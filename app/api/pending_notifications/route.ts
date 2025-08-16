import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    const db = await getDatabase()
    const rows = await db.collection("pending_notifications").find({}).toArray()
    return NextResponse.json({ count: rows.length, pending: rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ message: "error" }, { status: 500 })
  }
}
