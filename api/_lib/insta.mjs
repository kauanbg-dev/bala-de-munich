import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkAdminPin } from "./mvp.mjs";

// Feed do Instagram do Bala. A fonte principal é o Feedframer (plano grátis,
// sem marca d'água): eles ligam a conta profissional, renovam o token da Meta
// e hospedam as fotos num CDN que não expira. A chave entra no painel admin
// (?admin) ou em FEEDFRAMER_KEY na Vercel. A do painel manda.
//
// IG_TOKEN (Business Login da Meta) continua de reserva. As URLs da Meta são
// assinadas e morrem em horas, então o cache fica só em memória. Se as duas
// fontes falharem, o site cai no data.js — imagem local de verdade.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir =
  process.env.DATA_DIR || (process.env.VERCEL ? "/tmp" : path.join(root, "data"));
const keyFile = path.join(dataDir, "insta-key.json");
const BASE = "https://graph.instagram.com";
const FRAMER = "https://feedframer.com/api/v1/me";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const CACHE_MS = Number(process.env.IG_CACHE_MS) || 10 * 60 * 1000;
const FETCH_MS = 8_000;
const LIMIT = Number(process.env.IG_LIMIT) || 3;
const REFRESH_AFTER_MS = 30 * 24 * 3600 * 1000;
const TOKEN_KEY = "insta:token";
const FRAMER_KEY = "insta:framer-key";

