"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MapPin, Users, Clock } from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  userType: string
  organization: string
}

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventCreated: () => void
  user: User
}

export function CreateEventDialog({ open, onOpenChange, onEventCreated, user }: CreateEventDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "",
    location: "",
    startTime: "",
    endTime: "",
    expectedAttendees: "",
  })

  const computePrediction = (type: string, attendees: number) => {
    let expectedSurplus = 0
    let confidence: "low" | "medium" | "high" = "low"

    switch (type) {
      case "conference":
        expectedSurplus = Math.round(attendees * 0.08)
        confidence = "high"
        break
      case "workshop":
        expectedSurplus = Math.round(attendees * 0.05)
        confidence = "medium"
        break
      case "seminar":
        expectedSurplus = Math.round(attendees * 0.06)
        confidence = "medium"
        break
      case "meeting":
        expectedSurplus = Math.round(attendees * 0.12)
        confidence = "high"
        break
      case "celebration":
        expectedSurplus = Math.round(attendees * 0.15)
        confidence = "high"
        break
      default:
        expectedSurplus = Math.round(attendees * 0.07)
        confidence = "low"
    }

    return { expectedSurplus, confidence }
  }

  const getConfidenceBadge = (confidence: "low" | "medium" | "high") => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-100 text-green-800">High</Badge>
      case "medium":
        return <Badge className="bg-amber-100 text-amber-800">Medium</Badge>
      default:
        return <Badge className="bg-red-100 text-red-800">Low</Badge>
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
  // client-side guard: only admin can create events
  if (!(user && (user.userType === 'admin'))) {
      setError('You do not have permission to create events.')
      return
    }
    const attendeesNum = Number.parseInt(formData.expectedAttendees) || 0
    const prediction = computePrediction(formData.eventType, attendeesNum)
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          expectedAttendees: Number.parseInt(formData.expectedAttendees),
      organizer: user.name,
      organizerId: user.id,
      organizerEmail: user.email,
      organization: user.organization,
      expectedSurplus: prediction.expectedSurplus,
      expectedSurplusKg: Math.round(prediction.expectedSurplus * 0.25 * 100) / 100,
      confidence: prediction.confidence,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        onEventCreated()
        onOpenChange(false)
        setFormData({
          title: "",
          description: "",
          eventType: "",
          location: "",
          startTime: "",
          endTime: "",
          expectedAttendees: "",
        })
      } else {
        setError(data.message || "Failed to create event")
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
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>Add a new campus event to track potential surplus food opportunities</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Tech Conference 2024"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type *</Label>
              <Select value={formData.eventType} onValueChange={(value) => handleInputChange("eventType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="seminar">Seminar</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="celebration">Celebration</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the event"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="location"
                  placeholder="e.g., Main Auditorium, Room 101"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedAttendees">Expected Attendees *</Label>
              <div className="relative">
                <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="expectedAttendees"
                  type="number"
                  placeholder="e.g., 50"
                  value={formData.expectedAttendees}
                  onChange={(e) => handleInputChange("expectedAttendees", e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange("startTime", e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange("endTime", e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Live prediction preview */}
          <div className="p-4 bg-slate-50 rounded-lg">
            {String(formData.expectedAttendees).trim() ? (
              (() => {
                const attendeesNum = Number.parseInt(formData.expectedAttendees) || 0
                const pred = computePrediction(formData.eventType, attendeesNum)
                const KG_PER_SERVING = 0.25
                const predKg = Math.round(pred.expectedSurplus * KG_PER_SERVING * 100) / 100

                return (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600">Predicted Surplus</div>
                      <div className="text-xl font-bold text-slate-800">{predKg} kg</div>
                    </div>
                    <div>{getConfidenceBadge(pred.confidence)}</div>
                  </div>
                )
              })()
            ) : (
              <div className="text-sm text-slate-600">Enter expected attendees to see prediction</div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" className="flex-1 bg-cyan-800 hover:bg-cyan-900" disabled={isLoading || !(user && (user.userType === 'admin'))}>
              {isLoading ? "Creating..." : "Create Event"}
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
