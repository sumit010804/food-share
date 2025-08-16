import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    const db = await getDatabase()
    const users = await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray()

    const data = users.map((u: any) => ({
      id: u._id?.toString() || u.id,
      name: u.name,
      email: u.email,
      userType: u.userType || u.role || null,
      organization: u.organization,
      createdAt: u.createdAt,
    }))

    return NextResponse.json({ users: data })
  } catch (err) {
    console.error("GET /api/users error", err)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
