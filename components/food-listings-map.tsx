"use client"

import { useEffect, useRef } from "react"

type Listing = {
  id: string
  title: string
  location?: string
  availableUntil?: string
  lat?: number
  lng?: number
  status?: string
  quantity?: string
  foodType?: string
  listerName?: string
}

export default function FoodListingsMap({ listings }: { listings: Listing[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<any | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    let isCancelled = false

    ;(async () => {
      const { default: L } = await import("leaflet")

      // Initialize map once
      if (!leafletMapRef.current) {
        leafletMapRef.current = L.map(mapRef.current!).setView([20.5937, 78.9629], 13)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(leafletMapRef.current)
      }

      if (isCancelled) return
      const map = leafletMapRef.current!

      // Clear existing markers layer by layer
      map.eachLayer((layer: any) => {
        if ((layer as any)._url) return // keep tile layer
        map.removeLayer(layer)
      })

      const points = (listings || []).filter((l) => typeof l.lat === "number" && typeof l.lng === "number")

      // Fit bounds to points if any
      if (points.length > 0) {
        const bounds = L.latLngBounds(points.map((p) => [p.lat!, p.lng!]))
        map.fitBounds(bounds.pad(0.2))
      } else {
        map.setView([20.5937, 78.9629], 4)
      }

      // Add markers
      points.forEach((l) => {
        const marker = (L as any).circleMarker([l.lat!, l.lng!], {
          radius: 8,
          color: "#059669",
          fillColor: "#34d399",
          fillOpacity: 0.9,
          weight: 2,
        })
        const popup = `
          <div style="max-width:240px">
            <div style="font-weight:700;margin-bottom:4px">${l.title}</div>
            ${l.location ? `<div style="font-size:12px;color:#334155;margin-bottom:4px">${l.location}</div>` : ""}
            ${l.listerName ? `<div style=\"font-size:12px;color:#0f766e\">By: ${l.listerName}</div>` : ""}
            ${l.foodType || l.quantity ? `<div style=\"font-size:12px;color:#475569\">${[l.foodType, l.quantity].filter(Boolean).join(" · ")}</div>` : ""}
            ${l.availableUntil ? `<div style=\"font-size:12px;color:#64748b\">Until: ${new Date(l.availableUntil).toLocaleString()}</div>` : ""}
          </div>
        `
        marker.bindPopup(popup)
        marker.addTo(map)
      })
    })()

    return () => {
      isCancelled = true
    }
  }, [listings])

  return <div ref={mapRef} className="w-full h-80 rounded-lg overflow-hidden border border-emerald-200" />
}
