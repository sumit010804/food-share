
import { type NextRequest, NextResponse } from "next/server"
import clientPromise, { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
// QR for pickup is now generated only when a reservation is made (tickets),
// not at listing creation time.
import type { FoodListing } from "@/lib/types"
import { sendNotificationEmail } from "@/lib/email"
export async function GET() {
  try {
    const db = await getDatabase();
    const now = new Date();
    // Fetch listings that are still active for discovery:
    // - status available or reserved
    // - OR have remainingQuantity > 0 (safeguard for partial collections)
    const candidateListings = await db
      .collection("foodListings")
      .find({ $or: [ { status: { $in: ["available", "reserved"] } }, { remainingQuantity: { $gt: 0 } } ] })
      .toArray();

    const updatedListings: any[] = []
    for (const l of candidateListings) {
      const raw = l.availableUntil
      let availableUntilDate: Date | null = null
      try {
        availableUntilDate = raw ? new Date(raw) : null
      } catch (e) {
        availableUntilDate = null
      }

      if (availableUntilDate && now > availableUntilDate) {
        // mark expired in DB
        try {
          await db.collection("foodListings").updateOne({ _id: l._id }, { $set: { status: "expired" } })
        } catch (e) {
          console.error('Failed to mark listing expired', l.id, e)
        }
        continue
      }

      // listing is still valid
      // If there's remaining quantity, ensure downstream consumers treat it as available
      if (typeof l.remainingQuantity === 'number' && l.remainingQuantity > 0) {
        l.status = 'available'
      }
      updatedListings.push(l)
    }

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
  imageUrl: l.imageUrl || null,
  freshnessLabel: l.freshnessLabel || null,
        unit: l.unit || l.unitOfMeasure || null,
        location: l.location,
        // expose coordinates if present
        lat: typeof l.lat === 'number' ? l.lat : (typeof l.latitude === 'number' ? l.latitude : undefined),
        lng: typeof l.lng === 'number' ? l.lng : (typeof l.longitude === 'number' ? l.longitude : undefined),
        availableFrom: l.availableFrom || null,
        availableUntil: l.availableUntil || null,
        expiresAt: l.expiresAt || null,
  status: l.status,
        safeToEatHours: l.safeToEatHours || l.safetyHours || l.safeToEatHours,
        tags: l.qualityTags || l.tags || l.dietaryInfo || [],
        allergens: l.allergens || [],
        contactInfo: l.contactInfo || null,
  provider: provider,
  // normalize provider/creator IDs to strings when possible so frontend
  // owner checks work reliably (DB may store ObjectId or plain string)
  providerId: (l.providerId && typeof l.providerId !== 'string') ? l.providerId.toString() : (l.providerId || l.donorId || null),
  providerName: l.providerName || l.donorName || null,
  // expose a canonical createdBy id for client-side ownership checks
  createdBy: (l.donorId && typeof l.donorId !== 'string') ? l.donorId.toString() : (l.donorId || l.providerId || l.createdBy || null),
        // lister email (if present)
        createdByEmail: l.createdByEmail || l.email || null,
  // reservation fields (if any)
  reservedBy: l.reservedBy || l.reservedById || null,
  reservedByEmail: l.reservedByEmail || l.reserverEmail || null,
  reservedByName: l.reservedByName || l.reserverName || null,
  reservedAt: l.reservedAt || l.reservedAt || null,
        images: l.images || [],
        specialInstructions: l.specialInstructions || null,
        statusHistory: l.statusHistory || null,
  remainingQuantity: typeof l.remainingQuantity === 'number' ? l.remainingQuantity : undefined,
  reservations: Array.isArray(l.reservations) ? l.reservations : undefined,
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
    // Enforce role-based permission: only canteen/hostel/admin can create listings
    try {
      const requester = await db.collection('users').findOne({
        $or: [
          { email: data.email },
          { name: data.createdBy },
          { id: data.donorId },
        ].filter(Boolean)
      })
      const userType = requester?.userType || requester?.role || null
      const allowed = userType && (userType === 'canteen' || userType === 'hostel' || userType === 'admin')
      if (!allowed) {
        return NextResponse.json({ message: 'You do not have permission to create listings.' }, { status: 403 })
      }
    } catch (e) {
      // If user lookup fails, default to denying to be safe
      return NextResponse.json({ message: 'Unauthorized to create listings.' }, { status: 403 })
    }
    // determine lister email: prefer explicit field, otherwise try to
    // resolve from users collection using donorId or createdBy/name
    let createdByEmail: string | null = data.email || null
    if (!createdByEmail) {
      try {
        const userQuery: any = []
        if (data.donorId) {
          if (typeof data.donorId === 'string' && /^[0-9a-fA-F]{24}$/.test(data.donorId)) {
            userQuery.push({ _id: new ObjectId(data.donorId) })
          }
          userQuery.push({ id: data.donorId })
        }
        if (data.createdBy) {
          userQuery.push({ id: data.createdBy })
          userQuery.push({ name: data.createdBy })
          userQuery.push({ email: data.createdBy })
        }
        if (userQuery.length > 0) {
          const found = await db.collection('users').findOne({ $or: userQuery })
          if (found && found.email) createdByEmail = found.email
        }
      } catch (e) {
        console.error('Failed to resolve lister email from users collection', e)
      }
    }
    const newListing: any = {
      id: Date.now().toString(),
      title: data.title,
      description: data.description,
      foodType: data.foodType,
      quantity: data.quantity,
      location: data.location,
    imageUrl: data.imageUrl || null,
    freshnessLabel: data.freshnessLabel || null,
      // store coordinates if provided and valid numbers
      ...(Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))
        ? { lat: Number(data.lat), lng: Number(data.lng) }
        : {}),
      availableUntil: data.availableUntil,
      safeToEatHours: Number.parseInt(data.safetyHours || data.safeToEatHours),
      allergens: data.allergens || [],
      dietaryInfo: data.dietaryInfo || data.tags || [],
      contactInfo: data.contactInfo || `Contact: ${data.createdBy}`,
      status: "available",
  donorId: data.donorId || "1",
  donorName: data.createdBy,
  // canonical owner id for frontend checks
  createdBy: data.donorId || data.createdBy || null,
  // lister email (resolved above if not provided)
  createdByEmail: createdByEmail,
  createdAt: new Date().toISOString(),
      // qrCode removed: QR tickets are generated when a reservation is made
      collectedBy: null,
      collectedAt: null,
    };
    await db.collection("foodListings").insertOne(newListing);
    // Create a "new listing" notification for active users immediately and
    // schedule pending notifications for other users so they'll receive them
    // if they log in before the listing expires.
    try {
      const allUsers = await db.collection("users").find({}).toArray();
      // Only notify Student, NGO, and Admin users
      const users = allUsers.filter((u: any) => {
        const role = String(u.userType || u.role || '').toLowerCase()
        return role === 'student' || role === 'ngo' || role === 'admin'
      })
      const emailById = new Map<string, string | undefined>(
        users.map((u: any) => [u._id?.toString() || u.id, u.email])
      )
      const createdAt = new Date().toISOString();
      const baseId = Date.now().toString();

      const ACTIVE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes - consider user 'online' if active within this window

      const immediateDocs: any[] = []
      const pendingDocs: any[] = []

      const expiresAt = newListing.availableUntil || null

  users.forEach((u: any, idx: number) => {
        const uid = u._id?.toString() || u.id
        const uEmail = u.email || null
        // don't notify the lister (by id or by email)
        if ((newListing.donorId && uid === newListing.donorId) || (newListing.createdByEmail && uEmail && String(uEmail) === String(newListing.createdByEmail))) return

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

  // Email only Student, NGO, and Admin users with a valid email (excluding the lister), regardless of lastActive.
      try {
        const title = `New food listed: ${newListing.title}`
        const message = `${newListing.donorName} listed "${newListing.title}" — check it out!`

        await Promise.all(
          users.map(async (u: any) => {
            const uid = u._id?.toString() || u.id
            const to = u.email as string | undefined
            if (!to) return
            // Skip the lister by id or by email
            if ((newListing.donorId && uid === newListing.donorId) || (newListing.createdByEmail && to && String(to) === String(newListing.createdByEmail))) return
            try {
              await sendNotificationEmail(to, title, message, "https://foodshare-black.vercel.app/dashboard/food-listings")
            } catch (e) {
              console.warn("Broadcast new-listing email failed for", to, e)
            }
          })
        )
      } catch (e) {
        console.warn("Email broadcast loop error (new listing)", e)
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
