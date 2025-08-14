export interface QRCodeData {
  id: string
  title: string
  description: string
  foodType: string
  quantity: string
  location: string
  availableUntil: string
  safetyHours: number
  createdBy: string
  organization: string
  tags: string[]
  specialInstructions: string
  createdAt: string
}

export function generateQRCodeData(listing: any): string {
  const qrData: QRCodeData = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    foodType: listing.foodType,
    quantity: listing.quantity,
    location: listing.location,
    availableUntil: listing.availableUntil,
    safetyHours: listing.safetyHours,
    createdBy: listing.createdBy,
    organization: listing.organization,
    tags: listing.tags,
    specialInstructions: listing.specialInstructions,
    createdAt: listing.createdAt,
  }

  return JSON.stringify(qrData)
}

export function parseQRCodeData(qrString: string): QRCodeData | null {
  try {
    const data = JSON.parse(qrString)
    // Validate that it has the required fields
    if (data.id && data.title && data.organization) {
      return data as QRCodeData
    }
    return null
  } catch (error) {
    return null
  }
}
