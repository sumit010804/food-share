"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { QrCode, Camera, X, Package, MapPin, Clock, User, Building, CheckCircle } from "lucide-react"
import { parseQRCodeData, type QRCodeData } from "@/lib/qr-generator"
import jsQR from "jsqr"

interface QRScannerProps {
  onScan?: (data: QRCodeData) => void
}

export function QRScanner({ onScan }: QRScannerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scannedData, setScannedData] = useState<QRCodeData | null>(null)
  const [error, setError] = useState("")
  const [isCollecting, setIsCollecting] = useState(false)
  const [collected, setCollected] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const lastDecodedAtRef = useRef<number>(0)

  const startCamera = async () => {
    try {
      setError("")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera if available
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
  setIsScanning(true)
  scanningRef.current = true
  // Start scanning for QR codes
  scanForQRCode()
      }
    } catch (err) {
      setError("Unable to access camera. Please check permissions.")
      console.error("Camera error:", err)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
    scanningRef.current = false
  }

  const handleDecodedText = async (text: string) => {
    // Debounce repeated detections
    const now = Date.now()
    if (now - lastDecodedAtRef.current < 1200) return
    lastDecodedAtRef.current = now

    // Heuristic: if it looks like our ticket token (base64.sig), validate via API
    if (text.includes(".") && !text.includes("\n")) {
      await handleTokenScan(text)
      return
    }
    // Otherwise try legacy JSON payload
    const data = parseQRCodeData(text)
    if (data) {
      setScannedData(data)
      setError("")
      stopCamera()
      onScan?.(data)
      return
    }
    // Not recognized
    setError("QR not recognized. Try again.")
  }

  const scanForQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning || !scanningRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      if (scanningRef.current) setTimeout(scanForQRCode, 120)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code && code.data) {
        handleDecodedText(code.data)
      }
    } catch (e) {
      // ignore decode errors; continue scanning
    }

    if (scanningRef.current) {
      requestAnimationFrame(scanForQRCode)
    }
  }

  const handleManualInput = (input: string) => {
    const data = parseQRCodeData(input)
    if (data) {
      setScannedData(data)
      setError("")
      stopCamera()
      onScan?.(data)
    } else {
      setError("Invalid QR code data")
    }
  }

  const handleCollect = async () => {
    if (!scannedData) return

    setIsCollecting(true)
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")

      const response = await fetch("/api/food-listings/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId: scannedData.id,
          collectedBy: user.name,
          collectedAt: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        setCollected(true)
        // Close dialog after 2 seconds
        setTimeout(() => {
          setIsOpen(false)
          setScannedData(null)
          setCollected(false)
        }, 2000)
      } else {
        setError("Failed to mark as collected")
      }
    } catch (error) {
      setError("An error occurred while collecting")
    } finally {
      setIsCollecting(false)
    }
  }

  const handleTokenScan = async (token: string) => {
    setIsCollecting(true)
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      const body: any = { token, scannerId: user.id || user.name || null }
      const res = await fetch("/api/tickets/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setCollected(true)
        stopCamera()
        // Auto-close after 2 seconds
        setTimeout(() => {
          setIsOpen(false)
          setCollected(false)
          setScannedData(null)
        }, 2000)
      } else {
        const t = await res.json().catch(() => null)
        setError(t?.message || "Invalid or used/expired ticket")
      }
    } catch (e) {
      setError("Scan failed. Please try again.")
    } finally {
      setIsCollecting(false)
    }
  }

  const handleClose = () => {
    stopCamera()
    setIsOpen(false)
    setScannedData(null)
    setError("")
    setCollected(false)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const getFoodTypeColor = (foodType: string) => {
    switch (foodType) {
      case "meals":
        return "bg-orange-100 text-orange-800"
      case "snacks":
        return "bg-blue-100 text-blue-800"
      case "beverages":
        return "bg-purple-100 text-purple-800"
      case "fruits":
        return "bg-green-100 text-green-800"
      case "vegetables":
        return "bg-emerald-100 text-emerald-800"
      case "bakery":
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
  <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" />
            QR Code Scanner
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {collected && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">Item successfully marked as collected!</AlertDescription>
          </Alert>
        )}

        {!scannedData ? (
          <div className="space-y-4">
            {!isScanning ? (
              <div className="text-center space-y-4">
                <div className="w-32 h-32 mx-auto bg-slate-100 rounded-lg flex items-center justify-center">
                  <Camera className="h-12 w-12 text-slate-400" />
                </div>
                <Button onClick={startCamera} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <Camera className="h-4 w-4 mr-2" />
                  Start Camera
                </Button>

                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-2">Or paste QR code data:</p>
                  <textarea
                    className="w-full p-2 border rounded text-xs"
                    rows={3}
                    placeholder="Paste QR code data here..."
                    onChange={(e) => {
                      if (e.target.value.trim()) {
                        handleManualInput(e.target.value.trim())
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-64 bg-black rounded-lg object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Scanning overlay */}
                  <div className="absolute inset-0 border-2 border-emerald-400 rounded-lg">
                    <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-emerald-400"></div>
                    <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-emerald-400"></div>
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-emerald-400"></div>
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-emerald-400"></div>
                  </div>
                </div>

                <p className="text-center text-sm text-slate-600">Point camera at QR code to scan</p>

                <Button onClick={stopCamera} variant="outline" className="w-full bg-transparent">
                  <X className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-emerald-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-slate-800">{scannedData.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge className={getFoodTypeColor(scannedData.foodType)}>{scannedData.foodType}</Badge>
                      <span className="text-sm text-slate-500">{scannedData.quantity}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">{scannedData.description}</p>

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">{scannedData.location}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">{scannedData.organization}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">Listed by {scannedData.createdBy}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">
                      Available until {new Date(scannedData.availableUntil).toLocaleString()}
                    </span>
                  </div>
                </div>

                {scannedData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {scannedData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {scannedData.specialInstructions && (
                  <div className="bg-amber-50 p-3 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Instructions:</strong> {scannedData.specialInstructions}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                onClick={handleCollect}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={isCollecting}
              >
                <Package className="h-4 w-4 mr-2" />
                {isCollecting ? "Collecting..." : "Mark as Collected"}
              </Button>
              <Button onClick={handleClose} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
