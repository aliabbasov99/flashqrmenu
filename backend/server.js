import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHandler } from "./server/handler.js";

const here = path.dirname(fileURLToPath(import.meta.url));

for (const file of [
  path.join(here, ".env"),
  path.resolve(here, "..", ".env"),
  path.resolve(here, "..", "atlas-credentials.env")
]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const handler = createHandler();
const port = Number(process.env.PORT) || 3001;

http
  .createServer((req, res) => handler(req, res))
  .listen(port, () => console.log(`API listening on http://localhost:${port}/api`));
