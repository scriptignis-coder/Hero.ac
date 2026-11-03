import { getSession, send } from './_lib.js';

export default function handler(req, res) {
  const u = getSession(req);
  if (!u) return send(res, 401, { error: 'Not logged in' });
  send(res, 200, { id: u.id, name: u.name, avatar: u.avatar });
}
