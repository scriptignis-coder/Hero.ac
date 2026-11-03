const { ingestLicense, body, sb, touchServer } = require("../_lib");
// POST /api/ingest/log (header X-Ingest-Token = cle du serveur)
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  const lic = await ingestLicense(req);
  if (!lic) return res.status(401).json({ error: "cle invalide" });
  const b = body(req);
  try {
    await touchServer(lic.server_name);
    await sb(`hs_logs`, { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ server_name: lic.server_name, type: b.type || "info", detail: (b.detail || "").toString().slice(0, 400) }) });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
