// Scanner-only background management: scoped to a Discord-owned scanner license.
import { wrap, send, readBody, sb, enc, httpError, requireAccess, storageUpload, storageRemove } from './_lib.js';

const validId = id => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(id || ''));
export default wrap(async (req, res) => {
  if (req.method === 'GET' && req.query.pin) {
    const pin = String(req.query.pin).trim().toUpperCase().slice(0, 12);
    const pins = await sb(`scan_pins?pin=eq.${enc(pin)}&select=license_id`);
    if (!pins?.[0]?.license_id) return send(res, 200, { bg: '' });
    const licenses = await sb(`scanner_licenses?id=eq.${enc(pins[0].license_id)}&revoked_at=is.null&select=scanner_bg`);
    return send(res, 200, { bg: licenses?.[0]?.scanner_bg || '' });
  }
  const user = await requireAccess(req, 'herocheck');
  const b = req.method === 'POST' ? readBody(req) : {};
  const id = String(b.license_id || req.query.license_id || '');
  if (!validId(id)) throw httpError(400, 'Choose a scanner license first');
  const licenses = await sb(`scanner_licenses?id=eq.${enc(id)}&owner_discord=eq.${enc(String(user.id))}&revoked_at=is.null&select=id,scanner_bg`);
  if (!licenses?.length) throw httpError(403, 'Scanner license not found or not yours');
  if (req.method === 'GET') return send(res, 200, { bg: licenses[0].scanner_bg || '' });
  if (req.method === 'POST') {
    const m = /^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i.exec(String(b.image || ''));
    if (!m) throw httpError(400, 'Send a PNG, JPG or GIF image');
    const ext = /png/i.test(m[1]) ? 'png' : /gif/i.test(m[1]) ? 'gif' : 'jpg';
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) throw httpError(400, 'Image too large (max 8 MB)');
    const url = await storageUpload(`scanner-bg/${id}.${ext}`, buf, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    const bg = `${url}?t=${Date.now()}`;
    await sb(`scanner_licenses?id=eq.${enc(id)}&owner_discord=eq.${enc(String(user.id))}`, { method: 'PATCH', body: { scanner_bg: bg } });
    return send(res, 200, { bg });
  }
  if (req.method === 'DELETE') {
    await storageRemove([`scanner-bg/${id}.jpg`, `scanner-bg/${id}.png`, `scanner-bg/${id}.gif`]);
    await sb(`scanner_licenses?id=eq.${enc(id)}&owner_discord=eq.${enc(String(user.id))}`, { method: 'PATCH', body: { scanner_bg: '' } });
    return send(res, 200, { ok: true });
  }
  throw httpError(405, 'Method not allowed');
});
