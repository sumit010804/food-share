import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"
import type { Event } from "@/lib/types"

export async function GET() {
  try {
    const events = storage.getEvents()

    const now = new Date()
    events.forEach((event) => {
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

      // Update event status in storage if changed
      if (event.id) {
        storage.updateEvent(event.id, { ...event, status } as any)
      }
    })

    // Get updated events after status changes
    const updatedEvents = storage.getEvents()

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

    const newEvent: Event = {
      id: Date.now().toString(),
      title: data.title,
      description: data.description || "",
      date: data.startTime || data.date,
      location: data.location,
      organizer: data.organizer,
      organizerId: data.organizerId || "1", // Default organizer ID
      expectedAttendees: data.expectedAttendees,
      foodLogged: false,
      createdAt: new Date().toISOString(),
    }

    storage.addEvent(newEvent)

    const eventDate = new Date(newEvent.date).toLocaleDateString()
    const eventTime = new Date(newEvent.date).toLocaleTimeString()

    const notification = {
      id: `new-event-${newEvent.id}`,
      type: "event_added" as const,
      title: `New Event Added: ${newEvent.title}`,
      message: `${newEvent.organizer} has scheduled "${newEvent.title}" on ${eventDate} at ${eventTime}. Location: ${newEvent.location}. Expected surplus food: ${expectedSurplus} servings.`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: "medium" as const,
      actionUrl: "/dashboard/events",
      metadata: {
        eventId: newEvent.id,
      },
    }

    storage.broadcastNotification(notification)

    return NextResponse.json({
      message: "Event created successfully",
      event: newEvent,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
