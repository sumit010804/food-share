import { MongoClient } from 'mongodb'

async function main(){
  const uri = process.env.MONGODB_URI
  if(!uri){
    console.error('MONGODB_URI not set')
    process.exit(2)
  }
  const client = new MongoClient(uri)
  try{
    await client.connect()
    const db = client.db('foodshare')

    console.log('Ensuring indexes...')

    // Collections: unique on listingId to prevent duplicates per listing
    // Partial to skip docs where listingId is missing
    await db.collection('collections').createIndex(
      { listingId: 1 },
      { unique: true, name: 'uniq_listingId', partialFilterExpression: { listingId: { $exists: true, $type: 'string' } } }
    ).catch(e=>{ console.warn('collections.index warn', e?.message || e) })

    // FoodListings: status index for queries
    await db.collection('foodListings').createIndex({ status: 1 }).catch(()=>{})

    console.log('Indexes ensured')
  }catch(e){
    console.error('create-indexes failed', e)
    process.exitCode = 1
  }finally{
    await client.close()
  }
}

main()
