import { ObjectId } from "mongodb";
import { col, ensureIndexes } from "./db.js";
import { sign, readAuth, hashPassword, checkPassword, safeEqual } from "./auth.js";
import { uploadImage, deleteImage } from "./cloudinary.js";
import { json, fail, slugify, buildWorkHours } from "./util.js";

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const err = (msg, status = 400) => new HttpError(msg, status);

const superCreds = () => ({
  username: process.env.ADMIN_USERNAME || "admin",
  password: process.env.ADMIN_PASSWORD || "jaguar"
});

const THEME_IDS = new Set(["green", "wine", "navy", "brown", "terracotta", "charcoal"]);
const ORDER_STATUSES = new Set(["new", "processing", "done", "cancelled"]);

const oid = (id) => {
  try {
    return new ObjectId(String(id));
  } catch {
    throw err("Yanlış ID", 400);
  }
};

function subscriptionExpired(r) {
  if (!r || !r.subscriptionUntil) return false;
  const until = r.subscriptionUntil instanceof Date ? r.subscriptionUntil : new Date(r.subscriptionUntil);
  if (Number.isNaN(until.getTime())) return false;
  return Date.now() > until.getTime();
}

function dateInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function publicRestaurant(r) {
  if (!r) return null;
  return {
    _id: String(r._id),
    slug: r.slug,
    name: r.name,
    logo: r.logo || "",
    heroImage: r.heroImage || "",
    active: r.active !== false,
    theme: THEME_IDS.has(r.theme) ? r.theme : "green",
    subscriptionUntil: dateInput(r.subscriptionUntil),
    subscriptionExpired: subscriptionExpired(r),
    hours: r.hours || {},
    workHours: buildWorkHours(r.hours || {})
  };
}

function publicOrder(o) {
  if (!o) return null;
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    _id: String(o._id),
    order: Number(o.order) || 0,
    table: o.table || "",
    note: o.note || "",
    items: items.map((i) => ({
      productId: i.productId ? String(i.productId) : "",
      name: i.name || "",
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 1
    })),
    total: Number(o.total) || 0,
    status: ORDER_STATUSES.has(o.status) ? o.status : "new",
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : "",
    updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : ""
  };
}

function readBody(request) {
  return request.json().catch(() => ({}));
}

async function requireSuper(request) {
  const auth = readAuth(request);
  if (!auth || auth.role !== "super") throw err("Giriş icazəsi yoxdur", 401);
  return auth;
}

async function requirePanel(request) {
  const auth = readAuth(request);
  if (!auth || auth.role !== "restaurant" || !auth.rid) {
    throw err("Giriş icazəsi yoxdur", 401);
  }
  const restaurants = await col("restaurants");
  const restaurant = await restaurants.findOne({ _id: oid(auth.rid) });
  if (!restaurant) throw err("Restoran tapılmadı", 404);
  if (restaurant.active === false) throw err("Restoran deaktivdir", 403);
  return { auth, restaurant };
}

async function nextOrder(restaurantId, collection) {
  const c = await col(collection);
  const last = await c
    .find({ restaurantId })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  return last.length ? (last[0].order || 0) + 1 : 1;
}

// ============================================================
//  Endpoint-lər
// ============================================================

