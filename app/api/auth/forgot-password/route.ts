import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { sendEmail } from "@/lib/email"

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString() }

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const db = await getDatabase()
    const user = await db.collection("users").findOne({ email })
    if (!user) return NextResponse.json({ message: "No account for this email" }, { status: 404 })

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await db.collection("otps").insertOne({ email, otp, purpose: "reset", expiresAt, used: false })

    try {
      await sendEmail(email, "Password reset code", `<p>Your reset code is <b>${otp}</b>. Expires in 10 minutes.</p>`)
      return NextResponse.json({ message: "Reset code sent" })
    } catch (mailErr) {
      const body: Record<string, any> = { message: "Code generated, but email delivery failed" }
      if (process.env.NODE_ENV !== "production") body.devOtp = otp
      return NextResponse.json(body)
    }
  } catch (e) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
