import { getCopaLive } from "./_lib/copa.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  try {
    const live = await getCopaLive();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=90");
    res.status(200).json(live);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: err.message || "copa" });
  }
}
