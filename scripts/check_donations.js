const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

async function main(){
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)){
    const env = fs.readFileSync(envPath,'utf8')
    env.split(/\n/).forEach(line=>{
      line = line.trim()
      if(!line || line.startsWith('#')) return
      const idx = line.indexOf('=')
      if (idx>0){
        const k = line.slice(0,idx)
        let v = line.slice(idx+1)
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1)
        process.env[k]=v
      }
    })
  }
  const uri = process.env.MONGODB_URI
  if(!uri){
    console.error('MONGODB_URI not found in .env.local')
    process.exit(2)
  }
  const client = new MongoClient(uri)
  try{
    await client.connect()
    const db = client.db('foodshare')
    const col = db.collection('donations')
    const total = await col.countDocuments()
    const samples = await col.find({}).sort({ createdAt: -1 }).limit(10).toArray()
    console.log('donations.count=', total)
    console.log(JSON.stringify(samples.map(s=>{
      const out = {
        _id: s._id ? String(s._id) : null,
        id: s.id || null,
        listingId: s.listingId || null,
        createdAt: s.createdAt || s.collectedAt || null,
        quantity: s.quantity || null,
        weight: s.weight || null,
        impactMetrics: s.impactMetrics || null
      }
      return out
    }), null, 2))
  }catch(e){
    console.error('error', e)
    process.exit(1)
  }finally{
    await client.close()
  }
}

main()
