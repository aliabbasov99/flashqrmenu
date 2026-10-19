// Lokal .env / atlas-credentials.env fayllarını process.env-ə yükləyir
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv(dir) {
  const base = dir || path.dirname(fileURLToPath(import.meta.url));
  for (const name of [".env", "../.env", "atlas-credentials.env", "../atlas-credentials.env"]) {
    const file = path.resolve(base, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
