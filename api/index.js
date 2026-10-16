const DEFAULT_SETTINGS = {
  workHoursStart: "15:00",
  workHoursEnd: "02:00",
  workHoursLabel: "", // boşdursa avtomatik "start—end" yığılır
  timeFormat: "24", // "24" və ya "12" saatlıq format
  heroImageKey: "", // R2-dəki hero şəklinin açarı (məs: hero/hero.jpg)
  password: "jaguar" // admin panelin giriş parolu (KV-də "admin_pass" ilə dəyişir)
};

const KV_SETTINGS_KEY = "site_settings";
const KV_PASSWORD_KEY = "admin_pass";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-pass",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: corsHeaders });

// R2 public URL - dashboard-dan "Public URL" bölməsindən götürülür
const R2_PUBLIC_URL = "https://pub-28aba3035f5e4b4b9d2246f55c816246.r2.dev";

async function readSettings(env) {
  const raw = await env.MENU_KV.get(KV_SETTINGS_KEY);
  let settings = { ...DEFAULT_SETTINGS };
  if (raw) {
    try {
      settings = { ...settings, ...JSON.parse(raw) };
    } catch (e) {
      // JSON pozulubsa defaultlara qayıdırıq
    }
  }
  const password = (await env.MENU_KV.get(KV_PASSWORD_KEY)) || DEFAULT_SETTINGS.password;
  settings.password = password;
  return settings;
}

// Yazı endpoint-ləri üçün parol yoxlaması
async function isAuthorized(request, env) {
  const headerPass =
    request.headers.get("x-admin-pass") ||
    new URL(request.url).searchParams.get("pass");
  if (!headerPass) return false;
  const stored = (await env.MENU_KV.get(KV_PASSWORD_KEY)) || DEFAULT_SETTINGS.password;
  return headerPass === stored;
}

