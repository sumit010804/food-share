import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"
import type { User } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, userType, organization } = await request.json()

    const existingUser = storage.getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 })
    }

    const newUser: User = {
      id: Date.now().toString(), // Simple ID generation
      name,
      email,
      password, // In real app, hash this password
      role: userType,
      organization,
      createdAt: new Date().toISOString(),
    }

    storage.addUser(newUser)

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser

    return NextResponse.json({
      message: "Account created successfully",
      user: userWithoutPassword,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
