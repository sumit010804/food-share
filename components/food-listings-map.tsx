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

      // Helper: color by status
      const getPinColor = (status?: string) => {
        switch ((status || '').toLowerCase()) {
          case 'available':
            return '#10b981' // emerald-500
          case 'reserved':
            return '#f59e0b' // amber-500
          case 'collected':
            return '#64748b' // slate-500
          case 'expired':
            return '#ef4444' // red-500
          default:
            return '#3b82f6' // blue-500
        }
      }

      // Add markers with custom SVG pin icons
      points.forEach((l) => {
        const color = getPinColor(l.status)
        const pinSvg = `
          <svg width="28" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.314-2.686-6-6-6z" fill="${color}" stroke="#0f172a" stroke-opacity="0.25" stroke-width="1"/>
            <circle cx="12" cy="8.5" r="2.5" fill="white" fill-opacity="0.9"/>
          </svg>
        `
        const icon = (L as any).divIcon({
          className: 'fs-pin',
          html: pinSvg,
          iconSize: [28, 40],
          iconAnchor: [14, 36], // bottom center
          popupAnchor: [0, -28],
        })

        const marker = (L as any).marker([l.lat!, l.lng!], { icon })
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
