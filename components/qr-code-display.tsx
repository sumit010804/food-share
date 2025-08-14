"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { QrCode, Download, Copy, Check } from "lucide-react"
import { generateQRCodeData } from "@/lib/qr-generator"

interface QRCodeDisplayProps {
  listing: any
  size?: number
}

export function QRCodeDisplay({ listing, size = 200 }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false)
  const qrData = generateQRCodeData(listing)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrData)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const handleDownload = () => {
    const svg = document.getElementById(`qr-${listing.id}`)
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        canvas.width = size
        canvas.height = size
        ctx?.drawImage(img, 0, 0)

        const link = document.createElement("a")
        link.download = `qr-code-${listing.title.replace(/\s+/g, "-").toLowerCase()}.png`
        link.href = canvas.toDataURL()
        link.click()
      }

      img.src = "data:image/svg+xml;base64," + btoa(svgData)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-transparent">
          <QrCode className="h-4 w-4 mr-2" />
          QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="p-4 bg-white">
            <CardContent className="flex justify-center p-0">
              <QRCodeSVG
                id={`qr-${listing.id}`}
                value={qrData}
                size={size}
                level="M"
                includeMargin={true}
                className="animate-fade-in"
              />
            </CardContent>
          </Card>

          <div className="text-center space-y-2">
            <p className="text-sm text-slate-600">Share this QR code for easy collection tracking</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleCopy} variant="outline" size="sm">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Data"}
              </Button>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded">
            <strong>Instructions:</strong> Recipients can scan this QR code to view item details and mark as collected
            when they pick up the food.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
