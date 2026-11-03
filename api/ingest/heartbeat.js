const { ingestLicense, body, touchServer } = require("../_lib");
// POST /api/ingest/heartbeat (header X-Ingest-Token = cle du serveur) { online, max }
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  const lic = await ingestLicense(req);
  if (!lic) return res.status(401).json({ error: "cle invalide" });
  const b = body(req);
  try {
    await touchServer(lic.server_name, { online: b.online || 0, max: b.max || 0 });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
