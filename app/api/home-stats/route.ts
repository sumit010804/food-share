import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

function parseKgFromQuantity(q: any): number {
  if (!q) return 0
  try {
    const s = String(q).trim().toLowerCase()
    const mKg = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|kilograms?)$/i)
    const mG = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|grams?)$/i)
    const mNum = s.match(/^([0-9]+(?:\.[0-9]+)?)/)
    if (mKg) return Number(mKg[1])
    if (mG) return Number(mG[1]) / 1000
    if (mNum) return Number(mNum[1])
  } catch {}
  return 0
}

export async function GET() {
  try {
    const db = await getDatabase()

    // 1) Meals Redistributed from donations collection
    const KG_PER_PERSON = Number(process.env.KG_PER_PERSON || process.env.PEOPLE_KG_PER_PERSON || '0.5')
    const donations = await db.collection('donations').find({}, { projection: { impactMetrics: 1, weight: 1, quantity: 1, raw: 1 } }).toArray()
    let mealsRedistributed = 0
    for (const d of donations) {
      const imp = (d as any).impactMetrics || {}
      const people = Number(imp.peopleFed ?? imp.peopleServed)
      if (people && Number.isFinite(people)) {
        mealsRedistributed += people
        continue
      }
      const kg = Number(imp.foodKg || d.weight || parseKgFromQuantity((d as any).quantity || (d as any).raw?.quantity)) || 0
      if (kg > 0 && KG_PER_PERSON > 0) mealsRedistributed += Math.floor(kg / KG_PER_PERSON)
    }

    // 2) Waste Reduction from analytics collection
    const analyticsCol = db.collection('analytics')
    const summary = await analyticsCol.findOne({ id: 'summary' })
    let wasteReductionPercent: number | null = null
    if (summary && typeof (summary as any).wasteReductionPercentage === 'number') {
      wasteReductionPercent = Math.max(0, Math.min(100, Math.round((summary as any).wasteReductionPercentage)))
    } else if (summary) {
      const totalFoodSaved = Number((summary as any).totalFoodSaved || 0)
      // Derive a bounded percentage using a simple saturation curve to avoid 100% early
      wasteReductionPercent = Math.min(95, Math.round((totalFoodSaved / Math.max(1, totalFoodSaved + 5)) * 100))
    } else {
      wasteReductionPercent = 0
    }

    // 3) Active Users from users collection (simple total count)
    const activeUsers = await db.collection('users').countDocuments({})

    return NextResponse.json({
      message: 'Home stats',
      stats: {
        mealsRedistributed,
        wasteReductionPercent,
        activeUsers,
      },
    })
  } catch (e) {
    console.error('home-stats error', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
