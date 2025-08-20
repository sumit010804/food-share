import crypto from 'crypto'

export interface TicketPayload {
  ticketId: string
  collectionId: string
  userId: string | null
  expiresAt: string // ISO
}

const DEFAULT_SECRET = 'dev-qr-secret'

function getSecret() {
  return process.env.QR_SECRET || DEFAULT_SECRET
}

function sign(payloadB64: string) {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex')
}

export function generateTicketToken(ticketId: string, collectionId: string, userId: string | null, expiresAtIso: string) {
  const payload: TicketPayload = { ticketId, collectionId, userId, expiresAt: expiresAtIso }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64')
  const sig = sign(payloadB64)
  return `${payloadB64}.${sig}`
}

export function verifyTicketToken(token: string): TicketPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [payloadB64, sig] = parts
    const expected = sign(payloadB64)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payloadJson = Buffer.from(payloadB64, 'base64').toString()
    const payload = JSON.parse(payloadJson) as TicketPayload
    return payload
  } catch (e) {
    return null
  }
}
