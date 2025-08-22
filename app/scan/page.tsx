"use client"

import TicketScanner from '@/components/ticket-scanner'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ScanPage() {
  const [listingId, setListingId] = useState<string | undefined>(undefined)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href)
      const q = u.searchParams.get('listingId') || undefined
      setListingId(q || undefined)
      try {
        const raw = localStorage.getItem('user')
        if (raw) setUser(JSON.parse(raw))
      } catch {}
    }
  }, [])
  const canScan = !!(user && (user.userType === 'canteen' || user.userType === 'hostel' || user.userType === 'admin'))
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Scan Pickup QR</h1>
      {canScan ? (
        <TicketScanner expectedListingId={listingId} />
      ) : (
        <div className="p-4 border rounded bg-white text-slate-700">
          You don’t have permission to scan QR codes. Please ask the canteen or hostel staff to assist.
        </div>
      )}
    </div>
  )
}
