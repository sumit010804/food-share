import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDatabase()
    const notificationId = params.id

    await db.collection("notifications").deleteOne({ id: notificationId })

    return NextResponse.json({
      message: "Notification deleted successfully",
      notificationId,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
