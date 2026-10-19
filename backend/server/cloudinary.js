// Cloudinary-a SDK-sız, REST API üzərindən yükləmə

function config() {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const m = url.match(/^cloudinary:\/\/([^:]+):(.+)@(.+)$/);
    if (m) {
      return { apiKey: m[1], apiSecret: m[2], cloudName: m[3].trim() };
    }
  }
  return {
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME
  };
}

function authHeader() {
  const { apiKey, apiSecret } = config();
  if (!apiKey || !apiSecret) throw new Error("Cloudinary konfiqurasiyası yoxdur");
  return "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
}

// file -> { secure_url, public_id }
export async function uploadImage(file, folder) {
  const { cloudName } = config();
  if (!cloudName) throw new Error("Cloudinary cloud adı təyin olunmayıb");

  const form = new FormData();
  form.append("file", file);
  if (folder) form.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    headers: { Authorization: authHeader() },
    body: form
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary yükləmə xətası");
  }
  return { secure_url: data.secure_url, public_id: data.public_id };
}

export async function deleteImage(publicId) {
  if (!publicId) return;
  const { cloudName } = config();
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("invalidate", "true");

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    headers: { Authorization: authHeader() },
    body: form
  }).catch(() => {});
}
