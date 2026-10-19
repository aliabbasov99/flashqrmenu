import crypto from "node:crypto";

const secret = () => process.env.SECRET || "qrmenu-secret-change-me";
const WEEK = 7 * 24 * 60 * 60 * 1000;

const b64 = (buf) => Buffer.from(buf).toString("base64url");

export function sign(payload) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + WEEK }));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// scrypt ilə parol hash-i: "salt:hex"
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// plain parol müqayisəsi (super admin env-də saxlanılır)
export function safeEqual(a, b) {
  const x = crypto.createHash("sha256").update(String(a || "")).digest();
  const y = crypto.createHash("sha256").update(String(b || "")).digest();
  return crypto.timingSafeEqual(x, y);
}

export function readAuth(request) {
  const token =
    request.headers.get("x-auth") ||
    new URL(request.url).searchParams.get("token") ||
    "";
  return verify(token);
}
