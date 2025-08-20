"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode } from 'lucide-react'

interface Props {
  collectionId: string
  size?: number
}

export default function TicketQRButton({ collectionId, size = 240 }: Props) {
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchTicket = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets?collectionId=${encodeURIComponent(collectionId)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.tickets && data.tickets.length) {
          setTicket(data.tickets[0])
        }
      }
    } catch (e) {
      console.error('Failed to fetch ticket', e)
    } finally {
      setLoading(false)
    }
  }

  const createTicket = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ticket) setTicket(data.ticket)
      } else {
        console.warn('Failed to create ticket', await res.text())
      }
    } catch (e) {
      console.error('Create ticket error', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 bg-transparent" onClick={fetchTicket}>
          <QrCode className="h-4 w-4 mr-2" />
          Show QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pickup QR</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 p-4">
          {loading && <div className="text-sm text-slate-500">Loading ticket…</div>}
          {!loading && !ticket && (
            <div className="text-sm text-slate-500">
              <div>No ticket available</div>
              <div className="mt-2">
                <Button onClick={createTicket} size="sm">Create QR</Button>
              </div>
            </div>
          )}
          {!loading && ticket && (
            <div className="bg-white p-4 rounded shadow">
              <QRCodeSVG value={ticket.token} size={size} level="M" includeMargin={true} />
            </div>
          )}
          {!loading && ticket && (
            <div className="text-xs text-slate-500">Expires at: {new Date(ticket.expiresAt).toLocaleString()}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
