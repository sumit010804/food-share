import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { sendOtpEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()
    const { email: rawEmail } = await request.json()
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    if (!email) return NextResponse.json({ message: "Email is required" }, { status: 400 })

    const user = await db.collection("users").findOne({ email })
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 })
    if (user.isVerified) return NextResponse.json({ message: "Already verified" }, { status: 200 })

    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await db.collection("users").updateOne({ email }, { $set: { otpCode: code, otpExpiresAt: expiresAt } })
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.info(`[DEV OTP] Resent verification code for ${email}: ${code}`)
    }
    try {
      await sendOtpEmail(email, code)
    } catch (e) {
      console.warn("Resend OTP email failed for", email, e)
    }
    return NextResponse.json({ message: "OTP sent" })
  } catch (error) {
    console.error("resend-otp error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}
