// Scanner background: staff upload an image on the dashboard; the scanner .exe
// fetches it by PIN and shows it behind the scan UI. Private to the owner's PINs.
import { wrap, send, readBody, sb, enc, httpError, requireUser, requireOwnedServer, storageUpload, storageRemove } from './_lib.js';

export default wrap(async (req, res) => {
  // the scanner fetches its background by PIN (no session)
  if (req.method === 'GET' && req.query.pin) {
    const pin = String(req.query.pin).trim().toUpperCase().slice(0, 12);
    const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=server_id`);
    if (!rows || !rows.length) return send(res, 200, { bg: '' });
    const srv = await sb(`servers?id=eq.${rows[0].server_id}&select=settings`);
    const bg = (srv && srv[0] && srv[0].settings && srv[0].settings.scanner_bg) || '';
    return send(res, 200, { bg });
  }

  const user = requireUser(req);

  if (req.method === 'GET') {
    const server = await requireOwnedServer(user, req.query.server);
    return send(res, 200, { bg: (server.settings && server.settings.scanner_bg) || '' });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    const server = await requireOwnedServer(user, b.server);
    const m = /^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i.exec(String(b.image || ''));
    if (!m) throw httpError(400, 'Send a PNG, JPG or GIF image');
    const ext = /png/i.test(m[1]) ? 'png' : /gif/i.test(m[1]) ? 'gif' : 'jpg';
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) throw httpError(400, 'Image too large (max 8 MB)');
    const url = await storageUpload(`scanner-bg/${server.id}.${ext}`, buf, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    const settings = Object.assign({}, server.settings || {}, { scanner_bg: `${url}?t=${Date.now()}` });
    await sb(`servers?id=eq.${server.id}`, { method: 'PATCH', body: { settings } });
    return send(res, 200, { bg: settings.scanner_bg });
  }

  if (req.method === 'DELETE') {
    const server = await requireOwnedServer(user, req.query.server);
    await storageRemove([`scanner-bg/${server.id}.jpg`, `scanner-bg/${server.id}.png`, `scanner-bg/${server.id}.gif`]);
    const settings = Object.assign({}, server.settings || {}, { scanner_bg: '' });
    await sb(`servers?id=eq.${server.id}`, { method: 'PATCH', body: { settings } });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
