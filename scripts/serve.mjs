import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCopaLive, startCopaSync } from "../api/_lib/copa.mjs";
import { handleMvp } from "../api/_lib/mvp.mjs";
import { handleFeed } from "../api/_lib/insta.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preferredPort = Number(process.env.PORT) || 8765;
const host = process.env.HOST || "0.0.0.0";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function sendJson(res, obj, status = 200, extraHeaders = {}) {
  const json = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(json);
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep) && file !== root) return null;
  return file;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/healthz") {
      sendJson(res, { ok: true });
      return;
    }
    if (url.pathname === "/api/mvp") {
      const out = await handleMvp(req);
      sendJson(res, out.json, out.status, out.headers);
      return;
    }
    if (url.pathname === "/api/copa") {
      sendJson(res, await getCopaLive());
      return;
    }
    if (url.pathname === "/api/feed") {
      const out = await handleFeed(req);
      sendJson(res, out.json, out.status, out.headers);
      return;
    }
    const file = safeFile(url.pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { "Content-Type": mime[ext] || "application/octet-stream" };
    if (ext === ".html" || file.endsWith(`${path.sep}index.html`)) {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
      headers.Pragma = "no-cache";
    } else if ([".css", ".js"].includes(ext)) {
      headers["Cache-Control"] = "public, max-age=60, must-revalidate";
    } else if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"].includes(ext)) {
      headers["Cache-Control"] = "public, max-age=3600";
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off("listening", onListen);
      reject(err);
    };
    const onListen = () => {
      server.off("error", onError);
      resolve(port);
    };
    server.once("error", onError);
    server.once("listening", onListen);
    server.listen(port, host);
  });
}

const ports = Number(process.env.PORT)
  ? [preferredPort]
  : [preferredPort, 8766, 8767, 8768, 8769];

let bound = null;
for (const port of ports) {
  try {
    bound = await listen(port);
    break;
  } catch (err) {
    if (err.code !== "EADDRINUSE") throw err;
  }
}
if (!bound) {
  console.error("Nenhuma porta livre (8765-8769).");
  process.exit(1);
}
console.log(`listening ${bound}`);
console.log(`Bala de Munich em http://127.0.0.1:${bound}`);
startCopaSync();
