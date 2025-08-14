"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Leaf, LogOut, Bell, Clock, Settings, Check, X, AlertTriangle } from "lucide-react"
import Link from "next/link"

interface User {
  id: string
  name: string
  email: string
  userType: string
  organization: string
}

interface Notification {
  id: string
  type: "new_listing" | "pickup_reminder" | "expiry_warning" | "reservation_confirmed" | "system"
  title: string
  message: string
  foodListingId?: string
  isRead: boolean
  createdAt: string
  priority: "low" | "medium" | "high"
  actionUrl?: string
}

interface NotificationSettings {
  newListings: boolean
  pickupReminders: boolean
  expiryWarnings: boolean
  reservationUpdates: boolean
  systemNotifications: boolean
  emailNotifications: boolean
}

export default function NotificationsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<NotificationSettings>({
    newListings: true,
    pickupReminders: true,
    expiryWarnings: true,
    reservationUpdates: true,
    systemNotifications: true,
    emailNotifications: false,
  })
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "settings">("all")
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
      fetchNotifications()
      loadSettings()
    } else {
      router.push("/login")
    }
  }, [router])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications")
      const data = await response.json()
      setNotifications(data.notifications || [])
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  const loadSettings = () => {
    const savedSettings = localStorage.getItem("notificationSettings")
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }

  const saveSettings = (newSettings: NotificationSettings) => {
    setSettings(newSettings)
    localStorage.setItem("notificationSettings", JSON.stringify(newSettings))
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      })
      setNotifications((prev) =>
        prev.map((notif) => (notif.id === notificationId ? { ...notif, isRead: true } : notif)),
      )
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "PATCH",
      })
      setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })))
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId))
    } catch (error) {
      console.error("Failed to delete notification:", error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_listing":
        return <Bell className="h-4 w-4 text-cyan-600" />
      case "pickup_reminder":
        return <Clock className="h-4 w-4 text-amber-600" />
      case "expiry_warning":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case "reservation_confirmed":
        return <Check className="h-4 w-4 text-green-600" />
      default:
        return <Bell className="h-4 w-4 text-slate-600" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-amber-100 text-amber-800"
      case "low":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-slate-100 text-slate-800"
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

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === "unread") return !notif.isRead
    return true
  })

  const unreadCount = notifications.filter((notif) => !notif.isRead).length

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
              {user.userType.charAt(0).toUpperCase() + user.userType.slice(1)}
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
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Notifications</h2>
            <p className="text-slate-600">Stay updated on food availability and pickup opportunities</p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" size="sm" className="bg-transparent">
                <Check className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
            <Badge variant="secondary" className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {unreadCount} unread
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 mb-8 border-b">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-cyan-800 text-cyan-800 font-medium"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => setActiveTab("unread")}
            className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "unread"
                ? "border-cyan-800 text-cyan-800 font-medium"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "settings"
                ? "border-cyan-800 text-cyan-800 font-medium"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>

        {/* Content */}
        {activeTab === "settings" ? (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose which notifications you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="newListings">New Food Listings</Label>
                  <p className="text-sm text-slate-600">Get notified when new surplus food is available</p>
                </div>
                <Switch
                  id="newListings"
                  checked={settings.newListings}
                  onCheckedChange={(checked) => saveSettings({ ...settings, newListings: checked })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="pickupReminders">Pickup Reminders</Label>
                  <p className="text-sm text-slate-600">Reminders for food pickup windows</p>
                </div>
                <Switch
                  id="pickupReminders"
                  checked={settings.pickupReminders}
                  onCheckedChange={(checked) => saveSettings({ ...settings, pickupReminders: checked })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="expiryWarnings">Expiry Warnings</Label>
                  <p className="text-sm text-slate-600">Alerts when food is about to expire</p>
                </div>
                <Switch
                  id="expiryWarnings"
                  checked={settings.expiryWarnings}
                  onCheckedChange={(checked) => saveSettings({ ...settings, expiryWarnings: checked })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="reservationUpdates">Reservation Updates</Label>
                  <p className="text-sm text-slate-600">Updates on your food reservations</p>
                </div>
                <Switch
                  id="reservationUpdates"
                  checked={settings.reservationUpdates}
                  onCheckedChange={(checked) => saveSettings({ ...settings, reservationUpdates: checked })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="systemNotifications">System Notifications</Label>
                  <p className="text-sm text-slate-600">Important system updates and announcements</p>
                </div>
                <Switch
                  id="systemNotifications"
                  checked={settings.systemNotifications}
                  onCheckedChange={(checked) => saveSettings({ ...settings, systemNotifications: checked })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-slate-600">Receive notifications via email</p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => saveSettings({ ...settings, emailNotifications: checked })}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.length === 0 ? (
              <Card className="border-slate-200">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-2">
                    {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
                  </h3>
                  <p className="text-slate-600">
                    {activeTab === "unread"
                      ? "You're all caught up! Check back later for new updates."
                      : "You'll see notifications about food listings and updates here."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`border-slate-200 transition-all hover:shadow-md ${
                    !notification.isRead ? "bg-cyan-50/50 border-cyan-200" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-slate-800">{notification.title}</h4>
                              {!notification.isRead && <div className="w-2 h-2 bg-cyan-600 rounded-full" />}
                              <Badge className={getPriorityColor(notification.priority)} variant="secondary">
                                {notification.priority}
                              </Badge>
                            </div>
                            <p className="text-slate-600 text-sm mb-2">{notification.message}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>{new Date(notification.createdAt).toLocaleString()}</span>
                              {notification.foodListingId && (
                                <Link href={`/dashboard/food-listings`} className="text-cyan-600 hover:text-cyan-800">
                                  View Listing
                                </Link>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.isRead && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsRead(notification.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteNotification(notification.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
