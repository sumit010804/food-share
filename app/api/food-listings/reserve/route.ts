import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import fs from 'fs'
import { updateAnalyticsForDonation } from '@/lib/analytics'

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()
    const body = await request.json()
  const { listingId, userId, userName, userEmail } = body

    if (!listingId || !userId) {
      return NextResponse.json({ message: "Missing listingId or userId" }, { status: 400 })
    }

    // Build a query that matches either custom `id` or Mongo _id
    const queries: any[] = [{ id: listingId }]
    if (/^[0-9a-fA-F]{24}$/.test(listingId)) {
      try { queries.push({ _id: new ObjectId(listingId) }) } catch (e) { /* ignore */ }
    }

  // We'll perform a findOne first to inspect the document and then
  // use its canonical _id for the atomic update. This avoids mismatches
  // between `id` and `_id` shapes in stored documents.
  const existing = await db.collection("foodListings").findOne({ $or: queries })
    if (!existing) {
      return NextResponse.json({ message: "Listing not found" }, { status: 404 })
    }

    // prefer email-based owner check if available; also derive ownerId for notifications
    const listerEmail = existing.createdByEmail || existing.email || null
    const ownerIdRaw = existing.providerId || existing.donorId || existing.createdBy || existing.donorIdString || null
    const ownerId = ownerIdRaw ? String(ownerIdRaw) : null
    if (listerEmail && userEmail && String(listerEmail) === String(userEmail)) {
      return NextResponse.json({ message: "Owner cannot reserve their own listing" }, { status: 403 })
    }

    // Atomically mark as reserved only if still available (use _id)
    const now = new Date()
    const update: any = {
      $set: {
        status: "reserved",
        reservedBy: userId,
        reservedByName: userName || null,
        reservedByEmail: userEmail || null,
        reservedAt: now,
        updatedAt: now,
      },
      $push: {
        statusHistory: { status: "reserved", at: now, by: userId }
      }
    }
    const result = await db.collection("foodListings").findOneAndUpdate({ _id: existing._id, status: "available" }, update, { returnDocument: "after" })
    let updatedListing: any = null
    if (!result || !result.value) {
      // either not found or not available anymore; fetch current doc to inspect status
      const current = await db.collection("foodListings").findOne({ _id: existing._id })
      // If the listing is now reserved by the same user who requested it, allow creation
      if (current && (current.reservedBy === userId || String(current.reservedBy) === String(userId))) {
        updatedListing = current
      } else {
        return NextResponse.json({ message: "Listing not available to reserve", currentStatus: current?.status || null, reservedBy: current?.reservedBy || null, reservedByEmail: current?.reservedByEmail || null }, { status: 409 })
      }
    } else {
      updatedListing = result.value
    }

    // Notify the lister (if any)
    try {
      const notify = {
        id: `${Date.now().toString()}-${updatedListing.id || updatedListing._id}`,
        userId: ownerId || null,
        type: "reserved",
        title: `Your listing was reserved: ${updatedListing.title}`,
        message: `${userName || 'Someone'} reserved your listing "${updatedListing.title}"`,
        read: false,
        createdAt: new Date().toISOString(),
        metadata: { foodListingId: updatedListing.id || updatedListing._id }
      }
      if (ownerId) await db.collection("notifications").insertOne(notify)
    } catch (e) {
      console.error("Failed to create reserve notification", e)
    }

    // Ensure a collection placeholder exists in MongoDB so the reserver sees it in Donation History.
    // Use an upsert (findOneAndUpdate with upsert) so this is robust to races and partial failures.
    let createdCollection: any = null
    // hoist collectionDoc so final fallback insert can reference it outside the try block
    let collectionDoc: any = null
    try {
      const collectionsCol = db.collection('collections')
      const listingIdStr = updatedListing.id || (updatedListing._id && String(updatedListing._id))
      collectionDoc = {
        id: `col-${Date.now().toString()}-${listingIdStr}`,
        listingId: listingIdStr,
        listingTitle: updatedListing.title,
        donatedBy: updatedListing.donorName || updatedListing.providerName || null,
        organization: updatedListing.organization || null,
        recipientId: userId ? String(userId) : null,
        recipientEmail: userEmail || null,
        recipientName: userName || null,
        reservedAt: now,
        status: 'reserved',
        quantity: updatedListing.quantity || null,
        location: updatedListing.location || null,
        foodType: updatedListing.foodType || null,
        createdAt: now,
        updatedAt: now,
      }

      // Build a tolerant filter so we match existing collections saved with different id shapes
      const matchFilters: any[] = [ { listingId: listingIdStr }, { id: listingIdStr } ]
      if (/^[0-9a-fA-F]{24}$/.test(listingIdStr)) {
        try {
          const oid = new ObjectId(listingIdStr)
          matchFilters.push({ listingId: oid })
          matchFilters.push({ _id: oid })
        } catch (e) {
          // ignore invalid ObjectId conversion
        }
      }

      // Try a single upsert that matches either string id or ObjectId forms. Handle driver return shapes.
      const upsertRes = await collectionsCol.findOneAndUpdate(
        { $or: matchFilters },
        { $setOnInsert: collectionDoc, $set: { updatedAt: now, status: 'reserved' } },
        { upsert: true, returnDocument: 'after' }
      )

  // (removed debug file logging)

      if (upsertRes && upsertRes.value) {
        try { fs.appendFileSync('data/reserve_debug.log', JSON.stringify({ ts: new Date().toISOString(), event: 'upsert_success', value: upsertRes.value }) + "\n") } catch(e){}
        createdCollection = upsertRes.value
      } else {
        try { console.error('reserve: upsertRes missing value', { upsertRes: (upsertRes as any) }) } catch(e){}
        // Debug: upsert returned no value (driver may not return doc). Log minimal info for investigation.
        try {
          console.error('reserve: upsert returned without value', { upserted: (upsertRes as any)?.lastErrorObject })
        } catch (e) { /* ignore logging errors */ }
        // Some Mongo drivers return lastErrorObject.upsertedId when upsert occurs but value is not returned.
        try {
          // Attempt to grab upserted id from result (defensive)
          const upsertedId = (upsertRes as any)?.lastErrorObject?.upserted?.[0]?._id || (upsertRes as any)?.lastErrorObject?.upsertedId
          if (upsertedId) {
            createdCollection = await collectionsCol.findOne({ _id: upsertedId })
          }
        } catch (e) {
          // ignore
        }

        // Final fallback: try a direct fetch by listingId or id; if missing, insert
        if (!createdCollection) {
          const fetched = await collectionsCol.findOne({ $or: [{ listingId: listingIdStr }, { id: listingIdStr }] })
          if (fetched) {
            createdCollection = fetched
          } else {
            try {
              const ins = await collectionsCol.insertOne(collectionDoc)
              createdCollection = await collectionsCol.findOne({ _id: ins.insertedId })
            } catch (insErr) {
              console.error('collections insert fallback failed', insErr)
              // As a last resort try a fetch again - may have been inserted by race
              const finalFetch = await collectionsCol.findOne({ $or: [{ listingId: listingIdStr }, { id: listingIdStr }] })
              try { console.error('reserve: finalFetch after insert failure', { finalFetch }) } catch(e){}
              try {
                const total = await collectionsCol.countDocuments()
                const samples = await collectionsCol.find({}).limit(5).toArray()
                console.error('reserve: collections stats after failure', { total, samplesCount: samples.length })
              } catch(e) { console.error('reserve: failed to fetch collections stats after failure', e) }
              if (finalFetch) createdCollection = finalFetch
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to ensure collection placeholder for reservation in DB', e)
    }

    // Normalize collection shape for client
    if (createdCollection) {
      const norm: any = { ...createdCollection }
      norm.id = createdCollection.id || (createdCollection._id && String(createdCollection._id))
      norm.listingId = createdCollection.listingId ? String(createdCollection.listingId) : norm.listingId || null
      norm.recipientId = createdCollection.recipientId ? String(createdCollection.recipientId) : null
      norm.recipientEmail = createdCollection.recipientEmail || null
      norm.recipientName = createdCollection.recipientName || null
      norm.reservedAt = createdCollection.reservedAt ? new Date(createdCollection.reservedAt).toISOString() : null
      norm.createdAt = createdCollection.createdAt ? new Date(createdCollection.createdAt).toISOString() : new Date().toISOString()
      norm.updatedAt = createdCollection.updatedAt ? new Date(createdCollection.updatedAt).toISOString() : norm.createdAt
      createdCollection = norm
    }

    // If a collection placeholder was created, increment analytics reserved counters
    try {
      if (createdCollection) {
        // We treat a reservation as an incremental collection event of type 'reserved'
        await updateAnalyticsForDonation(db, { ...createdCollection, impactMetrics: { foodKg: 0 } })
      }
    } catch (e) {
      console.error('Failed to update analytics on reserve', e)
    }


    // If previous upsert/insert attempts didn't produce a collection, try one final insert (defensive).
    if (!createdCollection) {
      try {
        const ins = await db.collection('collections').insertOne(collectionDoc)
        createdCollection = await db.collection('collections').findOne({ _id: ins.insertedId })
      } catch (e) {
        console.error('final insert for collection failed', e)
      }
    }

  // If DB attempts did not produce a saved collection, return null (client will fall back to events/fetch).
  // We previously attempted to return an in-memory placeholder, but build-time scoping made it error-prone.
  // A placeholder could be implemented safely in a subsequent change where we lift `collectionDoc` scope.

    return NextResponse.json({ message: "Reserved", listing: updatedListing, collection: createdCollection })
  } catch (error) {
    console.error("Reserve handler error:", error)
    const msg = (error && (error as any).message) ? (error as any).message : 'Internal server error'
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
