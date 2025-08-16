import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDatabase()
    const notificationId = params.id

    await db.collection("notifications").updateOne({ id: notificationId }, { $set: { read: true } })

    return NextResponse.json({
      message: "Notification marked as read",
      notificationId,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
