"use client"

import { useState, useEffect } from "react"
import { User, Award, TrendingUp, Calendar, MapPin, Mail } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface ProfileCircleProps {
  user: {
    id: string
    name: string
    email: string
    userType: string
    organization: string
  } | null
}

// Mock data for user donations and statistics
const donationData = [
  { month: "Jan", amount: 12.5, items: 8 },
  { month: "Feb", amount: 18.2, items: 12 },
  { month: "Mar", amount: 25.8, items: 16 },
  { month: "Apr", amount: 32.1, items: 21 },
  { month: "May", amount: 28.9, items: 18 },
  { month: "Jun", amount: 45.2, items: 29 },
]

const foodTypeData = [
  { name: "Vegetables", value: 35, color: "#10b981" },
  { name: "Grains", value: 25, color: "#f59e0b" },
  { name: "Fruits", value: 20, color: "#ef4444" },
  { name: "Dairy", value: 12, color: "#8b5cf6" },
  { name: "Others", value: 8, color: "#06b6d4" },
]

const impactData = [
  { metric: "CO₂ Saved", value: 89.4, unit: "kg", color: "text-green-600" },
  { metric: "Water Saved", value: 2156, unit: "L", color: "text-blue-600" },
  { metric: "People Fed", value: 127, unit: "", color: "text-purple-600" },
  { metric: "Meals Provided", value: 89, unit: "", color: "text-orange-600" },
]

export function ProfileCircle({ user }: ProfileCircleProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case "student":
        return "from-blue-400 to-blue-600"
      case "staff":
        return "from-emerald-400 to-emerald-600"
      case "canteen":
        return "from-orange-400 to-orange-600"
      case "hostel":
        return "from-purple-400 to-purple-600"
      case "event":
        return "from-pink-400 to-pink-600"
      case "ngo":
        return "from-cyan-400 to-cyan-600"
      default:
        return "from-gray-400 to-gray-600"
    }
  }

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isHovered) {
      timeout = setTimeout(() => setShowTooltip(true), 500)
    } else {
      setShowTooltip(false)
    }
    return () => clearTimeout(timeout)
  }, [isHovered])

  // Ping server to update lastActive timestamp so notifications can target online users
  useEffect(() => {
    const ping = async () => {
      try {
        const userData = localStorage.getItem("user")
        if (!userData) return
        const user = JSON.parse(userData)
        await fetch("/api/users/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id || user._id }),
        })
      } catch (err) {
        // non-fatal
      }
    }

    ping()
    const interval = setInterval(ping, 60 * 1000) // every minute
    return () => clearInterval(interval)
  }, [])

  if (!user) {
    return null
  }

  return (
    <div className="relative">
      {/* Profile Circle */}
      <Dialog>
        <DialogTrigger asChild>
          <div
            className="relative cursor-pointer group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${getUserTypeColor(
                user.userType,
              )} flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl animate-fade-in`}
            >
              {getInitials(user.name)}
            </div>

            {/* Online Status Indicator */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full animate-pulse"></div>

            {/* Hover Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
          </div>
        </DialogTrigger>

        {/* Hover Tooltip */}
        {showTooltip && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 animate-fade-in">
            <Card className="w-64 border-emerald-100 shadow-xl bg-white/95 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${getUserTypeColor(
                      user.userType,
                    )} flex items-center justify-center text-white font-bold text-sm`}
                  >
                    {getInitials(user.name)}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-800">{user.name}</CardTitle>
                    <CardDescription className="text-xs text-slate-600">{user.organization}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Food Donated</span>
                    <span className="text-sm font-semibold text-emerald-600">45.2 kg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">People Helped</span>
                    <span className="text-sm font-semibold text-blue-600">127</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Status</span>
                    <Badge className="text-xs bg-green-100 text-green-800 border-green-200">Active</Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 text-center">Click to view detailed profile</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Profile Modal */}
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-serif font-bold text-slate-800">
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${getUserTypeColor(
                  user.userType,
                )} flex items-center justify-center text-white font-bold text-xl shadow-lg`}
              >
                {getInitials(user.name)}
              </div>
              <div>
                <h2>{user.name}</h2>
                <p className="text-sm text-slate-600 font-normal">{user.organization}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            {/* Personal Information */}
            <Card className="border-emerald-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-serif font-bold text-slate-800">
                  <User className="h-5 w-5 text-emerald-600" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">{user.organization}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Award className="h-4 w-4 text-slate-500" />
                  <Badge
                    className={`${getUserTypeColor(user.userType).replace("from-", "bg-").replace("to-", "").split(" ")[0].replace("bg-", "bg-").replace("-400", "-100")} text-${user.userType === "student" ? "blue" : user.userType === "staff" ? "emerald" : user.userType === "canteen" ? "orange" : user.userType === "hostel" ? "purple" : user.userType === "event" ? "pink" : "cyan"}-800 border-${user.userType === "student" ? "blue" : user.userType === "staff" ? "emerald" : user.userType === "canteen" ? "orange" : user.userType === "hostel" ? "purple" : user.userType === "event" ? "pink" : "cyan"}-200`}
                  >
                    {user.userType?.charAt(0).toUpperCase() + user.userType?.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Member since January 2024</span>
                </div>
              </CardContent>
            </Card>

            {/* Impact Summary */}
            <Card className="border-emerald-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-serif font-bold text-slate-800">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Impact Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {impactData.map((item, index) => (
                    <div
                      key={item.metric}
                      className="text-center p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100 animate-scale-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className={`text-2xl font-bold ${item.color} mb-1`}>
                        {item.value}
                        {item.unit && <span className="text-sm ml-1">{item.unit}</span>}
                      </div>
                      <div className="text-xs text-slate-600">{item.metric}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Donation Charts */}
          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            {/* Monthly Donations Chart */}
            <Card className="border-emerald-100">
              <CardHeader>
                <CardTitle className="text-lg font-serif font-bold text-slate-800">Monthly Donations</CardTitle>
                <CardDescription>Food donated over the past 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    amount: {
                      label: "Amount (kg)",
                      color: "hsl(var(--chart-1))",
                    },
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={donationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="var(--color-amount)"
                        fill="var(--color-amount)"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Food Type Distribution */}
            <Card className="border-emerald-100">
              <CardHeader>
                <CardTitle className="text-lg font-serif font-bold text-slate-800">Food Type Distribution</CardTitle>
                <CardDescription>Types of food you've donated</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    vegetables: { label: "Vegetables", color: "#10b981" },
                    grains: { label: "Grains", color: "#f59e0b" },
                    fruits: { label: "Fruits", color: "#ef4444" },
                    dairy: { label: "Dairy", color: "#8b5cf6" },
                    others: { label: "Others", color: "#06b6d4" },
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={foodTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {foodTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-4">
                  {foodTypeData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-xs text-slate-600">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Items Chart */}
          <Card className="border-emerald-100 mt-6">
            <CardHeader>
              <CardTitle className="text-lg font-serif font-bold text-slate-800">Monthly Items Donated</CardTitle>
              <CardDescription>Number of food items donated each month</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  items: {
                    label: "Items",
                    color: "hsl(var(--chart-2))",
                  },
                }}
                className="h-[250px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={donationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="items" fill="var(--color-items)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  )
}
