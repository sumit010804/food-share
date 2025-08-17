const { MongoClient } = require('mongodb')
const fs = require('fs')
;(async ()=>{
  try{
    const env = fs.readFileSync('.env.local','utf8')
    env.split(/\n/).forEach(line=>{
      line = line.trim()
      if(!line||line.startsWith('#')) return
      const idx = line.indexOf('=')
      if(idx>0){
        const k = line.slice(0,idx)
        let v = line.slice(idx+1)
        if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))){v=v.slice(1,-1)}
        process.env[k]=v
      }
    })
    const client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    const db = client.db('foodshare')
    const res = await db.collection('collections').deleteMany({ debugProbe: true })
    console.log('deleted', res.deletedCount)
    await client.close()
  }catch(e){console.error(e);process.exit(1)}
})()
