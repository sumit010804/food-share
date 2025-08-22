import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function POST(request: Request) {
  const isDev = process.env.NODE_ENV !== "production"
  try {
    const db = await getDatabase()
    const data = await request.json().catch(() => ({} as any))
    const userId = data?.userId

    if (!userId) {
      // In dev, don't error on missing payload — keep it quiet.
      if (isDev) return NextResponse.json({ message: "heartbeat skipped (no userId)" }, { status: 200 })
      return NextResponse.json({ message: "userId required" }, { status: 400 })
    }

    const orClauses: any[] = []
    // Match custom string id
    orClauses.push({ id: String(userId) })
    // Try matching Mongo ObjectId if valid
    try {
      // Use dynamic import to avoid bundling issues in edge-like runtimes
      const { ObjectId } = await import("mongodb")
      if (ObjectId.isValid(String(userId))) {
        orClauses.push({ _id: new ObjectId(String(userId)) })
      }
    } catch {
      // ignore if mongodb module path differs in this environment
    }

    if (orClauses.length === 0) {
      return NextResponse.json({ message: "heartbeat skipped (unmatchable id)" }, { status: 200 })
    }

    await db
      .collection("users")
      .updateOne({ $or: orClauses }, { $set: { lastActive: new Date().toISOString() } }, { upsert: false })

    return NextResponse.json({ message: "heartbeat recorded" })
  } catch (err: any) {
    // Quiet in dev: don't spam logs or bubble 500s for background heartbeats
    if (isDev) {
      // no logging in dev for heartbeat failures
      return NextResponse.json({ message: "heartbeat skipped (dev)" }, { status: 200 })
    }
    console.error("heartbeat error", err)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
