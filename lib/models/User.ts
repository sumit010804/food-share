import type { ObjectId } from "mongodb"

export interface User {
  _id?: ObjectId
  name: string
  email: string
  password: string
  userType: "student" | "staff" | "canteen" | "hostel" | "event" | "ngo"
  organization: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
  preferences?: {
    notifications: {
      newListings: boolean
      pickupReminders: boolean
      expiryAlerts: boolean
      eventReminders: boolean
    }
  }
}

export const userSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "password", "userType", "organization"],
      properties: {
        name: { bsonType: "string" },
        email: { bsonType: "string" },
        password: { bsonType: "string" },
        userType: {
          bsonType: "string",
          enum: ["student", "staff", "canteen", "hostel", "event", "ngo"],
        },
        organization: { bsonType: "string" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        isActive: { bsonType: "bool" },
        preferences: {
          bsonType: "object",
          properties: {
            notifications: {
              bsonType: "object",
              properties: {
                newListings: { bsonType: "bool" },
                pickupReminders: { bsonType: "bool" },
                expiryAlerts: { bsonType: "bool" },
                eventReminders: { bsonType: "bool" },
              },
            },
          },
        },
      },
    },
  },
}
