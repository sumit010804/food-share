"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode } from 'lucide-react'

interface Props {
  collectionId: string
  listingId?: string
  size?: number
}

export default function TicketQRButton({ collectionId, listingId, size = 240 }: Props) {
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchTicket = async () => {
    setLoading(true)
    try {
      let res = await fetch(`/api/tickets?collectionId=${encodeURIComponent(collectionId)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.tickets && data.tickets.length) {
          setTicket(data.tickets[0])
          return
        }
      }
      // Fallback: try listingId if provided and different
      if (listingId && listingId !== collectionId) {
        const res2 = await fetch(`/api/tickets?collectionId=${encodeURIComponent(listingId)}`)
        if (res2.ok) {
          const data2 = await res2.json()
          if (data2.tickets && data2.tickets.length) {
            setTicket(data2.tickets[0])
            return
          }
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
      // Try with collectionId first; API will also fallback to listingId internally
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: collectionId || listingId || '' }),
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

  const copyToken = async () => {
    if (!ticket?.token) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(ticket.token)
      } else {
        const ta = document.createElement('textarea')
        ta.value = ticket.token
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('Failed to copy token', e)
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
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded shadow">
                <QRCodeSVG value={ticket.token} size={size} level="M" includeMargin={true} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={copyToken}>
                  {copied ? 'Copied' : 'Copy token'}
                </Button>
              </div>
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
