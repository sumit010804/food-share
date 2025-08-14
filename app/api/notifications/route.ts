import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"
import type { Notification } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    let notifications: Notification[]

    if (userId) {
      // Get notifications for specific user
      notifications = storage.getUserNotifications(userId)
    } else {
      // Get all notifications (for admin or broadcast purposes)
      notifications = storage.getNotifications()
    }

    // Sort notifications by creation date (newest first)
    const sortedNotifications = notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    return NextResponse.json({
      message: "Notifications retrieved successfully",
      notifications: sortedNotifications,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Check if this is a broadcast notification (no specific userId)
    if (!data.userId && !data.recipient) {
      // Broadcast to all users
      const notification = {
        id: Date.now().toString(),
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

      storage.broadcastNotification(notification)

      return NextResponse.json({
        message: "Notification broadcasted successfully",
        notification,
      })
    }

    // Create targeted notification
    const newNotification: Notification = {
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

    storage.addNotification(newNotification)

    return NextResponse.json({
      message: "Notification created successfully",
      notification: newNotification,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
