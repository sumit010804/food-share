import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"
import type { CollectionRecord, DonationRecord } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const { listingId, collectedBy, collectedAt, collectionMethod = "qr_scan" } = await request.json()

    const listing = storage.getFoodListingById(listingId)
    if (!listing) {
      return NextResponse.json({ message: "Food listing not found" }, { status: 404 })
    }

    // Check if already collected
    if (listing.status === "collected") {
      return NextResponse.json({ message: "Item already collected" }, { status: 400 })
    }

    const collection: CollectionRecord = {
      id: Date.now().toString(),
      collectorId: "current-user", // In real app, get from auth
      collectorName: collectedBy,
      donorId: listing.donorId,
      donorName: listing.donorName,
      foodListingId: listingId,
      foodTitle: listing.title,
      collectedAt,
      collectionMethod,
      location: listing.location,
      quantity: listing.quantity,
    }

    storage.addCollection(collection)

    const donation: DonationRecord = {
      id: `donation-${listingId}`,
      donorId: listing.donorId,
      donorName: listing.donorName,
      recipientId: "current-user",
      recipientName: collectedBy,
      foodTitle: listing.title,
      foodType: listing.foodType,
      quantity: listing.quantity,
      donatedAt: listing.createdAt,
      collectedAt,
      status: "collected",
      impactMetrics: {
        carbonSaved: 2.5, // kg CO2
        waterSaved: 150, // liters
        peopleServed: 1,
      },
    }

    storage.addDonation(donation)

    storage.updateFoodListing(listingId, {
      status: "collected",
      collectedBy,
      collectedAt,
    })

    const donorNotification = {
      id: `collection-${listingId}-donor`,
      type: "item_collected" as const,
      title: `Item Collected: ${listing.title}`,
      message: `Your food item "${listing.title}" has been collected by ${collectedBy}${
        collectionMethod === "qr_scan" ? " via QR scan" : collectionMethod === "manual" ? " manually" : " directly"
      }. Thank you for contributing to reducing food waste!`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: "medium" as const,
      actionUrl: "/dashboard/donation-history",
      metadata: {
        listingId,
        collectorName: collectedBy,
        collectionMethod,
      },
    }

    const collectorNotification = {
      id: `collection-${listingId}-collector`,
      type: "collection_confirmed" as const,
      title: `Collection Confirmed: ${listing.title}`,
      message: `You have successfully collected "${listing.title}" from ${listing.donorName}. Collection recorded at ${new Date(collectedAt).toLocaleTimeString()}.`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: "low" as const,
      actionUrl: "/dashboard/donation-history",
      metadata: {
        listingId,
        donorName: listing.donorName,
        collectionMethod,
      },
    }

    // Add notifications to storage
    storage.addNotification({ ...donorNotification, userId: listing.donorId })
    storage.addNotification({ ...collectorNotification, userId: "current-user" })

    return NextResponse.json({
      message: "Item marked as collected successfully",
      collection,
    })
  } catch (error) {
    console.error("Collection error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const collections = storage.getCollections()

    return NextResponse.json({
      message: "Collections retrieved successfully",
      collections,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
