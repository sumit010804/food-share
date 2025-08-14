import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const notificationId = params.id

    // In a real app, this would delete from the database
    // For now, we'll just return success
    return NextResponse.json({
      message: "Notification deleted successfully",
      notificationId,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
