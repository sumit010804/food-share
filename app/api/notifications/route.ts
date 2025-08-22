import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { sendNotificationEmail } from "@/lib/email"
import { ObjectId } from "mongodb"
import type { Notification } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    const query = userId ? { userId } : {}
    const notifications = (await db
      .collection<Notification>("notifications")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()) as unknown as Notification[]

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

      // Fire-and-forget emails (skip if SMTP not configured). Resolve per-user email.
      try {
        await Promise.all(
          users.map(async (u: any) => {
            if (!u?.email) return
            try {
              await sendNotificationEmail(u.email, data.title, data.message, data.actionUrl)
            } catch (e) {
              // don't block API on email failures
              console.warn("Email send failed for", u.email, e)
            }
          })
        )
      } catch (e) {
        console.warn("Broadcast email loop encountered an error", e)
      }

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

    // Try to send email to recipient if we can resolve their email
    try {
      const recipientId = notification.userId
      let objectId: ObjectId | null = null
      if (typeof recipientId === 'string' && /^[0-9a-fA-F]{24}$/.test(recipientId)) {
        try { objectId = new ObjectId(recipientId) } catch {}
      }
      const user = await db.collection("users").findOne({
        $or: [
          { id: recipientId },
          ...(objectId ? [{ _id: objectId }] as any[] : []),
        ],
      })
      const to = (user as any)?.email
      if (to) {
        await sendNotificationEmail(to, notification.title, notification.message, notification.actionUrl || undefined)
      }
    } catch (e) {
      console.warn("Targeted email send failed", e)
    }

    return NextResponse.json({
      message: "Notification created successfully",
      notification,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
