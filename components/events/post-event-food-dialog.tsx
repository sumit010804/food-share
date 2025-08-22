"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Clock, AlertTriangle, MapPin } from "lucide-react"

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
  expectedSurplusKg?: number
    confidence: "low" | "medium" | "high"
  }
  foodLogged: boolean
  createdAt: string
}

interface PostEventFoodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: Event | null
  eventsNeedingAttention: Event[]
  onFoodLogged: () => void
}

export function PostEventFoodDialog({
  open,
  onOpenChange,
  event,
  eventsNeedingAttention,
  onFoodLogged,
}: PostEventFoodDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedEventId, setSelectedEventId] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    foodType: "",
    quantity: "",
    safetyHours: "4",
    specialInstructions: "",
  })
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Load current user from localStorage for client-side guard
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      if (raw) setCurrentUser(JSON.parse(raw))
    } catch {}
  }, [])

  const currentEvent = event || eventsNeedingAttention.find((e) => e.id === selectedEventId)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEvent) return

    setIsLoading(true)
    setError("")

    try {
      // client-side guard: only admin can log post-event food
      if (!(currentUser && currentUser.userType === 'admin')) {
        setError('You do not have permission to log post-event food.')
        return
      }
      // Create food listing
      const foodResponse = await fetch("/api/food-listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          location: currentEvent.location,
          availableUntil: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
          tags: ["event-surplus", currentEvent.eventType],
          createdBy: currentEvent.organizer,
          organization: currentEvent.organization,
        }),
      })

      if (foodResponse.ok) {
        const resJson = await foodResponse.json()
        // Try to estimate kg from submitted quantity or returned listing
        const listing = resJson.listing || resJson.listing || null
        const qty = formData.quantity || (listing && (listing.quantity || listing.raw?.quantity))

        const parseQuantityToKg = (q: any) => {
          if (!q) return null
          const s = String(q).toLowerCase()
          // simple patterns
          const kgMatch = s.match(/([0-9]+(?:\.[0-9]+)?)\s*kg/)
          if (kgMatch) return parseFloat(kgMatch[1])
          const servingsMatch = s.match(/([0-9]+)\s*serv/)
          if (servingsMatch) {
            const servings = parseInt(servingsMatch[1])
            // assume 0.25 kg per serving as heuristic
            return Math.round(servings * 0.25 * 100) / 100
          }
          const numMatch = s.match(/([0-9]+(?:\.[0-9]+)?)/)
          if (numMatch) return parseFloat(numMatch[1])
          return null
        }

        const estimatedKg = parseQuantityToKg(qty)

        // Mark event as food logged and attach actual surplus kg if available
        try {
          let actorEmail: string | null = null
          let actorId: string | null = null
          try {
            const u = currentUser
            if (u) {
              actorEmail = u?.email || null
              actorId = u?.id || u?._id || null
            }
          } catch {}

          await fetch(`/api/events/${currentEvent.id}/food-logged`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actualSurplusKg: estimatedKg, actorEmail, actorId }),
          })
        } catch (e) {
          console.error('Failed to mark event as food logged with actual kg', e)
        }

        onFoodLogged()
        onOpenChange(false)
        setFormData({
          title: "",
          description: "",
          foodType: "",
          quantity: "",
          safetyHours: "4",
          specialInstructions: "",
        })
        setSelectedEventId("")
      } else {
        const data = await foodResponse.json()
        setError(data.message || "Failed to log food")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log Post-Event Surplus Food</DialogTitle>
          <DialogDescription>
            Create a food listing for surplus food from completed events to help reduce waste
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!event && eventsNeedingAttention.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="eventSelect">Select Event *</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event that needs food logging" />
                </SelectTrigger>
                <SelectContent>
                  {eventsNeedingAttention.map((evt) => (
                      <SelectItem key={evt.id} value={evt.id}>
                        {evt.title} - {evt.location} ({evt.foodPrediction.expectedSurplusKg ?? evt.foodPrediction.expectedSurplus} kg predicted)
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentEvent && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-800">{currentEvent.title}</h4>
                <Badge className="bg-amber-100 text-amber-800">
                  {currentEvent.foodPrediction.expectedSurplusKg ?? currentEvent.foodPrediction.expectedSurplus} kg predicted
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {currentEvent.location}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Ended {new Date(currentEvent.endTime).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Food Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Conference Lunch Leftovers"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="foodType">Food Type *</Label>
              <Select value={formData.foodType} onValueChange={(value) => handleInputChange("foodType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select food type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meals">Meals</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                  <SelectItem value="fruits">Fruits</SelectItem>
                  <SelectItem value="vegetables">Vegetables</SelectItem>
                  <SelectItem value="bakery">Bakery Items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the food, ingredients, preparation method, etc."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                placeholder="e.g., 5 kg (approx), 20 servings, 30 pieces"
                value={formData.quantity}
                onChange={(e) => handleInputChange("quantity", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="safetyHours">Safe to Eat (Hours) *</Label>
              <div className="relative">
                <AlertTriangle className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Select value={formData.safetyHours} onValueChange={(value) => handleInputChange("safetyHours", value)}>
                  <SelectTrigger className="pl-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialInstructions">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              placeholder="Any special handling, storage, or pickup instructions"
              value={formData.specialInstructions}
              onChange={(e) => handleInputChange("specialInstructions", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="flex-1 bg-cyan-800 hover:bg-cyan-900"
              disabled={isLoading || (!event && !selectedEventId) || !(currentUser && currentUser.userType === 'admin')}
            >
              {isLoading ? "Creating..." : "Log Surplus Food"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
