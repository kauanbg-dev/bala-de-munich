import { getLivesStatus } from "./_lib/lives.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  try {
    const data = await getLivesStatus(req);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=30");
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: err.message || "lives" });
  }
}
