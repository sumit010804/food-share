"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

type Msg = {
  id: string
  listingId: string
  userId: string
  userName?: string
  text: string
  createdAt: string
}

export default function ListingChat({ listingId }: { listingId: string }) {
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  }) as any
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const socketUrl = useMemo(() => {
    // Prefer env override; fallback to same host on another port
    const base = process.env.NEXT_PUBLIC_SOCKET_URL || ''
    if (base) return base
    if (typeof window !== 'undefined') {
      const loc = window.location
      return `${loc.protocol}//${loc.hostname}:${process.env.NEXT_PUBLIC_SOCKET_PORT || 4000}`
    }
    return ""
  }, [])

  useEffect(() => {
  const fetchHistory = async () => {
      try {
    const me = user?.id ? `&userId=${encodeURIComponent(user.id)}` : ''
    const meEmail = user?.email ? `&userEmail=${encodeURIComponent(user.email)}` : ''
    const res = await fetch(`/api/chat/messages?listingId=${encodeURIComponent(listingId)}${me}${meEmail}`)
        const js = await res.json()
        setMessages(js.messages || [])
      } catch {}
    }
    fetchHistory()
  }, [listingId])

  useEffect(() => {
    if (!socketUrl) return
    const s = io(socketUrl, { transports: ['websocket'], autoConnect: true })
    socketRef.current = s
    s.on('connect', () => {
      setConnected(true)
      s.emit('chat:join', { listingId, user: { id: user?.id, name: user?.name, email: user?.email } })
    })
    s.on('disconnect', () => setConnected(false))
    s.on('chat:error', (_msg: string) => {
      // If server rejects socket chat (e.g., due to auth), drop to REST fallback
      setConnected(false)
    })
    s.on('chat:history', (history: Msg[]) => setMessages(history || []))
    s.on('chat:message', (msg: Msg) => setMessages((prev) => [...prev, msg]))
    return () => {
      try { s.emit('chat:leave', { listingId }) } catch {}
      s.disconnect()
    }
  }, [socketUrl, listingId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const value = text.trim()
    if (!value) return
    setText("")
  const payload = { listingId, userId: user?.id || 'anon', userName: user?.name || 'User', userEmail: user?.email, text: value }
    if (socketRef.current && connected) {
      socketRef.current.emit('chat:message', payload)
    } else {
      // fallback: POST to API
      try { await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }) } catch {}
      // optimistic append; the next GET will reconcile
      setMessages((prev) => [...prev, { ...payload, id: Date.now().toString(), createdAt: new Date().toISOString() }])
    }
    // hint the bell to refresh sooner
    try { window.dispatchEvent(new Event('notifications:refresh')) } catch {}
  }

  return (
    <Card className="p-3 border-emerald-100">
      <div className="text-sm text-slate-700 mb-2 font-medium">Chat</div>
      <div className="h-48 overflow-y-auto space-y-2 bg-emerald-50/40 p-2 rounded border border-emerald-100">
        {messages.map((m) => {
          const mine = String(m.userId) === String(user?.id)
          return (
            <div key={m.id} className={`max-w-[80%] ${mine ? 'ml-auto text-right' : ''}`}>
              <div className={`inline-block px-3 py-2 rounded-lg text-sm ${mine ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-100 text-slate-700'}`}>
                {!mine && <div className="text-[10px] text-emerald-600 mb-0.5">{m.userName || 'User'}</div>}
                <div>{m.text}</div>
                <div className={`text-[10px] mt-1 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={connected ? 'Type a message…' : 'Type a message (offline)…'} onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
        <Button type="button" onClick={send} className="gradient-primary text-white">Send</Button>
      </div>
      <div className="text-[11px] text-slate-500 mt-1">Status: {connected ? 'Live' : 'Fallback'}</div>
    </Card>
  )
}
