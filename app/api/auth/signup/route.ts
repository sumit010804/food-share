import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { User } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const { name, email, password, userType, organization } = await request.json();
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
    }
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      password,
      role: userType,
      organization,
      createdAt: new Date().toISOString(),
    };
    await db.collection("users").insertOne(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    return NextResponse.json({
      message: "Account created successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
