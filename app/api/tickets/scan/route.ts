import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { verifyTicketToken } from '@/lib/qr-ticket'
import { updateAnalyticsForDonation } from '@/lib/analytics'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    const { token, scannerId } = await request.json()
    if (!token) return NextResponse.json({ message: 'Missing token' }, { status: 400 })

    const payload = verifyTicketToken(token)
    if (!payload) return NextResponse.json({ message: 'Invalid token' }, { status: 400 })

    const db = await getDatabase()
    const ticketsCol = db.collection('tickets')
    const now = new Date()
    // Fetch the ticket doc first for clearer decisions
    const existingBefore = await ticketsCol.findOne({ id: payload.ticketId, token })
    if (!existingBefore) return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    if (existingBefore.usedAt) return NextResponse.json({ message: 'Ticket already used' }, { status: 409 })
    if (new Date(payload.expiresAt) < now) return NextResponse.json({ message: 'Ticket expired' }, { status: 400 })

    // Mark ticket used once (atomic) – accept null or missing usedAt
    const usedAt = new Date()
    const updateRes = await ticketsCol.updateOne(
      { id: payload.ticketId, token, $or: [ { usedAt: null }, { usedAt: { $exists: false } } ] },
      { $set: { usedAt, usedByScanner: scannerId || null, updatedAt: usedAt } }
    )

    if (!updateRes || updateRes.modifiedCount !== 1) {
      const existingAfter = await ticketsCol.findOne({ id: payload.ticketId, token })
      if (!existingAfter) return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
      if (existingAfter.usedAt) return NextResponse.json({ message: 'Ticket already used' }, { status: 409 })
      return NextResponse.json({ message: 'Ticket could not be marked used' }, { status: 400 })
    }

    const ticket = await ticketsCol.findOne({ id: payload.ticketId, token })
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket state unavailable after update' }, { status: 500 })
    }

    // Finalize collection and donation bookkeeping (best-effort)
    let collectionSummary: any = null
    let donationSummary: any = null
    try {
      const collectionsCol = db.collection('collections')
      let col = await collectionsCol.findOne({ id: ticket.collectionId })
      if (col && col.status !== 'collected') {
        await collectionsCol.updateOne({ id: ticket.collectionId }, { $set: { status: 'collected', collectedAt: usedAt, updatedAt: usedAt } })
        col = await collectionsCol.findOne({ id: ticket.collectionId })
      }

      // Update related listing
      try {
        if (col) {
          const foodListingsCol = db.collection('foodListings')
          const listingQueries: any[] = [{ id: col.listingId }]
          if (col.listingId && /^[0-9a-fA-F]{24}$/.test(String(col.listingId))) {
            try { listingQueries.push({ _id: new ObjectId(String(col.listingId)) }) } catch {}
          }
          await foodListingsCol.updateOne({ $or: listingQueries }, { $set: { status: 'collected', collectedAt: usedAt, collectedBy: scannerId || null } })
        }
      } catch (e) {
        console.warn('Scan: failed to update listing status', e)
      }

      // Insert donation and update analytics
      try {
        if (col) {
          const donationsCol = db.collection('donations')
          // Heuristic to compute weight
          const candidates = [col.quantity, col.weight, col.raw?.quantity, col.listingQuantity, col.listingQty]
          let foodKg = 0
          for (const c of candidates) {
            if (!c) continue
            try {
              const s = String(c).trim()
              const mKg = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|kilograms?)$/i)
              const mG = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|grams?)$/i)
              const mNum = s.match(/^[0-9]+(?:\.[0-9]+)?$/)
              if (mKg) { foodKg = Number(mKg[1]); break }
              if (mG) { foodKg = Number(mG[1]) / 1000; break }
              if (mNum) { foodKg = Number(mNum[0]); break }
            } catch {}
          }
          if (!foodKg) foodKg = 2
          const CO2_PER_KG = 2.5
          const WATER_L_PER_KG = 500
          const impactMetrics = {
            foodKg,
            co2Saved: Number((foodKg * CO2_PER_KG).toFixed(2)),
            waterSaved: Math.round(foodKg * WATER_L_PER_KG),
            peopleFed: 1,
          }
          const donationDoc: any = {
            id: `donation-${col.listingId}-${Date.now()}`,
            donorId: col.donorId || col.donatedBy || null,
            donorName: col.donatedBy || col.donorName || null,
            recipientId: col.recipientId || null,
            recipientName: col.recipientName || null,
            listingId: col.listingId || null,
            collectedAt: usedAt,
            createdAt: new Date().toISOString(),
            status: 'collected',
            quantity: col.quantity || null,
            weight: foodKg,
            impactMetrics,
          }
          const ins = await donationsCol.insertOne(donationDoc)
          const savedDonation = { ...donationDoc, _id: ins.insertedId }
          try { await updateAnalyticsForDonation(db, savedDonation) } catch (e) { console.warn('Scan: analytics update failed', e) }

          donationSummary = { id: savedDonation.id, listingId: savedDonation.listingId, weight: savedDonation.weight, impactMetrics: savedDonation.impactMetrics, collectedAt: savedDonation.collectedAt }
        }
      } catch (e) {
        console.warn('Scan: failed to insert donation', e)
      }

      // Notifications (best-effort)
      try {
        if (col) {
          const notificationsCol = db.collection('notifications')
          const donorNotification = {
            id: `collection-${col.listingId}-donor-${Date.now()}`,
            userId: col.donorId || null,
            type: 'item_collected',
            title: `Item Collected: ${col.listingTitle || ''}`,
            message: `Your item has been collected`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: { listingId: col.listingId, collectionMethod: 'qr_scan' }
          }
          const collectorNotification = {
            id: `collection-${col.listingId}-collector-${Date.now()}`,
            userId: col.recipientId || null,
            type: 'collection_confirmed',
            title: `Collection Confirmed: ${col.listingTitle || ''}`,
            message: `You collected ${col.listingTitle || ''}`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: { listingId: col.listingId, collectionMethod: 'qr_scan' }
          }
          if (donorNotification.userId) await notificationsCol.updateOne({ id: donorNotification.id }, { $setOnInsert: donorNotification }, { upsert: true })
          if (collectorNotification.userId) await notificationsCol.updateOne({ id: collectorNotification.id }, { $setOnInsert: collectorNotification }, { upsert: true })
        }
      } catch (e) {
        console.warn('Scan: notifications failed', e)
      }

      // Build collection summary
  if (col) {
        collectionSummary = {
          id: col.id || (col._id && String(col._id)) || ticket.collectionId,
          listingId: col.listingId || null,
          status: col.status || 'collected',
          collectedAt: (col.collectedAt && new Date(col.collectedAt).toISOString()) || usedAt.toISOString(),
        }
      }
    } catch (e) {
      console.warn('Scan bookkeeping failed', e)
    }

  if (!collectionSummary) {
      collectionSummary = { id: ticket.collectionId, status: 'collected', collectedAt: usedAt.toISOString() }
    }

    return NextResponse.json({
      message: 'Ticket valid',
  ticketId: ticket.id,
  collectionId: ticket.collectionId,
      usedAt: usedAt.toISOString(),
      collection: collectionSummary,
      donation: donationSummary,
    })
  } catch (e) {
    console.error('Ticket scan error', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
