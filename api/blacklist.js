import { wrap, send, requireAccess, readBody, sb, enc, str, httpError, audit } from './_lib.js';

// The blacklist, for staff: see who is on it, why, and lift it.
//
// Lifting sets lifted_at rather than deleting the row, so the history stays: an account that
// was blacklisted twice is worth knowing about, and a deleted row tells you nothing.

export default wrap(async (req, res) => {
  const user = await requireAccess(req, 'admin');

  if (req.method === 'GET') {
    const [rows, recent] = await Promise.all([
      sb('hs_blacklist?order=created_at.desc&limit=200&select=*').catch(() => []),
      sb('hs_abandoned_scans?order=noticed_at.desc&limit=100&select=*').catch(() => []),
    ]);
    let threshold = 3;
    try {
      const t = await sb('hs_settings?key=eq.abuse_threshold&select=value&limit=1');
      threshold = parseInt(t?.[0]?.value ?? '3', 10);
    } catch { }
    return send(res, 200, { blacklist: rows || [], abandoned: recent || [], threshold });
  }

  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const b = readBody(req);

  // ── lift a block ──────────────────────────────────────────────────────────
  if (b.action === 'lift') {
    const id = str(b.discord_id, 32);
    if (!id) throw httpError(400, 'discord_id required');
    await sb(`hs_blacklist?discord_id=eq.${enc(id)}&lifted_at=is.null`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: { lifted_at: new Date().toISOString(), lifted_by: String(user.id) },
    });
    // clear the record too, so the same old scans cannot trip the threshold again tomorrow
    await sb(`hs_abandoned_scans?owner_discord=eq.${enc(id)}`, { method: 'DELETE' }).catch(() => {});
    await audit(user, 'blacklist.lift', { target: id });
    return send(res, 200, { ok: true });
  }

  // ── block somebody by hand ────────────────────────────────────────────────
  if (b.action === 'add') {
    const id = str(b.discord_id, 32);
    if (!id) throw httpError(400, 'discord_id required');
    const reason = str(b.reason, 300) || 'Blacklisted by staff.';
    await sb(`hs_blacklist?discord_id=eq.${enc(id)}`, { method: 'DELETE' }).catch(() => {});
    await sb('hs_blacklist', { method: 'POST', prefer: 'return=minimal',
      body: { discord_id: id, reason, created_by: String(user.id) } });
    await audit(user, 'blacklist.add', { target: id, detail: { reason } });
    return send(res, 200, { ok: true });
  }

  // ── how many abandoned scans before the block is automatic ────────────────
  if (b.action === 'threshold') {
    const n = Math.max(0, Math.min(50, parseInt(b.value, 10) || 0));
    await sb('hs_settings', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { key: 'abuse_threshold', value: String(n) } });
    await audit(user, 'blacklist.threshold', { detail: { value: n } });
    return send(res, 200, { ok: true, threshold: n });
  }

  throw httpError(400, 'Unknown action');
});
