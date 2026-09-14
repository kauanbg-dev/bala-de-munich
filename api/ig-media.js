import { handleIgMedia } from "./_lib/insta.mjs";

export default async function handler(req, res) {
  try {
    const out = await handleIgMedia(req);
    for (const [key, value] of Object.entries(out.headers || {})) {
      res.setHeader(key, value);
    }
    if (out.json) {
      res.status(out.status).json(out.json);
      return;
    }
    res.status(out.status).send(out.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "media" });
  }
}
