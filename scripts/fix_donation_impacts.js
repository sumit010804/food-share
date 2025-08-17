const fs = require('fs')
const path = require('path')
const { MongoClient, ObjectId } = require('mongodb')

function parseKgFromQuantity(q){
  if (!q) return 0
  try{
    const s = String(q).trim().toLowerCase()
    const mKg = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|kilograms?)/i)
    const mG = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|grams?)/i)
    const mNum = s.match(/^([0-9]+(?:\.[0-9]+)?)/)
    if (mKg) return Number(mKg[1])
    if (mG) return Number(mG[1]) / 1000
    if (mNum) return Number(mNum[1])
  }catch(e){}
  return 0
}

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
    const donations = db.collection('donations')
    const listings = db.collection('foodListings')

  const CO2_PER_KG = 2.5
    const WATER_L_PER_KG = 500

    const cursor = donations.find({ $or: [ { impactMetrics: null }, { impactMetrics: { $exists: false } } ] })
    const todo = await cursor.toArray()
    console.log('Found donations needing impact update:', todo.length)
    for (const d of todo) {
      let foodKg = 0
      // try donation fields
      if (d.impactMetrics && d.impactMetrics.foodKg) foodKg = Number(d.impactMetrics.foodKg)
      if (!foodKg && d.weight) foodKg = Number(d.weight)
      if (!foodKg && d.quantity) foodKg = parseKgFromQuantity(d.quantity)
      if (!foodKg && d.listingId) {
        // attempt to find listing
        const l = await listings.findOne({ $or: [{ id: String(d.listingId) }, { _id: ObjectId.isValid(String(d.listingId)) ? new ObjectId(String(d.listingId)) : null }] })
        if (l) {
          foodKg = parseKgFromQuantity(l.quantity || l.raw?.quantity || null)
        }
      }
      if (!foodKg) foodKg = 2 // fallback
      const impactMetrics = {
        foodKg,
        co2Saved: Number((foodKg * CO2_PER_KG).toFixed(2)),
        waterSaved: Math.round(foodKg * WATER_L_PER_KG),
        peopleFed: 1
      }
      await donations.updateOne({ _id: d._id }, { $set: { impactMetrics, weight: foodKg } })
      console.log('Updated donation', d._id.toString(), 'with', impactMetrics)
    }
    console.log('Done')
  }catch(e){
    console.error('error', e)
    process.exit(1)
  }finally{
    await client.close()
  }
}

main()
