// Lokal/quruluş seed: Jaguar Lounge restoranı + mövcud menyu datasi
// İstifadə: MONGODB_URI=... npm run seed   (və ya .env / atlas-credentials.env faylından oxunur)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { hashPassword } from "../frontend/server/auth.js";
import { loadEnv } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnv(__dirname);
loadEnv(path.resolve(__dirname, ".."));

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI tapılmadı (.env / atlas-credentials.env yoxla)");
  process.exit(1);
}

const SLUG = process.env.SEED_SLUG || "jaguar-lounge";
const NAME = process.env.SEED_NAME || "Jaguar Lounge";
const USER = process.env.SEED_USER || "jaguar";
const PASS = process.env.SEED_PASS || "jaguar";

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "products.json"), "utf8"));

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "qrmenu");
  const restaurants = db.collection("restaurants");
  const categories = db.collection("categories");
  const products = db.collection("products");

  let restaurant = await restaurants.findOne({ slug: SLUG });
  if (!restaurant) {
    const doc = {
      slug: SLUG,
      name: NAME,
      username: USER,
      passwordHash: hashPassword(PASS),
      active: true,
      logo: "",
      heroImage: "",
      heroPublicId: "",
      hours: { start: "15:00", end: "02:00", label: "", format: "24" },
      createdAt: new Date()
    };
    const res = await restaurants.insertOne(doc);
    restaurant = { ...doc, _id: res.insertedId };
    console.log(`Restoran yaradıldı: ${SLUG} (login: ${USER} / parol: ${PASS})`);
  } else {
    console.log(`Restoran mövcuddur: ${SLUG}`);
  }

  const existingProducts = await products.countDocuments({ restaurantId: restaurant._id });
  if (existingProducts > 0 && !process.env.SEED_FORCE) {
    console.log(`Menyu artıq yüklü (${existingProducts} məhsul). Bərpa etmək üçün SEED_FORCE=1 npm run seed`);
    await client.close();
    return;
  }

  await categories.deleteMany({ restaurantId: restaurant._id });
  await products.deleteMany({ restaurantId: restaurant._id });

  const groupIds = new Map();
  let catOrder = 0;
  let prodOrder = 0;

  for (const item of raw) {
    const group = (item.mGroup || "").trim();
    if (group && !groupIds.has(group)) {
      catOrder += 1;
      const doc = { restaurantId: restaurant._id, name: group, order: catOrder };
      const res = await categories.insertOne(doc);
      groupIds.set(group, res.insertedId);
    }

    prodOrder += 1;
    await products.insertOne({
      restaurantId: restaurant._id,
      name: String(item.mName || "").trim(),
      subName: String(item.mSubName || "").trim(),
      price: Number(item.mPrice) || 0,
      image: "",
      imagePublicId: "",
      categoryId: group ? groupIds.get(group) : null,
      order: prodOrder
    });
  }

  console.log(`Seed tamamlandı: ${groupIds.size} kateqoriya, ${raw.length} məhsul`);
  await client.close();
}

main().catch((e) => {
  console.error("Seed xətası:", e.message);
  process.exit(1);
});
