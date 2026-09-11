const CACHE_MS = Number(process.env.LIVES_CACHE_MS) || 45_000;
const FETCH_MS = 5_000;
const MAX = 20;

let cache = null;
let inflight = null;

function cleanSlug(raw) {
  const slug = String(raw || "").trim();
  if (!slug || slug.length > 32) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  return slug;
}

function slugsFrom(req) {
  const url = new URL(req.url || "/", "http://x");
  return [...new Set(String(url.searchParams.get("c") || "").split(",").map(cleanSlug).filter(Boolean))].slice(0, MAX);
}

async function kickStatus(slug) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "BalaDeMunichSite/1.0 (+lives)",
      },
    });
    if (!res.ok) return { slug, live: false };
    const data = await res.json();
    const stream = data?.livestream;
    if (!stream) return { slug, live: false };
    return {
      slug,
      live: true,
      viewers: Number(stream.viewer_count) || 0,
      title: String(stream.session_title || "").slice(0, 80),
    };
  } catch {
    return { slug, live: false };
  } finally {
    clearTimeout(t);
  }
}

async function build(slugs) {
  const rows = await Promise.all(slugs.map(kickStatus));
  const live = {};
  for (const row of rows) live[row.slug.toLowerCase()] = row;
  return { ok: true, atualizadoEm: new Date().toISOString(), live };
}

export async function getLivesStatus(req) {
  const slugs = slugsFrom(req).sort();
  if (!slugs.length) return { ok: true, live: {} };
  const key = slugs.join(",");
  const now = Date.now();
  if (cache?.key === key && now - cache.at < CACHE_MS) return cache.payload;
  if (inflight?.key === key) return inflight.job;
  const job = build(slugs)
    .then((payload) => {
      cache = { key, payload, at: Date.now() };
      return payload;
    })
    .finally(() => {
      if (inflight?.key === key) inflight = null;
    });
  inflight = { key, job };
  return job;
}
