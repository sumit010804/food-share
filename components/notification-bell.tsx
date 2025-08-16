"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, Clock, AlertTriangle, Check, Sparkles, Calendar, Package, CheckCircle, QrCode } from "lucide-react"
import Link from "next/link"

interface Notification {
  id: string
  type:
    | "new_listing"
    | "pickup_reminder"
    | "expiry_warning"
    | "reservation_confirmed"
    | "system"
    | "new_event"
    | "item_collected"
    | "collection_confirmed"
  title: string
  message: string
  foodListingId?: string
  eventId?: string
  collectedBy?: string
  donatedBy?: string
  collectionMethod?: "qr_scan" | "manual" | "direct"
  isRead: boolean
  createdAt: string
  priority: "low" | "medium" | "high"
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // resilient fetchNotifications with per-request AbortController and cleanup
  let currentController: AbortController | null = null
  let mounted = true

  const fetchNotifications = async () => {
    // abort any previous inflight request
    if (currentController) {
      try {
        currentController.abort()
      } catch (e) {
        // ignore
      }
    }
    const controller = new AbortController()
    currentController = controller

    try {
      setFetchError(null)
      // Read user id safely from localStorage
      let userId: string | null = null
      try {
        const userRaw = localStorage.getItem("user")
        if (userRaw) {
          const parsed = JSON.parse(userRaw)
          userId = parsed?.id || parsed?._id || null
        }
      } catch (e) {
        // parsing failed, fallback to null
        userId = null
      }

      const url = userId ? `/api/notifications?userId=${encodeURIComponent(userId)}` : "/api/notifications"
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" })
      if (!mounted) return
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`)
      }

      const data = await response.json()
      const incoming = (data.notifications || data || []) as any[]
      const newNotifications = incoming.map((n: any) => ({
        id: n.id || n._id || String(n.id),
        type: n.type,
        title: n.title,
        message: n.message,
        foodListingId: n.metadata?.foodListingId,
        eventId: n.metadata?.eventId,
        collectedBy: n.metadata?.collectorName,
        donatedBy: n.metadata?.donorName,
        collectionMethod: n.metadata?.collectionMethod,
        isRead: !!(n.read || n.isRead),
        createdAt: n.createdAt || n.created_at || new Date().toISOString(),
        priority: n.priority || "medium",
      }))

      if (!mounted) return
      if (newNotifications.length > notifications.length) {
        setHasNewNotification(true)
        setTimeout(() => setHasNewNotification(false), 2000)
      }

      setNotifications(newNotifications)
    } catch (error: any) {
      if (error?.name === "AbortError") return
      console.error("notification-bell: fetchNotifications error:", error)
      if (!mounted) return
      setFetchError((error && error.message) || "Failed to load notifications")
      // keep previous notifications
    }
  }

  useEffect(() => {
    mounted = true
    fetchNotifications()
    const interval = window.setInterval(fetchNotifications, 30000)
    return () => {
      mounted = false
      try {
        if (currentController) currentController.abort()
      } catch (e) {
        // ignore
      }
      clearInterval(interval)
    }
  }, [])

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

  const getNotificationIcon = (type: string, priority: string, collectionMethod?: string) => {
    const iconClass = `h-4 w-4 transition-all duration-300 ${priority === "high" ? "animate-pulse" : ""}`

    switch (type) {
      case "pickup_reminder":
        return <Clock className={`${iconClass} text-amber-600`} />
      case "expiry_warning":
        return <AlertTriangle className={`${iconClass} text-red-600`} />
      case "reservation_confirmed":
        return <Check className={`${iconClass} text-green-600`} />
      case "new_listing":
        return <Sparkles className={`${iconClass} text-emerald-600`} />
      case "new_event":
        return <Calendar className={`${iconClass} text-purple-600`} />
      case "item_collected":
        return collectionMethod === "qr_scan" ? (
          <QrCode className={`${iconClass} text-cyan-600`} />
        ) : (
          <Package className={`${iconClass} text-blue-600`} />
        )
      case "collection_confirmed":
        return <CheckCircle className={`${iconClass} text-emerald-600`} />
      default:
        return <Bell className={`${iconClass} text-slate-600`} />
    }
  }

  const getNotificationBorderColor = (type: string) => {
    switch (type) {
      case "item_collected":
        return "border-cyan-400"
      case "collection_confirmed":
        return "border-emerald-400"
      case "new_listing":
        return "border-emerald-400"
      case "pickup_reminder":
        return "border-amber-400"
      case "expiry_warning":
        return "border-red-400"
      case "new_event":
        return "border-purple-400"
      default:
        return "border-emerald-400"
    }
  }

  const unreadCount = notifications.filter((notif) => !notif.isRead).length
  const recentNotifications = notifications.slice(0, 5) // Show only 5 most recent

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative hover-lift transition-all duration-300 ${hasNewNotification ? "animate-pulse" : ""}`}
        >
          <Bell
            className={`h-5 w-5 transition-all duration-300 ${
              unreadCount > 0 ? "text-emerald-600 animate-pulse" : "text-slate-600"
            } ${hasNewNotification ? "animate-bounce" : ""}`}
          />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs animate-scale-in shadow-lg">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          {hasNewNotification && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 animate-scale-in shadow-xl border-emerald-100">
        <DropdownMenuLabel className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-white">
          <span className="font-serif font-bold text-slate-800">Notifications</span>
          {unreadCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse">
              {unreadCount} new
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {fetchError ? (
          <div className="p-6 text-center text-red-600 animate-fade-in">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
            <p className="text-sm font-medium">{fetchError}</p>
            <p className="text-xs text-slate-500">Notifications are temporarily unavailable.</p>
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="p-6 text-center text-slate-500 animate-fade-in">
            <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <>
            {recentNotifications.map((notification, index) => {
              const itemKey = notification.id ?? `${notification.type}-${index}-${new Date(notification.createdAt).getTime()}`
              return (
              <DropdownMenuItem
                key={itemKey}
                className={`p-4 cursor-pointer transition-all duration-300 hover:bg-emerald-50 animate-slide-up ${
                  !notification.isRead
                    ? `bg-gradient-to-r from-emerald-50/50 to-white border-l-4 ${getNotificationBorderColor(notification.type)}`
                    : ""
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => {
                  if (!notification.isRead) {
                    markAsRead(notification.id)
                  }
                  setIsOpen(false)
                }}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform duration-200">
                    {getNotificationIcon(notification.type, notification.priority, notification.collectionMethod)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm truncate text-slate-800">{notification.title}</p>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 animate-pulse"></div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{notification.message}</p>
                    {(notification.type === "item_collected" || notification.type === "collection_confirmed") &&
                      notification.collectionMethod && (
                        <div className="mt-1">
                          <Badge
                            className={`text-xs ${
                              notification.collectionMethod === "qr_scan"
                                ? "bg-cyan-100 text-cyan-800 border-cyan-200"
                                : notification.collectionMethod === "manual"
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-slate-100 text-slate-800 border-slate-200"
                            }`}
                          >
                            {notification.collectionMethod === "qr_scan"
                              ? "QR Scan"
                              : notification.collectionMethod === "manual"
                                ? "Manual"
                                : "Direct"}
                          </Badge>
                        </div>
                      )}
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      {new Date(notification.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/notifications"
                className="text-center text-sm text-emerald-600 hover:text-emerald-800 font-medium p-3 hover:bg-emerald-50 transition-all duration-300"
              >
                View all notifications →
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
