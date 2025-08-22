import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { sendNotificationEmail, sendOtpEmail } from "@/lib/email"
import type { User } from "@/lib/types"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    let db
    try {
      db = await getDatabase();
    } catch (dbErr) {
      console.error("DB connection error in signup:", dbErr)
      return NextResponse.json({ message: 'Service unavailable: database not configured or unreachable (MONGODB_URI)' }, { status: 503 })
    }
  const { name, email: rawEmail, password, userType, organization, collegeName, canteenName, hostelName } = await request.json();
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail
    const validateEmail = (e: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ message: "Invalid email address" }, { status: 400 })
    }
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser: any = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      role: userType, // keep for compatibility
      userType,       // primary field used across UI
      organization,
      collegeName: collegeName || null,
      canteenName: canteenName || null,
      hostelName: hostelName || null,
      createdAt: new Date().toISOString(),
      isVerified: false,
      otpCode: null,
      otpExpiresAt: null,
    };
    await db.collection("users").insertOne(newUser);

    // Generate OTP and email to user
    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await db.collection("users").updateOne({ email }, { $set: { otpCode: code, otpExpiresAt: expiresAt } })
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.info(`[DEV OTP] Verification code for ${email}: ${code}`)
    }
    try {
      await sendOtpEmail(email, code)
    } catch (e) {
      console.warn("OTP email failed for", email, e)
    }
    const { password: _, ...userWithoutPassword } = newUser;
    return NextResponse.json({
      message: "Account created. Please verify with the OTP sent to your email.",
      user: userWithoutPassword,
      requiresVerification: true,
    });
  } catch (error) {
    console.error("Unexpected error in signup route:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

function generateOtpCode() {
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000))
}
