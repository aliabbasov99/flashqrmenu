import { handle } from "./router.js";

// Node.js serverless function adapter (Vercel): (req, res) -> Web Request/Response
export function createHandler() {
  return async function handler(req, res) {
    try {
      const host = req.headers.host || "localhost";
      const proto = req.headers["x-forwarded-proto"] || "http";
      const url = `${proto}://${host}${req.url || "/"}`;

      const headers = new Headers();
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
      }

      const method = (req.method || "GET").toUpperCase();
      let body;
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        if (buffer.length) body = buffer;
      }

      const request = new Request(url, { method, headers, body });
      const response = await handle(request);

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        if (key !== "content-length") res.setHeader(key, value);
      });
      const payload = Buffer.from(await response.arrayBuffer());
      res.setHeader("content-length", payload.length);
      res.end(payload);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ msg: "error: " + (e.message || "Server xətası") }));
    }
  };
}
