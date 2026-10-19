export const AUTH_SUPER = "qr_auth_super";
export const AUTH_PANEL = "qr_auth_panel";

export function getAuth(key = AUTH_SUPER) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function setAuth(value, key = AUTH_SUPER) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function clearAuth(key = AUTH_SUPER) {
  localStorage.removeItem(key);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, formData, token } = {}) {
  const headers = {};
  if (token) headers["x-auth"] = token;

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  const message = String(data.msg || "");

  if (!res.ok || message.startsWith("error")) {
    throw new ApiError(message.replace(/^error:\s*/, "") || "Xəta baş verdi", res.status);
  }
  return data;
}

// Böyük şəkilləri yükləmədən əvvəl kiçildir (Vercel body limiti üçün)
export async function resizeImage(file, max = 1600, quality = 0.85) {
  if (!file || !file.type?.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    const name = (file.name || "image").replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