let cache = null;
let inflight = null;

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function kvCommand(parts) {
  const kv = kvConfig();
  if (!kv) return null;
  const res = await fetch(kv.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(parts),
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  return await res.json();
}

async function readStoredToken() {
  try {
    const out = await kvCommand(["GET", TOKEN_KEY]);
    if (!out?.result) return null;
    const saved = JSON.parse(out.result);
    return saved?.token ? saved : null;
  } catch (err) {
    console.error("insta token read", err.message);
    return null;
  }
}

async function writeStoredToken(token) {
  try {
    await kvCommand(["SET", TOKEN_KEY, JSON.stringify({ token, at: Date.now() })]);
  } catch (err) {
    console.error("insta token write", err.message);
  }
}

function readKeyFile() {
  try {
    const saved = JSON.parse(fs.readFileSync(keyFile, "utf8"));
    return saved?.key ? String(saved.key) : null;
  } catch {
    return null;
  }
}

function writeKeyFile(key) {
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  if (!key) {
    try {
      fs.unlinkSync(keyFile);
    } catch {
      /* já não existia */
    }
    return;
  }
  fs.writeFileSync(keyFile, JSON.stringify({ key, at: Date.now() }));
}

async function readStoredFramerKey() {
  try {
    const out = await kvCommand(["GET", FRAMER_KEY]);
    if (out?.result) {
      const saved = JSON.parse(out.result);
      if (saved?.key) return String(saved.key);
    }
  } catch (err) {
    console.error("insta framer read", err.message);
  }
  return readKeyFile();
}

async function writeStoredFramerKey(key) {
  const value = key ? JSON.stringify({ key, at: Date.now() }) : null;
  try {
    if (kvConfig()) await kvCommand(value ? ["SET", FRAMER_KEY, value] : ["DEL", FRAMER_KEY]);
  } catch (err) {
    console.error("insta framer write", err.message);
  }
  writeKeyFile(key);
}

async function currentFramerKey() {
  return (await readStoredFramerKey()) || process.env.FEEDFRAMER_KEY || "";
}

function maskKey(key) {
  const text = String(key || "");
  if (text.length < 10) return "salva";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

async function callGraph(path, params, timeoutMs = FETCH_MS) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(graphError(data) || `graph ${res.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

// Renovar exige token com mais de 24h e ainda válido. Falha aqui não é fatal:
// o token atual continua servindo até vencer de fato.
async function currentToken() {
  const envToken = process.env.IG_TOKEN;
  const stored = await readStoredToken();
  const token = stored?.token || envToken;
  if (!token) return null;
  const age = stored?.at ? Date.now() - stored.at : null;
  const stale = age === null || age > REFRESH_AFTER_MS;
  if (!stale) return token;
  try {
    const out = await callGraph("refresh_access_token", {
      grant_type: "ig_refresh_token",
      access_token: token,
    });
    if (out?.access_token) {
      await writeStoredToken(out.access_token);
      return out.access_token;
    }
  } catch (err) {
    console.error("insta refresh", err.message);
  }
  return token;
}

function graphError(data) {
  return data?.error?.message || data?.message || data?.error || data?.errors?.[0]?.detail || null;
}

function firstLine(caption) {
  const text = String(caption || "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  if (!text) return "Instagram";
  return text.length > 64 ? `${text.slice(0, 63).trimEnd()}…` : text;
}

function toPost(node) {
  // Vídeo e reel não trazem imagem em media_url: a capa vem no thumbnail_url.
  const src = isVideo(node.media_type) ? node.thumbnail_url : node.media_url || node.thumbnail_url;
  if (!src) return null;
  const caption = firstLine(node.caption);
  return {
    src,
    alt: caption,
    caption,
    href: node.permalink,
    video: isVideo(node.media_type),
  };
}

function isVideo(type) {
  const kind = String(type || "").toUpperCase();
  return kind === "VIDEO" || kind === "REELS";
}

function toFramerPost(node) {
  const video = isVideo(node?.mediaType || node?.type);
  const src = video ? node.thumbnailUrl || node.mediaUrl : node.mediaUrl || node.thumbnailUrl;
  if (!src) return null;
  const caption = firstLine(node.caption);
  return {
    src,
    alt: caption,
    caption,
    href: node.permalink,
    video,
  };
}

async function buildFeedframer(key) {
  const url = new URL(FRAMER);
  url.searchParams.set("api_key", key);
  url.searchParams.set("page[size]", String(Math.max(LIMIT, 6)));
  url.searchParams.set("sort", "-published_at");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(graphError(data) || `framer ${res.status}`);
    const posts = (data?.posts || []).map(toFramerPost).filter(Boolean).slice(0, LIMIT);
    if (!posts.length) throw new Error("feed vazio");
    return { ok: true, fonte: "feedframer", atualizadoEm: new Date().toISOString(), posts };
  } finally {
    clearTimeout(t);
  }
}

async function buildMeta() {
  const token = await currentToken();
  if (!token) throw new Error("sem IG_TOKEN");
  const data = await callGraph("me/media", {
    fields: FIELDS,
    limit: String(Math.max(LIMIT, 6)),
    access_token: token,
  });
  const posts = (data?.data || []).map(toPost).filter(Boolean).slice(0, LIMIT);
  if (!posts.length) throw new Error("feed vazio");
  return { ok: true, fonte: "meta", atualizadoEm: new Date().toISOString(), posts };
}

async function build() {
  const errors = [];
  const framerKey = await currentFramerKey();
  if (framerKey) {
    try {
      return await buildFeedframer(framerKey);
    } catch (err) {
      errors.push(err.message);
      console.error("insta feedframer", err.message);
    }
  }
  try {
    return await buildMeta();
  } catch (err) {
    errors.push(err.message);
  }
  throw new Error(errors.filter(Boolean).join("; ") || "sem fonte de feed");
}

export async function getInstaFeed() {
  const now = Date.now();
  if (cache?.payload && now - cache.at < CACHE_MS) return cache.payload;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const payload = await build();
      cache = { payload, at: Date.now() };
      return payload;
    } catch (err) {
      console.error("insta sync", err.message);
      // Sem cache de erro: o data.js assume e o site continua com as fotos locais.
      return { ok: false, erro: err.message };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function bustFeedCache() {
  cache = null;
  inflight = null;
}

export async function feedAdminStatus() {
  const stored = await readStoredFramerKey();
  const env = Boolean(process.env.FEEDFRAMER_KEY);
  const live = await getInstaFeed();
  const fonte = live?.ok ? live.fonte : "piso";
  return {
    ok: true,
    stored: Boolean(stored),
    env,
    origem: stored ? "painel" : env ? "vercel" : null,
    live: Boolean(live?.ok),
    fonte,
    mascara: stored ? maskKey(stored) : env ? "variável da Vercel" : null,
  };
}

export async function handleFeed(req) {
  if (req.method === "GET") {
    return {
      json: await getInstaFeed(),
      status: 200,
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300" },
    };
  }
  if (req.method !== "POST") return { json: { error: "method" }, status: 405 };

  let body;
  try {
    body = await readBody(req);
  } catch {
    return { json: { error: "json" }, status: 400 };
  }
  if (!checkAdminPin(body.pin)) return { json: { error: "pin" }, status: 403 };

  const action = String(body.action || "");
  if (action === "status") return { json: await feedAdminStatus(), status: 200 };

  if (action === "save") {
    const key = String(body.key || "").trim();
    if (key.length < 16) return { json: { error: "key", erro: "chave curta" }, status: 400 };
    try {
      await buildFeedframer(key);
    } catch (err) {
      return { json: { error: "framer", erro: err.message }, status: 400 };
    }
    await writeStoredFramerKey(key);
    bustFeedCache();
    return { json: await feedAdminStatus(), status: 200 };
  }

  if (action === "clear") {
    await writeStoredFramerKey("");
    bustFeedCache();
    return { json: await feedAdminStatus(), status: 200 };
  }

  return { json: { error: "action" }, status: 400 };
}
