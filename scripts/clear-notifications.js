/*
  Purge notifications and pending_notifications collections.
  Usage:
    node -r dotenv/config scripts/clear-notifications.js
*/

const { MongoClient } = require('mongodb')

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('Missing MONGODB_URI in environment (.env)')
    process.exit(1)
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  try {
    await client.connect()
    const dbName = process.env.MONGODB_DB || 'foodshare'
    const db = client.db(dbName)
    const targets = ['notifications', 'pending_notifications']
    for (const name of targets) {
      const col = db.collection(name)
      const before = await col.countDocuments()
      const delRes = await col.deleteMany({})
      const after = await col.countDocuments()
      console.log(JSON.stringify({ collection: name, before, deleted: delRes.deletedCount, after }))
    }
  } catch (e) {
    console.error('Error clearing notifications:', e?.message || e)
    process.exitCode = 1
  } finally {
    await client.close().catch(() => {})
  }
}

main()
