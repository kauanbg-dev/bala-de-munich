import { handleFeed } from "./_lib/insta.mjs";

export default async function handler(req, res) {
  try {
    const out = await handleFeed(req);
    for (const [key, value] of Object.entries(out.headers || {})) {
      res.setHeader(key, value);
    }
    if (!out.headers?.["Cache-Control"]) res.setHeader("Cache-Control", "no-store");
    res.status(out.status).json(out.json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: err.message || "feed" });
  }
}
