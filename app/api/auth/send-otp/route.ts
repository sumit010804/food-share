import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { sendEmail } from "@/lib/email"

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const { email, purpose } = await request.json()
    if (!email) return NextResponse.json({ message: "Email required" }, { status: 400 })

    const db = await getDatabase()
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await db.collection("otps").insertOne({ email, otp, purpose: purpose || "verify", expiresAt, used: false })

    try {
      await sendEmail(
        email,
        "Your verification code",
        `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`
      )
      return NextResponse.json({ message: "OTP sent" })
    } catch (mailErr) {
      // Don't fail the request if email transport isn't configured.
      const body: Record<string, any> = { message: "OTP created, but email delivery failed" }
      if (process.env.NODE_ENV !== "production") body.devOtp = otp
      return NextResponse.json(body)
    }
  } catch (e) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
