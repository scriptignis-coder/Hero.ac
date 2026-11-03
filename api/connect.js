const { getSession, sb, newKey } = require("./_lib");
// POST { name } -> cree un serveur + une cle unique pour le proprietaire connecte
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const name = (b?.name || "").toString().trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "nom du serveur requis" });
  try {
    const key = newKey();
    await sb(`hs_licenses`, { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ key, server_name: name, owner_id: s.id, active: true }) });
    await sb(`hs_servers?on_conflict=name`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ name, online: 0, max: 0, last_seen: new Date().toISOString() }) });
    res.status(200).json({ ok: true, name, key });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
