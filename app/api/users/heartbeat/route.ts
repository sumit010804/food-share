import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function POST(request: Request) {
  try {
    const db = await getDatabase()
    const data = await request.json()
    const userId = data?.userId
    if (!userId) {
      return NextResponse.json({ message: "userId required" }, { status: 400 })
    }

    await db.collection("users").updateOne({ $or: [{ _id: userId }, { id: userId }] }, { $set: { lastActive: new Date().toISOString() } }, { upsert: false })

    return NextResponse.json({ message: "heartbeat recorded" })
  } catch (err) {
    console.error("heartbeat error", err)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
