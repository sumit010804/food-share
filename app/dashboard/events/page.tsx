"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Leaf, LogOut, Calendar, Plus, Search, MapPin, Clock, Users, AlertTriangle, CheckCircle } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { CreateEventDialog } from "@/components/events/create-event-dialog"
import { PostEventFoodDialog } from "@/components/events/post-event-food-dialog"
import Link from "next/link"

interface User {
  id: string
  name: string
  email: string
  userType: string
  organization: string
}

interface Event {
  id: string
  title: string
  description: string
  eventType: string
  location: string
  startTime: string
  endTime: string
  expectedAttendees: number
  organizer: string
  organization: string
  status: "upcoming" | "ongoing" | "completed" | "cancelled"
  foodPrediction: {
    expectedSurplus: number
    confidence: "low" | "medium" | "high"
  }
  foodLogged: boolean
  createdAt: string
}

export default function EventsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showFoodDialog, setShowFoodDialog] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
      fetchEvents()
    } else {
      router.push("/login")
    }
  }, [router])

  useEffect(() => {
    let filtered = events

    if (searchTerm) {
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.organization.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((event) => event.status === filterStatus)
    }

    if (filterType !== "all") {
      filtered = filtered.filter((event) => event.eventType === filterType)
    }

    setFilteredEvents(filtered)
  }, [events, searchTerm, filterStatus, filterType])

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/events")
      const data = await response.json()
      setEvents(data.events || [])
      setFilteredEvents(data.events || [])
    } catch (error) {
      console.error("Failed to fetch events:", error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "bg-blue-100 text-blue-800"
      case "ongoing":
        return "bg-green-100 text-green-800"
      case "completed":
        return "bg-slate-100 text-slate-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-green-100 text-green-800"
      case "medium":
        return "bg-amber-100 text-amber-800"
      case "low":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
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

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getEventsNeedingAttention = () => {
    return events.filter(
      (event) =>
        event.status === "completed" &&
        !event.foodLogged &&
  (event.foodPrediction?.expectedSurplus ?? 0) > 0 &&
        new Date(event.endTime) > new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
    )
  }

  const eventsNeedingAttention = getEventsNeedingAttention()

  if (!user) {
    return <div>Loading...</div>
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
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Event Integration</h2>
            <p className="text-slate-600">Manage campus events and predict surplus food opportunities</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-cyan-800 hover:bg-cyan-900 text-white mt-4 md:mt-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>

        {/* Attention Alert */}
        {eventsNeedingAttention.length > 0 && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>{eventsNeedingAttention.length} event(s)</strong> recently completed with predicted surplus food.{" "}
              <button onClick={() => setShowFoodDialog(true)} className="underline hover:no-underline font-medium">
                Log surplus food now
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Search and Filters */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="conference">Conference</SelectItem>
              <SelectItem value="workshop">Workshop</SelectItem>
              <SelectItem value="seminar">Seminar</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="celebration">Celebration</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Events Tabs */}
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="predictions">Food Predictions</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-cyan-800" />
                  Event Calendar
                </CardTitle>
                <CardDescription>Visual timeline of campus events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {filteredEvents
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .slice(0, 10)
                    .map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                            <Calendar className="h-6 w-6 text-cyan-800" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-800 truncate">{event.title}</h4>
                            <Badge className={getStatusColor(event.status)}>
                              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </Badge>
                            {(event.foodPrediction?.expectedSurplus ?? 0) > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {event.foodPrediction?.expectedSurplus ?? 0}kg surplus
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(event.startTime)} - {formatDateTime(event.endTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.expectedAttendees} attendees
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.status === "completed" &&
                            !event.foodLogged &&
                            (event.foodPrediction?.expectedSurplus ?? 0) > 0 && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedEvent(event)
                                  setShowFoodDialog(true)
                                }}
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                              >
                                Log Food
                              </Button>
                            )}
                          {event.foodLogged && (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Food Logged
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <Card key={event.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{event.title}</CardTitle>
                        <CardDescription className="text-sm">{event.description}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(event.status)}>
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDateTime(event.startTime)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="h-4 w-4" />
                      <span>{event.expectedAttendees} expected attendees</span>
                    </div>

                    {(event.foodPrediction?.expectedSurplus ?? 0) > 0 && (
                      <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                        <span className="text-sm text-amber-800">
                          Predicted surplus: {event.foodPrediction?.expectedSurplus ?? 0}kg
                        </span>
                        <Badge className={getConfidenceColor(event.foodPrediction?.confidence ?? "") } variant="secondary">
                          {event.foodPrediction?.confidence ?? "N/A"}
                        </Badge>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      {event.status === "completed" &&
                        !event.foodLogged &&
                        event.foodPrediction.expectedSurplus > 0 && (
                          <Button
                            size="sm"
                            className="flex-1 bg-amber-500 hover:bg-amber-600"
                            onClick={() => {
                              setSelectedEvent(event)
                              setShowFoodDialog(true)
                            }}
                          >
                            Log Food
                          </Button>
                        )}
                      <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-6">
            <div className="grid gap-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    High Surplus Predictions
                  </CardTitle>
                  <CardDescription>Events likely to generate significant surplus food</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredEvents
                      .filter((event) => (event.foodPrediction?.confidence ?? "") === "high" && (event.foodPrediction?.expectedSurplus ?? 0) > 5)
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg"
                        >
                          <div>
                            <h4 className="font-medium text-slate-800">{event.title}</h4>
                            <p className="text-sm text-slate-600">
                              {formatDateTime(event.startTime)} • {event.location}
                            </p>
                            <p className="text-sm text-amber-800 mt-1">
                              Expected surplus: {event.foodPrediction.expectedSurplus}kg
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-100 text-amber-800">High Confidence</Badge>
                            <Badge className={getStatusColor(event.status)}>
                              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-3 gap-6">
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg">This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-cyan-800 mb-2">
                      {
                        events.filter((e) => {
                          const eventDate = new Date(e.startTime)
                          const now = new Date()
                          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                          return eventDate >= now && eventDate <= weekFromNow
                        }).length
                      }
                    </div>
                    <p className="text-sm text-slate-600">Events scheduled</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Predicted Surplus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600 mb-2">
                      {events
                        .filter((e) => {
                          const eventDate = new Date(e.startTime)
                          const now = new Date()
                          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                          return eventDate >= now && eventDate <= weekFromNow
                        })
                        .reduce((sum, e) => sum + (e.foodPrediction?.expectedSurplus ?? 0), 0)}
                      kg
                    </div>
                    <p className="text-sm text-slate-600">Expected this week</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Needs Attention</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600 mb-2">{eventsNeedingAttention.length}</div>
                    <p className="text-sm text-slate-600">Events need food logging</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onEventCreated={fetchEvents}
        user={user}
      />

      <PostEventFoodDialog
        open={showFoodDialog}
        onOpenChange={setShowFoodDialog}
        event={selectedEvent}
        eventsNeedingAttention={eventsNeedingAttention}
        onFoodLogged={fetchEvents}
      />
    </div>
  )
}
