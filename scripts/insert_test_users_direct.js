const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')

function loadEnv(){
  const envPath = path.join(__dirname, '..', '.env.local')
  if(!fs.existsSync(envPath)) return {}
  const raw = fs.readFileSync(envPath,'utf8')
  const obj = {}
  for(const line of raw.split(/\n/)){
    const m = line.match(/^(\w+)=(?:"([^"]*)"|'([^']*)'|(.*))?$/)
    if(m){ obj[m[1]] = m[2]||m[3]||m[4]||'' }
  }
  return obj
}

(async ()=>{
  const env = loadEnv()
  const uri = env.MONGODB_URI
  if(!uri){ console.error('MONGODB_URI missing in .env.local'); process.exit(1) }
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  await client.connect()
  const db = client.db()
  const now = new Date()
  const users = [
    { id: 'test-user-A', name: 'User A', email: 'usera@example.com', userType: 'event', organization: 'TestOrg', createdAt: now, updatedAt: now, isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } } },
    { id: 'test-user-B', name: 'User B', email: 'userb@example.com', userType: 'student', organization: 'TestOrg', createdAt: now, updatedAt: now, isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } } },
    { id: 'test-user-C', name: 'User C', email: 'userc@example.com', userType: 'student', organization: 'TestOrg', createdAt: now, updatedAt: now, isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: false } } },
  ]

  for(const u of users){
    await db.collection('users').updateOne({ id: u.id }, { $set: u }, { upsert: true })
    const saved = await db.collection('users').findOne({ id: u.id })
    console.log('upserted', saved?._id || saved?.id || u.id)
  }

  await client.close()
  process.exit(0)
})().catch(e=>{ console.error(e); process.exit(1) })
