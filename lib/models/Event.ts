import type { ObjectId } from "mongodb"

export interface Event {
  _id?: ObjectId
  title: string
  description: string
  eventType: "conference" | "workshop" | "seminar" | "cultural" | "sports" | "meeting" | "other"
  organizerId: ObjectId
  organizerName: string
  location: string
  startDate: Date
  endDate: Date
  expectedAttendees: number
  estimatedFoodQuantity?: number
  status: "upcoming" | "ongoing" | "completed" | "cancelled"
  foodLogged: boolean
  foodLoggedAt?: Date
  createdAt: Date
  updatedAt: Date
  contactInfo: {
    phone?: string
    email?: string
    preferredContact: "phone" | "email" | "app"
  }
  notes?: string
}

export const eventSchema = {
  validator: {
    $jsonSchema: {
      
      bsonType: "object",
      required: [
        "title",
        "eventType",
        "organizerId",
        "organizerName",
        "location",
        "startDate",
        "endDate",
        "expectedAttendees",
      ],
      properties: {
        title: { bsonType: "string" },
        description: { bsonType: "string" },
        eventType: {
          bsonType: "string",
          enum: ["conference", "workshop", "seminar", "cultural", "sports", "meeting", "other"],
        },
        organizerId: { bsonType: "objectId" },
        organizerName: { bsonType: "string" },
        location: { bsonType: "string" },
        startDate: { bsonType: "date" },
        endDate: { bsonType: "date" },
        expectedAttendees: { bsonType: "number" },
        estimatedFoodQuantity: { bsonType: "number" },
        status: {
          bsonType: "string",
          enum: ["upcoming", "ongoing", "completed", "cancelled"],
        },
        foodLogged: { bsonType: "bool" },
        foodLoggedAt: { bsonType: "date" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
}
