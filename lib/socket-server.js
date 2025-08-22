// Plain JavaScript Socket.IO chat server with MongoDB persistence
const { createServer } = require('http')
const { Server } = require('socket.io')
const { MongoClient, ObjectId } = require('mongodb')

const PORT = Number(process.env.SOCKET_PORT || 4000)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodshare'

async function start() {
  const httpServer = createServer()
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db()
  const chats = db.collection('chats')
  try { await chats.createIndex({ listingId: 1, createdAt: 1 }) } catch {}
  const listings = db.collection('foodListings')
  const notifications = db.collection('notifications')

  const toStringId = (v) => { try { return v != null ? String(v) : null } catch { return null } }
  const resolveParticipants = async (listingId) => {
    const orFilters = [{ id: listingId }]
    if (ObjectId.isValid(listingId)) {
      try { orFilters.push({ _id: new ObjectId(listingId) }) } catch {}
    }
    const l = await listings.findOne({ $or: orFilters })
    if (!l) return { listing: null }
    const ownerId = toStringId(l.createdBy || l.providerId || l.donorId || l.ownerId)
    const reserverId = toStringId(l.reservedBy || l.reservedById)
    return { listing: l, ownerId, reserverId }
  }

  io.on('connection', (socket) => {
    socket.on('chat:join', async ({ listingId, user }) => {
      try {
        if (!listingId || !user || !user.id) return
        const { listing, ownerId, reserverId } = await resolveParticipants(listingId)
        if (!listing || !reserverId) return socket.emit('chat:error', 'Chat available only after reservation')
        const uid = toStringId(user.id)
        if (uid !== ownerId && uid !== reserverId) return socket.emit('chat:error', 'Not authorized for this chat')
        socket.join(`listing:${listingId}`)
        const history = await chats
          .find({ listingId })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
        socket.emit('chat:history', history.reverse())
      } catch (e) {
        socket.emit('chat:error', 'Failed to load messages')
      }
    })

    socket.on('chat:leave', ({ listingId }) => {
      if (listingId) socket.leave(`listing:${listingId}`)
    })

    socket.on('chat:message', async (payload) => {
      try {
        if (!payload || !payload.listingId || !payload.userId || !payload.text) return
        const { listing, ownerId, reserverId } = await resolveParticipants(payload.listingId)
        if (!listing || !reserverId) return socket.emit('chat:error', 'Chat available only after reservation')
        const senderId = toStringId(payload.userId)
        if (senderId !== ownerId && senderId !== reserverId) return socket.emit('chat:error', 'Not authorized for this chat')
        const now = new Date().toISOString()
        const msg = { ...payload, id: new ObjectId().toString(), createdAt: now }
        await chats.insertOne({ ...msg })
        io.to(`listing:${payload.listingId}`).emit('chat:message', msg)

        // In-app notification for the other participant (no email)
        try {
          const recipientId = senderId === ownerId ? reserverId : ownerId
          if (recipientId) {
            const notif = {
              id: `${Date.now()}-${recipientId}`,
              userId: recipientId,
              type: 'chat_message',
              title: `New message on ${listing.title || 'listing'}`,
              message: `${payload.userName || 'User'}: ${String(payload.text).slice(0, 120)}`,
              read: false,
              createdAt: now,
              priority: 'low',
              actionUrl: '/dashboard/food-listings',
              metadata: { listingId: toStringId(listing._id) || listing.id }
            }
            await notifications.insertOne(notif)
          }
        } catch {}
      } catch (e) {
        socket.emit('chat:error', 'Failed to send message')
      }
    })
  })

  httpServer.listen(PORT, () => {
    console.log(`[socket] Listening on :${PORT}`)
  })
}

if (require.main === module) {
  start().catch((e) => {
    console.error('Socket server failed to start', e)
    process.exit(1)
  })
}

module.exports = {}
