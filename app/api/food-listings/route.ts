import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"
import { generateQRCode } from "@/lib/qr-generator"
import type { FoodListing } from "@/lib/types"

export async function GET() {
  try {
    const listings = storage.getFoodListings()

    const now = new Date()
    listings.forEach((listing) => {
      const availableUntil = new Date(listing.availableUntil)
      if (now > availableUntil && listing.status === "available") {
        storage.updateFoodListing(listing.id, { status: "expired" })
      }
    })

    // Get updated listings after status changes
    const updatedListings = storage.getFoodListings()

    return NextResponse.json({
      message: "Food listings retrieved successfully",
      listings: updatedListings,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

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
      donorId: data.donorId || "1", // Default donor ID
      donorName: data.createdBy,
      createdAt: new Date().toISOString(),
      qrCode: "", // Will be generated below
      collectedBy: null,
      collectedAt: null,
    }

    // Generate QR code with listing details
    const qrData = {
      id: newListing.id,
      title: newListing.title,
      description: newListing.description,
      quantity: newListing.quantity,
      location: newListing.location,
      donorName: newListing.donorName,
      availableUntil: newListing.availableUntil,
      safeToEatHours: newListing.safeToEatHours,
      allergens: newListing.allergens,
      dietaryInfo: newListing.dietaryInfo,
    }

    const qrCode = await generateQRCode(qrData)
    newListing.qrCode = qrCode

    storage.addFoodListing(newListing)

    const notification = {
      id: `new-listing-${newListing.id}`,
      type: "new_listing" as const,
      title: `New Food Available: ${newListing.title}`,
      message: `${newListing.donorName} has listed ${newListing.quantity} of ${newListing.title}. Available at ${newListing.location} until ${new Date(newListing.availableUntil).toLocaleTimeString()}.`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: "medium" as const,
      actionUrl: "/dashboard/food-listings",
      metadata: {
        listingId: newListing.id,
      },
    }

    storage.broadcastNotification(notification)

    return NextResponse.json({
      message: "Food listing created successfully with QR code",
      listing: newListing,
    })
  } catch (error) {
    console.error("Food listing creation error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
