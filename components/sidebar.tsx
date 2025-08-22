"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, Search, BarChart3, Calendar, History, Menu, X, Home, QrCode } from "lucide-react"
import Leaf from "@/components/leaf-custom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SidebarProps {
  className?: string
}

const navigationItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    hoverColor: "hover:bg-emerald-100",
  },
  {
    name: "Scan QR",
    href: "/scan",
    icon: QrCode,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    hoverColor: "hover:bg-emerald-100",
  },
  {
    name: "List Food",
    href: "/dashboard/food-listings/create",
    icon: Plus,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    hoverColor: "hover:bg-blue-100",
  },
  {
    name: "Search",
    href: "/dashboard/food-listings",
    icon: Search,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    hoverColor: "hover:bg-amber-100",
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    hoverColor: "hover:bg-purple-100",
  },
  {
    name: "Events",
    href: "/dashboard/events",
    icon: Calendar,
    color: "text-green-600",
    bgColor: "bg-green-50",
    hoverColor: "hover:bg-green-100",
  },
  {
    name: "Donation History",
    href: "/dashboard/donation-history",
    icon: History,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    hoverColor: "hover:bg-cyan-100",
  },
]

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      if (raw) setUser(JSON.parse(raw))
    } catch {}
  }, [])

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white/90 backdrop-blur-md border-emerald-200 hover:bg-emerald-50"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

  {/* Removed floating Scan QR button */}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-full bg-white/95 backdrop-blur-md border-r border-emerald-100 transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className,
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Leaf className="h-8 w-8 text-emerald-600" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
              {!isCollapsed && (
                <div className="animate-fade-in">
                  <h1 className="text-xl font-serif font-black text-emerald-800 tracking-tight">FoodShare</h1>
                  <p className="text-xs text-slate-500">Campus Food Redistribution</p>
                </div>
              )}
            </div>

            {/* Collapse Button - Desktop Only */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 rounded-full bg-white border border-emerald-200 hover:bg-emerald-50 p-0"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <Menu className="h-3 w-3" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigationItems
              .filter((item) => {
                const role = user?.userType || user?.role
                const isStudentOrNgo = role === 'student' || role === 'ngo'
                // Additionally, hide Scan QR and List Food create for Student/NGO
                if (isStudentOrNgo) {
                  if (item.href === '/scan') return false
                  if (item.href === '/dashboard/food-listings/create') return false
                }
                return true
              })
              .map((item, index) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              const role = user?.userType || user?.role
              const isStudentOrNgo = role === 'student' || role === 'ngo'
              const label = isStudentOrNgo && item.href === '/dashboard/donation-history' ? 'Collection History' : item.name

              return (
                <Link
                  key={`${item.name}-${index}`}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                    isActive
                      ? `${item.bgColor} ${item.color} shadow-sm border border-opacity-20`
                      : `text-slate-600 hover:text-slate-800 ${item.hoverColor}`,
                    isCollapsed ? "justify-center" : "",
                    "animate-slide-up",
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                      isActive ? "scale-110" : "group-hover:scale-105",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {!isCollapsed && <span className="font-medium text-sm animate-fade-in">{label}</span>}

                  {/* Active Indicator */}
                  {isActive && <div className="absolute right-2 w-2 h-2 bg-current rounded-full animate-pulse" />}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-emerald-100">
            {!isCollapsed && (
              <div className="text-center animate-fade-in">
                <p className="text-xs text-slate-500 mb-2">Making campus sustainable</p>
                <div className="flex items-center justify-center gap-1">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-emerald-600 font-medium">Online</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

  {/* Main Content Spacer removed for dynamic layout */}
    </>
  )
}
