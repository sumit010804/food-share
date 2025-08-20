import { NextResponse } from 'next/server'
import { getDatabase } from '../../../../lib/mongodb'

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}))
  const { organizerEmail, title = 'Test Event', startTime, endTime, description = 'Dev created event', expectedSurplusKg = 2 } = payload

  if (!organizerEmail) return NextResponse.json({ ok: false, error: 'organizerEmail required' }, { status: 400 })

  const db = await getDatabase()
  const organizer = await db.collection('users').findOne({ email: organizerEmail })
  if (!organizer) return NextResponse.json({ ok: false, error: 'organizer not found' }, { status: 404 })

  const eventDoc = {
    title,
    description,
    organizerId: organizer._id,
    organizerEmail: organizer.email,
    startTime: startTime ? new Date(startTime) : new Date(Date.now() + 1000 * 60 * 60),
    endTime: endTime ? new Date(endTime) : new Date(Date.now() + 1000 * 60 * 60 * 3),
    foodPrediction: { expectedSurplusKg },
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'upcoming',
  }

  const res = await db.collection('events').insertOne(eventDoc)

  // trigger the same broadcast logic that app/api/events/route.ts uses.
  // For now return the created id and let manual inspection confirm notifications.
  return NextResponse.json({ ok: true, insertedId: res.insertedId })
}
