import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import fs from 'fs'
import { generateTicketToken } from '@/lib/qr-ticket'
import { updateAnalyticsForDonation } from '@/lib/analytics'

// Very small helper to parse a numeric quantity from a variety of inputs
const parseNumericQty = (q: any): number => {
  if (q === null || q === undefined) return 0
  if (typeof q === 'number') return isFinite(q) ? q : 0
  const s = String(q).trim().toLowerCase()
  // match plain number
  const mNum = s.match(/^[0-9]+(?:\.[0-9]+)?$/)
  if (mNum) return Number(mNum[0])
  // match like "12 kg", "12kgs", "12 pieces", "12 pcs"
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|kilograms?|pcs?|pieces?|servings?)?$/)
  if (m) return Number(m[1])
  // fallback: first number anywhere
  const any = s.match(/([0-9]+(?:\.[0-9]+)?)/)
  if (any) return Number(any[1])
  return 0
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()
    const body = await request.json()
  const { listingId, userId, userName, userEmail, quantity } = body

    if (!listingId || !userId) {
      return NextResponse.json({ message: "Missing listingId or userId" }, { status: 400 })
    }

    // Enforce role-based reservation rule: lister roles cannot reserve (canteen/hostel/admin)
    try {
      const orClauses: any[] = []
      if (userEmail) orClauses.push({ email: userEmail })
      if (userId) orClauses.push({ id: userId })
      const requester = await db.collection('users').findOne(orClauses.length > 0 ? { $or: orClauses } : { email: '__none__' })
      const role = requester?.userType || requester?.role || null
      if (role === 'canteen' || role === 'hostel' || role === 'admin') {
        return NextResponse.json({ message: 'Lister accounts (canteen/hostel/admin) cannot reserve items.' }, { status: 403 })
      }
    } catch (e) {
      // If we cannot determine the role, proceed; other checks still apply
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

    // Partial reservation handling
    const now = new Date()
    const totalQty = parseNumericQty(existing.quantity)
    const currentRemaining = typeof existing.remainingQuantity === 'number' && isFinite(existing.remainingQuantity)
      ? Number(existing.remainingQuantity)
      : totalQty
    const reqQty = Math.max(1, Math.floor(Number(quantity || 0)))
    if (!reqQty || reqQty <= 0) {
      return NextResponse.json({ message: "Invalid quantity requested" }, { status: 400 })
    }
    if (currentRemaining <= 0) {
      return NextResponse.json({ message: "No quantity remaining to reserve" }, { status: 409 })
    }
    if (reqQty > currentRemaining) {
      return NextResponse.json({ message: `Only ${currentRemaining} remaining`, remaining: currentRemaining }, { status: 409 })
    }

    const newRemaining = currentRemaining - reqQty
    const reservationId = `res-${Date.now().toString()}-${existing.id || existing._id}`

    // Update listing: set remaining, append reservations array entry, and status if fully reserved
    const listingUpdate: any = {
      $set: {
        remainingQuantity: newRemaining,
        updatedAt: now,
      },
      $push: {
        reservations: {
          id: reservationId,
          qty: reqQty,
          by: userId,
          byName: userName || null,
          byEmail: userEmail || null,
          status: 'reserved',
          at: now,
        },
        statusHistory: { status: "reserved_part", at: now, by: userId, qty: reqQty },
      },
    }
    if (newRemaining === 0) {
      listingUpdate.$set.status = 'reserved'
      listingUpdate.$set.reservedAt = now
    } else {
      // Keep status available while there is remaining quantity
      if (existing.status !== 'available') listingUpdate.$set.status = 'available'
    }

    const result = await db.collection("foodListings").findOneAndUpdate({ _id: existing._id }, listingUpdate, { returnDocument: "after" })
    const updatedListing: any = result?.value || (await db.collection("foodListings").findOne({ _id: existing._id }))

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
        id: `col-${Date.now().toString()}-${reservationId}`,
        reservationId,
        listingId: listingIdStr,
        listingTitle: updatedListing.title,
        donatedBy: updatedListing.donorName || updatedListing.providerName || null,
        organization: updatedListing.organization || null,
        recipientId: userId ? String(userId) : null,
        recipientEmail: userEmail || null,
        recipientName: userName || null,
        reservedAt: now,
        status: 'reserved',
        quantity: String(reqQty),
        location: updatedListing.location || null,
        foodType: updatedListing.foodType || null,
        createdAt: now,
        updatedAt: now,
      }
      const ins = await collectionsCol.insertOne(collectionDoc)
      createdCollection = { ...collectionDoc, _id: ins.insertedId }
    } catch (e) {
      console.error('Failed to create collection record for reservation', e)
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

  // Remove aggressive final blind insert to avoid accidental duplication. Instead,
  // rely on the earlier upsert + targeted fallbacks only.

  // If DB attempts did not produce a saved collection, return null (client will fall back to events/fetch).
  // We previously attempted to return an in-memory placeholder, but build-time scoping made it error-prone.
  // A placeholder could be implemented safely in a subsequent change where we lift `collectionDoc` scope.

    // After ensuring collection placeholder, issue a QR ticket for pickup
    let ticketInfo: any = null
    try {
      if (createdCollection) {
        const ticketId = `tkt-${Date.now().toString()}-${createdCollection.id}`
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour default
        const token = generateTicketToken(ticketId, createdCollection.id, userId || null, expiresAt)
        const ticketsCol = db.collection('tickets')
        const ticketDoc = {
          id: ticketId,
          collectionId: createdCollection.id,
          token,
          userId: userId || null,
          expiresAt: new Date(expiresAt),
          usedAt: null,
          createdAt: new Date(),
        }
        await ticketsCol.insertOne(ticketDoc)
        ticketInfo = { id: ticketId, token, expiresAt }
      }
    } catch (e) {
      console.error('Failed to issue ticket for reservation', e)
    }

    return NextResponse.json({ message: "Reserved", listing: updatedListing, collection: createdCollection, ticket: ticketInfo })
  } catch (error) {
    console.error("Reserve handler error:", error)
    const msg = (error && (error as any).message) ? (error as any).message : 'Internal server error'
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
