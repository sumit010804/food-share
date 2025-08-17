import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

async function generateAnalyticsFromDB(timeRange: string) {
  const db = await getDatabase()

  const [foodListings, donations, collections, events] = await Promise.all([
    db.collection("foodListings").find().toArray(),
    db.collection("donations").find().toArray(),
    db.collection("collections").find().toArray(),
    db.collection("events").find().toArray(),
  ])

  const now = new Date()
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // Helper to normalize date-like fields
  const toDate = (val: any) => {
    if (!val) return null
    if (val instanceof Date) return val
    try {
      return new Date(val)
    } catch {
      return null
    }
  }

  // Filter data by time range
  const recentListings = foodListings.filter((listing: any) => {
    const d = toDate(listing.createdAt)
    return d && d >= startDate
  })

  const recentDonations = donations.filter((donation: any) => {
    const d = toDate(donation.donatedAt) || toDate(donation.collectedAt) || toDate(donation.createdAt)
    return d && d >= startDate
  })

  const recentCollections = collections.filter((collection: any) => {
    const d = toDate(collection.collectedAt || collection.reservedAt)
    return d && d >= startDate
  })

  // Helper to extract weight in kg from a donation record
  const parseKgFromQuantity = (q: any) => {
    if (!q) return 0
    try {
      const s = String(q).trim().toLowerCase()
      const mKg = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|kilograms?)$/i)
      const mG = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|grams?)$/i)
      const mNum = s.match(/^([0-9]+(?:\.[0-9]+)?)/)
      if (mKg) return Number(mKg[1])
      if (mG) return Number(mG[1]) / 1000
      if (mNum) return Number(mNum[1])
    } catch (e) {}
    return 0
  }

  const CO2_PER_KG = 2.5
  const WATER_L_PER_KG = 500

  const totalFoodSaved = recentDonations.reduce((sum: number, donation: any) => {
    const impact = donation.impactMetrics || {}
    if (impact.foodKg) return sum + Number(impact.foodKg)
    if (donation.weight) return sum + Number(donation.weight)
    const q = donation.quantity || donation.raw?.quantity || null
    const parsed = parseKgFromQuantity(q)
    if (parsed) return sum + parsed
    return sum
  }, 0)

  const totalPeopleServed = recentDonations.reduce((sum: number, donation: any) => {
    const impact = donation.impactMetrics || {}
    return sum + (Number(impact.peopleFed || impact.peopleServed || 0) || 0)
  }, 0)

  const totalListings = recentListings.length

  const carbonFootprintSaved = recentDonations.reduce((sum: number, donation: any) => {
    const impact = donation.impactMetrics || {}
    if (impact.co2Saved) return sum + Number(impact.co2Saved)
    // fallback: compute from available weight
    const kg = Number(impact.foodKg || donation.weight || parseKgFromQuantity(donation.quantity || donation.raw?.quantity)) || 0
    return sum + kg * CO2_PER_KG
  }, 0)

  const waterFootprintSaved = recentDonations.reduce((sum: number, donation: any) => {
    const impact = donation.impactMetrics || {}
    if (impact.waterSaved) return sum + Number(impact.waterSaved)
    const kg = Number(impact.foodKg || donation.weight || parseKgFromQuantity(donation.quantity || donation.raw?.quantity)) || 0
    return sum + kg * WATER_L_PER_KG
  }, 0)

  // Generate trend data based on real data
  const foodSavedTrend: Array<any> = []
  const userEngagementTrend: Array<any> = []
  const impactTrend: Array<any> = []

  for (let i = Math.min(days, 30) - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split("T")[0]

    const dayListings = recentListings.filter((listing: any) => {
      const d = toDate(listing.createdAt)
      return d && d.toISOString().split("T")[0] === dateStr
    })

    const dayDonations = recentDonations.filter((donation: any) => {
      const d = toDate(donation.donatedAt) || toDate(donation.collectedAt) || toDate(donation.createdAt)
      return d && d.toISOString().split("T")[0] === dateStr
    })

    const amountKg = dayDonations.reduce((s: number, d: any) => {
      const impact = d.impactMetrics || {}
      if (impact.foodKg) return s + Number(impact.foodKg)
      if (d.weight) return s + Number(d.weight)
      return s + (parseKgFromQuantity(d.quantity || d.raw?.quantity) || 0)
    }, 0)

    const carbonDay = dayDonations.reduce((s: number, d: any) => {
      const impact = d.impactMetrics || {}
      if (impact.co2Saved) return s + Number(impact.co2Saved)
      const kg = Number(impact.foodKg || d.weight || parseKgFromQuantity(d.quantity || d.raw?.quantity)) || 0
      return s + kg * CO2_PER_KG
    }, 0)

    const waterDay = dayDonations.reduce((s: number, d: any) => {
      const impact = d.impactMetrics || {}
      if (impact.waterSaved) return s + Number(impact.waterSaved)
      const kg = Number(impact.foodKg || d.weight || parseKgFromQuantity(d.quantity || d.raw?.quantity)) || 0
      return s + kg * WATER_L_PER_KG
    }, 0)

    foodSavedTrend.push({
      date: dateStr,
      amount: amountKg,
    })

    userEngagementTrend.push({
      date: dateStr,
      users: new Set([...(dayListings as any[]).map((l) => l.donorId), ...(dayDonations as any[]).map((c) => c.recipientId || c.collectedBy)]).size,
      listings: dayListings.length,
    })

    impactTrend.push({
      date: dateStr,
      carbon: Math.round(carbonDay),
      water: Math.round(waterDay),
    })
  }

  // Calculate food type distribution from real data
  const foodTypeCount: Record<string, number> = {}
  recentListings.forEach((listing: any) => {
    const typeRaw = listing.foodType || "Prepared Food"
    const type = String(typeRaw).replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
    foodTypeCount[type] = (foodTypeCount[type] || 0) + 1
  })

  const foodTypeDistribution = Object.entries(foodTypeCount).map(([type, amount], index) => ({
    type,
    amount,
    color: ["#0891b2", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"][index % 5],
  }))

  // Calculate organization stats from real data
  const orgStats: Record<string, { listings: number; impact: number }> = {}
  recentListings.forEach((listing: any) => {
    const org = listing.donorName || "Unknown"
    if (!orgStats[org]) {
      orgStats[org] = { listings: 0, impact: 0 }
    }
    orgStats[org].listings += 1
    orgStats[org].impact += 4 // Assume 4kg impact per listing
  })

  const organizationStats = Object.entries(orgStats)
    .map(([organization, stats]) => ({ organization, ...stats }))
    .sort((a, b) => b.listings - a.listings)
    .slice(0, 5)

  return {
    overview: {
      totalFoodSaved: Math.round(totalFoodSaved),
      totalPeopleServed,
      totalListings,
      carbonFootprintSaved: Math.round(carbonFootprintSaved),
      waterFootprintSaved: Math.round(waterFootprintSaved),
      wasteReductionPercentage: Math.min(95, Math.round((totalListings / Math.max(1, totalListings + 5)) * 100)),
    },
    trends: {
      foodSavedTrend,
      userEngagementTrend,
      impactTrend,
    },
    breakdown: {
      foodTypeDistribution:
        foodTypeDistribution.length > 0
          ? foodTypeDistribution
          : [
              { type: "Prepared Food", amount: 35, color: "#0891b2" },
              { type: "Fresh Produce", amount: 25, color: "#f59e0b" },
              { type: "Packaged Items", amount: 20, color: "#10b981" },
              { type: "Beverages", amount: 12, color: "#8b5cf6" },
            ],
      organizationStats:
        organizationStats.length > 0
          ? organizationStats
          : [
              { organization: "Main Campus Canteen", listings: 45, impact: 180 },
              { organization: "Student Hostel A", listings: 32, impact: 128 },
            ],
      timeDistribution: [
        { hour: "6AM", listings: 2 },
        { hour: "8AM", listings: 8 },
        { hour: "10AM", listings: 12 },
        { hour: "12PM", listings: 25 },
        { hour: "2PM", listings: 18 },
        { hour: "4PM", listings: 15 },
        { hour: "6PM", listings: 22 },
        { hour: "8PM", listings: 8 },
        { hour: "10PM", listings: 3 },
      ],
    },
    goals: {
      monthlyFoodTarget: 500,
      currentMonthProgress: Math.round(totalFoodSaved),
      carbonReductionTarget: 1000,
      currentCarbonProgress: Math.round(carbonFootprintSaved),
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get("timeRange") || "30d"

    const analyticsData = await generateAnalyticsFromDB(timeRange)

    return NextResponse.json({
      message: "Analytics data retrieved successfully",
      analytics: analyticsData,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Analytics GET error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
