// Public feed the scanner fetches by PIN: the owning account's signatures, mapped to
// the shape the scanner expects (name, fileNames, features, domains, hashes, severity).
import { wrap, send, sb, enc } from './_lib.js';

export default wrap(async (req, res) => {
  const pin = String(req.query.pin || '').trim().toUpperCase().slice(0, 12);
  if (!pin) return send(res, 200, []);
  const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=server_id,license_id`);
  if (!rows || !rows.length) return send(res, 200, []);
  // owner of the PIN: through its scanner license (scanner-only accounts) or its FiveM server (older PINs)
  let owner = null;
  if (rows[0].license_id) {
    const lic = await sb(`scanner_licenses?id=eq.${enc(rows[0].license_id)}&select=owner_discord`);
    owner = lic?.[0]?.owner_discord || null;
  } else if (rows[0].server_id) {
    const srv = await sb(`servers?id=eq.${enc(rows[0].server_id)}&select=owner_discord`);
    owner = srv?.[0]?.owner_discord || null;
  }
  if (!owner) return send(res, 200, []);
  const sigs = await sb(`signatures?owner_discord=eq.${enc(owner)}&select=name,file_names,features,domains,hashes,severity,games`)
    .catch(() => sb(`signatures?owner_discord=eq.${enc(owner)}&select=name,file_names,features,domains,hashes,severity`));   // before v30 SQL
  const out = (sigs || []).map((s) => ({
    name: s.name,
    fileNames: s.file_names || [],
    features: s.features || [],
    domains: s.domains || [],
    hashes: s.hashes || [],
    severity: s.severity || 'high',
    games: s.games || [],      // empty = every game; the scanner keeps only the PIN's game
  }));
  send(res, 200, out);
});
