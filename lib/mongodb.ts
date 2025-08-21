import { MongoClient, type Db } from "mongodb"

// Delay validation of MONGODB_URI until runtime to avoid Next.js
// build-time failures when pages/controllers import this module.
let clientPromise: Promise<MongoClient> | null = null

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
  }

  // Keep server selection short so we can fall back quickly in dev when Atlas is unreachable
  const options: any = { serverSelectionTimeoutMS: 5000 }
  const client = new MongoClient(uri, options)

  if (process.env.NODE_ENV === "development") {
    // Preserve the promise across HMR reloads in development.
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
    }
    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = (async () => {
        try {
          return await client.connect()
        } catch (e) {
          // Fallback to local Mongo in development
          const fallbackUri = process.env.MONGODB_URI_FALLBACK || 'mongodb://127.0.0.1:27017'
          try {
            // directConnection avoids SRV/DNS in dev
            const fallback = new MongoClient(fallbackUri, { ...options, directConnection: true })
            return await fallback.connect()
          } catch (e2) {
            throw e
          }
        }
      })()
    }
    return globalWithMongo._mongoClientPromise
  }

  // In production, try primary URI once (no noisy fallback)
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
