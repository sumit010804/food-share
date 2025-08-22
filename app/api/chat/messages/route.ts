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
  const okById = userId && (String(userId) === String(ownerId) || String(userId) === String(reserverId))
  const okByEmail = userEmail && ((ownerEmail && String(userEmail) === String(ownerEmail)) || (reserverEmail && String(userEmail) === String(reserverEmail)))
      if (!reserverId || (!okById && !okByEmail)) {
        return NextResponse.json({ messages: [] })
      }
    }
    const messages = await db
      .collection('chats')
      .find({ listingId })
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
  const { listingId, userId, userName, userEmail, text } = body || {}
    if (!listingId || !userId || !text) return NextResponse.json({ message: 'Bad Request' }, { status: 400 })
    // enforce lister <-> reserver only
    const orFilters: any[] = [{ id: listingId }]
    if (ObjectId.isValid(listingId)) orFilters.push({ _id: new ObjectId(listingId) })
    const listing: any = await db.collection('foodListings').findOne({ $or: orFilters })
    const ownerId = toStringId(listing?.createdBy || listing?.providerId || listing?.donorId)
    const reserverId = toStringId(listing?.reservedBy || listing?.reservedById)
    const ownerEmail = toStringId(listing?.createdByEmail || listing?.email)
    const reserverEmail = toStringId(listing?.reservedByEmail)
    const okById = String(userId) === String(ownerId) || String(userId) === String(reserverId)
    const okByEmail = userEmail && ((ownerEmail && String(userEmail) === String(ownerEmail)) || (reserverEmail && String(userEmail) === String(reserverEmail)))
    if (!reserverId || (!okById && !okByEmail)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
    const msg = {
      id: Date.now().toString(),
      listingId,
      userId,
      userName: userName || 'User',
      text: String(text).slice(0, 1000),
      createdAt: new Date().toISOString(),
    }
    await db.collection('chats').insertOne(msg as any)
    // create in-app notification for the other participant (no email)
    try {
      let recipientId = String(userId) === String(ownerId) ? reserverId : ownerId
      // Fallback: resolve recipient by email if recipientId is missing but emails exist
      if (!recipientId) {
        const ownerEmail = toStringId(listing?.createdByEmail || listing?.email)
        const reserverEmail = toStringId(listing?.reservedByEmail)
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
          metadata: { listingId },
        }
        await db.collection('notifications').insertOne(notif as any)
      }
    } catch {}
    return NextResponse.json({ message: 'ok', msg })
  } catch (e) {
    return NextResponse.json({ message: 'Server Error' }, { status: 500 })
  }
}
