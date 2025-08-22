import { createServer } from "http"
import { Server } from "socket.io"
import { MongoClient, ObjectId } from "mongodb"
// Simple env-driven config
const PORT = Number(process.env.SOCKET_PORT || 4000)
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/foodshare"
type ChatMessage = {
	_id?: any
	id: string
	listingId: string
	userId: string
	userName: string
	text: string
	createdAt: string
}
async function start() {
	const httpServer = createServer()
	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET','POST'] },
	})

	// Mongo connection for persisting chat history
	const client = new MongoClient(MONGODB_URI)
	await client.connect()
	const db = client.db()
	const chats = db.collection<ChatMessage>('chats')
	await chats.createIndex({ listingId: 1, createdAt: 1 })

	io.on('connection', (socket) => {
		// join room by listing
		socket.on('chat:join', async ({ listingId, user }) => {
			try {
				if (!listingId) return
				socket.join(`listing:${listingId}`)
				// send last 50 messages
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

		socket.on('chat:message', async (payload: Omit<ChatMessage,'id'|'createdAt'>) => {
			try {
				const now = new Date().toISOString()
				const msg: ChatMessage = { ...payload, id: new ObjectId().toString(), createdAt: now }
				await chats.insertOne({ ...msg })
				io.to(`listing:${payload.listingId}`).emit('chat:message', msg)
			} catch (e) {
				socket.emit('chat:error', 'Failed to send message')
			}
		})
	})

	httpServer.listen(PORT, () => {
		console.log(`[socket] Listening on :${PORT}`)
	})
}

// Only run when invoked directly via ts-node or compiled node script
if (require.main === module) {
	start().catch((e) => {
		console.error('Socket server failed to start', e)
		process.exit(1)
	})
}

export {}
