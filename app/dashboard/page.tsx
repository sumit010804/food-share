"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Leaf from "@/components/leaf-custom"
import { LogOut, Plus, Bell, BarChart3, Calendar, Users, TrendingUp, Clock, Sparkles } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { ProfileCircle } from "@/components/profile-circle"
import { QRScanner } from "@/components/qr-scanner"
import Link from "next/link"

interface User {
  id: string
  name: string
  email: string
  userType: string
  organization: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[] | null>(null)
  const [listings, setListings] = useState<any[] | null>(null)
  const [analytics, setAnalytics] = useState<any | null>(null)
  const [notifications, setNotifications] = useState<any[] | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
      // once we have user, fetch server data
      fetchAllData()
    } else {
      router.push("/login")
    }
  }, [router])

  async function fetchAllData() {
    setLoadingData(true)
    setDataError(null)
    try {
      // read user id from localStorage to request user-scoped notifications
      let userId: string | null = null
      try {
        const userRaw = localStorage.getItem('user')
        if (userRaw) {
          const parsed = JSON.parse(userRaw)
          userId = parsed?.id || parsed?._id || null
        }
      } catch (e) {
        userId = null
      }

      const [uRes, lRes, aRes, nRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/food-listings'),
        fetch('/api/analytics'),
        fetch(userId ? `/api/notifications?userId=${encodeURIComponent(userId)}` : '/api/notifications'),
      ])

      if (!uRes.ok || !lRes.ok || !aRes.ok || !nRes.ok) {
        throw new Error('Failed to fetch one or more endpoints')
      }

      const uJson = await uRes.json()
      const lJson = await lRes.json()
      const aJson = await aRes.json()
      const nJson = await nRes.json()

      setUsers(uJson.users || null)
      setListings(lJson.listings || [])
      setAnalytics(aJson.analytics || null)
      setNotifications(nJson.notifications || [])
    } catch (err: any) {
      console.error('fetchAllData error', err)
      setDataError(err?.message || 'Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case "student":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "staff":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "canteen":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "hostel":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "event":
        return "bg-pink-100 text-pink-800 border-pink-200"
      case "ngo":
        return "bg-cyan-100 text-cyan-800 border-cyan-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-emerald-100 bg-white/90 backdrop-blur-md sticky top-0 z-30 animate-fade-in">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 hover-lift lg:hidden">
            <div className="relative">
              <Leaf className="h-8 w-8 text-emerald-600" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-2xl font-serif font-black text-emerald-800 tracking-tight">FoodShare</h1>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <QRScanner />
            <NotificationBell />
            <ProfileCircle user={user} />
            {user && (
              <Badge className={`${getUserTypeColor(user.userType)} font-medium px-3 py-1 border hover-lift`}>
                  {typeof user.userType === "string" && user.userType ? (user.userType.charAt(0).toUpperCase() + user.userType.slice(1)) : ""}
              </Badge>
            )}
            <span className="text-slate-700 font-medium hidden sm:block">Welcome, {user?.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent hover-lift font-medium"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-12 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-4xl font-serif font-black text-slate-800">Dashboard</h2>
            <Sparkles className="h-8 w-8 text-emerald-500 animate-pulse" />
          </div>
          <p className="text-xl text-slate-600 leading-relaxed">
            Manage your food redistribution activities and track your impact on campus sustainability.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Link href="/dashboard/food-listings/create" className="animate-scale-in">
            <Card className="hover-lift border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 group h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Plus className="h-7 w-7 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-serif font-bold text-slate-800">List Food</CardTitle>
                <CardDescription className="text-slate-600 leading-relaxed">
                  Add surplus food for redistribution
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/food-listings" className="animate-scale-in delay-100">
            <Card className="hover-lift border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 group h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Bell className="h-7 w-7 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-serif font-bold text-slate-800">Browse Food</CardTitle>
                <CardDescription className="text-slate-600 leading-relaxed">
                  View available food listings
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/notifications" className="animate-scale-in delay-200">
            <Card className="hover-lift border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 group h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Bell className="h-7 w-7 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-serif font-bold text-slate-800">Notifications</CardTitle>
                <CardDescription className="text-slate-600 leading-relaxed">View alerts and updates</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/analytics" className="animate-scale-in delay-300">
            <Card className="hover-lift border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 group h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="h-7 w-7 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-serif font-bold text-slate-800">Analytics</CardTitle>
                <CardDescription className="text-slate-600 leading-relaxed">
                  Track your impact and statistics
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Secondary Actions */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Link href="/dashboard/events" className="animate-scale-in delay-400">
            <Card className="hover-lift border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 group">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="h-7 w-7 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-serif font-bold text-slate-800">Event Integration</CardTitle>
                <CardDescription className="text-slate-600 leading-relaxed">
                  Manage campus events and predict surplus food
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/donation-history" className="animate-scale-in delay-500">
            <Card className="hover-lift border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 group">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl font-serif font-bold text-slate-800">Donation History</CardTitle>
                <CardDescription className="text-slate-600 leading-relaxed">
                  View your food donation records and impact
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-lg animate-fade-in delay-600">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl font-serif font-bold text-slate-800">
                <Clock className="h-6 w-6 text-emerald-600" />
                Recent Food Listings
              </CardTitle>
              <CardDescription className="text-slate-600">Latest surplus food available for pickup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingData ? (
                  <div>Loading listings...</div>
                ) : dataError ? (
                  <div className="text-red-600">{dataError}</div>
                ) : listings && listings.length > 0 ? (
                  listings.slice(0, 5).map((l) => (
                    <div key={l.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-white rounded-xl border border-emerald-100 hover-lift">
                      <div>
                        <p className="font-semibold text-slate-800 text-lg">{l.title}</p>
                        <p className="text-slate-600">{l.location} • {l.createdAt ? new Date(l.createdAt).toLocaleString() : ''}</p>
                      </div>
                      <Badge className={`font-medium ${l.status === 'available' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : l.status === 'expired' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{l.status}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">No listings found.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-lg animate-fade-in delay-700">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl font-serif font-bold text-slate-800">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
                Impact Summary
              </CardTitle>
              <CardDescription className="text-slate-600">Your contribution to campus sustainability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {loadingData ? (
                  <div>Loading analytics...</div>
                ) : dataError ? (
                  <div className="text-red-600">{dataError}</div>
                ) : analytics ? (
                  <>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-white rounded-xl border border-emerald-100">
                      <span className="text-slate-600 font-medium">Food Saved This Month</span>
                      <span className="font-bold text-2xl gradient-primary bg-clip-text text-transparent">{analytics.overview?.totalFoodSaved ?? 0} kg</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-white rounded-xl border border-blue-100">
                      <span className="text-slate-600 font-medium">People Served</span>
                      <span className="font-bold text-2xl text-blue-600">{analytics.overview?.totalPeopleServed ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-white rounded-xl border border-green-100">
                      <span className="text-slate-600 font-medium">CO₂ Saved</span>
                      <span className="font-bold text-2xl text-green-600">{analytics.overview?.carbonFootprintSaved ?? 0} kg</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-white rounded-xl border border-cyan-100">
                      <span className="text-slate-600 font-medium">Water Saved</span>
                      <span className="font-bold text-2xl text-cyan-600">{analytics.overview?.waterFootprintSaved ?? 0} L</span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">No analytics available.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
