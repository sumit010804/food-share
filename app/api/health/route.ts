import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    // try to get a DB connection
    const db = await getDatabase()
    // perform a cheap command to ensure connectivity
    await db.command({ ping: 1 })
    return NextResponse.json({ ok: true, db: true })
  } catch (err: any) {
    console.error("Health check DB error:", err?.message || err)
    return NextResponse.json({ ok: false, db: false, error: String(err?.message || err) }, { status: 503 })
  }
}