// "15:00" -> "03:00 PM" (12 saatlıq format)
function to12Hour(time) {
  const t = (time || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return t;
  let [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

// "15:00—02:00" formatını qaytarır (timeFormat: "24" və ya "12")
function buildWorkHours(settings) {
  if (settings.workHoursLabel && settings.workHoursLabel.trim()) {
    return settings.workHoursLabel.trim();
  }
  const is12 = String(settings.timeFormat) === "12";
  let s = (settings.workHoursStart || "").trim();
  let e = (settings.workHoursEnd || "").trim();
  if (is12) {
    s = to12Hour(s);
    e = to12Hour(e);
  }
  if (!s && !e) return "";
  return `${s}—${e}`;
}

async function deleteByPrefix(bucket, prefix) {
  const listed = await bucket.list({ prefix });
  for (const obj of listed.objects) {
    await bucket.delete(obj.key);
  }
  return listed.objects.map((o) => o.key);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ==========================================================
      //  MƏHSUL ŞƏKİLLƏRİ (R2)
      // ==========================================================

      // POST /api/img -> images/ qovluğundakı BÜTÜN köhnə şəkilləri silir, yenilərini yükləyir
      if (path === "/api/img" && request.method === "POST") {
        const formData = await request.formData();
        const uploadedFiles = [];

        await deleteByPrefix(env.MY_BUCKET, "images/");

        for (const [, value] of formData.entries()) {
          if (value && typeof value === "object" && value.name) {
            const fileName = value.name;
            const fileKey = `images/${fileName}`;
            const arrayBuffer = await value.arrayBuffer();
            await env.MY_BUCKET.put(fileKey, arrayBuffer, {
              httpMetadata: { contentType: value.type || "image/jpeg" }
            });
            uploadedFiles.push(fileKey);
          }
        }

        if (uploadedFiles.length === 0) {
          return json({ msg: "error: Fayl seçilməyib." }, 400);
        }

        return json({ msg: "success", files: uploadedFiles });
      }

      // GET /api/get-img -> images/ qovluğundakı şəkillərin siyahısı
      if (path === "/api/get-img" && request.method === "GET") {
        const listed = await env.MY_BUCKET.list({ prefix: "images/" });
        const files = listed.objects.map((obj) => obj.key);
        return json({ msg: "success", files });
      }

      // ==========================================================
      //  MENYU DATASI (KV)
      // ==========================================================

      // GET /api/data
      if (path === "/api/data" && request.method === "GET") {
        const rawData = await env.MENU_KV.get("menu_data");
        return new Response(rawData || "[]", { status: 200, headers: corsHeaders });
      }

      // POST /api/add-data
      if (path === "/api/add-data" && request.method === "POST") {
        const incomingData = await request.json();
        const dataToInsert = Array.isArray(incomingData) ? incomingData : [incomingData];
        await env.MENU_KV.put("menu_data", JSON.stringify(dataToInsert));
        return json({ msg: "success" });
      }

      // ==========================================================
      //  SAYT TƏNİZLƏRİ (iş saatları + hero şəkli)
      // ==========================================================

      // GET /api/settings -> Frontend üçün (parol qaytarılmır)
      if (path === "/api/settings" && request.method === "GET") {
        const settings = await readSettings(env);
        return json({
          msg: "success",
          settings: {
            workHoursStart: settings.workHoursStart,
            workHoursEnd: settings.workHoursEnd,
            workHoursLabel: settings.workHoursLabel,
            timeFormat: settings.timeFormat,
            workHours: buildWorkHours(settings),
            heroImageKey: settings.heroImageKey,
            heroImageUrl: settings.heroImageKey
              ? `${R2_PUBLIC_URL}/${settings.heroImageKey}`
              : ""
          }
        });
      }

      // GET /api/admin-settings -> Admin paneli üçün (parol tələb edir)
      if (path === "/api/admin-settings" && request.method === "GET") {
        if (!(await isAuthorized(request, env))) {
          return json({ msg: "error: Parol yanlışdır." }, 401);
        }
        const settings = await readSettings(env);
        return json({ msg: "success", settings });
      }

      // POST /api/admin-settings -> İş saatlarını / parolu yadda saxlayır
      if (path === "/api/admin-settings" && request.method === "POST") {
        if (!(await isAuthorized(request, env))) {
          return json({ msg: "error: Parol yanlışdır." }, 401);
        }

        const body = await request.json();
        const current = await readSettings(env);

        // Yeni parol göndərilibsə onu da yeniləyirik
        if (typeof body.password === "string" && body.password.trim()) {
          await env.MENU_KV.put(KV_PASSWORD_KEY, body.password.trim());
        }

        const next = {
          workHoursStart: (body.workHoursStart ?? current.workHoursStart) || "",
          workHoursEnd: (body.workHoursEnd ?? current.workHoursEnd) || "",
          workHoursLabel: body.workHoursLabel ?? current.workHoursLabel,
          timeFormat: body.timeFormat === "12" ? "12" : "24",
          heroImageKey: body.heroImageKey ?? current.heroImageKey
        };

        await env.MENU_KV.put(KV_SETTINGS_KEY, JSON.stringify(next));

        return json({
          msg: "success",
          settings: {
            ...next,
            workHours: buildWorkHours(next),
            heroImageUrl: next.heroImageKey ? `${R2_PUBLIC_URL}/${next.heroImageKey}` : ""
          }
        });
      }

      // POST /api/hero-img -> Hero şəklini R2-ə yükləyir (köhnəni silir)
      if (path === "/api/hero-img" && request.method === "POST") {
        if (!(await isAuthorized(request, env))) {
          return json({ msg: "error: Parol yanlışdır." }, 401);
        }

        const formData = await request.formData();
        const file = formData.get("file");
        const remove = formData.get("remove");

        const settings = await readSettings(env);

        // Hero şəkli silinmək istənir
        if (remove === "true") {
          await deleteByPrefix(env.MY_BUCKET, "hero/");
          await env.MENU_KV.put(
            KV_SETTINGS_KEY,
            JSON.stringify({ ...settings, heroImageKey: "" })
          );
          return json({ msg: "success", settings: { heroImageKey: "", heroImageUrl: "" } });
        }

        if (!file || typeof file !== "object" || !file.name) {
          return json({ msg: "error: Fayl seçilməyib." }, 400);
        }

        if (!/^image\//.test(file.type || "")) {
          return json({ msg: "error: Yalnız şəkil faylı yükləyə bilərsiniz." }, 400);
        }

        // Köhnə hero şəkillərini təmizləyirik
        await deleteByPrefix(env.MY_BUCKET, "hero/");

        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const fileKey = `hero/${Date.now()}_${safeName}`;
        const arrayBuffer = await file.arrayBuffer();

        await env.MY_BUCKET.put(fileKey, arrayBuffer, {
          httpMetadata: { contentType: file.type || "image/jpeg" }
        });

        await env.MENU_KV.put(
          KV_SETTINGS_KEY,
          JSON.stringify({ ...settings, heroImageKey: fileKey })
        );

        return json({
          msg: "success",
          settings: {
            heroImageKey: fileKey,
            heroImageUrl: `${R2_PUBLIC_URL}/${fileKey}`
          }
        });
      }

      // Uyğun endpoint tapılmadıqda
      return json({ msg: "error: Endpoint tapılmadı." }, 404);
    } catch (error) {
      return json({ msg: "error: " + error.message }, 500);
    }
  }
};