import type { ObjectId } from "mongodb"

export interface Notification {
  _id?: ObjectId
  userId: ObjectId
  type: "new_listing" | "pickup_reminder" | "expiry_warning" | "reservation_confirmed" | "event_reminder" | "system"
  title: string
  message: string
  priority: "low" | "medium" | "high"
  isRead: boolean
  createdAt: Date
  readAt?: Date
  relatedId?: ObjectId // ID of related food listing, event, etc.
  actionUrl?: string
  metadata?: {
    foodListingId?: ObjectId
    eventId?: ObjectId
    expiresAt?: Date
  }
}

export const notificationSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "type", "title", "message", "priority", "isRead", "createdAt"],
      properties: {
        userId: { bsonType: "objectId" },
        type: {
          bsonType: "string",
          enum: [
            "new_listing",
            "pickup_reminder",
            "expiry_warning",
            "reservation_confirmed",
            "event_reminder",
            "system",
          ],
        },
        title: { bsonType: "string" },
        message: { bsonType: "string" },
        priority: {
          bsonType: "string",
          enum: ["low", "medium", "high"],
        },
        isRead: { bsonType: "bool" },
        createdAt: { bsonType: "date" },
        readAt: { bsonType: "date" },
        relatedId: { bsonType: "objectId" },
        actionUrl: { bsonType: "string" },
      },
    },
  },
}
