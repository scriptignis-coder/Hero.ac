// 🤝 Partners shown on the website.
//   GET    /api/partners           → public list (name, logo, members, description, invite)
//   POST   /api/partners           → { invite, description } — Owner / Admin only (staff and Admin (test) are refused)
//   DELETE /api/partners?id=123    → Owner / Admin only
// The server name, logo and member count are read from Discord with the invite (no bot needed).
import { wrap, send, sb, enc, httpError, requireAccess, audit, str } from './_lib.js';

const codeOf = (v) => {
  const s = String(v || '').trim();
  const m = /(?:discord(?:app)?\.(?:gg|com\/invite)\/)?([A-Za-z0-9-]{2,32})\/?$/.exec(s);
  return m ? m[1] : null;
};

async function resolveInvite(code) {
  const r = await fetch(`https://discord.com/api/v10/invites/${enc(code)}?with_counts=true`, {
    headers: { 'User-Agent': 'HeRoShield (partners, 1.0)' }, signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!j || !j.guild) return null;
  const g = j.guild;
  return {
    guild_id: String(g.id), name: str(g.name, 100),
    icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${String(g.icon).startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
    members: Number(j.approximate_member_count) || null,
  };
}

export default wrap(async (req, res) => {
  if (req.method === 'GET') {
    const rows = await sb('partners?select=id,name,icon,members,description,invite&order=position.asc,created_at.desc&limit=60').catch(() => []);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return send(res, 200, { partners: rows || [] });
  }
  const user = await requireAccess(req, 'admin');   // Owner + Admin; Admin (test) is refused for changes
  if (req.method === 'POST') {
    const code = codeOf(req.body?.invite);
    if (!code) throw httpError(400, 'Paste the Discord invite link (discord.gg/…)');
    const description = str(req.body?.description, 300).trim();
    if (description.length < 5) throw httpError(400, 'Write a short description (5–300 characters)');
    const g = await resolveInvite(code);
    if (!g) throw httpError(400, 'This invite is invalid or expired — create a permanent invite (never expires)');
    const row = { ...g, invite: `https://discord.gg/${code}`, description, added_by: String(user.id) };
    await sb('partners?on_conflict=guild_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: row })
      .catch((e) => { if (/partners/.test(e.message)) throw httpError(500, 'Run supabase-v28-partners.sql in Supabase first'); throw e; });
    await audit(user, 'partner.add', { target: g.guild_id, targetName: g.name, detail: row.invite }).catch(() => {});
    return send(res, 200, { ok: true, partner: row });
  }
  if (req.method === 'DELETE') {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Missing id');
    const old = (await sb(`partners?id=eq.${id}&select=name,guild_id`))?.[0];
    await sb(`partners?id=eq.${id}`, { method: 'DELETE' });
    await audit(user, 'partner.remove', { target: old?.guild_id, targetName: old?.name }).catch(() => {});
    return send(res, 200, { ok: true });
  }
  throw httpError(405, 'Method not allowed');
});
