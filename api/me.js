import { getSession, send, sb, getAccess } from './_lib.js';

// Who is logged in + what they can open (HeRo Shield / HeRo Check / admin).
export default async function handler(req, res) {
  const u = getSession(req);
  if (!u) return send(res, 401, { error: 'Not logged in' });

  // remember everyone who logs in, so the admin can give them access on the Access page
  // (merge-duplicates only updates these columns — never the permissions)
  sb('user_access?on_conflict=discord_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { discord_id: String(u.id), name: u.name || null, avatar: u.avatar || null, last_login: new Date().toISOString() },
  }).catch(() => {});

  const access = await getAccess(u);
  send(res, 200, { id: u.id, name: u.name, avatar: u.avatar, access });
}
