import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function POST() {
  try {
    const db = await getDatabase()
    const now = new Date()

    const users = [
      {
        id: "test-user-A",
        name: "User A",
        email: "usera@example.com",
        userType: "event",
        organization: "TestOrg",
        createdAt: now,
        updatedAt: now,
        isActive: true,
        preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } },
      },
      {
        id: "test-user-B",
        name: "User B",
        email: "userb@example.com",
        userType: "student",
        organization: "TestOrg",
        createdAt: now,
        updatedAt: now,
        isActive: true,
        preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: true } },
      },
      {
        id: "test-user-C",
        name: "User C",
        email: "userc@example.com",
        userType: "student",
        organization: "TestOrg",
        createdAt: now,
        updatedAt: now,
        isActive: true,
        preferences: { notifications: { newListings: true, pickupReminders: true, expiryAlerts: true, eventReminders: false } },
      },
    ]

    // Upsert by id to avoid duplicates when re-running
    const results: any[] = []
    for (const u of users) {
      await db.collection("users").updateOne({ id: u.id }, { $set: u }, { upsert: true })
      const saved = await db.collection("users").findOne({ id: u.id })
      results.push({ id: saved?._id ?? saved?.id ?? u.id, email: saved?.email ?? u.email })
    }

    return NextResponse.json({ message: "Test users inserted", users: results })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ message: "Failed to insert test users" }, { status: 500 })
  }
}
