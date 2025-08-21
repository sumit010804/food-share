import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { generateTicketToken } from '@/lib/qr-ticket'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()
    const body = await request.json()
    const { collectionId, userId, validityMinutes = 60 } = body
    if (!collectionId) return NextResponse.json({ message: 'Missing collectionId' }, { status: 400 })

    // Ensure collection exists. First, try matching by explicit collection id or _id.
    const collections = db.collection('collections')
    const q: any[] = [{ id: collectionId }]
    if (/^[0-9a-fA-F]{24}$/.test(String(collectionId))) {
      try { q.push({ _id: new ObjectId(String(collectionId)) }) } catch(e){}
    }
    let collection = await collections.findOne({ $or: q })

    // Fallback: the client may have provided a listingId instead of a collection id.
    // Try to find a collection document that references this listingId or also uses
    // the listing id as its own id (older docs might).
    if (!collection) {
      try {
        const alt = await collections.find({ $or: [ { listingId: collectionId }, { id: collectionId } ] })
          .sort({ updatedAt: -1, reservedAt: -1, createdAt: -1 })
          .limit(1)
          .toArray()
        if (alt && alt.length) collection = alt[0]
      } catch (e) {
        // ignore and continue
      }
    }

    if (!collection) return NextResponse.json({ message: 'Collection not found' }, { status: 404 })

    const ticketId = `tkt-${Date.now().toString()}-${collection.id || collection._id}`
    const expiresAt = new Date(Date.now() + Number(validityMinutes) * 60 * 1000).toISOString()
    const token = generateTicketToken(ticketId, collection.id || String(collection._id), userId || null, expiresAt)

    // Persist ticket record
    const ticketsCol = db.collection('tickets')
    const ticketDoc = {
      id: ticketId,
      collectionId: collection.id || String(collection._id),
      token,
      userId: userId || null,
      expiresAt: new Date(expiresAt),
      usedAt: null,
      createdAt: new Date(),
    }
    await ticketsCol.insertOne(ticketDoc)

    return NextResponse.json({ message: 'Ticket issued', ticket: { id: ticketId, token, expiresAt } })
  } catch (e) {
    console.error('Ticket issuance error', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase()
    const url = new URL(request.url)
    const collectionId = url.searchParams.get('collectionId')
    const ticketId = url.searchParams.get('ticketId')
    const userId = url.searchParams.get('userId')

    const ticketsCol = db.collection('tickets')
    let query: any = {}
    if (ticketId) query.id = ticketId
    if (userId) query.userId = userId

    // If no filters were provided, return recent tickets
    if (!collectionId && !ticketId && !userId) {
      const t = await ticketsCol.find({}).sort({ createdAt: -1 }).limit(20).toArray()
      const mapped = t.map((x: any) => ({ id: x.id, collectionId: x.collectionId, expiresAt: x.expiresAt, usedAt: x.usedAt }))
      return NextResponse.json({ tickets: mapped })
    }

    // If collectionId provided, try direct match first. If none found, try resolving collection docs
    if (collectionId) {
      const direct = await ticketsCol.find({ collectionId }).sort({ createdAt: -1 }).limit(1).toArray()
      if (direct && direct.length) {
        const tk = direct[0]
        return NextResponse.json({ tickets: [{ id: tk.id, collectionId: tk.collectionId, token: tk.token, expiresAt: tk.expiresAt, usedAt: tk.usedAt }] })
      }

      // Fallback: maybe the caller passed a listingId (the listing's id) rather than the collection.id.
      // Find collections that reference this listingId and query their tickets.
      try {
        const collectionsCol = db.collection('collections')
        const matchFilters: any[] = [{ listingId: collectionId }, { id: collectionId }]
        if (/^[0-9a-fA-F]{24}$/.test(String(collectionId))) {
          try { matchFilters.push({ _id: new ObjectId(String(collectionId)) }) } catch (e) {}
        }
        const cols = await collectionsCol.find({ $or: matchFilters }).toArray()
        if (cols && cols.length) {
          const colIds = cols.map((c: any) => c.id || (c._id && String(c._id))).filter(Boolean)
          if (colIds.length) {
            const t = await ticketsCol.find({ collectionId: { $in: colIds } }).sort({ createdAt: -1 }).limit(1).toArray()
            if (t && t.length) {
              const tk = t[0]
              return NextResponse.json({ tickets: [{ id: tk.id, collectionId: tk.collectionId, token: tk.token, expiresAt: tk.expiresAt, usedAt: tk.usedAt }] })
            }
          }
        }
      } catch (e) {
        console.warn('Tickets GET: fallback collection lookup failed', e)
      }

      return NextResponse.json({ tickets: [] })
    }

    // For other queries (ticketId/userId) fall back to simple query
    if (Object.keys(query).length > 0) {
      const t = await ticketsCol.find(query).sort({ createdAt: -1 }).limit(1).toArray()
      if (!t || t.length === 0) return NextResponse.json({ tickets: [] })
      const tk = t[0]
      return NextResponse.json({ tickets: [{ id: tk.id, collectionId: tk.collectionId, token: tk.token, expiresAt: tk.expiresAt, usedAt: tk.usedAt }] })
    }

    return NextResponse.json({ tickets: [] })
  } catch (e) {
    console.error('Ticket GET error', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
