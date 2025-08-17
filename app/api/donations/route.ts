import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    const db = await getDatabase()
    const docs = await db.collection('donations').find({}).toArray()

    // Map DB donation docs to the UI-friendly shape
    const donations = docs.map((d: any) => ({
      id: d.id || (d._id && String(d._id)),
      foodItem: d.foodTitle || d.listingTitle || d.foodTitle || d.listingId || null,
      quantity: d.quantity || d.weight || null,
      donatedTo: d.recipientName || d.recipient || null,
      recipientType: d.recipientType || 'community',
      receivedTime: d.collectedAt || d.createdAt || null,
      location: d.location || null,
      status: d.status || 'collected',
      impactMetrics: d.impactMetrics || null,
      collectedBy: d.recipientName || d.collectedBy || null,
      collectedAt: d.collectedAt || null,
      collectionMethod: d.collectionMethod || null,
      donorId: d.donorId || null,
      donorName: d.donorName || null,
      recipientId: d.recipientId || null,
      raw: d,
    }))

    return NextResponse.json({ message: 'Donations retrieved successfully', donations })
  } catch (err) {
    console.error("GET /api/donations error", err)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
