import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const notificationId = params.id

    storage.updateNotification(notificationId, { read: true })

    return NextResponse.json({
      message: "Notification marked as read",
      notificationId,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
