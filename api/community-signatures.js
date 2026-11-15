import { wrap, send, requireAccess, readBody, sb, enc, str, httpError, audit } from './_lib.js';
import { GAMES } from './_games.js';

// The shared signature list. Everyone with a license can read it and add to it.
//
// A row here never reaches a scanner by itself: api/scanner-sigs.js still serves only the
// owner's OWN signatures. "Add to mine" copies the row into that owner's list, which is the
// moment they take responsibility for it. See MIGRATION-COMMUNITY-SIGNATURES-V30.sql.

const toList = (v) => (Array.isArray(v)
  ? v.map((x) => str(x, 120))
  : String(v || '').split(',').map((x) => x.trim())).filter(Boolean);

// Files that belong to the game, to Windows, or to the scanner itself. A signature naming one
// of these would make every clean PC look infected — exactly what happened when the game's own
// CitizenFX.FiveM.Native.dll was added as a signature by mistake.
const PROTECTED_NAMES = [
  /^citizenfx\./i, /^citizen-/i, /^cfx-/i, /^fivem/i, /^redm/i, /^gta5\.exe$/i, /^gtavlauncher\.exe$/i,
  /^mscorlib\.dll$/i, /^netstandard\.dll$/i, /^system\./i, /^microsoft\./i, /^mono\./i,
  /^kernel32\.dll$/i, /^ntdll\.dll$/i, /^user32\.dll$/i, /^explorer\.exe$/i, /^svchost\.exe$/i,
  /^discord\.exe$/i, /^steam\.exe$/i, /^chrome\.exe$/i, /^msedge\.exe$/i, /^heroshield/i,
];
const PROTECTED_DOMAINS = [
  'discord.com', 'discord.gg', 'steampowered.com', 'rockstargames.com', 'cfx.re', 'fivem.net',
  'google.com', 'microsoft.com', 'github.com', 'heroshield.store', 'onrender.com',
];

function reject(row) {
  for (const f of row.file_names) {
    if (PROTECTED_NAMES.some((rx) => rx.test(f)))
      return `"${f}" is a file the game, Windows or the scanner ships. A signature on it would flag every clean PC.`;
    // the name without its extension has to be long enough to mean something:
    // "a.dll", "x.exe", "run.exe" would match somebody's harmless file somewhere
    const stem = f.replace(/\.[a-z0-9]{1,5}$/i, '');
    if (stem.length < 4) return `"${f}" is too short to identify anything on its own.`;
  }
  for (const d of row.domains) {
    if (PROTECTED_DOMAINS.some((p) => d === p || d.endsWith('.' + p)))
      return `"${d}" is a normal service, not a cheat site.`;
    if (!d.includes('.')) return `"${d}" is not a domain.`;
  }
  for (const h of row.hashes) if (!/^[a-f0-9]{32,64}$/.test(h)) return `"${h}" is not a SHA-256 hash.`;
  return null;
}

export default wrap(async (req, res) => {
  const user = await requireAccess(req, 'herocheck');

  if (req.method === 'GET') {
    const mineOnly = String(req.query.mine || '') === '1';
    const q = mineOnly ? `&author_discord=eq.${enc(user.id)}` : '&hidden=is.false';
    const rows = await sb(`community_signatures?select=*${q}&order=created_at.desc&limit=300`);
    // which ones this user already copied, so the page can show "Added" instead of a button
    const own = await sb(`signatures?owner_discord=eq.${enc(user.id)}&select=name`) || [];
    const ownNames = new Set(own.map((s) => String(s.name || '').toLowerCase()));
    return send(res, 200, {
      signatures: (rows || []).map((r) => ({ ...r, mine: String(r.author_discord) === String(user.id), added: ownNames.has(String(r.name || '').toLowerCase()) })),
    });
  }

  if (req.method !== 'POST') {
    if (req.method === 'DELETE') {
      // you can withdraw your own entry
      await sb(`community_signatures?id=eq.${enc(req.query.id)}&author_discord=eq.${enc(user.id)}`, { method: 'DELETE' });
      return send(res, 200, { ok: true });
    }
    throw httpError(405, 'Method not allowed');
  }

  const b = readBody(req);

  // ── share one of my signatures with everyone ─────────────────────────────
  if (b.action === 'share') {
    const row = {
      author_discord: user.id,
      author_name: str(b.authorName || user.username || '', 60) || null,
      name: str(b.name, 80),
      file_names: toList(b.fileNames).map((s) => s.toLowerCase()),
      features: toList(b.features),
      domains: toList(b.domains).map((s) => s.toLowerCase()),
      hashes: toList(b.hashes).map((s) => s.toLowerCase()),
      severity: ['high', 'medium', 'low'].includes(b.severity) ? b.severity : 'high',
      games: [...new Set(toList(b.games).map((g) => g.toLowerCase()).filter((g) => Object.prototype.hasOwnProperty.call(GAMES, g)))],
      note: str(b.note || '', 300) || null,
    };
    if (!row.name) throw httpError(400, 'Give the signature a name.');
    if (!row.file_names.length && !row.domains.length && !row.hashes.length)
      throw httpError(400, 'Add at least one file name, domain or hash.');

    const bad = reject(row);
    if (bad) throw httpError(400, bad);

    const created = await sb('community_signatures', { method: 'POST', body: row, prefer: 'return=representation' });
    await audit(user, 'community_signature.share', { target: row.name });
    return send(res, 200, { signature: Array.isArray(created) ? created[0] : created });
  }

  // ── copy a shared signature into my own list ─────────────────────────────
  if (b.action === 'import') {
    if (!b.id) throw httpError(400, 'id required');
    const rows = await sb(`community_signatures?id=eq.${enc(b.id)}&select=*`);
    const s = rows && rows[0];
    if (!s) throw httpError(404, 'That signature is gone.');
    if (s.hidden) throw httpError(409, 'That signature was reported as a false positive and is no longer shared.');

    const mine = {
      owner_discord: user.id,
      name: str(s.name, 80),
      file_names: s.file_names || [],
      features: s.features || [],
      domains: s.domains || [],
      hashes: s.hashes || [],
      severity: s.severity || 'high',
      games: s.games || [],
    };
    try { await sb('signatures', { method: 'POST', body: mine, prefer: 'return=minimal' }); }
    catch (e) {
      if (!/games/i.test(e.message)) throw e;
      const { games, ...rest } = mine;                      // older DB without the games column
      await sb('signatures', { method: 'POST', body: rest, prefer: 'return=minimal' });
    }
    await sb('rpc/hs_count_signature_import', { method: 'POST', body: { p_sig: s.id } }).catch(() => {});
    await audit(user, 'community_signature.import', { target: s.name });
    return send(res, 200, { ok: true });
  }

  // ── flag a bad one ───────────────────────────────────────────────────────
  if (b.action === 'report') {
    if (!b.id) throw httpError(400, 'id required');
    const n = await sb('rpc/hs_report_community_signature', {
      method: 'POST', body: { p_sig: b.id, p_discord: user.id, p_reason: str(b.reason || '', 300) },
    });
    await audit(user, 'community_signature.report', { target: String(b.id) });
    return send(res, 200, { ok: true, reports: typeof n === 'number' ? n : undefined });
  }

  throw httpError(400, 'Unknown action');
});
