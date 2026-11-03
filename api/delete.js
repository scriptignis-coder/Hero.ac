const { getSession, sb } = require("./_lib");
// POST { name } -> supprime le serveur + sa cle + ses donnees (proprietaire uniquement)
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const name = (b?.name || "").toString().trim();
  if (!name) return res.status(400).json({ error: "nom requis" });
  const enc = encodeURIComponent(name);
  try {
    const lic = await sb(`hs_licenses?server_name=eq.${enc}&owner_id=eq.${s.id}&select=key`);
    if (!lic || !lic.length) return res.status(403).json({ error: "pas a toi" });
    const del = { method: "DELETE", headers: { Prefer: "return=minimal" } };
    await sb(`hs_licenses?server_name=eq.${enc}&owner_id=eq.${s.id}`, del).catch(() => {});
    await sb(`hs_servers?name=eq.${enc}`, del).catch(() => {});
    await sb(`hs_bans?server_name=eq.${enc}`, del).catch(() => {});
    await sb(`hs_logs?server_name=eq.${enc}`, del).catch(() => {});
    await sb(`hs_players?server_name=eq.${enc}`, del).catch(() => {});
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