async function route(request, seg, method) {
  await ensureIndexes();
  const path = seg.join("/");

  // ---------------- AUTH ----------------
  if (path === "auth/login" && method === "POST") {
    const body = await readBody(request);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (username && password) {
      const restaurants = await col("restaurants");
      const restaurant = await restaurants.findOne({ username });
      if (restaurant && checkPassword(password, restaurant.passwordHash)) {
        if (restaurant.active === false) throw err("Restoran deaktivdir", 403);
        const token = sign({
          role: "restaurant",
          rid: String(restaurant._id),
          slug: restaurant.slug,
          name: restaurant.name
        });
        return json({
          msg: "success",
          token,
          role: "restaurant",
          restaurant: { slug: restaurant.slug, name: restaurant.name }
        });
      }
    }

    const admin = superCreds();
    if (safeEqual(username, admin.username) && safeEqual(password, admin.password)) {
      const token = sign({ role: "super", name: "Super Admin" });
      return json({ msg: "success", token, role: "super" });
    }

    throw err("İstifadəçi adı və ya parol yanlışdır", 401);
  }

  // ---------------- PUBLIC ----------------
  if (path === "restaurants" && method === "GET") {
    const restaurants = await col("restaurants");
    const list = await restaurants
      .find({
        active: { $ne: false },
        $or: [{ subscriptionUntil: null }, { subscriptionUntil: { $gt: new Date() } }]
      })
      .project({ slug: 1, name: 1, heroImage: 1, logo: 1 })
      .sort({ name: 1 })
      .toArray();
    return json({ msg: "success", restaurants: list.map(publicRestaurant) });
  }

  if (seg[0] === "restaurants" && seg[1] && method === "GET") {
    const restaurants = await col("restaurants");
    const restaurant = await restaurants.findOne({ slug: seg[1] });
    if (!restaurant || restaurant.active === false || subscriptionExpired(restaurant)) {
      throw err("Restoran tapılmadı", 404);
    }

    // /restaurants/:slug/menu
    if (seg[2] === "menu") {
      const categories = await col("categories");
      const products = await col("products");
      const [cats, prods] = await Promise.all([
        categories.find({ restaurantId: restaurant._id }).sort({ order: 1, name: 1 }).toArray(),
        products.find({ restaurantId: restaurant._id }).sort({ order: 1 }).toArray()
      ]);
      const catMap = new Map(cats.map((c) => [String(c._id), c.name]));
      return json({
        msg: "success",
        restaurant: publicRestaurant(restaurant),
        categories: cats.map((c) => ({ _id: String(c._id), name: c.name, order: c.order || 0 })),
        products: prods.map((p) => ({
          _id: String(p._id),
          name: p.name,
          subName: p.subName || "",
          price: p.price ?? 0,
          image: p.image || "",
          categoryId: p.categoryId ? String(p.categoryId) : "",
          categoryName: p.categoryId ? catMap.get(String(p.categoryId)) || "" : "",
          order: p.order || 0
        }))
      });
    }

    return json({ msg: "success", restaurant: publicRestaurant(restaurant) });
  }

  // ---------------- SUPER ADMIN ----------------
  if (seg[0] === "super") {
    await requireSuper(request);
    const restaurants = await col("restaurants");

    if (path === "super/restaurants" && method === "GET") {
      const list = await restaurants.find({}).sort({ createdAt: -1 }).toArray();
      return json({
        msg: "success",
        restaurants: list.map((r) => ({ ...publicRestaurant(r), username: r.username }))
      });
    }

    if (path === "super/restaurants" && method === "POST") {
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const slug = slugify(body.slug || name);

      if (!name) throw err("Restoran adı lazımdır");
      if (!username) throw err("Login adı lazımdır");
      if (!password) throw err("Parol lazımdır");
      if (!slug) throw err("URL ünvanı (slug) yarana bilmədi");

      const exists = await restaurants.findOne({
        $or: [{ slug }, { username }]
      });
      if (exists) {
        throw err(
          exists.slug === slug ? "Bu ünvan artıq istifadə olunur" : "Bu login artıq istifadə olunur",
          409
        );
      }

      const doc = {
        slug,
        name,
        username,
        passwordHash: hashPassword(password),
        active: true,
        theme: "green",
        logo: "",
        heroImage: "",
        heroPublicId: "",
        hours: {
          start: "15:00",
          end: "02:00",
          label: "",
          format: "24"
        },
        createdAt: new Date()
      };
      const res = await restaurants.insertOne(doc);
      return json({ msg: "success", restaurant: publicRestaurant({ ...doc, _id: res.insertedId }) });
    }

    if (seg[0] === "super" && seg[1] === "restaurants" && seg[2] && method === "PUT") {
      const body = await readBody(request);
      const _id = oid(seg[2]);
      const current = await restaurants.findOne({ _id });
      if (!current) throw err("Restoran tapılmadı", 404);

      const updates = {};
      if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
      if (typeof body.username === "string" && body.username.trim()) {
        updates.username = body.username.trim().toLowerCase();
      }
      if (typeof body.password === "string" && body.password.trim()) {
        updates.passwordHash = hashPassword(body.password.trim());
      }
      if (typeof body.active === "boolean") updates.active = body.active;

      if (body.subscriptionUntil !== undefined) {
        const raw = String(body.subscriptionUntil || "").trim();
        if (!raw) {
          updates.subscriptionUntil = null;
        } else {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw err("Tarix formatı yanlışdır (YYYY-MM-DD)");
          const until = new Date(`${raw}T23:59:59.999Z`);
          if (Number.isNaN(until.getTime()) || dateInput(until) !== raw) {
            throw err("Yanlış tarix");
          }
          updates.subscriptionUntil = until;
        }
      }

      if (body.slug !== undefined) {
        const slug = slugify(body.slug);
        if (slug && slug !== current.slug) updates.slug = slug;
      }

      if (updates.slug || updates.username) {
        const clash = await restaurants.findOne({
          _id: { $ne: _id },
          $or: [
            ...(updates.slug ? [{ slug: updates.slug }] : []),
            ...(updates.username ? [{ username: updates.username }] : [])
          ]
        });
        if (clash) throw err("Bu ünvan və ya login artıq istifadə olunur", 409);
      }

      if (Object.keys(updates).length) await restaurants.updateOne({ _id }, { $set: updates });
      const updated = await restaurants.findOne({ _id });
      return json({ msg: "success", restaurant: publicRestaurant(updated) });
    }

    if (seg[0] === "super" && seg[1] === "restaurants" && seg[2] && method === "DELETE") {
      const _id = oid(seg[2]);
      const current = await restaurants.findOne({ _id });
      if (!current) throw err("Restoran tapılmadı", 404);

      const [categories, products] = await Promise.all([col("categories"), col("products")]);
      await Promise.all([
        categories.deleteMany({ restaurantId: _id }),
        products.deleteMany({ restaurantId: _id }),
        restaurants.deleteOne({ _id }),
        current.heroPublicId ? deleteImage(current.heroPublicId) : Promise.resolve()
      ]);
      return json({ msg: "success" });
    }
  }

  // ---------------- RESTORAN PANELİ ----------------
  if (seg[0] === "panel") {
    const { restaurant } = await requirePanel(request);

    if (path === "panel/restaurant" && method === "GET") {
      return json({ msg: "success", restaurant: publicRestaurant(restaurant) });
    }

  if (path === "panel/restaurant" && method === "PUT") {
    const body = await readBody(request);
    const restaurants = await col("restaurants");
    const updates = {};

    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.password === "string" && body.password.trim()) {
      updates.passwordHash = hashPassword(body.password.trim());
    }
    if (body.hours && typeof body.hours === "object") {
        updates.hours = {
          start: body.hours.start ?? restaurant.hours?.start ?? "",
          end: body.hours.end ?? restaurant.hours?.end ?? "",
          label: body.hours.label ?? restaurant.hours?.label ?? "",
          format: "24"
        };
    }
    if (body.logo !== undefined) {
      updates.logo = String(body.logo || "").trim();
    }
    if (typeof body.theme === "string") {
      const theme = body.theme.trim();
      if (theme && !THEME_IDS.has(theme)) throw err("Yanlış rəng teması");
      updates.theme = theme || "green";
    }

    if (Object.keys(updates).length) {
      await restaurants.updateOne({ _id: restaurant._id }, { $set: updates });
    }
    const updated = await restaurants.findOne({ _id: restaurant._id });
    return json({ msg: "success", restaurant: publicRestaurant(updated) });
  }

    if (path === "panel/hero" && method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file !== "object" || !file.name) throw err("Fayl seçilməyib");
      if (!/^image\//.test(file.type || "")) throw err("Yalnız şəkil yükləyə bilərsiniz");

      const uploaded = await uploadImage(file, `qrmenu/${restaurant.slug}/hero`);
      const restaurants = await col("restaurants");
      if (restaurant.heroPublicId) await deleteImage(restaurant.heroPublicId);
      await restaurants.updateOne(
        { _id: restaurant._id },
        { $set: { heroImage: uploaded.secure_url, heroPublicId: uploaded.public_id } }
      );
      return json({ msg: "success", url: uploaded.secure_url });
    }

    if (path === "panel/hero" && method === "DELETE") {
      const restaurants = await col("restaurants");
      if (restaurant.heroPublicId) await deleteImage(restaurant.heroPublicId);
      await restaurants.updateOne(
        { _id: restaurant._id },
        { $set: { heroImage: "", heroPublicId: "" } }
      );
      return json({ msg: "success" });
    }

    if (path === "panel/logo" && method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file !== "object" || !file.name) throw err("Fayl seçilməyib");
      if (!/^image\//.test(file.type || "")) throw err("Yalnız şəkil yükləyə bilərsiniz");

      const uploaded = await uploadImage(file, `qrmenu/${restaurant.slug}/logo`);
      const restaurants = await col("restaurants");
      await restaurants.updateOne(
        { _id: restaurant._id },
        { $set: { logo: uploaded.secure_url } }
      );
      return json({ msg: "success", url: uploaded.secure_url });
    }

    if (path === "panel/logo" && method === "DELETE") {
      const restaurants = await col("restaurants");
      await restaurants.updateOne(
        { _id: restaurant._id },
        { $set: { logo: "" } }
      );
      return json({ msg: "success" });
    }

    // --- Kateqoriyalar ---
    if (path === "panel/categories" && method === "GET") {
      const categories = await col("categories");
      const list = await categories
        .find({ restaurantId: restaurant._id })
        .sort({ order: 1, name: 1 })
        .toArray();
      return json({
        msg: "success",
        categories: list.map((c) => ({ _id: String(c._id), name: c.name, order: c.order || 0 }))
      });
    }

    if (path === "panel/categories" && method === "POST") {
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      if (!name) throw err("Kateqoriya adı lazımdır");
      const categories = await col("categories");
      const doc = {
        restaurantId: restaurant._id,
        name,
        order: Number.isFinite(Number(body.order))
          ? Number(body.order)
          : await nextOrder(restaurant._id, "categories")
      };
      const res = await categories.insertOne(doc);
      return json({ msg: "success", category: { _id: String(res.insertedId), ...doc } });
    }

    if (seg[1] === "categories" && seg[2] && method === "PUT") {
      const body = await readBody(request);
      const _id = oid(seg[2]);
      const categories = await col("categories");
      const current = await categories.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Kateqoriya tapılmadı", 404);

      const updates = {};
      if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
      if (body.order !== undefined && Number.isFinite(Number(body.order))) {
        updates.order = Number(body.order);
      }
      if (Object.keys(updates).length) await categories.updateOne({ _id }, { $set: updates });
      return json({ msg: "success" });
    }

    if (seg[1] === "categories" && seg[2] && method === "DELETE") {
      const _id = oid(seg[2]);
      const categories = await col("categories");
      const current = await categories.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Kateqoriya tapılmadı", 404);

      const products = await col("products");
      await products.updateMany({ categoryId: _id }, { $set: { categoryId: null } });
      await categories.deleteOne({ _id });
      return json({ msg: "success" });
    }

    // --- Məhsullar ---
    if (path === "panel/products" && method === "GET") {
      const [categories, products] = await Promise.all([col("categories"), col("products")]);
      const [cats, prods] = await Promise.all([
        categories.find({ restaurantId: restaurant._id }).sort({ order: 1 }).toArray(),
        products.find({ restaurantId: restaurant._id }).sort({ order: 1 }).toArray()
      ]);
      const catMap = new Map(cats.map((c) => [String(c._id), c.name]));
      return json({
        msg: "success",
        categories: cats.map((c) => ({ _id: String(c._id), name: c.name })),
        products: prods.map((p) => ({
          _id: String(p._id),
          name: p.name,
          subName: p.subName || "",
          price: p.price ?? 0,
          image: p.image || "",
          categoryId: p.categoryId ? String(p.categoryId) : "",
          order: p.order || 0
        })),
        categoryNames: Object.fromEntries(catMap)
      });
    }

    if (path === "panel/products" && method === "POST") {
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      if (!name) throw err("Məhsul adı lazımdır");

      const products = await col("products");
      const doc = {
        restaurantId: restaurant._id,
        name,
        subName: String(body.subName || "").trim(),
        price: Number(body.price) || 0,
        image: "",
        imagePublicId: "",
        categoryId: body.categoryId ? oid(body.categoryId) : null,
        order: await nextOrder(restaurant._id, "products")
      };
      const res = await products.insertOne(doc);
      return json({ msg: "success", product: { _id: String(res.insertedId), ...doc, categoryId: doc.categoryId ? String(doc.categoryId) : "" } });
    }

    if (seg[1] === "products" && seg[2] && method === "PUT") {
      const body = await readBody(request);
      const _id = oid(seg[2]);
      const products = await col("products");
      const current = await products.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Məhsul tapılmadı", 404);

      const updates = {};
      if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
      if (body.subName !== undefined) updates.subName = String(body.subName).trim();
      if (body.price !== undefined) updates.price = Number(body.price) || 0;
      if (body.categoryId !== undefined) {
        updates.categoryId = body.categoryId ? oid(body.categoryId) : null;
      }
      if (body.order !== undefined && Number.isFinite(Number(body.order))) {
        updates.order = Number(body.order);
      }

      await products.updateOne({ _id }, { $set: updates });
      return json({ msg: "success" });
    }

    if (seg[1] === "products" && seg[2] && method === "DELETE") {
      const _id = oid(seg[2]);
      const products = await col("products");
      const current = await products.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Məhsul tapılmadı", 404);
      if (current.imagePublicId) await deleteImage(current.imagePublicId);
      await products.deleteOne({ _id });
      return json({ msg: "success" });
    }

    // Məhsul şəkli yüklə / sil
    if (seg[1] === "products" && seg[2] && seg[3] === "image" && method === "POST") {
      const _id = oid(seg[2]);
      const products = await col("products");
      const current = await products.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Məhsul tapılmadı", 404);

      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file !== "object" || !file.name) throw err("Fayl seçilməyib");
      if (!/^image\//.test(file.type || "")) throw err("Yalnız şəkil yükləyə bilərsiniz");

      const uploaded = await uploadImage(file, `qrmenu/${restaurant.slug}/products`);
      if (current.imagePublicId) await deleteImage(current.imagePublicId);
      await products.updateOne(
        { _id },
        { $set: { image: uploaded.secure_url, imagePublicId: uploaded.public_id } }
      );
      return json({ msg: "success", url: uploaded.secure_url });
    }

    if (seg[1] === "products" && seg[2] && seg[3] === "image" && method === "DELETE") {
      const _id = oid(seg[2]);
      const products = await col("products");
      const current = await products.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Məhsul tapılmadı", 404);
      if (current.imagePublicId) await deleteImage(current.imagePublicId);
      await products.updateOne({ _id }, { $set: { image: "", imagePublicId: "" } });
      return json({ msg: "success" });
    }

    // --- Sifarişlər ---
    if (path === "panel/orders" && method === "GET") {
      const url = new URL(request.url);
      const since = url.searchParams.get("since");
      const status = url.searchParams.get("status");
      const filter = { restaurantId: restaurant._id };

      if (since) {
        const date = new Date(since);
        if (!Number.isNaN(date.getTime())) filter.createdAt = { $gt: date };
      }
      if (status && ORDER_STATUSES.has(status)) filter.status = status;
      else if (status === "active") filter.status = { $in: ["new", "processing"] };

      const orders = await col("orders");
      // TTL indeksinə əlavə olaraq, oxuyarkən 24 saatdan köhnə sifarişləri təmizlə
      await orders.deleteMany({
        restaurantId: restaurant._id,
        createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      const list = await orders
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(300)
        .toArray();
      return json({ msg: "success", orders: list.map(publicOrder) });
    }

    if (path === "panel/orders" && method === "POST") {
      const body = await readBody(request);
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (!rawItems.length) throw err("Sifariş boşdur");

      const products = await col("products");
      const ids = [];
      for (const raw of rawItems) {
        const id = String(raw?.productId || "");
        if (ObjectId.isValid(id) && !ids.some((x) => x.equals(id))) {
          ids.push(new ObjectId(id));
        }
      }
      if (!ids.length) throw err("Sifarişdə məhsul yoxdur");

      const found = await products
        .find({ _id: { $in: ids }, restaurantId: restaurant._id })
        .toArray();
      const productMap = new Map(found.map((p) => [String(p._id), p]));

      const merged = new Map();
      for (const raw of rawItems) {
        const product = productMap.get(String(raw?.productId || ""));
        if (!product) continue;
        const id = String(product._id);
        const qty = Math.max(1, Math.min(999, Math.floor(Number(raw?.qty) || 1)));
        const current = merged.get(id);
        if (current) current.qty += qty;
        else {
          merged.set(id, {
            productId: id,
            name: product.name || "",
            price: Number(product.price) || 0,
            qty
          });
        }
      }
      const items = [...merged.values()];
      if (!items.length) throw err("Məhsullar tapılmadı");

      const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const orders = await col("orders");
      const now = new Date();
      const doc = {
        restaurantId: restaurant._id,
        order: await nextOrder(restaurant._id, "orders"),
        table: String(body.table || "").trim().slice(0, 40),
        note: String(body.note || "").trim().slice(0, 300),
        items,
        total,
        status: "new",
        createdAt: now,
        updatedAt: now
      };
      const res = await orders.insertOne(doc);
      return json({ msg: "success", order: publicOrder({ ...doc, _id: res.insertedId }) });
    }

    if (seg[1] === "orders" && seg[2] && method === "PUT") {
      const body = await readBody(request);
      const status = String(body.status || "").trim();
      if (!ORDER_STATUSES.has(status)) throw err("Yanlış sifariş statusu");

      const _id = oid(seg[2]);
      const orders = await col("orders");
      const current = await orders.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Sifariş tapılmadı", 404);

      const now = new Date();
      await orders.updateOne({ _id }, { $set: { status, updatedAt: now } });
      return json({
        msg: "success",
        order: publicOrder({ ...current, status, updatedAt: now })
      });
    }

    if (seg[1] === "orders" && seg[2] && method === "DELETE") {
      const _id = oid(seg[2]);
      const orders = await col("orders");
      const current = await orders.findOne({ _id, restaurantId: restaurant._id });
      if (!current) throw err("Sifariş tapılmadı", 404);
      if (!["done", "cancelled"].includes(current.status)) {
        throw err("Əvvəlcə sifarişi bağlayın", 400);
      }
      await orders.deleteOne({ _id });
      return json({ msg: "success" });
    }
  }

  throw err("Endpoint tapılmadı", 404);
}

export async function handle(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-auth"
      }
    });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");
    const seg = path.split("/").filter(Boolean);
    const allowed = ["GET", "POST", "PUT", "DELETE"];
    if (!allowed.includes(request.method)) return fail("Metod icazə verilmir", 405);
    return await route(request, seg, request.method);
  } catch (e) {
    if (e instanceof HttpError) return json({ msg: "error: " + e.message }, e.status);
    return json({ msg: "error: " + (e.message || "Server xətası") }, 500);
  }
}
