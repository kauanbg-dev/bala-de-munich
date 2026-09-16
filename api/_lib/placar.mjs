import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkAdminPin } from "./mvp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp" : path.join(root, "data"));
const placarFile = path.join(dataDir, "placar.json");
const kvKey = "final-placar";

export const HOME = "Bala de Munich";
export const AWAY = "Botafofo";

function emptyPlacar() {
  return { live: false, done: false, us: 0, them: 0 };
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvCommand(parts, attempts = 2) {
  const kv = kvConfig();
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(kv.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kv.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parts),
      });
      if (!res.ok) throw new Error(`kv ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function readPlacar() {
  if (kvConfig()) {
    try {
      const data = await kvCommand(["GET", kvKey]);
      const raw = data?.result;
      if (!raw) return { store: emptyPlacar(), degraded: false };
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { store: normalize(obj), degraded: false };
    } catch (err) {
      console.error("placar kv get", err.message);
      return { store: emptyPlacar(), degraded: true };
    }
  }
  try {
    const raw = fs.readFileSync(placarFile, "utf8");
    if (!raw.trim()) return { store: emptyPlacar(), degraded: false };
    return { store: normalize(JSON.parse(raw)), degraded: false };
  } catch (err) {
    if (err.code === "ENOENT") return { store: emptyPlacar(), degraded: false };
    console.error("placar file get", err.message);
    return { store: emptyPlacar(), degraded: err instanceof SyntaxError ? false : true };
  }
}

async function savePlacar(store) {
  if (kvConfig()) {
    await kvCommand(["SET", kvKey, JSON.stringify(store)]);
    return;
  }
  fs.mkdirSync(path.dirname(placarFile), { recursive: true });
  fs.writeFileSync(placarFile, JSON.stringify(store), "utf8");
}

function clampScore(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(20, Math.round(n)));
}

function normalize(raw) {
  const base = emptyPlacar();
  if (!raw || typeof raw !== "object") return base;
  return {
    live: Boolean(raw.live),
    done: Boolean(raw.done),
    us: clampScore(raw.us, 0),
    them: clampScore(raw.them, 0),
  };
}

function payload(store) {
  return {
    ...store,
    home: HOME,
    away: AWAY,
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

export async function handlePlacar(req) {
  const { store, degraded } = await readPlacar();

  if (req.method === "GET") {
    return { json: { ...payload(store), degraded }, status: 200 };
  }
  if (req.method !== "POST") return { json: { error: "method" }, status: 405 };

  let body;
  try {
    body = await readBody(req);
  } catch {
    return { json: { error: "json" }, status: 400 };
  }

  if (!checkAdminPin(body.pin)) return { json: { error: "pin" }, status: 403 };
  if (degraded) return { json: { error: "storage" }, status: 503 };

  const action = String(body.action || "set");
  let next = { ...store };
  if (action === "clear") {
    next = emptyPlacar();
  } else if (action === "live") {
    next.live = true;
    next.done = false;
    if ("us" in body) next.us = clampScore(body.us, next.us);
    if ("them" in body) next.them = clampScore(body.them, next.them);
  } else if (action === "end") {
    next.live = false;
    next.done = true;
    if ("us" in body) next.us = clampScore(body.us, next.us);
    if ("them" in body) next.them = clampScore(body.them, next.them);
  } else {
    if ("us" in body) next.us = clampScore(body.us, next.us);
    if ("them" in body) next.them = clampScore(body.them, next.them);
    if (body.live === true || (!next.done && (next.us > 0 || next.them > 0))) {
      next.live = true;
      next.done = false;
    }
  }

  await savePlacar(next);
  return { json: payload(next), status: 200 };
}
