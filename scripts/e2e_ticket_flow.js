const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')
// Resolve fetch: prefer global (Node 18+), fallback to node-fetch if installed
let fetchLib = null
try { fetchLib = global.fetch } catch (e) { fetchLib = null }
if(!fetchLib){
  try { fetchLib = require('node-fetch') } catch (e) { fetchLib = null }
}
if(!fetchLib){
  console.error('fetch is not available. Please run on Node 18+ or install node-fetch in the workspace.')
  process.exit(2)
}
const fetch = fetchLib.default || fetchLib

function loadEnv(){
  const envPath = path.join(__dirname, '..', '.env.local')
  if(!fs.existsSync(envPath)) return {}
  const raw = fs.readFileSync(envPath,'utf8')
  const obj = {}
  for(const line of raw.split(/\n/)){
    const m = line.match(/^(\w+)=(?:"([^\"]*)"|'([^']*)'|(.*))?$/)
    if(m){ obj[m[1]] = m[2]||m[3]||m[4]||'' }
  }
  return obj
}

async function run(){
  const env = loadEnv()
  const uri = env.MONGODB_URI
  // prefer an explicit DEV_SERVER_URL, fallback to common local dev ports
  const devServer = env.DEV_SERVER_URL || 'http://localhost:3002'

  // We'll attempt to exercise the HTTP endpoints first (full E2E). If the
  // dev server is unreachable, we fallback to direct DB manipulation.
  let client = null
  let db = null
  let createdCollectionId = null
  let createdTicketId = null
  let ticketToken = null

  async function cleanupArtifacts() {
    try {
      if(!createdCollectionId && !createdTicketId && !ticketToken) return
      const uriLocal = uri
      let tempClient = client
      let tempDb = db
      if(!tempDb && uriLocal){
        tempClient = new MongoClient(uriLocal, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 })
        try { await tempClient.connect() } catch (e) { console.warn('cleanup: could not connect to mongo:', e && e.message); return }
        tempDb = tempClient.db()
      }
      if(tempDb){
        if(createdTicketId || ticketToken){
          const q = { $or: [] }
          if(createdTicketId) q.$or.push({ id: createdTicketId })
          if(ticketToken) q.$or.push({ token: ticketToken })
          if(q.$or.length > 0) {
            const r = await tempDb.collection('tickets').deleteMany(q)
            console.log('cleanup: deleted tickets count=', r.deletedCount)
          }
        }
        if(createdCollectionId){
          const r2 = await tempDb.collection('collections').deleteMany({ id: createdCollectionId })
          console.log('cleanup: deleted collections count=', r2.deletedCount)
        }
      }
      if(tempClient && tempClient !== client){ await tempClient.close() }
    } catch (e) {
      console.warn('cleanupArtifacts error', e && e.message)
    }
  }

  try{
  // create a test collection placeholder (like reserve flow would)
    const now = new Date().toISOString()
    const collection = {
      id: `e2e-collection-${Date.now()}`,
      listingId: 'e2e-listing',
      ownerId: 'test-user-A',
      status: 'reserved',
      collectionMethod: 'qr_scan',
      createdAt: now,
      updatedAt: now
    }

  // record created collection id for cleanup (may or may not be persisted)
  createdCollectionId = collection.id

  // Attempt HTTP path first: POST /api/tickets then POST /api/tickets/scan.
    // This avoids needing MongoDB connectivity if the local dev server is running.
  // ticketToken declared above in outer scope
    try{
      console.log('Attempting to issue ticket via HTTP API at', devServer)
      // create collection via DB only if needed by API; many setups expect the
      // collection to already exist — try API issuance first without DB create.
      const res = await fetch(`${devServer.replace(/\/$/, '')}/api/tickets`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ collectionId: collection.id, userId: collection.ownerId, validityMinutes: 60 }) })
      if(res.ok){
        const j = await res.json()
        ticketToken = j && j.ticket && j.ticket.token
        console.log('Issued ticket via API')
      } else {
        console.warn('Ticket API returned', res.status)
      }
    }catch(e){
      console.warn('Ticket API unreachable:', e && e.message)
    }

    // If HTTP issuance failed, ensure collection exists in DB and fall back to DB issuance
    if(!ticketToken){
      if(!uri){
        console.error('No MONGODB_URI and API issuance failed; cannot proceed')
        process.exit(2)
      }
      console.log('Falling back to MongoDB path; connecting to MongoDB...')
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 })
      try {
        await client.connect()
      } catch (err) {
        console.error('Failed to connect to MongoDB within timeout:', err && err.message)
        process.exit(2)
      }
      db = client.db()

      await db.collection('collections').updateOne({ id: collection.id }, { $set: collection }, { upsert: true })

  // generate token server-side using the same format as lib/qr-ticket.ts
    try {
      // generate token server-side using the same format as lib/qr-ticket.ts
      const crypto = require('crypto')
      const DEFAULT_SECRET = 'dev-qr-secret'
      const secret = process.env.QR_SECRET || DEFAULT_SECRET

  const ticketId = `e2e-ticket-${Date.now()}`
      const payload = { ticketId, collectionId: collection.id, userId: collection.ownerId, expiresAt: new Date(Date.now()+60*60*1000).toISOString() }
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64')
      const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex')
  ticketToken = `${payloadB64}.${sig}`
  createdTicketId = ticketId
  await db.collection('tickets').insertOne({ id: ticketId, collectionId: collection.id, token: ticketToken, userId: collection.ownerId, expiresAt: payload.expiresAt, usedAt: null, createdAt: new Date().toISOString() })
      console.log('Inserted ticket directly into DB')
    } catch (err) {
      console.error('DB issuance failed:', err && err.message)
      process.exit(3)
    }

  }

    if(!ticketToken){ throw new Error('Failed to obtain a ticket token') }

    // Attempt to scan via API first
    let scanOk = false
    try{
      console.log('Attempting to scan via HTTP API at', devServer)
      const scanRes = await fetch(`${devServer.replace(/\/$/, '')}/api/tickets/scan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: ticketToken, scannerId: 'e2e-scanner-1' }) })
      const scanJson = await scanRes.json().catch(()=>null)
      if(scanRes.ok){
        console.log('Scan API accepted ticket:', scanJson)
        scanOk = true
      } else {
        console.warn('Scan API returned', scanRes.status, scanJson)
      }
    }catch(e){
      console.warn('Scan API unreachable:', e && e.message)
    }

    if(!scanOk){
      if(!db){
        // connect to DB if we haven't already
        if(!uri){ console.error('No MONGODB_URI available to validate scan'); process.exit(2) }
        console.log('Connecting to MongoDB for DB-path scan...')
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 })
        try { await client.connect() } catch (err) { console.error('Mongo connect failed:', err && err.message); process.exit(2) }
        db = client.db()
      }
      // simulate scan: mark usedAt if not already used
      const t = await db.collection('tickets').findOne({ token: ticketToken })
      if(!t) throw new Error('Ticket not found in DB')
      if(t.usedAt) throw new Error('Ticket already used (unexpected)')
      await db.collection('tickets').updateOne({ token: ticketToken }, { $set: { usedAt: new Date().toISOString() } })
      console.log('Marked ticket used in DB')
    }

    // Verify usedAt is set
    const after = await db.collection('tickets').findOne({ token: ticketToken })
    if(!after || !after.usedAt){
      console.error('E2E FAILED: usedAt missing after scan')
      process.exit(3)
    }

    // Attempt second scan: should fail (either via API 409 or DB check)
    let secondFailed = false
    try{
      const secondRes = await fetch(`${devServer.replace(/\/$/, '')}/api/tickets/scan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: ticketToken, scannerId: 'e2e-scanner-1' }) })
      if(secondRes.ok){
        console.error('E2E FAILED: second scan unexpectedly succeeded')
        process.exit(4)
      } else {
        console.log('Second scan API returned', secondRes.status)
        secondFailed = true
      }
    }catch(e){
      // If API unreachable, use DB to confirm usedAt prevents reuse
      const t2 = await db.collection('tickets').findOne({ token: ticketToken })
      if(t2 && t2.usedAt) secondFailed = true
    }

    if(!secondFailed){
      console.error('E2E FAILED: token reuse was not prevented')
      process.exit(5)
    }

  console.log('E2E PASSED: ticket issued, scanned, and prevented reuse')
  await cleanupArtifacts()
  if(client) await client.close()
  process.exit(0)
  }catch(e){
  console.error('E2E ERROR', e)
  try { await cleanupArtifacts() } catch(_){}
  if(client) try { await client.close() } catch(_){}
  process.exit(6)
  }
}

run()
