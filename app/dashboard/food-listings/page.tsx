"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Leaf from "@/components/leaf-custom"
import { LogOut, Plus, Search, MapPin, Clock, Users, AlertTriangle, Filter, Menu, QrCode } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import Link from "next/link"
import FoodListingsMap from "@/components/food-listings-map"
import ListingChat from "@/components/listing-chat"

interface User {
  id: string
  name: string
  email: string
  userType: string
  organization: string
}

interface FoodListing {
  id: string
  title: string
  description: string
  foodType: string
  quantity: string
  location: string
  availableUntil: string
  safetyHours: number
  // optional extended fields returned by the API
  unit?: string
  safeToEatHours?: number
  specialInstructions?: string
  contactInfo?: string
  provider?: any
  raw?: any
  createdBy: string
  organization: string
  status: "available" | "reserved" | "expired" | "collected"
  tags?: string[]
  createdAt?: string
  qrCode?: boolean
  collectedBy?: string
  collectedAt?: string
  remainingQuantity?: number
}

export default function FoodListingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [listings, setListings] = useState<FoodListing[]>([])
  const [filteredListings, setFilteredListings] = useState<FoodListing[]>([])
  const [selectedListing, setSelectedListing] = useState<FoodListing | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatListing, setChatListing] = useState<FoodListing | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("active")
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
      fetchListings()
    } else {
      router.push("/login")
    }
  }, [router])

  const canListFood = !!(user && (user.userType === 'canteen' || user.userType === 'hostel' || (user as any).userType === 'admin' || (user as any).role === 'admin'))

  const fetchListings = async () => {
    try {
      const response = await fetch("/api/food-listings")
      const data = await response.json()
      setListings(data.listings || [])
      setFilteredListings(data.listings || [])
    } catch (error) {
      console.error("Failed to fetch listings:", error)
    }
  }

  const handleReserve = async (listing: FoodListing) => {
    try {
      // prevent self-reserve on client as well (use lister email)
      const currentUserEmail = user?.email || ''
      const listerEmail = (listing as any).createdByEmail || (listing as any).provider?.email || (listing as any).email || ''
      if (listerEmail && String(listerEmail) === String(currentUserEmail)) {
        alert("You cannot reserve your own listing.")
        return
      }

      // If user is a lister role (canteen/hostel/admin), they should not reserve; they list only
      if (canListFood) {
        alert('Lister accounts cannot reserve items. Use a Student or NGO account to collect.')
        return
      }

      // Ask for quantity to reserve
      const maxRemaining = typeof (listing as any).remainingQuantity === 'number' && isFinite((listing as any).remainingQuantity)
        ? Number((listing as any).remainingQuantity)
        : (() => {
            // try to parse from quantity string
            const s = String((listing as any).quantity || '').trim()
            const m = s.match(/([0-9]+(?:\.[0-9]+)?)/)
            return m ? Math.floor(Number(m[1])) : 0
          })()
      if (!maxRemaining || maxRemaining <= 0) {
        alert('No quantity remaining to reserve.')
        return
      }

      let input = prompt(`Enter quantity to reserve (1 - ${maxRemaining})`, Math.min(1, maxRemaining).toString())
      if (input === null) return
      let qty = Math.floor(Number(input))
      if (!qty || qty < 1) qty = 1
      if (qty > maxRemaining) qty = maxRemaining

      // optimistically update UI remaining
      setListings((prev) => prev.map(l => l.id === listing.id ? { ...l, remainingQuantity: Math.max(0, (l as any).remainingQuantity ? Number((l as any).remainingQuantity) - qty : (maxRemaining - qty)), status: (maxRemaining - qty) <= 0 ? 'reserved' : 'available' } : l))

      const res = await fetch('/api/food-listings/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ listingId: listing.id, userId: user?.id, userName: user?.name, userEmail: user?.email, quantity: qty })
      })

      if (!res.ok) {
        // Attempt to parse JSON body, but handle non-JSON responses gracefully
        let parsed: any = null
        try {
          parsed = await res.json()
        } catch (parseErr) {
          parsed = null
        }

        if (parsed && parsed.message) {
          // Expected 4xx responses (listing already reserved, etc.) are not runtime errors
          // so log at warn level to avoid Next dev overlay while still surfacing info.
          console.warn('Reserve failed', parsed.message, 'status', res.status)
          // Don't block the user with an alert on expected reservation conflicts.
          // Re-fetch listings so the UI reflects the canonical state.
        } else {
          // fallback to raw text if JSON wasn't available
          let textBody: string | null = null
          try {
            textBody = await res.text()
          } catch (tErr) {
            textBody = null
          }
          console.warn('Reserve failed', { status: res.status, statusText: res.statusText, body: textBody })
          alert(`Reserve failed: ${res.status} ${res.statusText}${textBody ? ` - ${textBody}` : ''}`)
        }

  // rollback optimistic update to canonical state
  fetchListings()
        return
      }

      // successful reserve -> re-fetch listings to get canonical data
      const json = await res.json().catch(() => null)
      fetchListings()

      // Notify other tabs/pages to reload collections. If server returned the created collection,
      // include it in the event detail so listeners can update state immediately without
      // relying on localStorage.
      try {
        if (json && json.collection) {
          window.dispatchEvent(new CustomEvent('collections:updated', { detail: json.collection }))
        } else {
          window.dispatchEvent(new Event('collections:updated'))
        }
      } catch (e) {
        console.warn('Failed to dispatch collections:updated event with detail', e)
        window.dispatchEvent(new Event('collections:updated'))
      }
    } catch (e) {
      console.error('Reserve error', e)
      fetchListings()
    }
  }

  useEffect(() => {
    let filtered = listings

    if (searchTerm) {
      filtered = filtered.filter(
        (listing) =>
          listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (listing.organization || "").toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filterType !== "all") {
      filtered = filtered.filter((listing) => listing.foodType === filterType)
    }

    if (filterStatus === "active") {
      filtered = filtered.filter((listing) => ["available", "reserved"].includes(listing.status))
    } else if (filterStatus !== "all") {
      filtered = filtered.filter((listing) => listing.status === filterStatus)
    }

    setFilteredListings(filtered)
  }, [listings, searchTerm, filterType, filterStatus])

  useEffect(() => {
    const onListingCreated = (e: Event) => {
      // Re-fetch listings when a new listing is created in another tab/window
      fetchListings()
    }

    window.addEventListener('listing:created', onListingCreated)
    return () => window.removeEventListener('listing:created', onListingCreated)
  }, [])

  // Deep-link: open chat dialog when ?chat=<listingId> (and optional reservationId) is present and user is authorized
  useEffect(() => {
    const targetId = searchParams?.get('chat')
    const resId = searchParams?.get('reservationId')
    if (!targetId || listings.length === 0 || !user) return
    const listing = listings.find((l) => String(l.id) === String(targetId))
    if (!listing) return
    const ownerId = String((listing as any).createdBy || (listing as any).providerId || (listing as any).donorId || '')
    const reserverId = String((listing as any).reservedBy || (listing as any).reservedById || '')
    const me = String((user as any)?.id || (user as any)?._id || '')
    const ownerEmail = String((listing as any).createdByEmail || (listing as any).provider?.email || '')
    const reserverEmail = String((listing as any).reservedByEmail || '')
    const myEmail = String((user as any)?.email || '')
  const reservations = Array.isArray((listing as any).reservations) ? (listing as any).reservations as any[] : []
    const myReservation = resId
      ? reservations.find((r: any) => String(r.id) === String(resId))
      : reservations.find((r: any) => String(r.by) === me || (r.byEmail && String(r.byEmail) === myEmail))
  const hasActiveReservation = reservations.some((r: any) => (r?.status || 'reserved') !== 'collected')
    const participant = (
      me === ownerId ||
      me === reserverId ||
      !!myReservation ||
      (ownerEmail && myEmail && ownerEmail === myEmail) ||
      (reserverEmail && myEmail && reserverEmail === myEmail)
    )
  const canChat = participant && (listing.status === 'reserved' || !!myReservation || (me === ownerId && hasActiveReservation))
    if (canChat) {
      const withRes = { ...(listing as any), __reservationId: resId || (Array.isArray((listing as any).reservations) ? (listing as any).reservations.find((r: any) => String(r.by) === me || (r.byEmail && String(r.byEmail) === myEmail))?.id : undefined) }
      setChatListing(withRes as any)
      setChatOpen(true)
    }
  }, [searchParams, listings, user])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 border-green-200"
      case "reserved":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "collected":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "expired":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTimeRemaining = (availableUntil: string) => {
    const now = new Date()
    const endTime = new Date(availableUntil)
    const diff = endTime.getTime() - now.getTime()

    if (diff <= 0) return "Expired"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    }
    return `${minutes}m remaining`
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

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      {/* Header */}
      <header className="border-b border-emerald-100 bg-white/90 backdrop-blur-md sticky top-0 z-50 animate-fade-in">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/dashboard" className="hover-lift">
              <div className="relative">
                <Leaf className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600" />
                <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
            </Link>
            <h1 className="text-lg sm:text-2xl font-serif font-black text-emerald-800 tracking-tight">FoodShare</h1>
          </div>

          {/* Mobile Menu */}
          <div className="flex items-center gap-2 sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="hover-lift">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col gap-4 mt-8">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                    {user && (
                      <Badge className={`${getUserTypeColor(user.userType)} font-medium px-3 py-1 border`}>
                  {user.userType ? (user.userType.charAt(0).toUpperCase() + user.userType.slice(1)) : ""}
                      </Badge>
                    )}
                    <span className="text-slate-700 font-medium text-sm">{user?.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent hover-lift font-medium justify-start"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Menu */}
          <div className="hidden sm:flex items-center gap-3 md:gap-4">
            {user && (
              <Badge className={`${getUserTypeColor(user.userType)} font-medium px-3 py-1 border hover-lift`}>
          {user.userType ? (user.userType.charAt(0).toUpperCase() + user.userType.slice(1)) : ""}
              </Badge>
            )}
            <span className="text-slate-700 font-medium hidden md:block">Welcome, {user?.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent hover-lift font-medium"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 animate-slide-up">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-800 mb-2">Food Listings</h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Browse and manage surplus food available for redistribution
            </p>
          </div>
          <Link href="/dashboard/food-listings/create" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto gradient-primary text-white hover-lift shadow-lg hover:shadow-emerald-200 font-medium h-12 sm:h-auto">
              <Plus className="h-4 w-4 mr-2" />
              List Food
            </Button>
          </Link>
        </div>

        {/* Live Map of Listings (if coordinates available) */}
        <div className="mb-6 sm:mb-8 animate-slide-up">
          <FoodListingsMap
            listings={(listings || []).map((l) => ({
              id: l.id,
              title: l.title,
              location: l.location,
              availableUntil: l.availableUntil,
              lat: (l as any).lat,
              lng: (l as any).lng,
              status: (l as any).status,
              quantity: l.quantity,
              foodType: l.foodType,
              listerName: (l as any).providerName || (l as any).provider?.name || (l as any).donorName || (l as any).createdBy || "",
            }))}
          />
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6 sm:mb-8 animate-slide-up delay-100">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search food listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 border-2 border-emerald-100 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 transition-all duration-300"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-12 border-2 border-emerald-100 focus:border-emerald-300">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Food Type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="meals">Meals</SelectItem>
                <SelectItem value="snacks">Snacks</SelectItem>
                <SelectItem value="beverages">Beverages</SelectItem>
                <SelectItem value="fruits">Fruits</SelectItem>
                <SelectItem value="vegetables">Vegetables</SelectItem>
                <SelectItem value="bakery">Bakery Items</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-12 border-2 border-emerald-100 focus:border-emerald-300">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Available + Reserved)</SelectItem>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="collected">Collected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredListings.map((listing, index) => (
            <Card
              key={listing.id}
              className="hover-lift border-emerald-100 hover:border-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 animate-scale-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-3 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg sm:text-xl font-serif font-bold text-slate-800 mb-2 line-clamp-2">
                      {listing.title}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 line-clamp-2">
                      {listing.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Badge className={`${getStatusColor(listing.status)} font-medium flex-shrink-0 border`}>
                      {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                    </Badge>
                    {/* QR option removed from listing summary; QR tickets are issued when reserved */}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Left: Image ~40% */}
                  <div className="md:col-span-2">
                    <div className="relative w-full h-40 sm:h-48 md:h-full overflow-hidden rounded-md border border-emerald-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={(listing as any).imageUrl || '/placeholder.jpg'}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                      {(listing as any).freshnessLabel && (
                        <div className="absolute top-2 left-2">
                          <span className="inline-flex items-center rounded-md bg-emerald-600/90 text-white text-xs sm:text-sm md:text-base px-3 py-1.5 shadow-md">
                            Freshness: {(listing as any).freshnessLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Details ~60% */}
                  <div className="md:col-span-3 flex flex-col">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{listing.location}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Users className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{listing.organization}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{getTimeRemaining(listing.availableUntil)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <span className="text-slate-600 truncate">Safe for {listing.safetyHours} hours</span>
                      </div>
                    </div>

                    {listing.status === "collected" && listing.collectedBy && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-3">
                        <p className="text-sm text-emerald-800">
                          <strong>Collected by:</strong> {listing.collectedBy}
                        </p>
                        {listing.collectedAt && (
                          <p className="text-xs text-emerald-600 mt-1">{new Date(listing.collectedAt).toLocaleString()}</p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1 mt-4">
                      <Badge variant="secondary" className="text-xs font-medium">
                        {listing.foodType}
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {listing.quantity}
                      </Badge>
                      {typeof (listing as any).remainingQuantity === 'number' && (
                        <Badge variant="outline" className="text-xs">
                          Remaining: {(listing as any).remainingQuantity}
                        </Badge>
                      )}
                      {(Array.isArray(listing.tags) ? listing.tags : []).slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {Array.isArray(listing.tags) && listing.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{listing.tags.length - 2}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-6">
                      {listing.status === "available" && !canListFood && String((listing as any).createdByEmail || '') !== String(user?.email || '') && (
                        <Button
                          size="sm"
                          className="flex-1 gradient-primary text-white hover-lift shadow-lg hover:shadow-emerald-200 h-10 font-medium"
                          onClick={() => handleReserve(listing)}
                        >
                          Reserve
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 font-medium"
                        onClick={() => {
                          setSelectedListing(listing)
                          setDialogOpen(true)
                        }}
                      >
                        Details
                      </Button>

                      {(() => {
                        const ownerId = String((listing as any).createdBy || (listing as any).providerId || (listing as any).donorId || '')
                        const reserverId = String((listing as any).reservedBy || (listing as any).reservedById || '')
                        const me = String((user as any)?.id || (user as any)?._id || '')
                        const ownerEmail = String((listing as any).createdByEmail || (listing as any).provider?.email || '')
                        const reserverEmail = String((listing as any).reservedByEmail || '')
                        const myEmail = String(user?.email || '')
                        // If partial reservations exist, allow chat when the current user is the owner or one of the reservations' by/byEmail
                        const reservations = Array.isArray((listing as any).reservations) ? ((listing as any).reservations as any[]) : []
                        const myReservation = reservations.find((r: any) => String(r.by) === me || (r.byEmail && String(r.byEmail) === myEmail))
                        const hasActiveReservation = reservations.some((r: any) => (r?.status || 'reserved') !== 'collected')
                        const canChat = (
                          (
                            ((listing as any).status === 'reserved') ||
                            !!myReservation ||
                            (me === ownerId && hasActiveReservation)
                          ) && (
                          me === ownerId ||
                          me === reserverId ||
                          !!myReservation ||
                          // Fallback: some legacy listings store owner via email, not id
                          (ownerEmail && myEmail && ownerEmail === myEmail) || (reserverEmail && myEmail && reserverEmail === myEmail)
                        ))
                        if (!canChat) return null
                        const activeFirst = reservations.find((r: any) => (r?.status || 'reserved') !== 'collected')
                        const withRes = { ...(listing as any), __reservationId: myReservation?.id || (me === ownerId ? activeFirst?.id : undefined) }
                        return (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 h-10 font-medium border border-emerald-200"
                            onClick={() => {
                              setChatListing(withRes as any)
                              setChatOpen(true)
                            }}
                          >
                            Chat
                          </Button>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Listing Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setSelectedListing(null); setDialogOpen(open) }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-start justify-between w-full">
                <div>
                  <DialogTitle>Listing Details</DialogTitle>
                  <DialogDescription>Complete details for the selected listing and the user who posted it.</DialogDescription>
                </div>
                <div className="text-right">
                  {selectedListing && (
                    <Badge className={`${getStatusColor(selectedListing.status)} font-medium px-2 py-1 border`}>{selectedListing.status.charAt(0).toUpperCase() + selectedListing.status.slice(1)}</Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            {selectedListing ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: main listing details */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedListing.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{selectedListing.description}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Food Type</p>
                      <p className="font-medium">{selectedListing.foodType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Quantity</p>
                      <p className="font-medium">{selectedListing.quantity}{selectedListing.unit ? ` ${selectedListing.unit}` : ''}</p>
                    </div>
                    {typeof (selectedListing as any).remainingQuantity === 'number' && (
                      <div>
                        <p className="text-xs text-slate-500">Remaining</p>
                        <p className="font-medium">{(selectedListing as any).remainingQuantity}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-500">Location</p>
                      <p className="font-medium">{selectedListing.location}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Available Until</p>
                      <p className="font-medium">{selectedListing.availableUntil ? new Date(selectedListing.availableUntil).toLocaleString() : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Safe To Eat (hrs)</p>
                      <p className="font-medium">{selectedListing.safetyHours ?? selectedListing.safeToEatHours ?? 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tags / Dietary Info</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(selectedListing.tags || []).length > 0 ? (selectedListing.tags || []).map((t, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                        )) : <span className="text-sm text-slate-500">—</span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-emerald-500">Special Instructions / Contact</p>
                    <p className="font-medium text-emerald-800">{selectedListing.specialInstructions || selectedListing.contactInfo || 'None provided'}</p>
                  </div>

                  {/* Chat quick access inside details for owner/reserver */}
                  {(() => {
                    const listing: any = selectedListing
                    const ownerId = String(listing.createdBy || listing.providerId || listing.donorId || '')
                    const me = String((user as any)?.id || (user as any)?._id || '')
                    const myEmail = String(user?.email || '')
                    const ownerEmail = String(listing.createdByEmail || listing.provider?.email || '')
                    const reservations = Array.isArray(listing.reservations) ? (listing.reservations as any[]) : []
                    const myReservation = reservations.find((r) => String(r.by) === me || (r.byEmail && String(r.byEmail) === myEmail))
                    const activeFirst = reservations.find((r) => (r?.status || 'reserved') !== 'collected')
                    const isOwner = me === ownerId || (!!ownerEmail && ownerEmail === myEmail)
                    const showChat = !!myReservation || (isOwner && !!activeFirst)
                    if (!showChat) return null
                    const resId = myReservation?.id || (isOwner ? activeFirst?.id : undefined)
                    return (
                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 border border-emerald-200"
                          onClick={() => {
                            const withRes = { ...listing, __reservationId: resId }
                            setChatListing(withRes as any)
                            setChatOpen(true)
                          }}
                        >
                          Open Chat
                        </Button>
                      </div>
                    )
                  })()}
                </div>

                {/* Right: provider / lister details */}
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 shadow-sm">
                    <p className="text-xs text-emerald-500">Listed by</p>
                    <p className="font-semibold mt-1 text-emerald-800">{(selectedListing as any).provider?.name || (selectedListing as any).providerName || 'Unknown'}</p>
                    <p className="text-xs text-emerald-500 mt-2">Organization</p>
                    <p className="font-medium text-emerald-700">{selectedListing.organization || (selectedListing as any).provider?.organization || '—'}</p>

                    <div className="mt-3 text-sm text-emerald-700">
                      {((selectedListing as any).provider?.email || (selectedListing as any).provider?.contact || null) && (
                        <p className="truncate"><strong className="text-emerald-600">Email:</strong> {(selectedListing as any).provider?.email || (selectedListing as any).provider?.contact}</p>
                      )}
                      {((selectedListing as any).provider?.phone || (selectedListing as any).provider?.phoneNumber || null) && (
                        <p className="mt-1 truncate"><strong className="text-emerald-600">Phone:</strong> {(selectedListing as any).provider?.phone || (selectedListing as any).provider?.phoneNumber}</p>
                      )}
                    </div>
                  </div>

                  {/* QR detail removed: QR is generated only when a reservation is made */}
                </div>
              </div>
            ) : (
              <div>Loading...</div>
            )}

            <DialogFooter>
              <div className="w-full flex justify-end">
                <Button onClick={() => setDialogOpen(false)} variant="outline">Close</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Chat Dialog */}
        <Dialog open={chatOpen} onOpenChange={(open) => { if (!open) setChatListing(null); setChatOpen(open) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Chat</DialogTitle>
              <DialogDescription>
                {chatListing ? `Discuss pickup for "${chatListing.title}"` : "Start chatting"}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              {chatListing && <ListingChat listingId={chatListing.id} />}
            </div>
            <DialogFooter>
              <div className="w-full flex justify-end">
                <Button onClick={() => setChatOpen(false)} variant="outline">Close</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Empty State */}
        {filteredListings.length === 0 && (
          <div className="text-center py-12 sm:py-16 animate-fade-in">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Search className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-serif font-bold text-slate-800 mb-2">No listings found</h3>
            <p className="text-slate-600 mb-6 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              {searchTerm || filterType !== "all" || filterStatus !== "all"
                ? "Try adjusting your search or filters to find what you're looking for"
                : "Be the first to list surplus food for redistribution and help reduce waste"}
            </p>
            <Link href="/dashboard/food-listings/create">
              <Button className="gradient-primary text-white hover-lift shadow-lg hover:shadow-emerald-200 h-12 px-8 font-medium">
                <Plus className="h-4 w-4 mr-2" />
                List Food
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
