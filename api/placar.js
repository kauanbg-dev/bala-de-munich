import { handlePlacar } from "./_lib/placar.mjs";

export default async function handler(req, res) {
  try {
    const out = await handlePlacar(req);
    res.setHeader("Cache-Control", "no-store");
    res.status(out.status).json(out.json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "placar" });
  }
}
