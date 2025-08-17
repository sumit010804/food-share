import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

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
    if (!result || !result.value) {
      // either not found or not available anymore; fetch current doc to return status
      const current = await db.collection("foodListings").findOne({ _id: existing._id })
      return NextResponse.json({ message: "Listing not available to reserve", currentStatus: current?.status || null, reservedBy: current?.reservedBy || null, reservedByEmail: current?.reservedByEmail || null }, { status: 409 })
    }
    const updatedListing = result.value

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

    // Create a collection placeholder so the reserver can see the reserved item
    try {
      const collectionDoc = {
        id: `col-${Date.now().toString()}-${updatedListing.id || updatedListing._id}`,
        listingId: updatedListing.id || (updatedListing._id && String(updatedListing._id)),
        listingTitle: updatedListing.title,
        donatedBy: updatedListing.donorName || updatedListing.providerName || null,
        organization: updatedListing.organization || null,
        recipientId: userId,
        recipientEmail: userEmail || null,
        recipientName: userName || null,
        reservedAt: now,
        status: 'reserved',
        quantity: updatedListing.quantity || null,
        location: updatedListing.location || null,
        foodType: updatedListing.foodType || null,
      }
      await db.collection('collections').insertOne(collectionDoc)
    } catch (e) {
      console.error('Failed to create collection placeholder for reservation', e)
    }

    return NextResponse.json({ message: "Reserved", listing: updatedListing })
  } catch (error) {
    console.error("Reserve handler error:", error)
    const msg = (error && (error as any).message) ? (error as any).message : 'Internal server error'
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
