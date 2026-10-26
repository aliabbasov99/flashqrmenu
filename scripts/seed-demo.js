// Demo restoran: 7 kateqoriya, 27 məhsul, logo və hero şəkli ilə
// İstifadə: npm run seed:demo
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { hashPassword } from "../backend/server/auth.js";
import { loadEnv } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnv(__dirname);
loadEnv(path.resolve(__dirname, ".."));

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI tapılmadı (.env yoxla)");
  process.exit(1);
}

const SLUG = "demo";
const USERNAME = "demo";
const PASSWORD = "demo123";

const photo = (id, width = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=70`;

const MENU = [
  {
    category: "Qəlyanaltılar",
    items: [
      ["Brusketta assortisi", "Pomidor, bazilika və parmezan", 12, photo("1559339352-11d035aa65de")],
      ["Pendir və zeytun boşqabı", "Seçilmiş pendirlər və yaşıl zeytun", 16.5, photo("1540189549336-e6e99c3679fe")],
      ["Toyuq qanadları", "Acılı sous ilə", 18, photo("1555939594-58d7cb561ad1")],
      ["Kartof fri", "Xırçıltılı, dəniz duzu ilə", 7.5, photo("1568901346375-23c9450c58cd")]
    ]
  },
  {
    category: "Salatlar",
    items: [
      ["Sezar salatı", "Toyuq, parmezan, kruton", 16, photo("1546069901-ba9599a7e63c")],
      ["Yunan salatı", "Feta, xiyar, pomidor, zeytun", 14, photo("1540189549336-e6e99c3679fe")],
      ["Avokado salatı", "Avokado, qarğıdalı, limon", 15.5, photo("1512621776951-a57141f2eefd")],
      ["Ton balıqlı salat", "Ton balığı, yumurta, yaşıl noxud", 18, photo("1512621776951-a57141f2eefd")]
    ]
  },
  {
    category: "Şorbalar",
    items: [
      ["Mərcimək şorbası", "Limon və çörək ilə", 8, photo("1547592180-85f173990554")],
      ["Toyuq şorbası", "Ev əriştəsi ilə", 9, photo("1603105037880-880cd4edfb0d")],
      ["Göbələk krem-şorbası", "Krem və göyərti ilə", 10.5, photo("1547592180-85f173990554")]
    ]
  },
  {
    category: "Əsas yeməklər",
    items: [
      ["Ribay steak", "Qril tərəvəzləri ilə", 42, photo("1600891964092-4316c288032e")],
      ["Toyuq şnitzel", "Kartof püresi ilə", 19, photo("1600891964092-4316c288032e")],
      ["Pasta Alfredo", "Toyuq və parmezan sousu", 21, photo("1473093295043-cdd812d0e601")],
      ["Penne arabiata", "Acılı pomidor sousu", 20, photo("1563379926898-05f4575a45d8")]
    ]
  },
  {
    category: "Qril",
    items: [
      ["Qarışıq qril", "Toyuq, quzu və tərəvəz", 38, photo("1555939594-58d7cb561ad1")],
      ["Quzu kabab", "Lavaş və sumaq ilə", 24, photo("1555939594-58d7cb561ad1")],
      ["Toyuq kabab", "Marinə edilmiş toyuq", 18, photo("1555939594-58d7cb561ad1")],
      ["Lülyə kabab", "Xüsusi ədviyyatlar ilə", 22, photo("1568901346375-23c9450c58cd")]
    ]
  },
  {
    category: "İçkilər",
    items: [
      ["Təzə sıxılmış portağal", "200 ml", 7, photo("1513558161293-cdaf765ed2fd")],
      ["Ev limonadı", "Nanə və limon", 6.5, photo("1513558161293-cdaf765ed2fd")],
      ["Ayran", "Soyuq", 4, photo("1544145945-f90425340c7e")],
      ["Espresso", "Tək", 5, photo("1544145945-f90425340c7e")]
    ]
  },
  {
    category: "Desertlər",
    items: [
      ["Şokoladlı lava kek", "Vanil dondurması ilə", 9, photo("1565958011703-44f9829ba187")],
      ["Çizkeyk", "Giləmeyvə sousu ilə", 9.5, photo("1551024506-0bccd828d307")],
      ["Tiramisu", "Klassik italyan deserti", 10, photo("1565958011703-44f9829ba187")],
      ["Dondurma assortisi", "3 top", 8, photo("1497034825429-c343d7c6a68f")]
    ]
  }
];

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "qrmenu");
  const restaurants = db.collection("restaurants");
  const categories = db.collection("categories");
  const products = db.collection("products");

  const doc = {
    slug: SLUG,
    name: "Demo Lounge",
    username: USERNAME,
    passwordHash: hashPassword(PASSWORD),
    active: true,
    theme: "terracotta",
    logo: "/demo/logo.svg",
    heroImage: "/demo/hero.jpg",
    heroPublicId: "",
    subscriptionUntil: null,
    hours: { start: "10:00", end: "23:00", label: "", format: "24" }
  };

  const existing = await restaurants.findOne({ slug: SLUG });
  let restaurantId;
  if (existing) {
    await restaurants.updateOne({ _id: existing._id }, { $set: doc });
    restaurantId = existing._id;
    console.log("Demo restoran yeniləndi");
  } else {
    const res = await restaurants.insertOne({ ...doc, createdAt: new Date() });
    restaurantId = res.insertedId;
    console.log("Demo restoran yaradıldı");
  }

  await Promise.all([
    categories.deleteMany({ restaurantId }),
    products.deleteMany({ restaurantId })
  ]);

  let catOrder = 0;
  let prodOrder = 0;
  let productCount = 0;

  for (const group of MENU) {
    catOrder += 1;
    const cat = await categories.insertOne({
      restaurantId,
      name: group.category,
      order: catOrder
    });

    for (const [name, subName, price, image] of group.items) {
      prodOrder += 1;
      productCount += 1;
      await products.insertOne({
        restaurantId,
        name,
        subName,
        price,
        image,
        imagePublicId: "",
        categoryId: cat.insertedId,
        order: prodOrder
      });
    }
  }

  console.log(`Hazırdır: ${catOrder} kateqoriya, ${productCount} məhsul`);
  console.log(`Menyu: /r/${SLUG} — panel: /panel (${USERNAME} / ${PASSWORD})`);
  await client.close();
}

main().catch((e) => {
  console.error("Demo seed xətası:", e.message);
  process.exit(1);
});
