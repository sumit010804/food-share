import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 })
    }

    storage.markAllNotificationsAsRead(userId)

    return NextResponse.json({
      message: "All notifications marked as read",
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
