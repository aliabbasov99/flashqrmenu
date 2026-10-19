// Lokal API test serveru: npm run dev:api -> http://localhost:3001
import http from "node:http";
import { loadEnv } from "./env.js";

loadEnv();

const { createHandler } = await import("../backend/server/handler.js");
const handler = createHandler();
const port = process.env.PORT || 3001;

http
  .createServer((req, res) => handler(req, res))
  .listen(port, () => console.log(`API: http://localhost:${port}/api/...`));
