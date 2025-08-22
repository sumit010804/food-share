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

    const mapped = updatedEvents.map((ev: any) => {
      const start = ev.startTime || ev.date
      const end = ev.endTime || (start ? new Date(new Date(start).getTime() + 4 * 60 * 60 * 1000).toISOString() : undefined)
      return { ...ev, startTime: start, endTime: end }
    })

    return NextResponse.json({
      message: "Events retrieved successfully",
      events: mapped,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const db = await getDatabase()

    // Enforce role-based permission: only admin or event organizer can create events
    try {
      const requester = await db.collection('users').findOne({
        $or: [
          { email: data.organizerEmail },
          { id: data.organizerId },
          { name: data.organizer },
        ].filter(Boolean)
      })
      const userType = requester?.userType || requester?.role || null
  const allowed = userType && (userType === 'admin')
      if (!allowed) {
        return NextResponse.json({ message: 'You do not have permission to create events.' }, { status: 403 })
      }
    } catch (e) {
      return NextResponse.json({ message: 'Unauthorized to create events.' }, { status: 403 })
    }

    // We compute expected surplus in servings first (percentage of attendees),
    // then convert to kilograms using a per-serving weight heuristic.
    const KG_PER_SERVING = 0.25 // 250g per serving assumption
    let expectedSurplusKg = 0
    let confidence: "low" | "medium" | "high" = "low"

    const attendees = data.expectedAttendees || 0
    let expectedServings = 0
    switch (data.eventType) {
      case "conference":
        expectedServings = Math.round(attendees * 0.08) // 8% surplus rate
        confidence = "high"
        break
      case "workshop":
        expectedServings = Math.round(attendees * 0.05) // 5% surplus rate
        confidence = "medium"
        break
      case "seminar":
        expectedServings = Math.round(attendees * 0.06) // 6% surplus rate
        confidence = "medium"
        break
      case "meeting":
        expectedServings = Math.round(attendees * 0.12) // 12% surplus rate
        confidence = "high"
        break
      case "celebration":
        expectedServings = Math.round(attendees * 0.15) // 15% surplus rate
        confidence = "high"
        break
      default:
        expectedServings = Math.round(attendees * 0.07) // 7% default
        confidence = "low"
    }

    expectedSurplusKg = Math.round((expectedServings * KG_PER_SERVING) * 100) / 100

  // db already initialized above

  const newEvent: any = {
      title: data.title,
      description: data.description || "",
      // keep legacy `date` but also store explicit startTime/endTime
      date: data.startTime || data.date,
      startTime: data.startTime || data.date,
      endTime: data.endTime || (data.startTime ? new Date(new Date(data.startTime).getTime() + 4 * 60 * 60 * 1000).toISOString() : undefined),
      location: data.location,
      organizer: data.organizer,
      organizerId: data.organizerId || "1",
      expectedAttendees: data.expectedAttendees,
      foodPrediction: {
  expectedSurplus: typeof data.expectedSurplus === 'number' ? data.expectedSurplus : expectedServings,
  expectedSurplusKg: typeof data.expectedSurplusKg === 'number' ? data.expectedSurplusKg : expectedSurplusKg,
  confidence: data.confidence || confidence,
      },
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
  message: `${createdEvent!.organizer} has scheduled "${createdEvent!.title}" on ${eventDate} at ${eventTime}. Location: ${createdEvent!.location}. Expected surplus food: ${expectedSurplusKg} kg.`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: "medium" as const,
      actionUrl: "/dashboard/events",
      metadata: {
        eventId: String(createdEvent!._id),
      },
    }

    // Persist notification to DB: broadcast to all users except the organizer
    try {
      // Fetch users excluding the organizer (by id or email if provided)
      const excludeQuery: any = {}
      if (createdEvent!.organizerId) excludeQuery.id = { $ne: String(createdEvent!.organizerId) }
      if (data.organizerEmail) excludeQuery.email = { $ne: String(data.organizerEmail) }

      // Fetch all users and filter out the organizer explicitly (safer across schemas)
      const users = await db
        .collection("users")
        .find({})
        .project({ id: 1, email: 1, preferences: 1 })
        .toArray()

      const recipients = users.filter((u: any) => {
        if (!u) return false
        // exclude organizer
        if (createdEvent!.organizerId && String(u.id) === String(createdEvent!.organizerId)) return false
        if (data.organizerEmail && String(u.email) === String(data.organizerEmail)) return false
        // respect per-user preference for event reminders; default = true
        const wantsEvents = u.preferences && u.preferences.notifications && typeof u.preferences.notifications.eventReminders === 'boolean' ? u.preferences.notifications.eventReminders : true
        if (!wantsEvents) return false
        return true
      })

      if (recipients.length > 0) {
        const baseId = Date.now().toString()
        const createdAt = new Date().toISOString()
        const docs = recipients.map((u: any) => ({
          id: `${baseId}-${u.id}`,
          userId: u.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: false,
          createdAt,
          priority: notification.priority,
          actionUrl: notification.actionUrl,
          metadata: notification.metadata,
        }))

        await db.collection("notifications").insertMany(docs)
      }
    } catch (e) {
      console.error('Failed to broadcast event notification', e)
      // Do not insert a fallback notification that may notify the organizer; skip broadcasting on error.
    }

    return NextResponse.json({
      message: "Event created successfully",
      event: createdEvent,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
