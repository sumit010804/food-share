import { MongoClient, type Db } from "mongodb"

// Delay validation of MONGODB_URI until runtime to avoid Next.js
// build-time failures when pages/controllers import this module.
let clientPromise: Promise<MongoClient> | null = null

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
  }

  const options = {}
  const client = new MongoClient(uri, options)

  if (process.env.NODE_ENV === "development") {
    // Preserve the promise across HMR reloads in development.
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
    }
    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = client.connect()
    }
    return globalWithMongo._mongoClientPromise
  }

  return client.connect()
}

export default async function getClient(): Promise<MongoClient> {
  if (!clientPromise) clientPromise = createClientPromise()
  return clientPromise
}

export async function getDatabase(): Promise<Db> {
  const client = await getClient()
  return client.db("foodshare")
}
