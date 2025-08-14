import type { ObjectId } from "mongodb"

export interface FoodListing {
  _id?: ObjectId
  title: string
  description: string
  foodType: "vegetarian" | "non-vegetarian" | "vegan" | "mixed"
  quantity: number
  unit: string
  location: string
  availableFrom: Date
  availableUntil: Date
  expiresAt: Date
  status: "available" | "reserved" | "picked-up" | "expired"
  safeToEatHours: number
  qualityTags: string[]
  allergens: string[]
  providerId: ObjectId
  providerName: string
  providerType: string
  reservedBy?: ObjectId
  reservedAt?: Date
  pickedUpBy?: ObjectId
  pickedUpAt?: Date
  createdAt: Date
  updatedAt: Date
  images?: string[]
  specialInstructions?: string
  contactInfo: {
    phone?: string
    email?: string
    preferredContact: "phone" | "email" | "app"
  }
}

export const foodListingSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "title",
        "foodType",
        "quantity",
        "unit",
        "location",
        "availableFrom",
        "availableUntil",
        "expiresAt",
        "providerId",
      ],
      properties: {
        title: { bsonType: "string" },
        description: { bsonType: "string" },
        foodType: {
          bsonType: "string",
          enum: ["vegetarian", "non-vegetarian", "vegan", "mixed"],
        },
        quantity: { bsonType: "number" },
        unit: { bsonType: "string" },
        location: { bsonType: "string" },
        availableFrom: { bsonType: "date" },
        availableUntil: { bsonType: "date" },
        expiresAt: { bsonType: "date" },
        status: {
          bsonType: "string",
          enum: ["available", "reserved", "picked-up", "expired"],
        },
        safeToEatHours: { bsonType: "number" },
        qualityTags: { bsonType: "array" },
        allergens: { bsonType: "array" },
        providerId: { bsonType: "objectId" },
        providerName: { bsonType: "string" },
        providerType: { bsonType: "string" },
        reservedBy: { bsonType: "objectId" },
        reservedAt: { bsonType: "date" },
        pickedUpBy: { bsonType: "objectId" },
        pickedUpAt: { bsonType: "date" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
}
