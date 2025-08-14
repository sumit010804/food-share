import type { ObjectId } from "mongodb"

export interface AnalyticsRecord {
  _id?: ObjectId
  userId?: ObjectId
  organizationId?: string
  date: Date
  metrics: {
    foodSaved: number // in kg
    peopleServed: number
    co2Saved: number // in kg
    waterSaved: number // in liters
    listingsCreated: number
    listingsCompleted: number
    eventsLogged: number
  }
  foodTypes: {
    vegetarian: number
    nonVegetarian: number
    vegan: number
    mixed: number
  }
  createdAt: Date
  updatedAt: Date
}

export const analyticsSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["date", "metrics", "foodTypes", "createdAt"],
      properties: {
        userId: { bsonType: "objectId" },
        organizationId: { bsonType: "string" },
        date: { bsonType: "date" },
        metrics: {
          bsonType: "object",
          required: ["foodSaved", "peopleServed", "co2Saved", "waterSaved"],
          properties: {
            foodSaved: { bsonType: "number" },
            peopleServed: { bsonType: "number" },
            co2Saved: { bsonType: "number" },
            waterSaved: { bsonType: "number" },
            listingsCreated: { bsonType: "number" },
            listingsCompleted: { bsonType: "number" },
            eventsLogged: { bsonType: "number" },
          },
        },
        foodTypes: {
          bsonType: "object",
          required: ["vegetarian", "nonVegetarian", "vegan", "mixed"],
          properties: {
            vegetarian: { bsonType: "number" },
            nonVegetarian: { bsonType: "number" },
            vegan: { bsonType: "number" },
            mixed: { bsonType: "number" },
          },
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
}
