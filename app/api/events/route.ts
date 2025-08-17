import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { Event } from "@/lib/types"

export async function GET() {
  try {
    const db = await getDatabase()
    const events = await db.collection("events").find().toArray()

    const now = new Date()
    // Update statuses and persist changes
    await Promise.all(
      events.map(async (event: any) => {
        const eventDate = new Date(event.date)
        const eventEndDate = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000) // Assume 4 hours duration

        let status: "upcoming" | "ongoing" | "completed" = "upcoming"
        if (now < eventDate) {
          status = "upcoming"
        } else if (now >= eventDate && now <= eventEndDate) {
          status = "ongoing"
        } else if (now > eventEndDate) {
          status = "completed"
        }

        if (event._id && event.status !== status) {
          await db.collection("events").updateOne({ _id: event._id }, { $set: { status } })
        }
      })
    )

    const updatedEvents = await db.collection("events").find().toArray()

    return NextResponse.json({
      message: "Events retrieved successfully",
      events: updatedEvents,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    let expectedSurplus = 0
    let confidence: "low" | "medium" | "high" = "low"

    const attendees = data.expectedAttendees
    switch (data.eventType) {
      case "conference":
        expectedSurplus = Math.round(attendees * 0.08) // 8% surplus rate
        confidence = "high"
        break
      case "workshop":
        expectedSurplus = Math.round(attendees * 0.05) // 5% surplus rate
        confidence = "medium"
        break
      case "seminar":
        expectedSurplus = Math.round(attendees * 0.06) // 6% surplus rate
        confidence = "medium"
        break
      case "meeting":
        expectedSurplus = Math.round(attendees * 0.12) // 12% surplus rate
        confidence = "high"
        break
      case "celebration":
        expectedSurplus = Math.round(attendees * 0.15) // 15% surplus rate
        confidence = "high"
        break
      default:
        expectedSurplus = Math.round(attendees * 0.07) // 7% default
        confidence = "low"
    }

    const db = await getDatabase()

    const newEvent: Partial<Event> = {
      title: data.title,
      description: data.description || "",
      date: data.startTime || data.date,
      location: data.location,
      organizer: data.organizer,
      organizerId: data.organizerId || "1",
      expectedAttendees: data.expectedAttendees,
      foodLogged: false,
      createdAt: new Date().toISOString(),
    }

    const insertResult = await db.collection("events").insertOne(newEvent)
    const createdEvent = await db.collection("events").findOne({ _id: insertResult.insertedId })

    const eventDate = new Date(createdEvent!.date).toLocaleDateString()
    const eventTime = new Date(createdEvent!.date).toLocaleTimeString()

    const notification = {
      id: `new-event-${String(createdEvent!._id)}`,
      type: "event_added" as const,
      title: `New Event Added: ${createdEvent!.title}`,
      message: `${createdEvent!.organizer} has scheduled "${createdEvent!.title}" on ${eventDate} at ${eventTime}. Location: ${createdEvent!.location}. Expected surplus food: ${expectedSurplus} servings.`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: "medium" as const,
      actionUrl: "/dashboard/events",
      metadata: {
        eventId: String(createdEvent!._id),
      },
    }

    // Persist notification to DB so other services/clients can read it
    await db.collection("notifications").insertOne(notification)

    return NextResponse.json({
      message: "Event created successfully",
      event: createdEvent,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
