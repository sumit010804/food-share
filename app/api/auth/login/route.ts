import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const { email, password } = await request.json();
    const user = await db.collection("users").findOne({ email });
    if (!user || user.password !== password) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({
      message: "Login successful",
      user: userWithoutPassword,
    });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
