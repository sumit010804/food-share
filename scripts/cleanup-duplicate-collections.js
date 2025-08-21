/*
  Cleanup duplicate documents in the `collections` collection.
  Strategy:
  - Group by normalized listingId (String(listingId))
  - Keep the most recently updated/collected/reserved document
  - Delete the rest (only when --apply is passed). Without --apply, runs in dry-run mode.

  Usage:
    node scripts/cleanup-duplicate-collections.js           # dry-run, prints what it would delete
    node scripts/cleanup-duplicate-collections.js --apply   # performs deletions
*/

const fs = require('fs')
const path = require('path')
const { MongoClient, ObjectId } = require('mongodb')

function loadEnv() {
  const candidates = ['.env.local', '.env']
  for (const fname of candidates) {
    const p = path.resolve(process.cwd(), fname)
    if (!fs.existsSync(p)) continue
    const txt = fs.readFileSync(p, 'utf8')
    txt.split(/\n/).forEach(line => {
      if (!line) return
      const s = line.trim()
      if (!s || s.startsWith('#')) return
      const i = s.indexOf('=')
      if (i <= 0) return
      const k = s.slice(0, i)
      let v = s.slice(i + 1)
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env[k] = v
    })
    break
  }
}

function ts(d) {
  if (!d) return 0
  try { return new Date(d).getTime() || 0 } catch { return 0 }
}

async function main() {
  const APPLY = process.argv.includes('--apply')
  loadEnv()
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not found in .env/.env.local')
    process.exit(2)
  }
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('foodshare')
    const col = db.collection('collections')
    const docs = await col.find({}).toArray()
    const buckets = new Map()
    for (const d of docs) {
      const key = String(d.listingId ?? d.id ?? d._id)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(d)
    }

    let dupGroups = 0
    let deleteCount = 0
    for (const [key, arr] of buckets) {
      if (arr.length <= 1) continue
      dupGroups++
      // Pick the best doc to keep (highest timestamp across updatedAt/collectedAt/reservedAt/createdAt)
      let best = arr[0]
      let bestTs = Math.max(ts(best.updatedAt), ts(best.collectedAt), ts(best.reservedAt), ts(best.createdAt))
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i]
        const t = Math.max(ts(d.updatedAt), ts(d.collectedAt), ts(d.reservedAt), ts(d.createdAt))
        if (t > bestTs) { best = d; bestTs = t }
      }
      const toDelete = arr.filter(d => d !== best)
      if (toDelete.length) {
        console.log(`listingId=${key} has ${arr.length} docs -> keeping _id=${best._id} id=${best.id} (ts=${new Date(bestTs).toISOString()})`) 
        for (const d of toDelete) {
          console.log('  delete _id=', String(d._id), ' id=', d.id)
          if (APPLY) {
            await col.deleteOne({ _id: d._id })
            deleteCount++
          }
        }
      }
    }

    console.log(`\nDuplicate groups: ${dupGroups}`)
    console.log(`Deleted: ${deleteCount} ${APPLY ? '(applied)' : '(dry-run)'}`)
  } catch (e) {
    console.error('Cleanup failed:', e)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

main()
