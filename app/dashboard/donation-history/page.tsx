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
import TicketQRButton from '@/components/ticket-qr-button'
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
  // optional fields present for reserved but not yet collected
  recipientId?: string
  recipientEmail?: string
  recipientName?: string
  reservedAt?: string
  updatedAt?: string
}

// real data will be loaded from the server
// collections and charts are populated from server data

export default function DonationHistoryPage() {
  const [user, setUser] = useState<any>(null)
   const [donations, setDonations] = useState<DonationRecord[]>([])
   const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [filteredDonations, setFilteredDonations] = useState<DonationRecord[]>([])
  const [filteredCollections, setFilteredCollections] = useState<CollectionRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [recipientFilter, setRecipientFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("donations")
  const router = useRouter()

  // Helper: dedupe collections by a canonical listing key; prefer DB-backed entries (with raw)
  const dedupeCollections = (items: any[]) => {
    const keyOf = (x: any) => {
      // Normalize across variants: collections.listingId (string), raw.listingId, raw.id, fallback to id
      return (
        (x.listingId && String(x.listingId)) ||
        (x.raw?.listingId && String(x.raw.listingId)) ||
        (x.raw?.id && String(x.raw.id)) ||
        (x.id && String(x.id)) ||
        `${x.listingTitle || ''}-${x.collectedAt || x.reservedAt || ''}`
      )
    }
    const score = (x: any) => {
      // Prefer DB-backed entries (raw present) by adding a large bias
      const bias = x.raw ? 1_000_000_000 : 0
      const t = new Date(x.updatedAt || x.collectedAt || x.reservedAt || 0).getTime() || 0
      return bias + t
    }
    const map = new Map<string, any>()
    for (const c of items) {
      const key = keyOf(c)
      const prev = map.get(key)
      if (!prev) { map.set(key, c); continue }
      if (score(c) >= score(prev)) map.set(key, c)
    }
    return Array.from(map.values())
  }

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      const parsed = JSON.parse(userData)
      setUser(parsed)
      // pass the freshly parsed user into loader so it doesn't depend on state update timing
      loadCollectionData(parsed)
      loadDonationData()
    } else {
      router.push("/login")
    }

    

    // Listen for cross-tab collection updates; event may contain the newly created collection
    const onCollectionsUpdated = (e: any) => {
      const currentUserRaw = localStorage.getItem('user')
      const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null

      // If the event includes a collection in detail, merge it into state immediately for a
      // snappy UI, but only if it belongs to the current user. Otherwise, re-fetch collections.
      const col = e?.detail || null
      if (col) {
        const belongsToMe = (() => {
          if (!currentUser) return false
          if (col.recipientId && currentUser.id && String(col.recipientId) === String(currentUser.id)) return true
          if (col.recipientEmail && currentUser.email && String(col.recipientEmail) === String(currentUser.email)) return true
          return false
        })()

        if (belongsToMe) {
          setCollections((prev: any[]) => dedupeCollections(prev.concat([col])))
          // Replace synthetic entries with canonical ones from server soon after
          setTimeout(() => loadCollectionData(), 300)
          return
        }
      }

      // no detail or doesn't belong to current user -> re-fetch
      loadCollectionData()
    }
    window.addEventListener('collections:updated', onCollectionsUpdated as EventListener)
    return () => window.removeEventListener('collections:updated', onCollectionsUpdated as EventListener)
  }, [router])

  const loadDonationData = async () => {
    try {
      const res = await fetch("/api/donations")
      if (res.ok) {
        const data = await res.json()
        const allDonations = data.donations || []
        // determine current user (state may not yet be set when called)
        const currentUserRaw = localStorage.getItem('user')
        const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : user

        // If we have a current user, show donations where they are the donor OR where
        // the donation belongs to a listing they created (so donors see impact when others collect)
        let myDonations = allDonations
        if (currentUser) {
          const userId = currentUser.id || currentUser._id
          const userEmail = currentUser.email
          const userName = currentUser.name

          // Fetch listings to identify listings created by this user
          let myListingIds = new Set<string>()
          try {
            const listingsRes = await fetch('/api/food-listings')
            if (listingsRes.ok) {
              const ld = await listingsRes.json()
              const listings = ld.listings || []
              for (const l of listings) {
                const isMine = (l.createdBy && (String(l.createdBy) === String(userId))) ||
                  (l.createdByEmail && userEmail && String(l.createdByEmail) === String(userEmail)) ||
                  (l.providerId && String(l.providerId) === String(userId)) ||
                  (l.providerName && userName && String(l.providerName) === String(userName))
                if (isMine) {
                  if (l.id) myListingIds.add(String(l.id))
                  if (l._id) myListingIds.add(String(l._id))
                  if (l.raw && l.raw.id) myListingIds.add(String(l.raw.id))
                }
              }
            }
          } catch (e) {
            console.warn('Failed to fetch listings when filtering donations', e)
          }

          myDonations = allDonations.filter((d: any) => {
            if (!d) return false
            if (d.donorId && userId && String(d.donorId) === String(userId)) return true
            if (d.donorEmail && userEmail && String(d.donorEmail) === String(userEmail)) return true
            if (d.donorName && userName && String(d.donorName) === String(userName)) return true

            // If donation references a listing that belongs to me, include it
            const listingId = d.listingId || d.raw?.listingId || d.foodItem || null
            if (listingId && myListingIds.has(String(listingId))) return true

            return false
          })
        }

        // Try to fetch listings so we can derive a weight when donations do not include quantity
        let listingMap: Record<string, any> = {}
        try {
          const listRes = await fetch('/api/food-listings')
          if (listRes.ok) {
            const listData = await listRes.json()
            const listings = listData.listings || []
            for (const l of listings) {
              if (l.id) listingMap[String(l.id)] = l
              if (l._id) listingMap[String(l._id)] = l
              if (l.raw && l.raw.id) listingMap[String(l.raw.id)] = l
            }
          }
        } catch (e) {
          console.warn('Failed to fetch listings while loading donations', e)
        }

        // dedupe donations by id and enrich with listing quantity when available
        const seen = new Map<string, any>()
        for (const d of myDonations) {
          const key = d.id || (d._id && String(d._id)) || JSON.stringify(d)
          if (seen.has(key)) continue

          const dd: any = d
          const listingId = dd.listingId || dd.raw?.listingId || dd.foodItem || null
          const listing = listingId ? listingMap[String(listingId)] : null
          if (listing) {
            dd.listing = listing
            const qty = listing.quantity || listing.raw?.quantity || null
            const ft = (listing.foodType || '').toLowerCase()
            if (qty) {
              // Convert common listing quantity types to kilograms for canonical display
              const KG_PER_SERVING = 0.25
              const KG_PER_PIECE = 0.2
              let kgVal: number | null = null
              if (ft === 'meals') {
                const n = Number(qty) || parseFloat(String(qty)) || 0
                kgVal = Math.round(n * KG_PER_SERVING * 100) / 100
              } else if (ft === 'snacks' || ft === 'fruits' || ft === 'vegetables') {
                const n = Number(qty) || parseFloat(String(qty)) || 0
                kgVal = Math.round(n * KG_PER_PIECE * 100) / 100
              } else {
                // assume quantity already in kg when foodType not specific
                const parsed = parseQuantityKg(qty)
                kgVal = parsed && parsed > 0 ? Math.round(parsed * 100) / 100 : null
              }

              if (kgVal !== null) {
                dd.quantity = `${kgVal} kg`
                dd.quantityKg = kgVal
              } else {
                dd.quantity = `${qty}`
              }
            }
          }

          seen.set(key, dd)
        }
        setDonations(Array.from(seen.values()))
      }
    } catch (err) {
      console.error("Failed to load donations:", err)
    }
  }

  const loadCollectionData = async (overrideUser?: any) => {
    try {
      const response = await fetch("/api/food-listings/collect")
      if (response.ok) {
        const data = await response.json()
        // Show only collections reserved/assigned to the current user (by id or email)
        const allCollections = data.collections || []
        const activeUser = overrideUser || user
        const userId = activeUser?.id
        const userEmail = activeUser?.email
  const myCollectionsRaw = allCollections.filter((c: any) => {
          if (!userId && !userEmail) return false
          if (c.recipientId && userId && String(c.recipientId) === String(userId)) return true
          if (c.recipientEmail && userEmail && String(c.recipientEmail) === String(userEmail)) return true
          return false
        })
  let merged = dedupeCollections(myCollectionsRaw)

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
              // Align listingId with how the server stores it in collections (prefer raw.id when present)
              listingId: (l.raw && l.raw.id) ? String(l.raw.id) : (l.id || (l._id && String(l._id))),
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
            merged = dedupeCollections(merged.concat(reservedForMe))
            // no-op: we rely on DB-backed collections and event.detail for immediate UI updates
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
  setFilteredCollections(dedupeCollections(filteredCols))
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

  // Conversion constants (sensible defaults; adjust if you have better domain values)
  const CO2_PER_KG = 2.5 // kg CO2 saved per kg of food
  const WATER_L_PER_KG = 500 // liters of water saved per kg of food
  // Configurable minimum kg required per person; default 0.5 kg/person
  const KG_PER_PERSON = Number(process.env.NEXT_PUBLIC_KG_PER_PERSON || '0.5')
  const MEALS_PER_KG = KG_PER_PERSON > 0 ? (1 / KG_PER_PERSON) : 2

  // Parse a quantity value into kilograms. Supports formats like:
  // "5 kg", "500 g", "3 servings", "2 pcs", "4 pieces", or numeric values.
  // Returns weight in kilograms.
  const parseQuantityKg = (q: any) => {
    if (q === null || q === undefined) return 0
    // Constants to convert non-kg units to kg
    const KG_PER_SERVING = 0.25 // default kg per serving
    const KG_PER_PIECE = 0.2 // default kg per piece

    if (typeof q === 'number') return q
    if (typeof q === 'string') {
      const s = q.trim().toLowerCase()

      // common patterns: number + unit
      const match = s.match(/([0-9]*\.?[0-9]+)\s*(kg|kilogram|kilograms)\b/)
      if (match) return parseFloat(match[1])

      const matchG = s.match(/([0-9]*\.?[0-9]+)\s*(g|gram|grams)\b/)
      if (matchG) return parseFloat(matchG[1]) / 1000

      const matchServ = s.match(/([0-9]*\.?[0-9]+)\s*(servings?|serves?|serving)\b/)
      if (matchServ) return parseFloat(matchServ[1]) * KG_PER_SERVING

      const matchPiece = s.match(/([0-9]*\.?[0-9]+)\s*(pcs|pieces?|piece|pc)\b/)
      if (matchPiece) return parseFloat(matchPiece[1]) * KG_PER_PIECE

      // sometimes values like "5kg" or "500g" without space
      const compactKg = s.match(/^([0-9]*\.?[0-9]+)kg$/)
      if (compactKg) return parseFloat(compactKg[1])
      const compactG = s.match(/^([0-9]*\.?[0-9]+)g$/)
      if (compactG) return parseFloat(compactG[1]) / 1000

      // fallback: try to extract first number and assume kg
      const num = s.match(/([0-9]*\.?[0-9]+)/)
      if (num) return parseFloat(num[1])
    }

    return 0
  }

  const getDonationWeight = (d: any) => {
    // Try common fields where weight might be stored
    const candidates = [d.quantity, d.weight, d.impactMetrics?.weight, d.listing?.quantity, d.raw?.quantity]
    for (const c of candidates) {
      const parsed = parseQuantityKg(c)
      if (parsed && parsed > 0) return parsed
    }
    return 0
  }
  // totalImpact: compute total weight (with fallback) and people fed
  const DEFAULT_WEIGHT_PER_DONATION = 2 // kg fallback when a donation has no quantity info

  // Prefer persisted per-donation impactMetrics where available (co2Saved, waterSaved, peopleFed).
  // Fall back to derived weights when impactMetrics are missing.
  let totalWeight = 0
  let totalCo2 = 0
  let totalWater = 0
  let totalPeopleFed = 0
  for (const donation of donations) {
    const dd: any = donation
    // If the donation has persisted impactMetrics, use them
    // Gather weight even if impactMetrics exist (to derive people-fed fallback)
    let weight = 0
    if (dd.impactMetrics && dd.impactMetrics.foodKg) {
      weight = Number(dd.impactMetrics.foodKg) || 0
    }
    if (!weight) weight = getDonationWeight(dd)
    if (!weight || weight <= 0) weight = DEFAULT_WEIGHT_PER_DONATION

    if (dd.impactMetrics && (dd.impactMetrics.co2Saved || dd.impactMetrics.waterSaved || dd.impactMetrics.foodKg)) {
      totalCo2 += Number(dd.impactMetrics.co2Saved || 0)
      totalWater += Number(dd.impactMetrics.waterSaved || 0)
      totalWeight += Number(dd.impactMetrics.foodKg || weight || 0)
    } else {
      totalWeight += weight
      totalCo2 += weight * CO2_PER_KG
      totalWater += weight * WATER_L_PER_KG
    }
    // Prefer explicit peopleFed, else derive from weight
  const derivedPeople = Math.max(0, Math.floor(weight * MEALS_PER_KG))
    totalPeopleFed += Number(dd.impactMetrics?.peopleFed || dd.impactMetrics?.peopleServed || derivedPeople)
  }

  const totalImpact = {
    co2Saved: totalCo2,
    waterSaved: Math.round(totalWater),
  peopleFed: totalPeopleFed,
  }

  // --- Chart helpers ---
  const getPastMonths = (count = 6) => {
    const months: { key: string; label: string; date: Date }[] = []
    const now = new Date()
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleString('en-US', { month: 'short' })
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({ key, label, date: d })
    }
    return months
  }

  const monthlyDonationData = (() => {
    const months = getPastMonths(6)
    const data = months.map((m) => ({ month: m.label, donations: 0, collections: 0, weight: 0 }))

    // count donations per month and sum weight
    for (const d of donations) {
      const dd: any = d
      const ts = dd.receivedTime || dd.collectedAt || dd.createdAt || null
      const date = ts ? new Date(ts) : null
      if (!date) continue
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const idx = months.findIndex((mm) => mm.key === key)
      if (idx >= 0) {
        data[idx].donations = (data[idx].donations || 0) + 1
        data[idx].weight = (data[idx].weight || 0) + getDonationWeight(dd)
      }
    }

    // count collections per month and sum collected quantity
    for (const c of collections) {
      const cc: any = c
      const ts = cc.collectedAt || cc.reservedAt || cc.updatedAt || null
      const date = ts ? new Date(ts) : null
      if (!date) continue
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const idx = months.findIndex((mm) => mm.key === key)
      if (idx >= 0) {
        data[idx].collections = (data[idx].collections || 0) + 1
        data[idx].weight = (data[idx].weight || 0) + parseQuantityKg(c.quantity)
      }
    }

    return data
  })()

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
                                  <strong>Collection time:</strong> {donation.collectedAt ? formatDate(donation.collectedAt) : '—'}
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
                                {(donation.impactMetrics?.co2Saved ?? 0)} kg
                              </div>
                              <div className="text-xs text-slate-500">CO₂ Saved</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-blue-100">
                              <div className="text-lg font-bold text-blue-600">
                                {(donation.impactMetrics?.waterSaved ?? 0)} L
                              </div>
                              <div className="text-xs text-slate-500">Water Saved</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-purple-100">
                              <div className="text-lg font-bold text-purple-600">
                                {(donation.impactMetrics?.peopleFed ?? 0)}
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
                            <Badge className={`${getCollectionMethodColor(collection.collectionMethod || '')} font-medium`}> 
                              {(collection.collectionMethod || 'manual').replace("_", " ").toUpperCase()}
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
                              <span>{collection.collectedAt ? formatDate(collection.collectedAt) : '—'}</span>
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

                                          {/* If this reserved collection belongs to the current user (recipient),
                                              show the Ticket QR so they can present it at pickup. Otherwise
                                              show the Collect button for the lister/staff to mark pickup. */}
                                          {collection.status === 'reserved' && (() => {
                                            try {
                                              const currentUser = user
                                              const belongsToMe = currentUser && (
                                                (collection.recipientId && currentUser.id && String(collection.recipientId) === String(currentUser.id)) ||
                                                (collection.recipientEmail && currentUser.email && String(collection.recipientEmail) === String(currentUser.email))
                                              )

                                              if (belongsToMe) {
                                                return (
                                                  <div className="ml-2">
                                                    {/* Provide both collectionId (if present) and listingId for robust lookup */}
                                                    {/* @ts-ignore */}
                                                    <TicketQRButton collectionId={collection.id || collection.listingId} listingId={collection.listingId || collection.id} />
                                                  </div>
                                                )
                                              }
                                            } catch (e) {
                                              // fall through to show collect button on any error
                                            }

                                            return (
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
                                            )
                                          })()}
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
