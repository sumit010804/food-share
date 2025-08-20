import { Db } from 'mongodb'

/**
 * Incrementally update a lightweight analytics summary and daily buckets
 * when a donation/collection is recorded.
 *
 * - Keeps a single summary doc with id='summary'.
 * - Maintains per-day counters under `daily.<YYYY-MM-DD>` using $inc.
 */
export async function updateAnalyticsForDonation(db: Db, donation: any) {
  try {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]

    // Use provided impact metrics if available, otherwise fall back to sensible defaults
  // Use explicit impact metrics from the donation when present. Avoid non-zero fallbacks
  // which caused analytics to increment even when a donation had no computed metrics.
  const impact = (donation && donation.impactMetrics) || {}
  const peopleServed = Number(impact.peopleServed || 0)
  // Accept both carbonSaved and co2Saved
  const carbon = Number((impact.carbonSaved ?? impact.co2Saved) || 0)
  const water = Number(impact.waterSaved || 0)
  const foodKg = Number(impact.foodKg || 0)

    const analyticsCol = db.collection('analytics')

    const inc: any = {
      totalCollections: 1,
      totalDonations: 1,
      totalFoodSaved: foodKg,
      totalPeopleServed: peopleServed,
      carbonFootprintSaved: carbon,
      waterFootprintSaved: water,
    }

    // daily counters
    inc[`daily.${dateStr}.collections`] = 1
    inc[`daily.${dateStr}.donations`] = 1
    inc[`daily.${dateStr}.foodSaved`] = foodKg
    inc[`daily.${dateStr}.carbon`] = carbon
    inc[`daily.${dateStr}.water`] = water

    await analyticsCol.updateOne(
      { id: 'summary' },
      {
        $inc: inc,
        $set: { updatedAt: now },
        $setOnInsert: { id: 'summary', createdAt: now },
      },
      { upsert: true }
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to update analytics for donation', e)
  }
}
