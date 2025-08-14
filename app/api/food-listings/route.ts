
import { type NextRequest, NextResponse } from "next/server"
import clientPromise, { getDatabase } from "@/lib/mongodb"
import { generateQRCodeData } from "@/lib/qr-generator"
import type { FoodListing } from "@/lib/types"
export async function GET() {
  try {
    const db = await getDatabase();
    const listings = await db.collection("foodListings").find({}).toArray();
    // Expire listings if needed
    const now = new Date();
    for (const listing of listings) {
      const availableUntil = new Date(listing.availableUntil);
      if (now > availableUntil && listing.status === "available") {
        await db.collection("foodListings").updateOne({ id: listing.id }, { $set: { status: "expired" } });
      }
    }
    // Get updated listings
    const updatedListings = await db.collection("foodListings").find({}).toArray();
    return NextResponse.json({
      message: "Food listings retrieved successfully",
      listings: updatedListings,
    });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const data = await request.json();
    const newListing: FoodListing = {
      id: Date.now().toString(),
      title: data.title,
      description: data.description,
      foodType: data.foodType,
      quantity: data.quantity,
      location: data.location,
      availableUntil: data.availableUntil,
      safeToEatHours: Number.parseInt(data.safetyHours || data.safeToEatHours),
      allergens: data.allergens || [],
      dietaryInfo: data.dietaryInfo || data.tags || [],
      contactInfo: data.contactInfo || `Contact: ${data.createdBy}`,
      status: "available",
      donorId: data.donorId || "1",
      donorName: data.createdBy,
      createdAt: new Date().toISOString(),
      qrCode: generateQRCodeData(data),
      collectedBy: null,
      collectedAt: null,
    };
    await db.collection("foodListings").insertOne(newListing);
    return NextResponse.json({
      message: "Food listing created successfully with QR code",
      listing: newListing,
    });
  } catch (error) {
    console.error("Food listing creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
