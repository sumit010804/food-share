
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

    // Load users so we can attach provider/donor details to each listing.
    const users = await db.collection("users").find({}).toArray();
    const userMap = new Map(users.map((u: any) => [u._id?.toString() || u.id, u]));

    const data = updatedListings.map((l: any) => {
      // try to resolve the provider/donor from donorId / providerId
      let provider = null;
      const possibleId = l.donorId || l.providerId || l.donorIdString || null;
      if (possibleId) {
        provider = userMap.get(possibleId.toString()) || null;
      }
      // fallback to donorName if no provider record
      if (!provider && l.donorName) {
        provider = { name: l.donorName };
      }

      return {
        id: l._id?.toString() || l.id,
        title: l.title,
        description: l.description,
        foodType: l.foodType,
        quantity: l.quantity,
        unit: l.unit || l.unitOfMeasure || null,
        location: l.location,
        availableFrom: l.availableFrom || null,
        availableUntil: l.availableUntil || null,
        expiresAt: l.expiresAt || null,
        status: l.status,
        safeToEatHours: l.safeToEatHours || l.safetyHours || l.safeToEatHours,
        tags: l.qualityTags || l.tags || l.dietaryInfo || [],
        allergens: l.allergens || [],
        contactInfo: l.contactInfo || null,
        provider: provider,
        providerId: l.providerId || l.donorId || null,
        providerName: l.providerName || l.donorName || null,
        images: l.images || [],
        specialInstructions: l.specialInstructions || null,
        statusHistory: l.statusHistory || null,
        collectedBy: l.collectedBy || l.pickedUpBy || null,
        collectedAt: l.collectedAt || l.pickedUpAt || null,
        createdAt: l.createdAt || l._createdAt || null,
        updatedAt: l.updatedAt || null,
        qrCode: l.qrCode || null,
        raw: l, // include raw document for any additional fields
      };
    });

    return NextResponse.json({
      message: "Food listings retrieved successfully",
      listings: data,
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
    // Create a "new listing" notification for active users immediately and
    // schedule pending notifications for other users so they'll receive them
    // if they log in before the listing expires.
    try {
      const users = await db.collection("users").find({}).toArray();
      const createdAt = new Date().toISOString();
      const baseId = Date.now().toString();

      const ACTIVE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes - consider user 'online' if active within this window

      const immediateDocs: any[] = []
      const pendingDocs: any[] = []

      const expiresAt = newListing.availableUntil || null

      users.forEach((u: any, idx: number) => {
        const uid = u._id?.toString() || u.id
        // don't notify the lister
        if (newListing.donorId && (uid === newListing.donorId)) return

        const title = `New food listed: ${newListing.title}`
        const message = `${newListing.donorName} listed "${newListing.title}" — check it out!`

        const recipient = {
          id: `${baseId}-${uid}-${idx}`,
          userId: uid,
          type: "new_listing",
          title,
          message,
          read: false,
          createdAt,
          priority: "medium",
          actionUrl: "/dashboard/food-listings",
          metadata: {
            foodListingId: newListing.id,
            donorName: newListing.donorName,
          },
        }

        // If user has a lastActive timestamp and it is within the active window,
        // push an immediate notification. Otherwise schedule a pending notification
        // to be delivered on next login if the listing hasn't expired.
        const lastActive = u.lastActive ? new Date(u.lastActive).getTime() : 0
        const now = Date.now()
        if (lastActive && now - lastActive <= ACTIVE_WINDOW_MS) {
          immediateDocs.push(recipient)
        } else {
          // schedule pending notification tied to the listing expiry
          pendingDocs.push({
            id: `${baseId}-pending-${uid}-${idx}`,
            userId: uid,
            type: "new_listing",
            title,
            message,
            metadata: {
              foodListingId: newListing.id,
              donorName: newListing.donorName,
            },
            createdAt,
            expiresAt: expiresAt,
          })
        }
      })

      if (immediateDocs.length > 0) {
        await db.collection("notifications").insertMany(immediateDocs)
      }
      if (pendingDocs.length > 0) {
        await db.collection("pending_notifications").insertMany(pendingDocs)
      }
    } catch (notifyErr) {
      console.error("Failed to create notifications or pending scheduling:", notifyErr)
    }
    return NextResponse.json({
      message: "Food listing created successfully with QR code",
      listing: newListing,
    });
  } catch (error) {
    console.error("Food listing creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
