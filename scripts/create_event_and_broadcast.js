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

  // Create a synthetic event as organizer test-user-A
  const now = new Date()
  const KG_PER_SERVING = 0.25
  const data = {
    title: 'Test Event From Script',
    description: 'A test event to validate notification broadcasting',
    startTime: now.toISOString(),
    endTime: new Date(now.getTime()+2*60*60*1000).toISOString(),
    location: 'Test Hall',
    organizer: 'User A',
    organizerId: 'test-user-A',
    expectedAttendees: 100,
    eventType: 'conference'
  }

  // compute expected surplus
  let expectedServings = Math.round(data.expectedAttendees * 0.08)
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
    foodPrediction: {
      expectedSurplus: expectedServings,
      expectedSurplusKg,
      confidence: 'high'
    },
    foodLogged: false,
    createdAt: new Date().toISOString()
  }

  const insertResult = await db.collection('events').insertOne(newEvent)
  const createdEvent = await db.collection('events').findOne({ _id: insertResult.insertedId })
  console.log('Inserted event id', insertResult.insertedId.toString())

  // Broadcast notifications per POST logic
  try{
    const users = await db.collection('users').find({}).project({ id:1, email:1, preferences:1 }).toArray()
    const recipients = users.filter(u => {
      if(!u) return false
      if(String(u.id) === String(createdEvent.organizerId)) return false
      // no organizerEmail here
      const wantsEvents = u.preferences && u.preferences.notifications && typeof u.preferences.notifications.eventReminders === 'boolean' ? u.preferences.notifications.eventReminders : true
      if(!wantsEvents) return false
      return true
    })

    console.log('Recipients count', recipients.length, recipients.map(r=>r.id))
    if(recipients.length>0){
      const baseId = Date.now().toString()
      const createdAt = new Date().toISOString()
      const docs = recipients.map((u) => ({
        id: `${baseId}-${u.id}`,
        userId: u.id,
        type: 'event_added',
        title: `New Event Added: ${createdEvent.title}`,
  message: `${createdEvent.organizer} has scheduled "${createdEvent.title}". Expected surplus food: ${expectedSurplusKg} kg.`,
        read: false,
        createdAt,
        priority: 'medium',
        actionUrl: '/dashboard/events',
        metadata: { eventId: String(createdEvent._id) }
      }))

      const r = await db.collection('notifications').insertMany(docs)
      console.log('Inserted notifications:', r.insertedCount)
    }
  }catch(e){ console.error('Broadcast failed', e) }

  // Query notifications for test-user-B and test-user-C
  const notifsB = await db.collection('notifications').find({ userId: 'test-user-B' }).toArray()
  const notifsC = await db.collection('notifications').find({ userId: 'test-user-C' }).toArray()
  console.log('User B notifications:', notifsB.length)
  console.log('User C notifications:', notifsC.length)

  await client.close()
  process.exit(0)
})().catch(e=>{ console.error(e); process.exit(1) })
