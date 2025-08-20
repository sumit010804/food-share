"use client"

import TicketScanner from '@/components/ticket-scanner'

export default function ScanPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Scan Pickup QR</h1>
      <TicketScanner />
    </div>
  )
}
