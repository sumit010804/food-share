"use client"

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, X, QrCode, CheckCircle } from 'lucide-react'

export default function TicketScanner({ scannerId, expectedListingId: expectedFromProps }: { scannerId?: string, expectedListingId?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [expectedListingId, setExpectedListingId] = useState<string | undefined>(expectedFromProps)

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const startCamera = async () => {
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      setIsScanning(true)
      scanLoop(s)
    } catch (e: any) {
      console.error('Camera error', e)
      setError('Unable to access camera. Check permissions.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
    setIsScanning(false)
  }

  const scanLoop = async (s: MediaStream) => {
    if (!videoRef.current) return
    const video = videoRef.current

    // Use BarcodeDetector if available (no extra dependency)
    const hasDetector = (window as any).BarcodeDetector
    if (hasDetector) {
      const BarcodeDetector = (window as any).BarcodeDetector
      let detector: any
      try {
        detector = new BarcodeDetector({ formats: ['qr_code'] })
      } catch (e) {
        detector = null
      }

      const loop = async () => {
        if (!isScanning) return
        try {
          const barcodes = detector ? await detector.detect(video) : []
          if (barcodes && barcodes.length) {
            const v = barcodes[0].rawValue || barcodes[0].rawData || null
            if (v) {
              // stop camera while processing
              stopCamera()
              await handleToken(v)
              return
            }
          }
        } catch (e) {
          // ignore per-frame decode errors
        }
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
      return
    }

    // Fallback: keep camera open but ask user to paste token manually
  }

  const handleToken = async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      const deviceId = scannerId || localStorage.getItem('deviceId') || `dev-${Math.random().toString(36).slice(2,8)}`
      // store generated deviceId for future
      if (!localStorage.getItem('deviceId')) localStorage.setItem('deviceId', deviceId)

      const res = await fetch('/api/tickets/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, scannerId: deviceId, expectedListingId: expectedListingId || undefined }),
      })
      const js = await res.json()
      if (res.ok) {
  // show verified & include any returned collection/donation data
  setResult(js)
      } else {
        setError(js.message || 'Scan failed')
      }
    } catch (e) {
      console.error('Scan error', e)
      setError('Scan failed due to network or server error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-600 mt-1" />
            <div>
              <div className="font-semibold">Verified — Ticket valid</div>
              <div className="text-sm text-slate-600">Collection: {result.collectionId}</div>
              <div className="text-sm text-slate-600">Used at: {result.usedAt || new Date().toISOString()}</div>
              {result.collection && (
                <div className="mt-2 text-sm text-slate-600 bg-white p-2 rounded">
                  <div><strong>Listing:</strong> {result.collection.listingTitle || result.collection.listingId}</div>
                  <div><strong>Recipient:</strong> {result.collection.recipientName || result.collection.recipientEmail || result.collection.recipientId}</div>
                  <div><strong>Status:</strong> {result.collection.status}</div>
                </div>
              )}
              {result.donation && (
                <div className="mt-2 text-sm text-slate-600 bg-white p-2 rounded">
                  <div><strong>Donation recorded</strong></div>
                  <div>Weight: {result.donation.weight ? `${result.donation.weight} kg` : (result.donation.quantity || 'N/A')}</div>
                </div>
              )}
            </div>
          </div>
        </Alert>
      )}

      {!result && (
        <Card className="p-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              Scan Ticket QR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="w-full rounded overflow-hidden relative">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-64 bg-black object-cover" />
                <div className="absolute inset-0 border-2 border-emerald-400 rounded" />
              </div>

              <div className="flex gap-2">
                {!isScanning ? (
                  <Button onClick={startCamera} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <Camera className="h-4 w-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-2" />
                    Stop Camera
                  </Button>
                )}
              </div>

              <div className="text-sm text-slate-600">If automatic camera scan fails, paste the QR token below and press Validate.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Expected Listing ID (optional, to enforce match)</label>
                  <input
                    type="text"
                    placeholder="listing id"
                    value={expectedListingId || ''}
                    onChange={(e) => setExpectedListingId(e.target.value || undefined)}
                    className="w-full p-2 border rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">QR token</label>
                  <textarea placeholder="Paste QR token here" id="ticket-token-input" className="w-full p-2 border rounded text-xs" rows={3} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={async () => {
                  const v = (document.getElementById('ticket-token-input') as HTMLTextAreaElement).value.trim()
                  if (!v) return setError('Please paste token')
                  await handleToken(v)
                }} className="flex-1">
                  Validate
                </Button>
                <Button onClick={() => {
                  (document.getElementById('ticket-token-input') as HTMLTextAreaElement).value = ''
                }} variant="outline">Clear</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <div className="text-sm text-slate-500">Validating…</div>}
    </div>
  )
}
