"use client"

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, X, QrCode, CheckCircle } from 'lucide-react'
// Fallback decoder for browsers without BarcodeDetector. We dynamically import
// jsQR at runtime to avoid SSR/import timing issues across browsers/builds.

export default function TicketScanner({ scannerId, expectedListingId: expectedFromProps }: { scannerId?: string, expectedListingId?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [expectedListingId, setExpectedListingId] = useState<string | undefined>(expectedFromProps)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [videoReady, setVideoReady] = useState(false)
  const stopFlagRef = useRef(false)
  const decodingRef = useRef(false)
  const jsQRRef = useRef<any>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const zxingRef = useRef<{ reader: any, controls: any } | null>(null)
  const [cameras, setCameras] = useState<Array<{ deviceId: string, label: string }>>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined)
  const [zoomOn, setZoomOn] = useState(false)
  // For E2E: allow injecting a QR image data URL for decoding without camera
  const startTestImageLoop = (dataUrl: string) => {
    if (!jsQRRef.current) return false
    const canvas = canvasRef.current
    if (!canvas) return false
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
    const img = new Image()
    img.onload = () => {
      const step = () => {
        if (stopFlagRef.current || decodingRef.current) return
        try {
          canvas.width = img.width
          canvas.height = img.height
          ctx?.drawImage(img, 0, 0)
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
          if (imageData) {
            const code = jsQRRef.current(imageData.data, imageData.width, imageData.height)
            if (code && code.data) {
              decodingRef.current = true
              try {
                const el = document.getElementById('ticket-token-input') as HTMLTextAreaElement | null
                if (el) el.value = String(code.data)
              } catch {}
              handleToken(String(code.data))
              return
            }
          }
        } catch {}
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    img.src = dataUrl
    return true
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const startCamera = async () => {
    setError(null)
    try {
      // Try ZXing first to avoid running multiple engines simultaneously
      try {
        const mod: any = await import('@zxing/browser')
        const Reader = mod?.BrowserQRCodeReader || mod?.BrowserMultiFormatReader
        if (Reader && videoRef.current) {
          const reader = new Reader()
          // Pick a back/environment camera if available
          let deviceId: string | undefined = selectedDeviceId
          try {
            const list = await (mod.BrowserQRCodeReader?.listVideoInputDevices?.() || mod.BrowserMultiFormatReader?.listVideoInputDevices?.())
            if (Array.isArray(list) && list.length) {
              const mapped = list.map((d: any) => ({ deviceId: d.deviceId, label: d.label || 'Camera' }))
              setCameras(mapped)
              if (!deviceId) {
                const back = list.find((d: any) => /back|environment/i.test(d.label))
                deviceId = (back || list[list.length - 1]).deviceId
              }
            }
          } catch {}
          const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current as HTMLVideoElement, (result: any) => {
            if (!result || decodingRef.current || stopFlagRef.current || !isScanning) return
            try {
              const text = typeof result.getText === 'function' ? result.getText() : (result.text || String(result))
              decodingRef.current = true
              stopCamera()
              handleToken(String(text))
            } catch {}
          })
          zxingRef.current = { reader, controls }
          // wait for metadata then mark video ready
          const v = videoRef.current
          if (v) {
            try { v.setAttribute('playsinline', 'true') } catch {}
            try { v.muted = true } catch {}
            await new Promise<void>((resolve) => {
              const onLoaded = () => resolve()
              if (v.readyState >= 1) onLoaded(); else v.addEventListener('loadedmetadata', onLoaded, { once: true })
            })
            setVideoReady(true)
            // detect torch availability from the active stream
            try {
              const s = (v as any).srcObject as MediaStream | null
              if (s) {
                setStream(s)
                const track = s.getVideoTracks()[0]
                const caps: any = (track && typeof track.getCapabilities === 'function') ? track.getCapabilities() : null
                setTorchAvailable(!!(caps && caps.torch))
                // Attempt a mild zoom to improve focus if supported
                try {
                  if (caps && typeof (track as any).applyConstraints === 'function' && 'zoom' in caps) {
                    await (track as any).applyConstraints({ advanced: [{ zoom: 2 }] })
                    setZoomOn(true)
                  }
                } catch {}
              }
            } catch {}
          }
          stopFlagRef.current = false
          decodingRef.current = false
          setIsScanning(true)
          // Watchdog: if ZXing hasn't decoded within 7s, kick off alternate decoders
          setTimeout(() => {
            if (!decodingRef.current && !stopFlagRef.current) {
              scanLoop()
            }
          }, 7000)
          // E2E: allow decoding a provided image
          try {
            const testImg = (window as any).__TEST_QR_IMAGE as string | undefined
            if (testImg) startTestImageLoop(testImg)
          } catch {}
          return
        }
      } catch (e) {
        console.warn('ZXing initialization failed, falling back to getUserMedia + BarcodeDetector/jsQR', e)
      }

      // Fallback: manual getUserMedia + BarcodeDetector/jsQR
      // Ensure jsQR is available for the final fallback path
      if (!jsQRRef.current) {
        try {
          const mod: any = await import('jsqr')
          jsQRRef.current = mod?.default || mod
        } catch (e) {
          console.warn('Failed to load jsQR, relying on BarcodeDetector only', e)
        }
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      setStream(s)
      try {
        const track = s.getVideoTracks()[0]
        const caps: any = (track && typeof track.getCapabilities === 'function') ? track.getCapabilities() : null
        setTorchAvailable(!!(caps && caps.torch))
      } catch {}
      const v = videoRef.current
      if (v) {
        v.srcObject = s
        try { v.setAttribute('playsinline', 'true') } catch {}
        try { v.muted = true } catch {}
        await new Promise<void>((resolve) => {
          const onLoaded = () => { v.play().catch(() => {}).finally(() => resolve()) }
          if (v.readyState >= 1) onLoaded(); else v.addEventListener('loadedmetadata', onLoaded, { once: true })
        })
        setVideoReady(true)
      }
      stopFlagRef.current = false
      decodingRef.current = false
      setIsScanning(true)
      // kick off BD/jsQR decode loops only for fallback
      scanLoop()
      // E2E: test image loop
      try {
        const testImg = (window as any).__TEST_QR_IMAGE as string | undefined
        if (testImg) startTestImageLoop(testImg)
      } catch {}
    } catch (e: any) {
      console.error('Camera error', e)
      setError('Unable to access camera. Check permissions.')
      // E2E/test fallback: if a test QR image is provided, start decoding without camera
      try {
        const testImg = (window as any).__TEST_QR_IMAGE as string | undefined
        if (testImg) {
          stopFlagRef.current = false
          decodingRef.current = false
          setIsScanning(true)
          startTestImageLoop(testImg)
        }
      } catch {}
    }
  }

  const stopCamera = () => {
    const v = videoRef.current
    if (v) {
      try { v.pause() } catch {}
      try { (v as any).srcObject = null } catch {}
    }
    if (stream) {
      try {
        if (torchOn) {
          const track = stream.getVideoTracks()[0]
          if (track) {
            // turn off torch if it was on
            try { (track as any).applyConstraints({ advanced: [{ torch: false }] }) } catch {}
          }
          setTorchOn(false)
        }
      } catch {}
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
    try {
      if (zxingRef.current?.controls?.stop) zxingRef.current.controls.stop()
      zxingRef.current = null
    } catch {}
    stopFlagRef.current = true
    decodingRef.current = false
    setIsScanning(false)
    setVideoReady(false)
  }

  const scanLoop = async () => {
    if (!videoRef.current) return
    const video = videoRef.current
    if (stopFlagRef.current || !isScanning) return

    // Start BarcodeDetector loop if supported
    const BarcodeDetectorCtor = (window as any).BarcodeDetector
    if (BarcodeDetectorCtor) {
      let detector: any = null
      try {
        if (typeof BarcodeDetectorCtor.getSupportedFormats === 'function') {
          const formats: string[] = await BarcodeDetectorCtor.getSupportedFormats()
          if (!Array.isArray(formats) || !formats.includes('qr_code')) throw new Error('qr_code not supported')
        }
        detector = new BarcodeDetectorCtor({ formats: ['qr_code'] })
      } catch {
        detector = null
      }

      if (detector) {
        const detectLoop = async () => {
          if (stopFlagRef.current || !isScanning || decodingRef.current) return
          try {
            const barcodes = await detector.detect(video)
            if (barcodes && barcodes.length) {
              const v = (barcodes[0] as any).rawValue || (barcodes[0] as any).rawData || null
              if (v) {
                decodingRef.current = true
                try {
                  const el = document.getElementById('ticket-token-input') as HTMLTextAreaElement | null
                  if (el) el.value = String(v)
                } catch {}
                stopCamera()
                await handleToken(String(v))
                return
              }
            }
          } catch {}
          requestAnimationFrame(detectLoop)
        }
        requestAnimationFrame(detectLoop)
      }
    }

    // Start jsQR loop if available
    const canvas = canvasRef.current
    if (canvas && jsQRRef.current) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
      const step = () => {
        if (stopFlagRef.current || !isScanning || decodingRef.current || !video.videoWidth || !video.videoHeight) {
          requestAnimationFrame(step)
          return
        }
        try {
          // Downscale to improve performance and decoding reliability
          const targetW = Math.min(640, video.videoWidth || 640)
          const scale = targetW / (video.videoWidth || targetW)
          const targetH = Math.floor((video.videoHeight || 480) * scale)
          canvas.width = targetW
          canvas.height = targetH
          ctx?.drawImage(video, 0, 0, targetW, targetH)
          const img = ctx?.getImageData(0, 0, canvas.width, canvas.height)
          if (img) {
            const code = jsQRRef.current(img.data, img.width, img.height)
            if (code && code.data) {
              decodingRef.current = true
              try {
                const el = document.getElementById('ticket-token-input') as HTMLTextAreaElement | null
                if (el) el.value = String(code.data)
              } catch {}
              stopCamera()
              handleToken(String(code.data))
              return
            }
          }
        } catch {}
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
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
              {cameras.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Camera</label>
                    <select
                      className="w-full p-2 border rounded text-xs"
                      value={selectedDeviceId || ''}
                      onChange={(e) => setSelectedDeviceId(e.target.value || undefined)}
                    >
                      <option value="">Auto (prefer back)</option>
                      {cameras.map((c) => (
                        <option key={c.deviceId} value={c.deviceId}>{c.label || 'Camera'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="w-full rounded overflow-hidden relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-64 bg-black object-cover"
                  style={{ opacity: videoReady ? 1 : 0.5 }}
                />
                {/* hidden canvas for jsQR fallback */}
                <canvas ref={canvasRef} className="hidden" />
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
                {isScanning && torchAvailable && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (!stream) return
                        const track = stream.getVideoTracks()[0]
                        if (!track) return
                        await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] })
                        setTorchOn(!torchOn)
                      } catch (e) {
                        console.warn('Torch toggle failed', e)
                        setTorchAvailable(false)
                      }
                    }}
                  >
                    {torchOn ? 'Torch off' : 'Torch on'}
                  </Button>
                )}
                {isScanning && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!decodingRef.current) scanLoop()
                    }}
                  >
                    Alternate decoder
                  </Button>
                )}
                {isScanning && stream && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const track = stream.getVideoTracks()[0]
                        const caps: any = track?.getCapabilities?.()
                        if (!caps || !('zoom' in caps)) return
                        const next = !zoomOn
                        await (track as any).applyConstraints({ advanced: [{ zoom: next ? 2 : 1 }] })
                        setZoomOn(next)
                      } catch {}
                    }}
                  >
                    {zoomOn ? 'Zoom 1x' : 'Zoom 2x'}
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
