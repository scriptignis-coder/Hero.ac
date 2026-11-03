const { ingestLicense, body, sb, touchServer } = require("../_lib");
// POST /api/ingest/player (header X-Ingest-Token = cle du serveur) { identifier, name, online, add_sec }
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  const lic = await ingestLicense(req);
  if (!lic) return res.status(401).json({ error: "cle invalide" });
  const b = body(req);
  const id = b.identifier; const srv = lic.server_name;
  if (!id) return res.status(400).json({ error: "identifier" });
  try {
    await touchServer(srv);
    let total = 0;
    const cur = await sb(`hs_players?server_name=eq.${encodeURIComponent(srv)}&identifier=eq.${encodeURIComponent(id)}&select=playtime_sec`);
    if (cur && cur.length) total = Number(cur[0].playtime_sec) || 0;
    total += Math.max(0, parseInt(b.add_sec || 0, 10));
    await sb(`hs_players?on_conflict=server_name,identifier`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ server_name: srv, identifier: id, name: b.name || null, playtime_sec: total, online: !!b.online, last_seen: new Date().toISOString() }) });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
