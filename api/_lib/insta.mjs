// Feed do Instagram do Bala, via Business Login for Instagram (graph.instagram.com).
// A conta é profissional, então o app serve só ela: não tem fluxo de login aqui,
// o token longo é gerado no painel da Meta e entra por variável de ambiente.
//
// Duas armadilhas que moldam este arquivo:
//   1. As URLs de imagem do CDN da Meta são assinadas e expiram em poucas horas.
//      Por isso o cache é curto e em memória: guardar em disco devolveria link
//      morto, que na tela vira imagem quebrada. Se a busca falha, o site cai no
//      data.js, que tem imagem local de verdade.
//   2. O token longo vale 60 dias. A gente renova sozinho quando passa da
//      metade da validade e guarda o novo no Redis que já existe pro MVP.
//      Sem Redis o site funciona igual, mas alguém precisa trocar o token na
//      Vercel antes dos 60 dias.

const BASE = "https://graph.instagram.com";
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
    if (!res.ok) throw new Error(data?.error?.message || `graph ${res.status}`);
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
  const src = node.media_type === "VIDEO" ? node.thumbnail_url : node.media_url || node.thumbnail_url;
  if (!src) return null;
  const caption = firstLine(node.caption);
  return {
    src,
    alt: caption,
    caption,
    href: node.permalink,
    video: node.media_type === "VIDEO",
  };
}

async function build() {
  const token = await currentToken();
  if (!token) throw new Error("sem IG_TOKEN");
  const data = await callGraph("me/media", {
    fields: FIELDS,
    limit: String(Math.max(LIMIT, 6)),
    access_token: token,
  });
  const posts = (data?.data || []).map(toPost).filter(Boolean).slice(0, LIMIT);
  if (!posts.length) throw new Error("feed vazio");
  return { ok: true, atualizadoEm: new Date().toISOString(), posts };
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
