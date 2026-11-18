import { getSession, send, sb, getAccess } from './_lib.js';

// Who is logged in + what they can open (HeRo Shield / HeRo Check / admin).
export default async function handler(req, res) {
  const u = getSession(req);
  if (!u) return send(res, 401, { error: 'Not logged in' });

  // remember everyone who logs in, so the admin can give them access on the Access page
  // (merge-duplicates only updates these columns — never the permissions)
  if (!String(u.id).startsWith('email:')) sb('user_access?on_conflict=discord_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { discord_id: String(u.id), name: u.name || null, avatar: u.avatar || null, last_login: new Date().toISOString() },
  }).catch(() => {});

  // Settle any scan that was killed, then answer. This runs on every dashboard load, so a
  // blacklist lands the moment the person comes back to look — they do not have to ask for
  // another PIN first. It is also the one request every blocked account is guaranteed to make.
  try {
    const { sweepAbandoned, blacklistOf } = await import('./_abuse.js');
    const own = await sb(`scanner_licenses?owner_discord=eq.${encodeURIComponent(String(u.id))}&select=id`)
      .catch(() => []);
    if (own?.length) await sweepAbandoned({ ownerDiscord: u.id, licenseIds: own.map((x) => x.id) });

    const banned = await blacklistOf(u.id);
    if (banned) return send(res, 403, {
      error: 'This account is blacklisted. ' + (banned.reason || '')
           + ' If you believe this is wrong, open a ticket — staff can lift it.',
      blacklisted: true, blacklistReason: banned.reason || null,
    });
  } catch { }

  const access = await getAccess(u);
  // when a timed permission ends (null = lifetime / from Render env)
  let expires_at = null;
  try { const r = await sb(`user_access?discord_id=eq.${encodeURIComponent(String(u.id))}&select=expires_at`); expires_at = r?.[0]?.expires_at || null; } catch { }
  send(res, 200, { id: u.id, name: u.name, avatar: u.avatar, access, expires_at });
}
