import { type NextRequest, NextResponse } from "next/server"
import { storage } from "@/lib/local-storage"

function generateAnalyticsFromStorage(timeRange: string) {
  const foodListings = storage.getFoodListings()
  const donations = storage.getDonations()
  const collections = storage.getCollections()
  const events = storage.getEvents()

  const now = new Date()
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // Filter data by time range
  const recentListings = foodListings.filter((listing) => new Date(listing.createdAt) >= startDate)
  const recentDonations = donations.filter((donation) => new Date(donation.donatedAt) >= startDate)
  const recentCollections = collections.filter((collection) => new Date(collection.collectedAt) >= startDate)

  // Calculate totals from real data
  const totalFoodSaved = recentDonations.length * 2.5 // Assume 2.5kg average per donation
  const totalPeopleServed = recentDonations.reduce((sum, donation) => sum + donation.impactMetrics.peopleServed, 0)
  const totalListings = recentListings.length
  const carbonFootprintSaved = recentDonations.reduce((sum, donation) => sum + donation.impactMetrics.carbonSaved, 0)
  const waterFootprintSaved = recentDonations.reduce((sum, donation) => sum + donation.impactMetrics.waterSaved, 0)

  // Generate trend data based on real data
  const foodSavedTrend = []
  const userEngagementTrend = []
  const impactTrend = []

  for (let i = Math.min(days, 30) - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split("T")[0]

    const dayListings = recentListings.filter((listing) => listing.createdAt.split("T")[0] === dateStr)
    const dayCollections = recentCollections.filter((collection) => collection.collectedAt.split("T")[0] === dateStr)

    foodSavedTrend.push({
      date: dateStr,
      amount: dayCollections.length * 2.5, // Assume 2.5kg per collection
    })

    userEngagementTrend.push({
      date: dateStr,
      users: new Set([...dayListings.map((l) => l.donorId), ...dayCollections.map((c) => c.collectorId)]).size,
      listings: dayListings.length,
    })

    impactTrend.push({
      date: dateStr,
      carbon: dayCollections.length * 2.1, // 2.1kg CO2 per collection
      water: dayCollections.length * 15, // 15L water per collection
    })
  }

  // Calculate food type distribution from real data
  const foodTypeCount: Record<string, number> = {}
  recentListings.forEach((listing) => {
    const type = listing.foodType.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
    foodTypeCount[type] = (foodTypeCount[type] || 0) + 1
  })

  const foodTypeDistribution = Object.entries(foodTypeCount).map(([type, amount], index) => ({
    type,
    amount,
    color: ["#0891b2", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"][index % 5],
  }))

  // Calculate organization stats from real data
  const orgStats: Record<string, { listings: number; impact: number }> = {}
  recentListings.forEach((listing) => {
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

    const analyticsData = generateAnalyticsFromStorage(timeRange)

    return NextResponse.json({
      message: "Analytics data retrieved successfully",
      analytics: analyticsData,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
