"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis } from "recharts"
import { Leaf, LogOut, Users, Utensils, Droplets, Zap, Calendar, Award, Target, ArrowUp } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import Link from "next/link"

interface User {
  id: string
  name: string
  email: string
  userType: string
  organization: string
}

interface AnalyticsData {
  overview: {
    totalFoodSaved: number
    totalPeopleServed: number
    totalListings: number
    carbonFootprintSaved: number
    waterFootprintSaved: number
    wasteReductionPercentage: number
  }
  trends: {
    foodSavedTrend: Array<{ date: string; amount: number }>
    userEngagementTrend: Array<{ date: string; users: number; listings: number }>
    impactTrend: Array<{ date: string; carbon: number; water: number }>
  }
  breakdown: {
    foodTypeDistribution: Array<{ type: string; amount: number; color: string }>
    organizationStats: Array<{ organization: string; listings: number; impact: number }>
    timeDistribution: Array<{ hour: string; listings: number }>
  }
  goals: {
    monthlyFoodTarget: number
    currentMonthProgress: number
    carbonReductionTarget: number
    currentCarbonProgress: number
  }
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [timeRange, setTimeRange] = useState("30d")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
      fetchAnalytics()
    } else {
      router.push("/login")
    }
  }, [router, timeRange])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`)
      const data = await response.json()
      setAnalyticsData(data.analytics)
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case "student":
        return "bg-blue-100 text-blue-800"
      case "staff":
        return "bg-green-100 text-green-800"
      case "canteen":
        return "bg-orange-100 text-orange-800"
      case "hostel":
        return "bg-purple-100 text-purple-800"
      case "event":
        return "bg-pink-100 text-pink-800"
      case "ngo":
        return "bg-cyan-100 text-cyan-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  if (!user || !analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  const chartConfig = {
    amount: {
      label: "Amount (kg)",
      color: "hsl(var(--chart-1))",
    },
    users: {
      label: "Active Users",
      color: "hsl(var(--chart-2))",
    },
    listings: {
      label: "Listings",
      color: "hsl(var(--chart-3))",
    },
    carbon: {
      label: "Carbon Saved (kg)",
      color: "hsl(var(--chart-4))",
    },
    water: {
      label: "Water Saved (L)",
      color: "hsl(var(--chart-5))",
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Leaf className="h-8 w-8 text-cyan-800" />
            </Link>
            <h1 className="text-2xl font-bold text-cyan-800">FoodShare</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Badge className={getUserTypeColor(user.userType)}>
        {user.userType ? (user.userType.charAt(0).toUpperCase() + user.userType.slice(1)) : ""}
            </Badge>
            <span className="text-slate-700">Welcome, {user.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 bg-transparent"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Analytics Dashboard</h2>
            <p className="text-slate-600">Track your environmental impact and platform usage</p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 3 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Food Saved</CardTitle>
              <Utensils className="h-4 w-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{analyticsData.overview.totalFoodSaved}kg</div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>+12% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">People Served</CardTitle>
              <Users className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">
                {formatNumber(analyticsData.overview.totalPeopleServed)}
              </div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>+8% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{analyticsData.overview.totalListings}</div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>+15% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Carbon Saved</CardTitle>
              <Leaf className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">
                {analyticsData.overview.carbonFootprintSaved}kg CO₂
              </div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>+18% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Water Saved</CardTitle>
              <Droplets className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{analyticsData.overview.waterFootprintSaved}L</div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>+14% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waste Reduction</CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">
                {analyticsData.overview.wasteReductionPercentage}%
              </div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>+3% from last month</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Goals Progress */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-cyan-800" />
                Monthly Food Target
              </CardTitle>
              <CardDescription>Progress towards this month's food redistribution goal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Current: {analyticsData.goals.currentMonthProgress}kg</span>
                  <span>Target: {analyticsData.goals.monthlyFoodTarget}kg</span>
                </div>
                <Progress
                  value={(analyticsData.goals.currentMonthProgress / analyticsData.goals.monthlyFoodTarget) * 100}
                  className="h-2"
                />
                <p className="text-xs text-slate-600">
                  {Math.round((analyticsData.goals.currentMonthProgress / analyticsData.goals.monthlyFoodTarget) * 100)}
                  % complete
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-green-600" />
                Carbon Reduction Target
              </CardTitle>
              <CardDescription>Progress towards carbon footprint reduction goal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Current: {analyticsData.goals.currentCarbonProgress}kg CO₂</span>
                  <span>Target: {analyticsData.goals.carbonReductionTarget}kg CO₂</span>
                </div>
                <Progress
                  value={(analyticsData.goals.currentCarbonProgress / analyticsData.goals.carbonReductionTarget) * 100}
                  className="h-2"
                />
                <p className="text-xs text-slate-600">
                  {Math.round(
                    (analyticsData.goals.currentCarbonProgress / analyticsData.goals.carbonReductionTarget) * 100,
                  )}
                  % complete
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="impact">Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>Food Saved Over Time</CardTitle>
                  <CardDescription>Daily food redistribution amounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <AreaChart data={analyticsData.trends.foodSavedTrend}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>User Engagement</CardTitle>
                  <CardDescription>Active users and listings created</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <LineChart data={analyticsData.trends.userEngagementTrend}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--chart-2))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="listings"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--chart-3))" }}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>Food Type Distribution</CardTitle>
                  <CardDescription>Breakdown by food categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <PieChart>
                      <Pie
                        data={analyticsData.breakdown.foodTypeDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="amount"
                        label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                      >
                        {analyticsData.breakdown.foodTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>Peak Hours</CardTitle>
                  <CardDescription>Food listings by hour of day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={analyticsData.breakdown.timeDistribution}>
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="listings" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Organization Leaderboard</CardTitle>
                <CardDescription>Top contributing organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.breakdown.organizationStats.map((org, index) => (
                    <div
                      key={org.organization}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center text-sm font-bold text-cyan-800">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{org.organization}</p>
                          <p className="text-sm text-slate-600">{org.listings} listings</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-cyan-800">{org.impact}kg</p>
                        <p className="text-xs text-slate-600">food saved</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impact" className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Environmental Impact Over Time</CardTitle>
                <CardDescription>Carbon and water footprint savings</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[400px]">
                  <AreaChart data={analyticsData.trends.impactTrend}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="carbon"
                      stackId="1"
                      stroke="hsl(var(--chart-4))"
                      fill="hsl(var(--chart-4))"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="water"
                      stackId="2"
                      stroke="hsl(var(--chart-5))"
                      fill="hsl(var(--chart-5))"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-slate-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <Leaf className="h-5 w-5" />
                    Carbon Impact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-green-800">
                      {analyticsData.overview.carbonFootprintSaved}kg CO₂
                    </p>
                    <p className="text-sm text-green-700">Equivalent to planting 12 trees</p>
                    <p className="text-xs text-green-600">Based on food production emissions avoided</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Droplets className="h-5 w-5" />
                    Water Impact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-blue-800">{analyticsData.overview.waterFootprintSaved}L</p>
                    <p className="text-sm text-blue-700">Equivalent to 45 days of drinking water</p>
                    <p className="text-xs text-blue-600">Based on agricultural water usage avoided</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <Zap className="h-5 w-5" />
                    Energy Impact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-amber-800">1,250 kWh</p>
                    <p className="text-sm text-amber-700">Energy saved from food production</p>
                    <p className="text-xs text-amber-600">Equivalent to powering a home for 42 days</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
