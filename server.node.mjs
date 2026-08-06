import http from "node:http";
import { Readable } from "node:stream";
import app from "./dist/server/server.js";

const host = process.env.HOST || process.env.NITRO_HOST || "0.0.0.0";
const port = Number(process.env.PORT || process.env.NITRO_PORT || 8080);

const server = http.createServer(async (req, res) => {
  try {
    const protocol =
      req.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim() ||
      "http";

    const hostname =
      req.headers["x-forwarded-host"]?.toString().split(",")[0]?.trim() ||
      req.headers.host ||
      `${host}:${port}`;

    const url = new URL(req.url || "/", `${protocol}://${hostname}`);

    const method = req.method || "GET";
    const hasBody = method !== "GET" && method !== "HEAD";

    const request = new Request(url, {
      method,
      headers: req.headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? "half" : undefined,
    });

    const response = await app.fetch(request, process.env, {
      waitUntil(promise) {
        Promise.resolve(promise).catch(console.error);
      },
      passThroughOnException() {},
    });

    res.statusCode = response.status;
    res.statusMessage = response.statusText;

    for (const [name, value] of response.headers) {
      if (name.toLowerCase() !== "set-cookie") {
        res.setHeader(name, value);
      }
    }

    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length > 0) {
      res.setHeader("set-cookie", cookies);
    }

    if (method === "HEAD" || !response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("HTTP adapter error:", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }

    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`EagleBABA listening on http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(() => process.exit(0));

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
