export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-auth",
  "Content-Type": "application/json; charset=utf-8"
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

export function fail(message, status = 400) {
  return json({ msg: "error: " + message }, status);
}

export function ok(data = {}) {
  return json({ msg: "success", ...data });
}

export function slugify(text) {
  const map = { ə: "e", ü: "u", ö: "o", ğ: "g", ş: "s", ç: "c", ı: "i", İ: "i" };
  return String(text || "")
    .toLowerCase()
    .replace(/[əüöğşıçİ]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// "15:00" -> "03:00 PM"
export function to12Hour(time) {
  const t = (time || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return t;
  let [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function buildWorkHours(hours = {}) {
  if (hours.label && hours.label.trim()) return hours.label.trim();
  const is12 = String(hours.format) === "12";
  let s = (hours.start || "").trim();
  let e = (hours.end || "").trim();
  if (is12) {
    s = to12Hour(s);
    e = to12Hour(e);
  }
  if (!s && !e) return "";
  return `${s}—${e}`;
}
