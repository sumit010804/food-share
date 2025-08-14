// MongoDB Database Setup Script
// Run this script to initialize the database with proper collections and indexes

import { getDatabase } from "../lib/mongodb.js"
import { userSchema } from "../lib/models/User.js"
import { foodListingSchema } from "../lib/models/FoodListing.js"
import { notificationSchema } from "../lib/models/Notification.js"
import { eventSchema } from "../lib/models/Event.js"
import { analyticsSchema } from "../lib/models/Analytics.js"

async function setupDatabase() {
  try {
    const db = await getDatabase()

    console.log("Setting up MongoDB collections and indexes...")

    // Create collections with validation schemas
    await db.createCollection("users", userSchema)
    await db.createCollection("foodListings", foodListingSchema)
    await db.createCollection("notifications", notificationSchema)
    await db.createCollection("events", eventSchema)
    await db.createCollection("analytics", analyticsSchema)

    // Create indexes for better performance

    // User indexes
    await db.collection("users").createIndex({ email: 1 }, { unique: true })
    await db.collection("users").createIndex({ userType: 1 })
    await db.collection("users").createIndex({ organization: 1 })

    // Food listing indexes
    await db.collection("foodListings").createIndex({ status: 1 })
    await db.collection("foodListings").createIndex({ providerId: 1 })
    await db.collection("foodListings").createIndex({ foodType: 1 })
    await db.collection("foodListings").createIndex({ location: 1 })
    await db.collection("foodListings").createIndex({ availableFrom: 1, availableUntil: 1 })
    await db.collection("foodListings").createIndex({ expiresAt: 1 })
    await db.collection("foodListings").createIndex({ createdAt: -1 })

    // Notification indexes
    await db.collection("notifications").createIndex({ userId: 1 })
    await db.collection("notifications").createIndex({ isRead: 1 })
    await db.collection("notifications").createIndex({ type: 1 })
    await db.collection("notifications").createIndex({ createdAt: -1 })
    await db.collection("notifications").createIndex({ priority: 1 })

    // Event indexes
    await db.collection("events").createIndex({ organizerId: 1 })
    await db.collection("events").createIndex({ status: 1 })
    await db.collection("events").createIndex({ startDate: 1, endDate: 1 })
    await db.collection("events").createIndex({ eventType: 1 })
    await db.collection("events").createIndex({ foodLogged: 1 })

    // Analytics indexes
    await db.collection("analytics").createIndex({ userId: 1 })
    await db.collection("analytics").createIndex({ organizationId: 1 })
    await db.collection("analytics").createIndex({ date: -1 })

    console.log("✅ Database setup completed successfully!")
    console.log("Collections created: users, foodListings, notifications, events, analytics")
    console.log("Indexes created for optimal performance")
  } catch (error) {
    console.error("❌ Database setup failed:", error)
    throw error
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log("Database initialization complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Database initialization failed:", error)
    process.exit(1)
  })
