import { handleMvp } from "../scripts/mvp.mjs";

export default async function handler(req, res) {
  try {
    const out = await handleMvp(req);
    for (const [key, value] of Object.entries(out.headers || {})) {
      res.setHeader(key, value);
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(out.status).json(out.json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "mvp" });
  }
}
