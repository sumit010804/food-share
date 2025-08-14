import type React from "react"
import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
  <div className="min-h-screen w-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 flex items-stretch">
      <Sidebar />
  <main className="flex-1 transition-all duration-300 ease-in-out pl-0 lg:pl-64">{children}</main>
    </div>
  )
}
