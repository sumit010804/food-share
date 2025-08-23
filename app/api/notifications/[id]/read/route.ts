import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

// In Next.js 15+, dynamic route params must be awaited.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await getDatabase()

    await db.collection("notifications").updateOne({ id }, { $set: { read: true } })

    return NextResponse.json({
      message: "Notification marked as read",
      notificationId: id,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
