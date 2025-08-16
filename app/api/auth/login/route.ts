import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const { email: rawEmail, password } = await request.json();
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail
    const validateEmail = (e: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ message: "Invalid email address" }, { status: 400 })
    }
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const stored = user.password as string | undefined
    let passwordMatch = false
    if (stored) {
      try {
        passwordMatch = await bcrypt.compare(password, stored)
      } catch (e) {
        // If bcrypt compare fails (stored value might be plaintext), fallback to direct comparison
        passwordMatch = stored === password
      }
    }

    if (!passwordMatch) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }
    const { password: _, ...userWithoutPassword } = user;
    // Deliver any pending notifications scheduled for this user (if still valid)
    try {
      const pending = await db
        .collection("pending_notifications")
        .find({ userId: user._id?.toString() || user.id })
        .toArray();

      const toDeliver = pending.filter((p: any) => {
        if (!p.expiresAt) return true
        const exp = new Date(p.expiresAt).getTime()
        return Date.now() <= exp
      })

      if (toDeliver.length > 0) {
        // convert to proper notification documents (preserve id, createdAt)
        const docs = toDeliver.map((p: any) => ({
          id: p.id || Date.now().toString(),
          userId: p.userId,
          type: p.type,
          title: p.title,
          message: p.message,
          read: false,
          createdAt: p.createdAt || new Date().toISOString(),
          priority: p.priority || "medium",
          actionUrl: p.actionUrl || "/dashboard/food-listings",
          metadata: p.metadata || {},
        }))

        await db.collection("notifications").insertMany(docs)
        // remove delivered pending entries
        const ids = toDeliver.map((p: any) => p._id)
        await db.collection("pending_notifications").deleteMany({ _id: { $in: ids } })
      }
    } catch (err) {
      console.error("Failed to deliver pending notifications on login:", err)
    }

    return NextResponse.json({
      message: "Login successful",
      user: userWithoutPassword,
    });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
