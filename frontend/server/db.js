import { MongoClient } from "mongodb";

const uri = () => process.env.MONGODB_URI;
const dbName = () => process.env.MONGODB_DB || "qrmenu";

async function connect() {
  if (!uri()) throw new Error("MONGODB_URI təyin olunmayıb");
  if (!globalThis.__qrMongo) {
    const client = new MongoClient(uri());
    await client.connect();
    globalThis.__qrMongo = client;
  }
  return globalThis.__qrMongo.db(dbName());
}

export async function col(name) {
  const db = await connect();
  return db.collection(name);
}

export async function ensureIndexes() {
  if (globalThis.__qrIndexed) return;
  try {
    const restaurants = await col("restaurants");
    await restaurants.createIndex({ slug: 1 }, { unique: true });
    await restaurants.createIndex({ username: 1 }, { unique: true });
    const categories = await col("categories");
    await categories.createIndex({ restaurantId: 1, order: 1 });
    const products = await col("products");
    await products.createIndex({ restaurantId: 1, order: 1 });
    globalThis.__qrIndexed = true;
  } catch (e) {
    // indeks yaradılmasa əsas iş davam edir
  }
}
