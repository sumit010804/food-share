import { type NextRequest, NextResponse } from "next/server"
import { trainAndPredictEvent } from "@/lib/predictor"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const features = {
      expectedAttendees: data.expectedAttendees,
      eventType: data.eventType,
      dayOfWeek: data.dayOfWeek,
      hourOfDay: data.hourOfDay,
      organizerId: data.organizerId,
      location: data.location,
    }

    const result = await trainAndPredictEvent(features)
    return NextResponse.json({ message: 'Predicted', predictedKg: result.predictedKg })
  } catch (e) {
    console.error('predict/event error', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
