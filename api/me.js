import { wrap, getSession, send, getAccess } from './_lib.js';

export default wrap(async (req, res) => {
  const u = getSession(req);
  if (!u) return send(res, 401, { error: 'Not logged in' });
  const access = await getAccess(u);
  send(res, 200, { id: u.id, name: u.name, avatar: u.avatar, access });
});
