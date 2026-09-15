import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkAdminPin } from "./mvp.mjs";

// Feed do Instagram do Bala.
//
// 1. Perfil público do @balademunich — posts novos no mesmo dia.
// 2. Feedframer — CDN estável (plano grátis só atualiza 1×/dia).
// 3. IG_TOKEN da Meta — reserva.
// 4. data.js — piso local.
//
// Quando o Instagram e o Feedframer respondem, o site mistura por shortcode:
// ordem e posts novos vêm do perfil; foto do Feedframer entra se já existir.
// Fotos só do Instagram passam por /api/ig-media pra não quebrar hotlink.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir =
  process.env.DATA_DIR || (process.env.VERCEL ? "/tmp" : path.join(root, "data"));
const keyFile = path.join(dataDir, "insta-key.json");
const BASE = "https://graph.instagram.com";
const FRAMER = "https://feedframer.com/api/v1/me";
const HANDLE = "balademunich";
const IG_APP_ID = "936619743392459";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const CACHE_MS = Number(process.env.IG_CACHE_MS) || 2 * 60 * 1000;
const IG_WEB_MS = Number(process.env.IG_WEB_CACHE_MS) || 5 * 60 * 1000;
const FETCH_MS = 8_000;
const LIMIT = Number(process.env.IG_LIMIT) || 3;
const LOOKAHEAD = Math.max(LIMIT, 12);
const FRAMER_PAGE = 6;
const REFRESH_AFTER_MS = 30 * 24 * 3600 * 1000;
const TOKEN_KEY = "insta:token";
const FRAMER_KEY = "insta:framer-key";

let cache = null;
let inflight = null;
let igWebCache = { at: 0, posts: [] };

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
    timestamp: node.timestamp || "",
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
    timestamp: node.publishedAt || node.published_at || node.timestamp || "",
  };
}

function shortcodeOf(href) {
  const match = String(href || "").match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : "";
}

function queryParam(req, name) {
  const fromQuery = req?.query?.[name];
  if (fromQuery) return Array.isArray(fromQuery) ? String(fromQuery[0]) : String(fromQuery);
  try {
    return new URL(req.url || "/", "http://x").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function allowedImageUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || ""));
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  const ok =
    host === "cdninstagram.com" ||
    host.endsWith(".cdninstagram.com") ||
    host === "fbcdn.net" ||
    host.endsWith(".fbcdn.net");
  return ok ? parsed.toString() : null;
}

function proxySrc(src) {
  const url = String(src || "");
  if (!url || url.startsWith("/")) return url;
  return allowedImageUrl(url) ? `/api/ig-media?u=${encodeURIComponent(url)}` : url;
}

function publicPost(post) {
  return {
    src: proxySrc(post.src),
    alt: post.alt,
    caption: post.caption,
    href: post.href,
    video: Boolean(post.video),
    contain: Boolean(post.contain),
  };
}

function loadSnapshot() {
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "ig-snapshot.json");
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(saved?.posts) ? saved.posts : [];
  } catch {
    return [];
  }
}

function mergePosts(igPosts, ffPosts) {
  const ffBy = new Map();
  for (const post of ffPosts) {
    const code = shortcodeOf(post.href);
    if (code) ffBy.set(code, post);
  }
  const seen = new Set();
  const out = [];
  for (const post of igPosts) {
    const code = shortcodeOf(post.href);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const ff = ffBy.get(code);
    out.push({
      ...post,
      src: ff?.src || post.src,
      video: ff?.video ?? post.video,
    });
  }
  for (const post of ffPosts) {
    const code = shortcodeOf(post.href) || post.href;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(post);
  }
  out.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  return out.map(publicPost);
}

const IG_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "X-IG-App-ID": IG_APP_ID,
  Referer: `https://www.instagram.com/${HANDLE}/`,
};

async function fetchInstagramWeb() {
  const urls = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${HANDLE}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${HANDLE}`,
  ];
  let lastError = "instagram vazio";
  for (const url of urls) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: IG_HEADERS });
      if (!res.ok) {
        lastError = `instagram ${res.status}`;
        if (res.status === 429) break;
        continue;
      }
      const data = await res.json().catch(() => null);
      const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
      const posts = [];
      for (const edge of edges) {
        const node = edge?.node;
        if (!node?.shortcode) continue;
        const src = node.display_url || node.thumbnail_src;
        if (!src) continue;
        const caption = firstLine(node.edge_media_to_caption?.edges?.[0]?.node?.text);
        posts.push({
          src,
          alt: caption,
          caption,
          href: `https://www.instagram.com/p/${node.shortcode}/`,
          video: Boolean(node.is_video),
          timestamp: node.taken_at_timestamp
            ? new Date(node.taken_at_timestamp * 1000).toISOString()
            : "",
        });
        if (posts.length >= LOOKAHEAD) break;
      }
      if (posts.length) return posts;
      lastError = "instagram vazio";
    } catch (err) {
      lastError = err.message || "instagram";
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error(lastError);
}

