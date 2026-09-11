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

function slugsFrom(req, key) {
  const url = new URL(req.url || "/", "http://x");
  return [...new Set(String(url.searchParams.get(key) || "").split(",").map(cleanSlug).filter(Boolean))].slice(0, MAX);
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

async function twitchStatus(slug) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    // Client-ID público do próprio site da Twitch: dá pra saber se o canal
    // está no ar sem cadastrar app. Se a Twitch mudar, o card só fica offline.
    const res = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Client-ID": process.env.TWITCH_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko",
      },
      body: JSON.stringify({
        query: `query($login:String!){user(login:$login){stream{id title}}}`,
        variables: { login: slug },
      }),
    });
    if (!res.ok) return { slug, live: false };
    const data = await res.json();
    const stream = data?.data?.user?.stream;
    if (!stream) return { slug, live: false };
    return { slug, live: true, title: String(stream.title || "").slice(0, 80) };
  } catch {
    return { slug, live: false };
  } finally {
    clearTimeout(t);
  }
}

function putLive(map, kind, row) {
  const slug = String(row.slug || "").toLowerCase();
  map[`${kind}:${slug}`] = row;
  if (!map[slug]) map[slug] = row;
}

async function build(kickSlugs, twitchSlugs) {
  const rows = await Promise.all([
    ...kickSlugs.map(kickStatus),
    ...twitchSlugs.map(twitchStatus),
  ]);
  const live = {};
  kickSlugs.forEach((slug, i) => putLive(live, "kick", rows[i]));
  twitchSlugs.forEach((slug, i) => putLive(live, "twitch", rows[kickSlugs.length + i]));
  return { ok: true, atualizadoEm: new Date().toISOString(), live };
}

export async function getLivesStatus(req) {
  const kickSlugs = slugsFrom(req, "c").sort();
  const twitchSlugs = slugsFrom(req, "t").sort();
  if (!kickSlugs.length && !twitchSlugs.length) return { ok: true, live: {} };
  const key = `k:${kickSlugs.join(",")}|t:${twitchSlugs.join(",")}`;
  const now = Date.now();
  if (cache?.key === key && now - cache.at < CACHE_MS) return cache.payload;
  if (inflight?.key === key) return inflight.job;
  const job = build(kickSlugs, twitchSlugs)
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
