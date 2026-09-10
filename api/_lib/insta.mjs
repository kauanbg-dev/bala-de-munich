// Feed do Instagram do Bala. A fonte principal é o Feedframer (plano grátis,
// sem marca d'água): eles ligam a conta profissional, renovam o token da Meta
// e hospedam as fotos num CDN que não expira. A chave entra em FEEDFRAMER_KEY.
//
// IG_TOKEN (Business Login da Meta) continua de reserva. As URLs da Meta são
// assinadas e morrem em horas, então o cache fica só em memória. Se as duas
// fontes falharem, o site cai no data.js — imagem local de verdade.

const BASE = "https://graph.instagram.com";
const FRAMER = "https://feedframer.com/api/v1/me";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const CACHE_MS = Number(process.env.IG_CACHE_MS) || 10 * 60 * 1000;
const FETCH_MS = 8_000;
const LIMIT = Number(process.env.IG_LIMIT) || 3;
const REFRESH_AFTER_MS = 30 * 24 * 3600 * 1000;
const TOKEN_KEY = "insta:token";

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
  const framerKey = process.env.FEEDFRAMER_KEY;
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
