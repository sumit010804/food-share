import type { User, FoodListing, Notification, Event, AnalyticsData, DonationRecord, CollectionRecord } from "./types"

export class LocalStorageManager {
  private static instance: LocalStorageManager
  private isBrowser: boolean
  private memoryStore: Map<string, string>

  private constructor() {
  // Detect if running in a browser environment with localStorage
  this.isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  this.memoryStore = new Map()
  this.initializeData()
  }

  public static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager()
    }
    return LocalStorageManager.instance
  }

  private initializeData() {
    // Initialize default data if not exists
    if (!this.getItem("users")) {
      this.setItem("users", this.getDefaultUsers())
    }
    if (!this.getItem("foodListings")) {
      this.setItem("foodListings", this.getDefaultFoodListings())
    }
    if (!this.getItem("notifications")) {
      this.setItem("notifications", [])
    }
    if (!this.getItem("events")) {
      this.setItem("events", this.getDefaultEvents())
    }
    if (!this.getItem("analytics")) {
      this.setItem("analytics", this.getDefaultAnalytics())
    }
    if (!this.getItem("donations")) {
      this.setItem("donations", [])
    }
    if (!this.getItem("collections")) {
      this.setItem("collections", [])
    }
  }

  private getItem<T>(key: string): T | null {
    try {
      if (this.isBrowser) {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : null
      } else {
        const item = this.memoryStore.get(key)
        return item ? JSON.parse(item) : null
      }
    } catch (error) {
      console.error(`Error getting ${key} from localStorage:`, error)
      return null
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value)
      if (this.isBrowser) {
        window.localStorage.setItem(key, serialized)
      } else {
        this.memoryStore.set(key, serialized)
      }
    } catch (error) {
      console.error(`Error setting ${key} in localStorage:`, error)
    }
  }

  // User operations
  getUsers(): User[] {
    return this.getItem<User[]>("users") || []
  }

  addUser(user: User): void {
    const users = this.getUsers()
    users.push(user)
    this.setItem("users", users)
  }

  updateUser(userId: string, updates: Partial<User>): void {
    const users = this.getUsers()
    const index = users.findIndex((u) => u.id === userId)
    if (index !== -1) {
      users[index] = { ...users[index], ...updates }
      this.setItem("users", users)
    }
  }

  getUserByEmail(email: string): User | null {
    const users = this.getUsers()
    return users.find((u) => u.email === email) || null
  }

  getUserById(id: string): User | null {
    const users = this.getUsers()
    return users.find((u) => u.id === id) || null
  }

  // Food Listings operations
  getFoodListings(): FoodListing[] {
    return this.getItem<FoodListing[]>("foodListings") || []
  }

  addFoodListing(listing: FoodListing): void {
    const listings = this.getFoodListings()
    listings.push(listing)
    this.setItem("foodListings", listings)
  }

  updateFoodListing(id: string, updates: Partial<FoodListing>): void {
    const listings = this.getFoodListings()
    const index = listings.findIndex((l) => l.id === id)
    if (index !== -1) {
      listings[index] = { ...listings[index], ...updates }
      this.setItem("foodListings", listings)
    }
  }

  deleteFoodListing(id: string): void {
    const listings = this.getFoodListings()
    const filtered = listings.filter((l) => l.id !== id)
    this.setItem("foodListings", filtered)
  }

  getFoodListingById(id: string): FoodListing | null {
    const listings = this.getFoodListings()
    return listings.find((l) => l.id === id) || null
  }

  // Notifications operations
  getNotifications(): Notification[] {
    return this.getItem<Notification[]>("notifications") || []
  }

  addNotification(notification: Notification): void {
    const notifications = this.getNotifications()
    notifications.unshift(notification) // Add to beginning for latest first
    this.setItem("notifications", notifications)
  }

  updateNotification(id: string, updates: Partial<Notification>): void {
    const notifications = this.getNotifications()
    const index = notifications.findIndex((n) => n.id === id)
    if (index !== -1) {
      notifications[index] = { ...notifications[index], ...updates }
      this.setItem("notifications", notifications)
    }
  }

  markAllNotificationsAsRead(userId: string): void {
    const notifications = this.getNotifications()
    const updated = notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n))
    this.setItem("notifications", updated)
  }

  getUserNotifications(userId: string): Notification[] {
    const notifications = this.getNotifications()
    return notifications.filter((n) => n.userId === userId)
  }

  // Events operations
  getEvents(): Event[] {
    return this.getItem<Event[]>("events") || []
  }

  addEvent(event: Event): void {
    const events = this.getEvents()
    events.push(event)
    this.setItem("events", events)
  }

  updateEvent(id: string, updates: Partial<Event>): void {
    const events = this.getEvents()
    const index = events.findIndex((e) => e.id === id)
    if (index !== -1) {
      events[index] = { ...events[index], ...updates }
      this.setItem("events", events)
    }
  }

  // Analytics operations
  getAnalytics(): AnalyticsData {
    return this.getItem<AnalyticsData>("analytics") || this.getDefaultAnalytics()
  }

  updateAnalytics(updates: Partial<AnalyticsData>): void {
    const analytics = this.getAnalytics()
    const updated = { ...analytics, ...updates }
    this.setItem("analytics", updated)
  }

  // Donation operations
  getDonations(): DonationRecord[] {
    return this.getItem<DonationRecord[]>("donations") || []
  }

  addDonation(donation: DonationRecord): void {
    const donations = this.getDonations()
    donations.push(donation)
    this.setItem("donations", donations)
  }

  // Collection operations
  getCollections(): CollectionRecord[] {
    return this.getItem<CollectionRecord[]>("collections") || []
  }

  addCollection(collection: CollectionRecord): void {
    const collections = this.getCollections()
    collections.push(collection)
    this.setItem("collections", collections)
  }

  // Broadcast notification to all users
  broadcastNotification(notification: Omit<Notification, "userId">): void {
    const users = this.getUsers()
    users.forEach((user) => {
      this.addNotification({
        ...notification,
        userId: user.id,
        id: `${notification.id}-${user.id}`,
      })
    })
  }

  // Default data generators
  private getDefaultUsers(): User[] {
    return [
      {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        role: "student",
        organization: "Heritage Institute of Technology",
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Jane Smith",
        email: "jane@example.com",
        password: "password123",
        role: "canteen_manager",
        organization: "Main Canteen",
        createdAt: new Date().toISOString(),
      },
    ]
  }

  private getDefaultFoodListings(): FoodListing[] {
    return [
      {
        id: "1",
        title: "Fresh Sandwiches",
        description: "Leftover sandwiches from lunch service",
        foodType: "prepared_food",
        quantity: "20 pieces",
        location: "Main Canteen",
        availableUntil: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        safeToEatHours: 4,
        allergens: ["gluten"],
        dietaryInfo: ["vegetarian"],
        contactInfo: "Call: 9080805940",
        status: "available",
        donorId: "2",
        donorName: "Jane Smith",
        createdAt: new Date().toISOString(),
        qrCode: "",
        collectedBy: null,
        collectedAt: null,
      },
    ]
  }

  private getDefaultEvents(): Event[] {
    return [
      {
        id: "1",
        title: "Annual Tech Fest",
        description: "Technology festival with food stalls",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Main Auditorium",
        organizer: "Tech Club",
        organizerId: "1",
        expectedAttendees: 500,
        foodLogged: false,
        createdAt: new Date().toISOString(),
      },
    ]
  }

  private getDefaultAnalytics(): AnalyticsData {
    return {
      totalFoodSaved: 1250,
      totalPeopleServed: 890,
      carbonFootprintSaved: 2.8,
      waterFootprintSaved: 1500,
      monthlyGoal: 2000,
      monthlyProgress: 1250,
      weeklyData: [
        { day: "Mon", amount: 45 },
        { day: "Tue", amount: 52 },
        { day: "Wed", amount: 38 },
        { day: "Thu", amount: 61 },
        { day: "Fri", amount: 48 },
        { day: "Sat", amount: 35 },
        { day: "Sun", amount: 42 },
      ],
      foodTypeDistribution: [
        { type: "Prepared Food", amount: 45 },
        { type: "Fresh Produce", amount: 30 },
        { type: "Packaged Items", amount: 25 },
      ],
      organizationLeaderboard: [
        { name: "Main Canteen", amount: 450 },
        { name: "Hostel A", amount: 320 },
        { name: "Event Committee", amount: 280 },
      ],
    }
  }
}

// Export singleton instance
export const storage = LocalStorageManager.getInstance()
