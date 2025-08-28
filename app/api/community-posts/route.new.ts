import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI as string;
const dbName = "foodshare";
const collectionName = "community_posts";

export async function GET() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const posts = await db.collection(collectionName).find({}).sort({ _id: -1 }).toArray();
  await client.close();
  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const { author, content, attachments } = await request.json();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const post = {
    author,
    content,
    attachments: attachments || [],
    date: new Date().toISOString(),
    likes: [],
    replies: [],
  };
  await db.collection(collectionName).insertOne(post);
  await client.close();
  return NextResponse.json(post);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  await client.close();
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const { id, content, attachments } = await request.json();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await db.collection(collectionName).updateOne(
    { _id: new ObjectId(id) },
    { $set: { content, attachments } }
  );
  await client.close();
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const { id, like, reply } = await request.json();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  if (like) {
    await db.collection(collectionName).updateOne(
      { _id: new ObjectId(id) },
      { $addToSet: { likes: like } }
    );
  }
  if (reply) {
    await db.collection(collectionName).updateOne(
      { _id: new ObjectId(id) },
      { $push: { replies: reply } }
    );
  }
  await client.close();
  return NextResponse.json({ success: true });
}
