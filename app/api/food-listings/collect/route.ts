import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"
import { getDatabase } from "@/lib/mongodb"
import type { CollectionRecord, DonationRecord } from "@/lib/types"
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    const { listingId, collectedBy, collectedAt, collectionMethod = "qr_scan" } = await request.json()

    // Try DB-backed flow first
    try {
      const db = await getDatabase()
      const collectionsCol = db.collection('collections')
      const foodListingsCol = db.collection('foodListings')
      const donationsCol = db.collection('donations')
      const notificationsCol = db.collection('notifications')

      // find collection either by listingId field or by id
      let existing = await collectionsCol.findOne({ $or: [{ listingId }, { id: listingId }] })

      // If no collection doc exists yet, try to find the reserved food listing and create a collection from it
      if (!existing) {
        const listingQueries: any[] = [{ id: listingId }]
        if (/^[0-9a-fA-F]{24}$/.test(String(listingId))) {
          try { listingQueries.push({ _id: new ObjectId(String(listingId)) }) } catch (e) { /* ignore */ }
        }
        const listingDoc = await foodListingsCol.findOne({ $or: listingQueries })
        if (!listingDoc) {
          return NextResponse.json({ message: 'Collection not found' }, { status: 404 })
        }

        // Only allow collect if listing is reserved or available
        if (listingDoc.status === 'collected') {
          return NextResponse.json({ message: 'Item already collected' }, { status: 400 })
        }

        // Create collection document from listing
        const now = new Date()
        const collectionDoc = {
          id: `col-${Date.now().toString()}-${listingDoc.id || listingDoc._id}`,
          listingId: listingDoc.id || (listingDoc._id && String(listingDoc._id)),
          listingTitle: listingDoc.title,
          donatedBy: listingDoc.donorName || listingDoc.providerName || null,
          organization: listingDoc.organization || null,
          recipientId: listingDoc.reservedBy || null,
          recipientEmail: listingDoc.reservedByEmail || null,
          recipientName: listingDoc.reservedByName || null,
          reservedAt: listingDoc.reservedAt || listingDoc.updatedAt || now,
          status: 'reserved',
          quantity: listingDoc.quantity || null,
          location: listingDoc.location || null,
          foodType: listingDoc.foodType || null,
          createdAt: now,
          updatedAt: now,
        }
        const insertRes = await collectionsCol.insertOne(collectionDoc)
        existing = await collectionsCol.findOne({ _id: insertRes.insertedId })
      }

      // Ensure we have a collection document
      if (!existing) {
        return NextResponse.json({ message: 'Collection lookup failed' }, { status: 500 })
      }

      // Update collection to collected
      await collectionsCol.updateOne(
        { _id: existing._id },
        { $set: { status: 'collected', collectedAt, collectedBy, collectionMethod, updatedAt: new Date() } }
      )

      // Update corresponding food listing status to collected
      const listingQueries2: any[] = [{ id: existing.listingId || listingId }]
      if (/^[0-9a-fA-F]{24}$/.test(String(existing.listingId || listingId))) {
        try { listingQueries2.push({ _id: new ObjectId(String(existing.listingId || listingId)) }) } catch (e) { /* ignore */ }
      }

      await foodListingsCol.updateOne({ $or: listingQueries2 }, { $set: { status: 'collected', collectedAt: new Date(), collectedBy } })

      // Insert a donation record
      const donationDoc = {
        id: `donation-${existing.listingId || listingId}-${Date.now()}`,
        donorId: existing.donorId || existing.donatedBy || null,
        donorName: existing.donatedBy || existing.donorName || null,
        recipientId: existing.recipientId || existing.recipientId || null,
        recipientName: existing.recipientName || collectedBy || null,
        listingId: existing.listingId || listingId,
        collectedAt,
        createdAt: new Date().toISOString(),
        status: 'collected',
      }
      await donationsCol.insertOne(donationDoc)

      // Create notifications
      try {
        const donorNotification = {
          id: `collection-${existing.listingId || listingId}-donor`,
          userId: existing.donorId || existing.donatedBy || null,
          type: 'item_collected',
          title: `Item Collected: ${existing.listingTitle || existing.foodTitle || ''}`,
          message: `Your item has been collected by ${collectedBy}`,
          read: false,
          createdAt: new Date().toISOString(),
          metadata: { listingId: existing.listingId || listingId, collectionMethod }
        }
        const collectorNotification = {
          id: `collection-${existing.listingId || listingId}-collector`,
          userId: existing.recipientId || null,
          type: 'collection_confirmed',
          title: `Collection Confirmed: ${existing.listingTitle || existing.foodTitle || ''}`,
          message: `You collected ${existing.listingTitle || existing.foodTitle || ''}`,
          read: false,
          createdAt: new Date().toISOString(),
          metadata: { listingId: existing.listingId || listingId, collectionMethod }
        }
        if (donorNotification.userId) await notificationsCol.insertOne(donorNotification)
        if (collectorNotification.userId) await notificationsCol.insertOne(collectorNotification)
      } catch (e) {
        console.warn('Failed to create notifications for collect', e)
      }

      return NextResponse.json({ message: 'Item marked as collected successfully', collection: { ...existing, status: 'collected', collectedAt, collectedBy } })
    } catch (dbErr) {
      console.warn('DB-backed collect failed, falling back to local storage', dbErr)
    }

    // Fallback to in-memory/local storage behavior
    const listing = storage.getFoodListingById(listingId)
    if (!listing) {
      return NextResponse.json({ message: 'Food listing not found' }, { status: 404 })
    }

    // Check if already collected
    if (listing.status === 'collected') {
      return NextResponse.json({ message: 'Item already collected' }, { status: 400 })
    }

    const collection: CollectionRecord = {
      id: Date.now().toString(),
      collectorId: 'current-user', // In real app, get from auth
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
      recipientId: 'current-user',
      recipientName: collectedBy,
      foodTitle: listing.title,
      foodType: listing.foodType,
      quantity: listing.quantity,
      donatedAt: listing.createdAt,
      collectedAt,
      status: 'collected',
      impactMetrics: {
        carbonSaved: 2.5,
        waterSaved: 150,
        peopleServed: 1,
      },
    }

    storage.addDonation(donation)

    storage.updateFoodListing(listingId, {
      status: 'collected',
      collectedBy,
      collectedAt,
    })

    const donorNotification = {
      id: `collection-${listingId}-donor`,
      type: 'item_collected' as const,
      title: `Item Collected: ${listing.title}`,
      message: `Your food item "${listing.title}" has been collected by ${collectedBy}${
        collectionMethod === 'qr_scan' ? ' via QR scan' : collectionMethod === 'manual' ? ' manually' : ' directly'
      }.`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: 'medium' as const,
      actionUrl: '/dashboard/donation-history',
      metadata: { listingId, collectorName: collectedBy, collectionMethod },
    }

    const collectorNotification = {
      id: `collection-${listingId}-collector`,
      type: 'collection_confirmed' as const,
      title: `Collection Confirmed: ${listing.title}`,
      message: `You have successfully collected "${listing.title}" from ${listing.donorName}.`,
      read: false,
      createdAt: new Date().toISOString(),
      priority: 'low' as const,
      actionUrl: '/dashboard/donation-history',
      metadata: { listingId, donorName: listing.donorName, collectionMethod },
    }

    storage.addNotification({ ...donorNotification, userId: listing.donorId })
    storage.addNotification({ ...collectorNotification, userId: 'current-user' })

    return NextResponse.json({ message: 'Item marked as collected successfully', collection })
  } catch (error) {
    console.error('Collection error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Prefer DB collections when available
    try {
      const db = await getDatabase()
      const collections = await db.collection('collections').find({}).toArray()
      return NextResponse.json({ message: "Collections retrieved successfully", collections })
    } catch (e) {
      // fallback to in-memory/local storage for dev
      const collections = storage.getCollections()
      return NextResponse.json({ message: "Collections retrieved successfully", collections })
    }
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
