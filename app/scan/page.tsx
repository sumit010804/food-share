"use client"

import TicketScanner from '@/components/ticket-scanner'
import { useEffect, useState } from 'react'

export default function ScanPage() {
  const [listingId, setListingId] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href)
      const q = u.searchParams.get('listingId') || undefined
      setListingId(q || undefined)
    }
  }, [])
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Scan Pickup QR</h1>
      <TicketScanner expectedListingId={listingId} />
    </div>
  )
}
