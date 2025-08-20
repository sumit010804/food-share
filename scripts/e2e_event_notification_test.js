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

async function upsertTestUsers(db){
  const now = new Date()
  const users = [
    { id: 'test-user-A', name: 'User A', email: 'usera@example.com', userType: 'event', organization: 'TestOrg', createdAt: now, updatedAt: now, isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } } },
    { id: 'test-user-B', name: 'User B', email: 'userb@example.com', userType: 'student', organization: 'TestOrg', createdAt: now, updatedAt: now, isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } } },
    { id: 'test-user-C', name: 'User C', email: 'userc@example.com', userType: 'student', organization: 'TestOrg', createdAt: now, updatedAt: now, isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: false } } },
  ]

  for(const u of users){
    await db.collection('users').updateOne({ id: u.id }, { $set: u }, { upsert: true })
  }
}

async function clearTestArtifacts(db){
  // remove notifications for test users and events created by this e2e
  await db.collection('notifications').deleteMany({ userId: { $in: ['test-user-A','test-user-B','test-user-C'] } })
  await db.collection('events').deleteMany({ title: { $regex: '^E2E Test Event' } })
}

async function run(){
  const env = loadEnv()
  const uri = env.MONGODB_URI
  if(!uri){ console.error('MONGODB_URI missing'); process.exit(2) }
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  await client.connect()
  const db = client.db()

  try{
    await upsertTestUsers(db)
    await clearTestArtifacts(db)

    const now = new Date()
    const KG_PER_SERVING = 0.25
    const data = {
      title: `E2E Test Event ${Date.now()}`,
      description: 'E2E run',
      startTime: now.toISOString(),
      endTime: new Date(now.getTime()+2*60*60*1000).toISOString(),
      location: 'E2E Hall',
      organizer: 'User A',
      organizerId: 'test-user-A',
      expectedAttendees: 80,
      eventType: 'conference'
    }

    const expectedServings = Math.round(data.expectedAttendees * 0.08)
    const expectedSurplusKg = Math.round((expectedServings * KG_PER_SERVING) * 100) / 100

    const newEvent = {
      title: data.title,
      description: data.description,
      date: data.startTime,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      organizer: data.organizer,
      organizerId: data.organizerId,
      expectedAttendees: data.expectedAttendees,
      foodPrediction: { expectedSurplus: expectedServings, expectedSurplusKg, confidence: 'high' },
      foodLogged: false,
      createdAt: new Date().toISOString()
    }

    const insertResult = await db.collection('events').insertOne(newEvent)
    const createdEvent = await db.collection('events').findOne({ _id: insertResult.insertedId })
    if(!createdEvent){ throw new Error('Event insert failed') }

    // Broadcast notifications (mirror server logic)
    const users = await db.collection('users').find({}).project({ id:1, email:1, preferences:1 }).toArray()
    const recipients = users.filter(u => {
      if(!u) return false
      if(String(u.id) === String(createdEvent.organizerId)) return false
      const wantsEvents = u.preferences && u.preferences.notifications && typeof u.preferences.notifications.eventReminders === 'boolean' ? u.preferences.notifications.eventReminders : true
      if(!wantsEvents) return false
      return true
    })

    if(recipients.length > 0){
      const baseId = Date.now().toString()
      const createdAt = new Date().toISOString()
      const docs = recipients.map(u => ({ id: `${baseId}-${u.id}`, userId: u.id, type: 'event_added', title: `New Event Added: ${createdEvent.title}`, message: `${createdEvent.organizer} has scheduled "${createdEvent.title}". Expected surplus food: ${expectedSurplusKg} kg.`, read:false, createdAt, priority:'medium', actionUrl:'/dashboard/events', metadata:{ eventId: String(createdEvent._id) } }))
      await db.collection('notifications').insertMany(docs)
    }

    // Assertions
    const notifsA = await db.collection('notifications').find({ userId: 'test-user-A' }).toArray()
    const notifsB = await db.collection('notifications').find({ userId: 'test-user-B' }).toArray()
    const notifsC = await db.collection('notifications').find({ userId: 'test-user-C' }).toArray()

    console.log('counts -> A:', notifsA.length, 'B:', notifsB.length, 'C:', notifsC.length)

    const pass = notifsA.length === 0 && notifsB.length >= 1 && notifsC.length === 0
    if(pass){
      console.log('E2E PASSED')
      await client.close()
      process.exit(0)
    } else {
      console.error('E2E FAILED: unexpected notification counts')
      console.error({ a: notifsA.length, b: notifsB.length, c: notifsC.length })
      await client.close()
      process.exit(3)
    }
  }catch(e){
    console.error('E2E ERROR', e)
    await client.close()
    process.exit(4)
  }
}

run()
