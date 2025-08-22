import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { sendNotificationEmail } from "@/lib/email"
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
    const { name, email: rawEmail, password, userType, organization } = await request.json();
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

    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      role: userType,
      organization,
      createdAt: new Date().toISOString(),
    };
    await db.collection("users").insertOne(newUser);
    // Send welcome email (fire-and-forget; safely no-op if SMTP not configured)
    try {
      await sendNotificationEmail(
        email,
        "Welcome to FoodShare",
        `Hi ${name || "there"}, your FoodShare account is ready. You can now list or find food!`,
        "http://foodshare-black.vercel.app/"
      )
    } catch (e) {
      console.warn("Welcome email failed for", email, e)
    }
    const { password: _, ...userWithoutPassword } = newUser;
    return NextResponse.json({
      message: "Account created successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Unexpected error in signup route:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
