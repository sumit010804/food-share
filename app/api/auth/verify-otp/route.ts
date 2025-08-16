import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const { email, otp, purpose } = await request.json()
    const db = await getDatabase()

    const record = await db.collection("otps").findOne({ email, otp, purpose, used: false })
    if (!record) return NextResponse.json({ message: "Invalid code" }, { status: 400 })

    if (new Date(record.expiresAt) < new Date()) {
      return NextResponse.json({ message: "Code expired" }, { status: 400 })
    }

    await db.collection("otps").updateOne({ _id: record._id }, { $set: { used: true } })
    return NextResponse.json({ message: "OTP verified" })
  } catch (e) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
