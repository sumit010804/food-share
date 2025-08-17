"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  History,
  Search,
  Filter,
  User,
  MapPin,
  Clock,
  Package,
  TrendingUp,
  Download,
  Eye,
  QrCode,
  CheckCircle,
  ArrowRight,
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface DonationRecord {
  id: string
  foodItem: string
  quantity: string
  donatedTo: string
  recipientType: "student" | "staff" | "ngo" | "community"
  receivedTime: string
  location: string
  status: "completed" | "pending" | "cancelled" | "collected"
  impactMetrics: {
    co2Saved: number
    waterSaved: number
    peopleFed: number
  }
  collectedBy?: string
  collectedAt?: string
  qrCodeGenerated?: boolean
  collectionMethod?: "qr_scan" | "manual" | "direct"
}

interface CollectionRecord {
  id: string
  listingId: string
  listingTitle: string
  donatedBy: string
  organization: string
  collectedBy: string
  collectedAt: string
  quantity: string
  foodType: string
  location: string
  collectionMethod: "qr_scan" | "manual" | "direct"
  status?: string
}

// real data will be loaded from the server
const mockCollectionHistory: CollectionRecord[] = [
  {
    id: "1",
    listingId: "1",
    listingTitle: "Vegetable Curry",
    donatedBy: "Jane Smith",
    organization: "Main Campus Canteen",
    collectedBy: "Rahul Kumar",
    collectedAt: "2024-01-15T15:45:00Z",
    quantity: "5.2 kg",
    foodType: "meals",
    location: "Main Canteen",
    collectionMethod: "qr_scan",
  },
  {
    id: "2",
    listingId: "2",
    listingTitle: "Fresh Sandwiches",
    donatedBy: "Mike Johnson",
    organization: "Student Hostel A",
    collectedBy: "Priya Sharma",
    collectedAt: "2024-01-14T17:20:00Z",
    quantity: "3.8 kg",
    foodType: "snacks",
    location: "Student Hostel",
    collectionMethod: "qr_scan",
  },
]

// Mock monthly donation data for charts
const monthlyDonationData = [
  { month: "Aug", donations: 12, weight: 28.5, collections: 10 },
  { month: "Sep", donations: 18, weight: 42.1, collections: 16 },
  { month: "Oct", donations: 15, weight: 35.8, collections: 13 },
  { month: "Nov", donations: 22, weight: 51.2, collections: 20 },
  { month: "Dec", donations: 19, weight: 44.6, collections: 17 },
  { month: "Jan", donations: 25, weight: 58.3, collections: 22 },
]

