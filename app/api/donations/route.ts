import { NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"

export async function GET() {
  try {
    const donations = storage.getDonations()
    return NextResponse.json({ message: "Donations retrieved successfully", donations })
  } catch (err) {
    console.error("GET /api/donations error", err)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
