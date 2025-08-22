import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
// For chat_message and most in-app flows we skip email. Email send is used only for broadcast new listings (kept elsewhere).
import { ObjectId } from "mongodb"
import type { Notification } from "@/lib/types"

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production"
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    let db
    try {
      db = await getDatabase()
    } catch (e) {
      if (isDev) {
        // In dev, avoid failing the dashboard due to transient DB issues; return empty list
        return NextResponse.json({ message: "Notifications unavailable (dev)", notifications: [] }, { status: 200 })
      }
      throw e
    }

    const baseQuery: any = {}
    if (userId) {
      // Notifications store userId as a string; match on string form
      baseQuery.userId = String(userId)
    }

    let notifications: Notification[] = []
    try {
      notifications = (await db
        .collection<Notification>("notifications")
        .find(baseQuery)
        .sort({ createdAt: -1 })
        .toArray()) as unknown as Notification[]
    } catch (e) {
      if (isDev) {
        return NextResponse.json({ message: "Notifications unavailable (dev)", notifications: [] }, { status: 200 })
      }
      throw e
    }

    return NextResponse.json({
      message: "Notifications retrieved successfully",
      notifications,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase()
    const data = await request.json()

    // Broadcast to all users when no specific recipient is provided
    if (!data.userId && !data.recipient) {
  const users = await db.collection("users").find({}).project({ id: 1, email: 1, name: 1 }).toArray()
      const baseId = Date.now().toString()
      const createdAt = new Date().toISOString()

      const docs: Notification[] = users.map((u: any) => ({
        id: `${baseId}-${u.id}`,
        userId: u.id,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        createdAt,
        priority: data.priority || "medium",
        actionUrl: data.actionUrl,
        metadata: {
          listingId: data.foodListingId,
          eventId: data.eventId,
          collectorName: data.collectedBy,
          donorName: data.donatedBy,
          collectionMethod: data.collectionMethod,
        },
      }))

      if (docs.length > 0) {
        await db.collection("notifications").insertMany(docs)
      }

  // Skip email broadcast for generic POST /api/notifications to keep notifications in-app.

      return NextResponse.json({
        message: "Notification broadcasted successfully",
        count: docs.length,
      })
    }

    // Create targeted notification
    const notification: Notification = {
      id: Date.now().toString(),
      userId: data.userId || data.recipient,
      type: data.type,
      title: data.title,
      message: data.message,
      read: false,
      createdAt: new Date().toISOString(),
      priority: data.priority || "medium",
      actionUrl: data.actionUrl,
      metadata: {
        listingId: data.foodListingId,
        eventId: data.eventId,
        collectorName: data.collectedBy,
        donorName: data.donatedBy,
        collectionMethod: data.collectionMethod,
      },
    }

    await db.collection("notifications").insertOne(notification)

  // Skip targeted email send; keep chat and other app notifications in-app.

    return NextResponse.json({
      message: "Notification created successfully",
      notification,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
