// POST (FiveM, x-license) {action:'open', identifier} -> upload url
// GET  (dashboard)        ?server=&identifier=      -> latest jpeg frame
import { wrap, send, readBody, requireLicense, requireUser, requireOwnedServer, httpError, str } from './_lib.js';
import { openStream, getFrame } from './_stream.js';

export default wrap(async (req, res) => {
  if (req.method === 'POST') {
    const server = await requireLicense(req);
    const b = readBody(req);
    if (b.action !== 'open') throw httpError(400, 'Invalid action');
    const identifier = str(b.identifier, 120);
    if (!identifier) throw httpError(400, 'Missing identifier');
    const key = openStream(server.id, identifier);
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const wsProto = proto === 'http' ? 'ws' : 'wss';
    return send(res, 200, {
      url: `${wsProto}://${host}/ws/pub?k=${key}`,          // live WebSocket (NUI game view)
      upload: `${proto}://${host}/api/stream/upload?k=${key}`, // fallback (screenshot-basic)
    });
  }

  const user = requireUser(req);
  const server = await requireOwnedServer(user, req.query.server);
  const frame = getFrame(server.id, str(req.query.identifier, 120));
  if (!frame) return send(res, 404, { error: 'No frame yet' });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame', String(frame.n));
  res.setHeader('X-Frame-Age', String(Date.now() - frame.ts));
  res.end(frame.buf);
});
