const { getDatabase } = require('../lib/mongodb')
const { hashPassword } = require('../lib/auth')

async function run(){
  const db = await getDatabase()
  // Clear test users with email prefix test+
  await db.collection('users').deleteMany({ email: { $regex: '^test+' } })
  const users = [
    { name: 'User A', email: 'test+usera@example.local', password: await hashPassword('password'), userType: 'event', organization: 'TestOrg', createdAt: new Date(), updatedAt: new Date(), isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } } },
    { name: 'User B', email: 'test+userb@example.local', password: await hashPassword('password'), userType: 'student', organization: 'TestOrg', createdAt: new Date(), updatedAt: new Date(), isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } } },
    { name: 'User C', email: 'test+userc@example.local', password: await hashPassword('password'), userType: 'student', organization: 'TestOrg', createdAt: new Date(), updatedAt: new Date(), isActive: true, preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } } },
  ]

  const res = await db.collection('users').insertMany(users)
  console.log('Inserted', res.insertedCount)
  for (const k in res.insertedIds) console.log(k, res.insertedIds[k].toString())
  process.exit(0)
}

run().catch(e=>{console.error(e);process.exit(1)})
