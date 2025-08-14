import { type NextRequest, NextResponse } from "next/server"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const eventId = params.id

    // In a real app, this would update the database
    // For now, we'll just return success
    return NextResponse.json({
      message: "Event marked as food logged",
      eventId,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
