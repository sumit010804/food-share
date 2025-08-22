import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { sendNotificationEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()
    const { email: rawEmail, code: rawCode } = await request.json()
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const code = typeof rawCode === 'string' ? rawCode.trim() : ''

    if (!email || !code) {
      return NextResponse.json({ message: "Email and code are required" }, { status: 400 })
    }

    const user = await db.collection("users").findOne({ email })
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    if (user.isVerified) {
      return NextResponse.json({ message: "Already verified" }, { status: 200 })
    }

    const exp = user.otpExpiresAt ? new Date(user.otpExpiresAt).getTime() : 0
    if (!user.otpCode || !exp || Date.now() > exp) {
      return NextResponse.json({ message: "OTP expired. Please request a new code." }, { status: 400 })
    }

    if (String(user.otpCode) !== code) {
      return NextResponse.json({ message: "Invalid code" }, { status: 400 })
    }

    await db.collection("users").updateOne(
      { email },
      {
        $set: { isVerified: true },
        $unset: { otpCode: "", otpExpiresAt: "" },
      }
    )

    try {
      await sendNotificationEmail(
        email,
        "Welcome to FoodShare",
        `Hi ${user.name || "there"}, your FoodShare account is verified. You can now list or find food!`,
        "http://foodshare-black.vercel.app/"
      )
    } catch (e) {
      console.warn("Welcome email failed after verification for", email, e)
    }

    return NextResponse.json({ message: "Email verified successfully" })
  } catch (error) {
    console.error("verify-otp error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
