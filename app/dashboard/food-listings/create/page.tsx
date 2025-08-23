"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Leaf from "@/components/leaf-custom"
import { LogOut, ArrowLeft, Plus, X, Clock, AlertTriangle, MapPin } from "lucide-react"
import Link from "next/link"

interface User {
  id: string
  name: string
  email: string
  userType: string
  organization: string
}

export default function CreateFoodListingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    foodType: "",
    quantity: "",
    location: "",
    availableUntil: "",
    safetyHours: "4",
  specialInstructions: "",
  lat: "",
  lng: "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [freshnessLabel, setFreshnessLabel] = useState<string | null>(null)
  const [freshnessProbs, setFreshnessProbs] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
      // Set default location based on user organization
      const parsedUser = JSON.parse(userData)
      setFormData((prev) => ({
        ...prev,
        location: parsedUser.organization,
      }))
    } else {
      router.push("/login")
    }
  }, [router])

  const canListFood = user && (user.userType === 'canteen' || user.userType === 'hostel' || user.userType === 'admin')
  if (user && !canListFood) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-6 border rounded-lg bg-white text-slate-700">
          You don’t have permission to create listings. Please browse available food in Food Listings.
        </div>
      </div>
    )
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // If user attached an image, send to freshness predictor API first
      let uploadedImageUrl: string | undefined
      let detectedFreshness: string | undefined
      if (imageFile) {
        try {
          const fd = new FormData()
          fd.append('image', imageFile)
          const fresRes = await fetch('/api/freshness', { method: 'POST', body: fd })
          const fresJson = await fresRes.json().catch(() => ({}))
          if (fresRes.ok) {
            uploadedImageUrl = fresJson.imageUrl
            detectedFreshness = fresJson.label
            setFreshnessLabel(fresJson.label || null)
            setFreshnessProbs(fresJson.probabilities || null)
          } else {
            setFreshnessLabel(fresJson.label || 'Unknown')
          }
        } catch (e) {
          // Non-fatal
          setFreshnessLabel('Unknown')
        }
      }

      const response = await fetch("/api/food-listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          tags,
          createdBy: user?.name,
          organization: user?.organization,
          lat: formData.lat ? Number(formData.lat) : undefined,
          lng: formData.lng ? Number(formData.lng) : undefined,
          imageUrl: uploadedImageUrl,
          freshnessLabel: detectedFreshness,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess("Food listing created successfully!")
        // Notify other windows/frames and immediately navigate to listings so the lister sees the new item
        try {
          window.dispatchEvent(new CustomEvent('listing:created', { detail: { id: data.listing?.id } }))
        } catch (e) {
          // ignore if window not available in test env
        }
        router.push("/dashboard/food-listings")
      } else {
        setError(data.message || "Failed to create listing")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
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

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/food-listings">
            <Button variant="outline" size="sm" className="bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Listings
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">List Surplus Food</h2>
            <p className="text-slate-600">Help reduce waste by sharing surplus food with the community</p>
          </div>
        </div>

        {/* Form */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle>Food Details</CardTitle>
            <CardDescription>Provide information about the surplus food you want to redistribute</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Food Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Vegetable Curry, Fresh Sandwiches"
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
                  <Label htmlFor="location">Pickup Location *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="location"
                      placeholder="Building, room number, or specific location"
                      value={formData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          alert("Geolocation is not supported in your browser.")
                          return
                        }
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            const { latitude, longitude } = pos.coords
                            setFormData((prev) => ({ ...prev, lat: String(latitude), lng: String(longitude) }))
                          },
                          (err) => {
                            console.warn("Geolocation denied or unavailable", err)
                            alert("Location permission denied or unavailable.")
                          },
                          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                        )
                      }}
                    >
                      Share Current Location
                    </Button>
                    {(formData.lat && formData.lng) && (
                      <span className="text-xs text-slate-600 self-center">Lat: {Number(formData.lat).toFixed(5)}, Lng: {Number(formData.lng).toFixed(5)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="availableUntil">Available Until *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="availableUntil"
                      type="datetime-local"
                      value={formData.availableUntil}
                      onChange={(e) => handleInputChange("availableUntil", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="safetyHours">Safe to Eat (Hours) *</Label>
                  <div className="relative">
                    <AlertTriangle className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Select
                      value={formData.safetyHours}
                      onValueChange={(value) => handleInputChange("safetyHours", value)}
                    >
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
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add tags (e.g., vegetarian, spicy, gluten-free)"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => removeTag(tag)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Food Photo (optional)</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*;capture=camera"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setImageFile(f)
                    setFreshnessLabel(null)
                    setFreshnessProbs(null)
                    if (f) {
                      const url = URL.createObjectURL(f)
                      setImagePreview(url)
                    } else {
                      setImagePreview(null)
                    }
                  }}
                />
                {imagePreview && (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="preview" className="h-24 w-24 object-cover rounded-md border" />
                    {freshnessLabel && (
                      <Badge className="bg-emerald-100 text-emerald-800">Freshness: {freshnessLabel}</Badge>
                    )}
                  </div>
                )}
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
                <Button type="submit" className="flex-1 bg-cyan-800 hover:bg-cyan-900" disabled={isLoading}>
                  {isLoading ? "Creating..." : "List Food"}
                </Button>
                <Link href="/dashboard/food-listings" className="flex-1">
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