export default function DonationHistoryPage() {
  const [user, setUser] = useState<any>(null)
  const [donations, setDonations] = useState<DonationRecord[]>([])
  const [collections, setCollections] = useState<CollectionRecord[]>(mockCollectionHistory)
  const [filteredDonations, setFilteredDonations] = useState<DonationRecord[]>([])
  const [filteredCollections, setFilteredCollections] = useState<CollectionRecord[]>(mockCollectionHistory)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [recipientFilter, setRecipientFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("donations")
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
      loadCollectionData()
      loadDonationData()
    } else {
      router.push("/login")
    }
  }, [router])

  const loadDonationData = async () => {
    try {
      const res = await fetch("/api/donations")
      if (res.ok) {
        const data = await res.json()
        setDonations(data.donations || [])
      }
    } catch (err) {
      console.error("Failed to load donations:", err)
    }
  }

  const loadCollectionData = async () => {
    try {
      const response = await fetch("/api/food-listings/collect")
      if (response.ok) {
        const data = await response.json()
        // Show only collections reserved/assigned to the current user (by id or email)
        const allCollections = data.collections || []
        const userId = user?.id
        const userEmail = user?.email
        const myCollections = allCollections.filter((c: any) => {
          if (!userId && !userEmail) return false
          if (c.recipientId && userId && String(c.recipientId) === String(userId)) return true
          if (c.recipientEmail && userEmail && String(c.recipientEmail) === String(userEmail)) return true
          return false
        })
        let merged = myCollections

        // Also include any reserved listings where the listing.reservedByEmail matches the user's email
        try {
          const listingsRes = await fetch('/api/food-listings')
          if (listingsRes.ok) {
            const listingsData = await listingsRes.json()
            const listings = listingsData.listings || []
            const reservedForMe = listings.filter((l: any) => {
              const reservedBy = l.reservedBy || l.raw?.reservedBy || null
              const reservedByEmail = l.reservedByEmail || l.raw?.reservedByEmail || null
              if (!userEmail && !userId) return false
              if (reservedBy && userId && String(reservedBy) === String(userId)) return true
              if (reservedByEmail && userEmail && String(reservedByEmail) === String(userEmail)) return true
              return false
            }).map((l: any) => ({
              id: `synth-${l.id || l._id}`,
              listingId: l.id || (l._id && String(l._id)),
              listingTitle: l.title,
              donatedBy: l.donorName || l.providerName || null,
              organization: l.organization || null,
              recipientId: l.reservedBy || null,
              recipientEmail: l.reservedByEmail || null,
              recipientName: l.reservedByName || null,
              reservedAt: l.reservedAt || l.updatedAt || null,
              status: 'reserved',
              quantity: l.quantity || null,
              location: l.location || null,
              foodType: l.foodType || null,
              collectionMethod: l.collectionMethod || 'manual',
            }))

            // merge and dedupe by listingId
            const byListing: Record<string, any> = {}
            merged.concat(reservedForMe).forEach((c: any) => {
              const lid = c.listingId || c.id
              byListing[lid] = byListing[lid] || c
            })
            merged = Object.values(byListing)
          }
        } catch (e) {
          console.warn('Failed to fetch listings for reserved merge', e)
        }

        setCollections(merged)
      }
    } catch (error) {
      console.error("Failed to load collection data:", error)
    }
  }

  useEffect(() => {
    let filtered = donations

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (donation) =>
          donation.foodItem.toLowerCase().includes(searchTerm.toLowerCase()) ||
          donation.donatedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          donation.location.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((donation) => donation.status === statusFilter)
    }

    // Recipient type filter
    if (recipientFilter !== "all") {
      filtered = filtered.filter((donation) => donation.recipientType === recipientFilter)
    }

    setFilteredDonations(filtered)

    let filteredCols = collections
    if (searchTerm) {
      filteredCols = filteredCols.filter(
        (collection) =>
          collection.listingTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          collection.collectedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
          collection.donatedBy.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }
    setFilteredCollections(filteredCols)
  }, [searchTerm, statusFilter, recipientFilter, donations, collections])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "collected":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getRecipientTypeColor = (type: string) => {
    switch (type) {
      case "student":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "staff":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "ngo":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "community":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getCollectionMethodColor = (method: string) => {
    switch (method) {
      case "qr_scan":
        return "bg-cyan-100 text-cyan-800 border-cyan-200"
      case "manual":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "direct":
        return "bg-slate-100 text-slate-800 border-slate-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const totalImpact = donations.reduce(
    (acc, donation) => ({
      co2Saved: acc.co2Saved + donation.impactMetrics.co2Saved,
      waterSaved: acc.waterSaved + donation.impactMetrics.waterSaved,
      peopleFed: acc.peopleFed + donation.impactMetrics.peopleFed,
    }),
    { co2Saved: 0, waterSaved: 0, peopleFed: 0 },
  )

  const collectionStats = {
    totalCollections: collections.length,
    qrCollections: collections.filter((c) => c.collectionMethod === "qr_scan").length,
    manualCollections: collections.filter((c) => c.collectionMethod === "manual").length,
    directCollections: collections.filter((c) => c.collectionMethod === "direct").length,
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-emerald-200 rounded-full mx-auto mb-4"></div>
          <div className="text-emerald-600 font-medium">Loading donation history...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      <div className="container mx-auto px-4 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <History className="h-8 w-8 text-emerald-600" />
            <h1 className="text-4xl font-serif font-black text-slate-800">Donation History</h1>
          </div>
          <p className="text-xl text-slate-600 leading-relaxed">
            Track your food donations, collections, and see the impact you've made on campus sustainability.
          </p>
        </div>

        {/* Impact Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-lg animate-scale-in">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-serif font-bold text-slate-800">
                <TrendingUp className="h-5 w-5 text-green-600" />
                CO₂ Saved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 mb-2">{totalImpact.co2Saved.toFixed(1)} kg</div>
              <p className="text-sm text-slate-600">Equivalent to planting 2 trees</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-lg animate-scale-in delay-100">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-serif font-bold text-slate-800">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Water Saved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 mb-2">{totalImpact.waterSaved} L</div>
              <p className="text-sm text-slate-600">Enough for 50 people daily</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-lg animate-scale-in delay-200">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-serif font-bold text-slate-800">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                People Fed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 mb-2">{totalImpact.peopleFed}</div>
              <p className="text-sm text-slate-600">Meals provided to community</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-lg animate-scale-in delay-300">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-serif font-bold text-slate-800">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600 mb-2">{collectionStats.totalCollections}</div>
              <p className="text-sm text-slate-600">{collectionStats.qrCollections} via QR scan</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <Card className="border-emerald-100 animate-fade-in delay-300">
            <CardHeader>
              <CardTitle className="text-lg font-serif font-bold text-slate-800">Monthly Activity</CardTitle>
              <CardDescription>Donations vs Collections over the past 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  donations: {
                    label: "Donations",
                    color: "hsl(var(--chart-1))",
                  },
                  collections: {
                    label: "Collections",
                    color: "hsl(var(--chart-2))",
                  },
                }}
                className="h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyDonationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="donations"
                      stroke="var(--color-donations)"
                      strokeWidth={3}
                      dot={{ fill: "var(--color-donations)", strokeWidth: 2, r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="collections"
                      stroke="var(--color-collections)"
                      strokeWidth={3}
                      dot={{ fill: "var(--color-collections)", strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 animate-fade-in delay-400">
            <CardHeader>
              <CardTitle className="text-lg font-serif font-bold text-slate-800">Weight Donated</CardTitle>
              <CardDescription>Total weight of food donated monthly</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  weight: {
                    label: "Weight (kg)",
                    color: "hsl(var(--chart-2))",
                  },
                }}
                className="h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyDonationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="weight" fill="var(--color-weight)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-emerald-50 border border-emerald-200">
            <TabsTrigger
              value="donations"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              Donations ({filteredDonations.length})
            </TabsTrigger>
            <TabsTrigger
              value="collections"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              Collections ({filteredCollections.length})
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card className="border-emerald-100 animate-fade-in delay-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-serif font-bold text-slate-800">
                <Filter className="h-5 w-5 text-emerald-600" />
                Filter Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-emerald-200 focus:border-emerald-400"
                  />
                </div>

                {activeTab === "donations" && (
                  <>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="border-emerald-200 focus:border-emerald-400">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="collected">Collected</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                      <SelectTrigger className="border-emerald-200 focus:border-emerald-400">
                        <SelectValue placeholder="Filter by recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Recipients</SelectItem>
                        <SelectItem value="student">Students</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="ngo">NGOs</SelectItem>
                        <SelectItem value="community">Community</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}

                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="donations">
            {/* Donation Records */}
            <Card className="border-emerald-100 animate-fade-in delay-600">
              <CardHeader>
                <CardTitle className="text-lg font-serif font-bold text-slate-800">
                  Donation Records ({filteredDonations.length})
                </CardTitle>
                <CardDescription>Detailed history of your food donations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredDonations.map((donation, index) => (
                    <div
                      key={donation.id}
                      className="p-6 bg-gradient-to-r from-white to-emerald-50/30 rounded-xl border border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-lg animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <Package className="h-5 w-5 text-emerald-600" />
                            <h3 className="text-lg font-semibold text-slate-800">{donation.foodItem}</h3>
                            <Badge className={`${getStatusColor(donation.status)} font-medium`}>
                              {donation.status.charAt(0).toUpperCase() + donation.status.slice(1)}
                            </Badge>
                            {donation.qrCodeGenerated && (
                              <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200">
                                <QrCode className="h-3 w-3 mr-1" />
                                QR Generated
                              </Badge>
                            )}
                          </div>

                          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-600 mb-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <span>
                                <strong>Donated to:</strong> {donation.donatedTo}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${getRecipientTypeColor(donation.recipientType)} text-xs`}>
                                {donation.recipientType.charAt(0).toUpperCase() + donation.recipientType.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span>{donation.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span>{formatDate(donation.receivedTime)}</span>
                            </div>
                          </div>

                          {donation.status === "collected" && donation.collectedBy && (
                            <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-emerald-800">Collection Details</span>
                              </div>
                              <div className="grid md:grid-cols-2 gap-2 text-sm text-emerald-700">
                                <div>
                                  <strong>Collected by:</strong> {donation.collectedBy}
                                </div>
                                <div>
                                  <strong>Collection time:</strong> {formatDate(donation.collectedAt!)}
                                </div>
                                {donation.collectionMethod && (
                                  <div className="flex items-center gap-2">
                                    <strong>Method:</strong>
                                    <Badge className={`${getCollectionMethodColor(donation.collectionMethod)} text-xs`}>
                                      {donation.collectionMethod.replace("_", " ").toUpperCase()}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="grid md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-white rounded-lg border border-emerald-100">
                              <div className="text-lg font-bold text-emerald-600">{donation.quantity}</div>
                              <div className="text-xs text-slate-500">Quantity</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                              <div className="text-lg font-bold text-green-600">
                                {donation.impactMetrics.co2Saved} kg
                              </div>
                              <div className="text-xs text-slate-500">CO₂ Saved</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-blue-100">
                              <div className="text-lg font-bold text-blue-600">
                                {donation.impactMetrics.waterSaved} L
                              </div>
                              <div className="text-xs text-slate-500">Water Saved</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-purple-100">
                              <div className="text-lg font-bold text-purple-600">
                                {donation.impactMetrics.peopleFed}
                              </div>
                              <div className="text-xs text-slate-500">People Fed</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredDonations.length === 0 && (
                    <div className="text-center py-12">
                      <History className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-600 mb-2">No donations found</h3>
                      <p className="text-slate-500">Try adjusting your filters or search terms.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="collections">
            <Card className="border-emerald-100 animate-fade-in delay-600">
              <CardHeader>
                <CardTitle className="text-lg font-serif font-bold text-slate-800">
                  Collection Records ({filteredCollections.length})
                </CardTitle>
                <CardDescription>Items you've collected from other donors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredCollections.map((collection, index) => (
                    <div
                      key={collection.id}
                      className="p-6 bg-gradient-to-r from-white to-cyan-50/30 rounded-xl border border-cyan-100 hover:border-cyan-200 transition-all duration-300 hover:shadow-lg animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <CheckCircle className="h-5 w-5 text-cyan-600" />
                            <h3 className="text-lg font-semibold text-slate-800">{collection.listingTitle}</h3>
                            <Badge className={`${getCollectionMethodColor(collection.collectionMethod)} font-medium`}>
                              {collection.collectionMethod.replace("_", " ").toUpperCase()}
                            </Badge>
                          </div>

                          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-600 mb-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <span>
                                <strong>Donated by:</strong> {collection.donatedBy}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-slate-400" />
                              <span>
                                <strong>Organization:</strong> {collection.organization}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span>{collection.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span>{formatDate(collection.collectedAt)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                            <div className="text-center">
                              <div className="text-lg font-bold text-cyan-600">{collection.quantity}</div>
                              <div className="text-xs text-slate-500">Quantity</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <div className="text-sm text-slate-600">
                              <strong>Collection Method:</strong>{" "}
                              {collection.collectionMethod === "qr_scan"
                                ? "QR Code Scan"
                                : collection.collectionMethod === "manual"
                                  ? "Manual Entry"
                                  : "Direct Pickup"}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 bg-transparent"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Details
                          </Button>
                          {collection.status === 'reserved' && (
                            <Button
                              size="sm"
                              className="bg-cyan-600 text-white hover-lift h-10"
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/food-listings/collect', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ listingId: collection.listingId, collectedBy: user?.name, collectedAt: new Date().toISOString(), collectionMethod: 'manual' })
                                  })
                                  if (res.ok) {
                                    // refresh collections/donations
                                    loadCollectionData()
                                    loadDonationData()
                                  } else {
                                    console.warn('Collect failed', await res.text())
                                  }
                                } catch (e) {
                                  console.error('Collect error', e)
                                }
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Collect
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredCollections.length === 0 && (
                    <div className="text-center py-12">
                      <CheckCircle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-600 mb-2">No collections found</h3>
                      <p className="text-slate-500">Items you collect will appear here.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
