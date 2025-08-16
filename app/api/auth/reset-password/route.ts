import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json()
    const db = await getDatabase()

    const record = await db.collection("otps").findOne({ email, otp, purpose: "reset", used: false })
    if (!record) return NextResponse.json({ message: "Invalid code" }, { status: 400 })
    if (new Date(record.expiresAt) < new Date()) return NextResponse.json({ message: "Code expired" }, { status: 400 })

    await db.collection("users").updateOne({ email }, { $set: { password: newPassword } })
    await db.collection("otps").updateOne({ _id: record._id }, { $set: { used: true } })

    return NextResponse.json({ message: "Password updated" })
  } catch (e) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
