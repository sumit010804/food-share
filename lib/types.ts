export interface User {
  id: string
  name: string
  email: string
  password: string
  role: "student" | "staff" | "canteen_manager" | "hostel_manager" | "event_organizer" | "ngo_representative"
  organization: string
  createdAt: string
}

export interface FoodListing {
  id: string
  title: string
  description: string
  foodType: "prepared_food" | "fresh_produce" | "packaged_items" | "beverages"
  quantity: string
  location: string
  availableUntil: string
  safeToEatHours: number
  allergens: string[]
  dietaryInfo: string[]
  contactInfo: string
  status: "available" | "reserved" | "collected" | "expired"
  donorId: string
  donorName: string
  createdAt: string
  qrCode: string
  collectedBy?: string | null
  collectedAt?: string | null
}

export interface Notification {
  id: string
  userId: string
  type:
    | "new_listing"
    | "pickup_reminder"
    | "expiry_warning"
    | "reservation_confirmed"
    | "item_collected"
    | "collection_confirmed"
    | "event_added"
  title: string
  message: string
  read: boolean
  createdAt: string
  priority: "low" | "medium" | "high"
  actionUrl?: string
  metadata?: {
    listingId?: string
    eventId?: string
    collectorName?: string
    donorName?: string
    collectionMethod?: string
  }
}

export interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  organizer: string
  organizerId: string
  expectedAttendees: number
  foodLogged: boolean
  createdAt: string
}

export interface AnalyticsData {
  totalFoodSaved: number
  totalPeopleServed: number
  carbonFootprintSaved: number
  waterFootprintSaved: number
  monthlyGoal: number
  monthlyProgress: number
  weeklyData: Array<{ day: string; amount: number }>
  foodTypeDistribution: Array<{ type: string; amount: number }>
  organizationLeaderboard: Array<{ name: string; amount: number }>
}

export interface DonationRecord {
  id: string
  donorId: string
  donorName: string
  recipientId?: string
  recipientName?: string
  foodTitle: string
  foodType: string
  quantity: string
  donatedAt: string
  collectedAt?: string
  status: "donated" | "collected" | "expired"
  impactMetrics: {
    carbonSaved: number
    waterSaved: number
    peopleServed: number
  }
}

export interface CollectionRecord {
  id: string
  collectorId: string
  collectorName: string
  donorId: string
  donorName: string
  foodListingId: string
  foodTitle: string
  collectedAt: string
  collectionMethod: "qr_scan" | "manual" | "direct"
  location: string
  quantity: string
}
