import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const user = storage.getUserByEmail(email)

    if (!user || user.password !== password) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 })
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      message: "Login successful",
      user: userWithoutPassword,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
