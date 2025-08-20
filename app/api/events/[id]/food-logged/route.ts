import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const eventId = params.id
    const db = await getDatabase()
    const body = await request.json().catch(() => ({}))

    // Find event by id or _id
    const queries: any[] = [{ id: eventId }]
    if (/^[0-9a-fA-F]{24}$/.test(eventId)) {
      try { queries.push({ _id: new ObjectId(eventId) }) } catch (e) {}
    }

    const event = await db.collection('events').findOne({ $or: queries })
    if (!event) return NextResponse.json({ message: 'Event not found' }, { status: 404 })

    // Expect body to contain an `actualSurplusKg` number if available (from created listing)
    const actualKg = typeof body.actualSurplusKg === 'number' ? body.actualSurplusKg : null

    // Record an entry in event_surplus_history for modelling
    try {
      const historyDoc: any = {
        eventId: event.id || (event._id && String(event._id)) || null,
        eventType: event.eventType || null,
        organizer: event.organizer || null,
        organizerId: event.organizerId || null,
        expectedAttendees: event.expectedAttendees || null,
        location: event.location || null,
        dayOfWeek: event.date ? new Date(event.date).getDay() : null,
        hourOfDay: event.date ? new Date(event.date).getHours() : null,
        actualSurplusKg: actualKg,
        createdAt: new Date().toISOString(),
      }

      await db.collection('event_surplus_history').insertOne(historyDoc)
    } catch (e) {
      console.error('Failed to write event surplus history', e)
    }

    // Update event to mark foodLogged true
    try {
      await db.collection('events').updateOne({ _id: event._id }, { $set: { foodLogged: true, updatedAt: new Date().toISOString(), 'foodPrediction.actualSurplusKg': actualKg } })
    } catch (e) {
      console.error('Failed to update event foodLogged', e)
    }

    return NextResponse.json({ message: 'Event marked as food logged', eventId, actualSurplusKg: actualKg })
  } catch (error) {
    console.error('food-logged handler error', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
