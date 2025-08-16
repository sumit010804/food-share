import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    const db = await getDatabase()
    const docs = await db.collection('foodListings').find({}).toArray()
    const counts: Record<string, number> = {}
    for (const d of docs) {
      const s = d.status || 'unknown'
      counts[s] = (counts[s] || 0) + 1
    }

    return NextResponse.json({ ok: true, total: docs.length, counts, sample: docs.slice(0, 10) })
  } catch (err: any) {
    console.error('debug food-listings error', err)
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
