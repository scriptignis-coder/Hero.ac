// Public feed the scanner fetches by PIN: the operator's memory strings.
// Same PIN → owner resolution as api/scanner-sigs.js.
//
// The scanner reads these with Core/MemoryStrings.cs and looks for each string inside the process
// it names, while it is already reading that process's memory — so this costs no extra scan time.
import { wrap, send, sb, enc } from './_lib.js';

export default wrap(async (req, res) => {
  const pin = String(req.query.pin || '').trim().toUpperCase().slice(0, 12);
  if (!pin) return send(res, 200, []);

  const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=server_id,license_id`);
  if (!rows || !rows.length) return send(res, 200, []);

  let owner = null;
  if (rows[0].license_id) {
    const lic = await sb(`scanner_licenses?id=eq.${enc(rows[0].license_id)}&select=owner_discord`);
    owner = lic?.[0]?.owner_discord || null;
  } else if (rows[0].server_id) {
    const srv = await sb(`servers?id=eq.${enc(rows[0].server_id)}&select=owner_discord`);
    owner = srv?.[0]?.owner_discord || null;
  }
  if (!owner) return send(res, 200, []);

  // before the V31 migration this table does not exist: an empty feed, not an error, so an
  // older database keeps scanning normally
  const list = await sb(`memory_strings?owner_discord=eq.${enc(owner)}&select=process_name,client_name,string,severity&limit=500`)
    .catch(() => null);

  return send(res, 200, (list || []).map((r) => ({
    process: r.process_name,
    label: r.client_name || '',
    string: r.string,
    severity: r.severity === 'warning' ? 'warning' : 'detect',
  })));
});