async function buildInstagramWeb() {
  const now = Date.now();
  if (igWebCache.posts.length && now - igWebCache.at < IG_WEB_MS) {
    return {
      ok: true,
      fonte: "instagram",
      atualizadoEm: new Date(igWebCache.at).toISOString(),
      posts: igWebCache.posts,
    };
  }
  try {
    const posts = await fetchInstagramWeb();
    igWebCache = { at: Date.now(), posts };
    return { ok: true, fonte: "instagram", atualizadoEm: new Date().toISOString(), posts };
  } catch (err) {
    if (igWebCache.posts.length) {
      return {
        ok: true,
        fonte: "instagram",
        atualizadoEm: new Date(igWebCache.at).toISOString(),
        posts: igWebCache.posts,
      };
    }
    throw err;
  }
}

async function buildFeedframer(key, limit = FRAMER_PAGE) {
  const url = new URL(FRAMER);
  url.searchParams.set("api_key", key);
  url.searchParams.set("page[size]", String(Math.min(limit, FRAMER_PAGE)));
  url.searchParams.set("sort", "-published_at");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(graphError(data) || `framer ${res.status}`);
    const posts = (data?.posts || []).map(toFramerPost).filter(Boolean).slice(0, limit);
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
    limit: String(LOOKAHEAD),
    access_token: token,
  });
  const posts = (data?.data || []).map(toPost).filter(Boolean).slice(0, LIMIT).map(publicPost);
  if (!posts.length) throw new Error("feed vazio");
  return { ok: true, fonte: "meta", atualizadoEm: new Date().toISOString(), posts };
}

async function build() {
  const errors = [];
  let ff = { posts: [] };
  let ig = { posts: [] };
  const framerKey = await currentFramerKey();
  const jobs = [];
  if (framerKey) {
    jobs.push(
      buildFeedframer(framerKey)
        .then((out) => {
          ff = out;
        })
        .catch((err) => {
          errors.push(err.message);
          console.error("insta feedframer", err.message);
        })
    );
  }
  jobs.push(
    buildInstagramWeb()
      .then((out) => {
        ig = out;
      })
      .catch((err) => {
        errors.push(err.message);
        console.error("insta web", err.message);
      })
  );
  await Promise.all(jobs);

  const igPosts = ig.posts || [];
  const ffPosts = ff.posts || [];
  const snapPosts = loadSnapshot();
  const primary = igPosts.length ? igPosts : snapPosts;
  const posts = mergePosts(primary, ffPosts).slice(0, LIMIT);
  if (posts.length) {
    const fonte = igPosts.length
      ? ffPosts.length
        ? "instagram+feedframer"
        : "instagram"
      : ffPosts.length
        ? "feedframer"
        : "piso";
    return { ok: true, fonte, atualizadoEm: new Date().toISOString(), posts };
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
  igWebCache = { at: 0, posts: [] };
}

const IG_MEDIA_MAX = 5 * 1024 * 1024;

export async function handleIgMedia(req) {
  const allowed = allowedImageUrl(queryParam(req, "u"));
  if (!allowed) {
    return { status: 400, headers: { "Cache-Control": "no-store" }, json: { error: "url" } };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(allowed, {
      signal: ctrl.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": IG_HEADERS["User-Agent"],
        Referer: `https://www.instagram.com/${HANDLE}/`,
      },
    });
    if (!res.ok) {
      return { status: res.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" }, json: { error: "media" } };
    }
    const length = Number(res.headers.get("content-length") || 0);
    if (length > IG_MEDIA_MAX) {
      return { status: 413, headers: { "Cache-Control": "no-store" }, json: { error: "size" } };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > IG_MEDIA_MAX) {
      return { status: 413, headers: { "Cache-Control": "no-store" }, json: { error: "size" } };
    }
    const type = String(res.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!type.startsWith("image/")) {
      return { status: 502, headers: { "Cache-Control": "no-store" }, json: { error: "type" } };
    }
    return {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
      body: buf,
    };
  } catch {
    return { status: 502, headers: { "Cache-Control": "no-store" }, json: { error: "media" } };
  } finally {
    clearTimeout(t);
  }
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
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
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

  if (action === "refresh") {
    bustFeedCache();
    return { json: await feedAdminStatus(), status: 200 };
  }

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
