import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export const dynamic = 'force-dynamic'

function toStringId(v: any): string | null { try { return v != null ? String(v) : null } catch { return null } }

export async function GET(req: NextRequest) {
  try {
    const db = await getDatabase()
    const { searchParams } = new URL(req.url)
    const listingId = searchParams.get('listingId') || ''
    const userId = searchParams.get('userId') || ''
    const userEmail = searchParams.get('userEmail') || ''
    const reservationId = searchParams.get('reservationId') || ''
    if (!listingId) return NextResponse.json({ messages: [] })
    // Optional: enforce access if userId provided
    if (userId || userEmail) {
      const orFilters: any[] = [{ id: listingId }]
      if (ObjectId.isValid(listingId)) orFilters.push({ _id: new ObjectId(listingId) })
      const listing: any = await db.collection('foodListings').findOne({ $or: orFilters })
      const ownerId = toStringId(listing?.createdBy || listing?.providerId || listing?.donorId)
      const reserverId = toStringId(listing?.reservedBy || listing?.reservedById)
      const ownerEmail = toStringId(listing?.createdByEmail || listing?.email)
      const reserverEmail = toStringId(listing?.reservedByEmail)

      // If reservationId provided, authorize against that reservation participant
      if (reservationId && Array.isArray(listing?.reservations)) {
        const r = (listing.reservations as any[]).find((x: any) => String(x.id) === String(reservationId))
        const rBy = toStringId(r?.by || r?.userId)
        const rEmail = toStringId(r?.byEmail || r?.userEmail)
        const okById2 = userId && (String(userId) === String(ownerId) || String(userId) === String(rBy))
        const okByEmail2 = userEmail && ((ownerEmail && String(userEmail) === String(ownerEmail)) || (rEmail && String(userEmail) === String(rEmail)))
        if (!r || (!okById2 && !okByEmail2)) return NextResponse.json({ messages: [] })
      } else {
        const okById = userId && (String(userId) === String(ownerId) || String(userId) === String(reserverId))
        const okByEmail = userEmail && ((ownerEmail && String(userEmail) === String(ownerEmail)) || (reserverEmail && String(userEmail) === String(reserverEmail)))
        // If listing-level chat, require a single reserver or owner match
        if (!okById && !okByEmail) return NextResponse.json({ messages: [] })
      }
    }
    const query: any = { listingId }
    if (reservationId) {
      query.$or = [
        { reservationId: reservationId },
        { reservationId: null },
        { reservationId: { $exists: false } },
      ]
    }
    const messages = await db
      .collection('chats')
      .find(query)
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray()
    return NextResponse.json({ messages })
  } catch (e) {
    return NextResponse.json({ messages: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDatabase()
    const body = await req.json()
    const { listingId, reservationId, userId, userName, userEmail, text } = body || {}
    if (!listingId || !userId || !text) return NextResponse.json({ message: 'Bad Request' }, { status: 400 })
    // enforce lister <-> reserver only
    const orFilters: any[] = [{ id: listingId }]
    if (ObjectId.isValid(listingId)) orFilters.push({ _id: new ObjectId(listingId) })
    const listing: any = await db.collection('foodListings').findOne({ $or: orFilters })
    const ownerId = toStringId(listing?.createdBy || listing?.providerId || listing?.donorId)
    const reserverId = toStringId(listing?.reservedBy || listing?.reservedById)
    const ownerEmail = toStringId(listing?.createdByEmail || listing?.email)
    const reserverEmail = toStringId(listing?.reservedByEmail)
    let ok = false
    if (reservationId && Array.isArray(listing?.reservations)) {
      const r = (listing.reservations as any[]).find((x: any) => String(x.id) === String(reservationId))
      const rBy = toStringId(r?.by || r?.userId)
      const rEmail = toStringId(r?.byEmail || r?.userEmail)
      ok = !!r && (String(userId) === String(ownerId) || String(userId) === String(rBy) || (userEmail && ((ownerEmail && String(userEmail) === String(ownerEmail)) || (rEmail && String(userEmail) === String(rEmail)))))
    } else {
      const okById = String(userId) === String(ownerId) || String(userId) === String(reserverId)
      const okByEmail = userEmail && ((ownerEmail && String(userEmail) === String(ownerEmail)) || (reserverEmail && String(userEmail) === String(reserverEmail)))
      ok = !!(okById || okByEmail)
    }
    if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    const msg = {
      id: Date.now().toString(),
      listingId,
      reservationId: reservationId || null,
      userId,
      userName: userName || 'User',
      text: String(text).slice(0, 1000),
      createdAt: new Date().toISOString(),
    }
    await db.collection('chats').insertOne(msg as any)
    // create in-app notification for the other participant (no email)
    try {
      let recipientId: string | null = null
      if (reservationId && Array.isArray(listing?.reservations)) {
        const r = (listing.reservations as any[]).find((x: any) => String(x.id) === String(reservationId))
        const rBy = toStringId(r?.by || r?.userId)
        recipientId = String(userId) === String(ownerId) ? rBy : ownerId
      } else {
        recipientId = String(userId) === String(ownerId) ? reserverId : ownerId
      }
      // Fallback: resolve recipient by email if recipientId is missing but emails exist
      if (!recipientId) {
        const ownerEmail = toStringId(listing?.createdByEmail || listing?.email)
        const reserverEmail = reservationId && Array.isArray(listing?.reservations)
          ? toStringId(((listing.reservations as any[]).find((x: any) => String(x.id) === String(reservationId)) as any)?.byEmail)
          : toStringId(listing?.reservedByEmail)
        const senderEmail = toStringId((body as any)?.userEmail)
        let targetEmail = null as string | null
        if (senderEmail && ownerEmail && senderEmail === ownerEmail) targetEmail = reserverEmail
        else if (senderEmail && reserverEmail && senderEmail === reserverEmail) targetEmail = ownerEmail
        if (targetEmail) {
          const target = await db.collection('users').findOne({ email: targetEmail })
          if (target) recipientId = toStringId((target as any)._id) || toStringId((target as any).id)
        }
      }
  if (recipientId) {
        const notif = {
          id: `${Date.now().toString()}-${recipientId}`,
          userId: recipientId,
          type: 'chat_message',
          title: `New message on ${listing?.title || 'listing'}`,
          message: `${msg.userName}: ${msg.text.slice(0, 120)}`,
          read: false,
          createdAt: msg.createdAt,
          priority: 'low',
          actionUrl: '/dashboard/food-listings',
          metadata: { listingId, reservationId: reservationId || undefined },
        }
        await db.collection('notifications').insertOne(notif as any)
      }
    } catch {}
    return NextResponse.json({ message: 'ok', msg })
  } catch (e) {
    return NextResponse.json({ message: 'Server Error' }, { status: 500 })
  }
}
