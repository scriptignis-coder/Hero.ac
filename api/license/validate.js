const { sb } = require("../_lib");
// GET ?key=... -> { valid: bool }  (appele par le resource au demarrage)
module.exports = async (req, res) => {
  const key = req.query?.key;
  if (!key) return res.status(200).json({ valid: false });
  try {
    // si aucune licence enregistree -> mode ouvert (valid=true) pour demarrer sans friction
    const all = await sb(`hs_licenses?select=key&limit=1`);
    if (!all || all.length === 0) return res.status(200).json({ valid: true, open: true });
    const row = await sb(`hs_licenses?key=eq.${encodeURIComponent(key)}&active=eq.true&select=key`);
    return res.status(200).json({ valid: !!(row && row.length) });
  } catch (e) {
    // en cas d'erreur backend, ne bloque pas le serveur du client
    return res.status(200).json({ valid: true, error: e.message });
  }
};
