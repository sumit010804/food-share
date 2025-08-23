import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { CollectionRecord, DonationRecord } from "@/lib/types"
import { updateAnalyticsForDonation } from '@/lib/analytics'
import { ObjectId } from 'mongodb'

// Parse numeric quantity helper (same semantics as in reserve)
const parseNumericQty = (q: any): number => {
  if (q === null || q === undefined) return 0
  if (typeof q === 'number') return isFinite(q) ? q : 0
  const s = String(q).trim().toLowerCase()
  const mNum = s.match(/^[0-9]+(?:\.[0-9]+)?$/)
  if (mNum) return Number(mNum[0])
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|kilograms?|pcs?|pieces?|servings?)?$/)
  if (m) return Number(m[1])
  const any = s.match(/([0-9]+(?:\.[0-9]+)?)/)
  if (any) return Number(any[1])
  return 0
}

export async function POST(request: NextRequest) {
  try {
  const { listingId, collectionId, collectedBy, collectedAt, collectionMethod = "qr_scan" } = await request.json()

  const db = await getDatabase()
  const collectionsCol = db.collection('collections')
  const foodListingsCol = db.collection('foodListings')
  const donationsCol = db.collection('donations')
  const notificationsCol = db.collection('notifications')

  // Build robust match filters so we can find collections regardless of whether listingId was stored
  // as a string or an ObjectId in previous runs.
  const listingIdStr = String(listingId)
  const matchFilters: any[] = [{ listingId: listingIdStr }, { id: listingIdStr }]
  if (/^[0-9a-fA-F]{24}$/.test(listingIdStr)) {
    try {
      const oid = new ObjectId(listingIdStr)
      matchFilters.push({ listingId: oid })
      matchFilters.push({ _id: oid })
      matchFilters.push({ id: oid })
    } catch (e) {
      // ignore invalid ObjectId conversion
    }
  }

  // find collection either by provided collectionId or by listingId
  let existing = null as any
  if (collectionId) {
    const cIdStr = String(collectionId)
    const cFilters: any[] = [{ id: cIdStr }]
    if (/^[0-9a-fA-F]{24}$/.test(cIdStr)) {
      try { const coid = new ObjectId(cIdStr); cFilters.push({ _id: coid }) } catch {}
    }
    existing = await collectionsCol.findOne({ $or: cFilters })
  }
  if (!existing) {
    existing = await collectionsCol.findOne({ $or: matchFilters })
  }

      // If no collection doc exists yet, try to find the reserved food listing and create a collection from it
      if (!existing) {
        const listingQueries: any[] = [{ id: listingIdStr }]
        if (/^[0-9a-fA-F]{24}$/.test(listingIdStr)) {
          try { listingQueries.push({ _id: new ObjectId(listingIdStr) }) } catch (e) { /* ignore */ }
        }
        const listingDoc = await foodListingsCol.findOne({ $or: listingQueries })
        if (!listingDoc) {
          return NextResponse.json({ message: 'Collection not found' }, { status: 404 })
        }

        // Only allow collect if listing is reserved or available
        if (listingDoc.status === 'collected') {
          return NextResponse.json({ message: 'Item already collected' }, { status: 400 })
        }

        // Prepare collection document from listing for upsert
        const now = new Date()
        const collectionDoc = {
          id: `col-${Date.now().toString()}-${listingDoc.id || listingDoc._id}`,
          listingId: listingDoc.id || (listingDoc._id && String(listingDoc._id)),
          listingTitle: listingDoc.title,
          donatedBy: listingDoc.donorName || listingDoc.providerName || null,
          organization: listingDoc.organization || null,
          recipientId: listingDoc.reservedBy || null,
          recipientEmail: listingDoc.reservedByEmail || null,
          recipientName: listingDoc.reservedByName || null,
          reservedAt: listingDoc.reservedAt || listingDoc.updatedAt || now,
          status: 'reserved',
          quantity: listingDoc.quantity || null,
          location: listingDoc.location || null,
          foodType: listingDoc.foodType || null,
          createdAt: now,
          updatedAt: now,
        }

        // Upsert to avoid duplicate documents when prior runs stored listingId in a different type
        const upsertRes = await collectionsCol.findOneAndUpdate(
          { $or: matchFilters },
          { $setOnInsert: collectionDoc, $set: { updatedAt: now } },
          { upsert: true, returnDocument: 'after' }
        )
        existing = upsertRes?.value || (await collectionsCol.findOne({ $or: matchFilters }))
      }

      // Ensure we have a collection document
      if (!existing) {
        return NextResponse.json({ message: 'Collection lookup failed' }, { status: 500 })
      }

      // Update collection to collected
      await collectionsCol.updateOne(
        { _id: existing._id },
        { $set: { status: 'collected', collectedAt, collectedBy, collectionMethod, updatedAt: new Date() } }
      )

      // Update corresponding food listing remainingQuantity and status
      const lidStr = String(existing.listingId || listingId)
      const listingQueries2: any[] = [{ id: lidStr }]
      if (/^[0-9a-fA-F]{24}$/.test(lidStr)) {
        try { listingQueries2.push({ _id: new ObjectId(lidStr) }) } catch (e) { /* ignore */ }
      }
      const listingDoc = await foodListingsCol.findOne({ $or: listingQueries2 })
      if (listingDoc) {
        const totalQty = parseNumericQty(listingDoc.quantity)
        const prevRemaining = typeof listingDoc.remainingQuantity === 'number' ? Number(listingDoc.remainingQuantity) : Math.max(0, totalQty)
        const collQty = parseNumericQty(existing.quantity)
        const newRemaining = Math.max(0, prevRemaining - collQty)
        const setUpdate: any = { remainingQuantity: newRemaining, updatedAt: new Date() }
        if (newRemaining === 0) {
          setUpdate.status = 'collected'
          setUpdate.collectedAt = new Date()
          setUpdate.collectedBy = collectedBy
        } else {
          // Keep the listing discoverable for remaining portions
          setUpdate.status = 'available'
        }
        const updateOps: any = { $set: setUpdate }
        // If this collection record is tied to a specific reservation, mark that reservation as collected
        if (existing.reservationId) {
          updateOps.$set['reservations.$[r].status'] = 'collected'
        }
        await foodListingsCol.updateOne(
          { _id: listingDoc._id },
          updateOps,
          existing.reservationId ? { arrayFilters: [ { 'r.id': existing.reservationId } ] } as any : undefined
        )
      }

      // Determine weight/quantity for the donation. Prefer explicit fields if present.
  const candidates = [existing.quantity, existing.weight, existing.raw?.quantity, existing.listingQuantity, existing.listingQty]
      let foodKg = 0
      // Try to parse numeric values if present (very small heuristic parser)
      for (const c of candidates) {
        if (!c) continue
        try {
          const s = String(c).trim()
          // common formats: "5", "5 kg", "500 g"
          const mKg = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|kilograms?)$/i)
          const mG = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|grams?)$/i)
          const mNum = s.match(/^[0-9]+(?:\.[0-9]+)?$/)
          if (mKg) { foodKg = Number(mKg[1]); break }
          if (mG) { foodKg = Number(mG[1]) / 1000; break }
          if (mNum) { foodKg = Number(mNum[0]); break }
        } catch (e) { /* ignore parse */ }
      }

      // Fallback: if no quantity found, assume 2kg as a conservative default
      if (!foodKg) foodKg = 2

  // Impact multipliers: 1 kg => 2.5 kg CO2
  const CO2_PER_KG = 2.5
      const WATER_L_PER_KG = 500
      const KG_PER_PERSON = Number(process.env.KG_PER_PERSON || process.env.PEOPLE_KG_PER_PERSON || '0.5')

      const impactMetrics = {
        foodKg,
        co2Saved: Number((foodKg * CO2_PER_KG).toFixed(2)),
        waterSaved: Math.round(foodKg * WATER_L_PER_KG),
        // People fed is derived from minimum kg required per person; allow 0 if below threshold
        peopleFed: Math.max(0, Math.floor(foodKg / KG_PER_PERSON)),
      }

      // Insert a donation record including computed impact metrics
      const donationDoc: any = {
        id: `donation-${existing.listingId || listingId}-${Date.now()}`,
        donorId: existing.donorId || existing.donatedBy || null,
        donorName: existing.donatedBy || existing.donorName || null,
        recipientId: existing.recipientId || existing.recipientId || null,
        recipientName: existing.recipientName || collectedBy || null,
        listingId: existing.listingId || listingId,
        collectedAt,
        createdAt: new Date().toISOString(),
        status: 'collected',
        quantity: existing.quantity || null,
        weight: foodKg,
        impactMetrics,
      }
      const ins = await donationsCol.insertOne(donationDoc)

      // Update analytics incrementally for this donation using explicit impact metrics
      try {
        const savedDonation = { ...donationDoc, _id: ins.insertedId }
        await updateAnalyticsForDonation(db, savedDonation)
      } catch (e) {
        console.error('Failed to update analytics after donation insert', e)
      }

      // Create notifications
      try {
        const donorNotification = {
          id: `collection-${existing.listingId || listingId}-donor`,
          userId: existing.donorId || existing.donatedBy || null,
          type: 'item_collected',
          title: `Item Collected: ${existing.listingTitle || existing.foodTitle || ''}`,
          message: `Your item has been collected by ${collectedBy}`,
          read: false,
          createdAt: new Date().toISOString(),
          metadata: { listingId: existing.listingId || listingId, collectionMethod }
        }
        const collectorNotification = {
          id: `collection-${existing.listingId || listingId}-collector`,
          userId: existing.recipientId || null,
          type: 'collection_confirmed',
          title: `Collection Confirmed: ${existing.listingTitle || existing.foodTitle || ''}`,
          message: `You collected ${existing.listingTitle || existing.foodTitle || ''}`,
          read: false,
          createdAt: new Date().toISOString(),
          metadata: { listingId: existing.listingId || listingId, collectionMethod }
        }
        if (donorNotification.userId) {
          await notificationsCol.updateOne(
            { id: donorNotification.id },
            { $setOnInsert: donorNotification },
            { upsert: true },
          )
        }
        if (collectorNotification.userId) {
          await notificationsCol.updateOne(
            { id: collectorNotification.id },
            { $setOnInsert: collectorNotification },
            { upsert: true },
          )
        }
      } catch (e) {
        console.warn('Failed to create notifications for collect', e)
      }

      return NextResponse.json({ message: 'Item marked as collected successfully', collection: { ...existing, status: 'collected', collectedAt, collectedBy } })
  } catch (error) {
    console.error('Collection error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
  const db = await getDatabase()
  const collections = await db.collection('collections').find({}).toArray()
  // Normalize collections for client
  const normalized = collections.map((c: any) => ({
    id: c.id || (c._id && String(c._id)),
    listingId: c.listingId ? String(c.listingId) : null,
    listingTitle: c.listingTitle || c.foodTitle || null,
    donatedBy: c.donatedBy || c.donorName || null,
    organization: c.organization || null,
    recipientId: c.recipientId ? String(c.recipientId) : null,
    recipientEmail: c.recipientEmail || null,
    recipientName: c.recipientName || null,
    reservedAt: c.reservedAt ? new Date(c.reservedAt).toISOString() : null,
    collectedAt: c.collectedAt ? new Date(c.collectedAt).toISOString() : null,
    status: c.status || null,
    quantity: c.quantity || null,
    location: c.location || null,
    foodType: c.foodType || null,
    collectionMethod: c.collectionMethod || null,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
    raw: c,
  }))

  return NextResponse.json({ message: "Collections retrieved successfully", collections: normalized })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
