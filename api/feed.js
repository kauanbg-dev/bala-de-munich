import { getInstaFeed } from "./_lib/insta.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  try {
    const feed = await getInstaFeed();
    // Cache curto: as URLs de imagem da Meta são assinadas e expiram.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    res.status(200).json(feed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: err.message || "feed" });
  }
}
