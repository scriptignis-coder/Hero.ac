const { ingestLicense, body, sb, touchServer } = require("../_lib");
// POST /api/ingest/ban (header X-Ingest-Token = cle du serveur)
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  const lic = await ingestLicense(req);
  if (!lic) return res.status(401).json({ error: "cle invalide" });
  const b = body(req);
  const server = lic.server_name;
  try {
    await touchServer(server);
    await sb(`hs_bans`, { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        server_name: server, type: b.type || null, player_name: b.name || null,
        identifier: b.identifier || null, reason: b.reason || null, detail: b.detail || null,
        ban_id: b.banId ? String(b.banId) : null, expires: b.expires || 0, screenshot: b.screenshot || null
      }) });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
