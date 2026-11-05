import { wrap, send, readBody, sb, enc, str, httpError, requireAccess } from './_lib.js';

// Watch-list of cheat Discord servers. Add them by invite link — Discord's public
// invite API gives the server ID, name and icon (no bot needed).
const codeOf = (s) => {
  s = String(s || '').trim();
  const m = /(?:discord(?:app)?\.com\/invite\/|discord\.gg\/|discord\.com\/invite\/)([A-Za-z0-9-]+)/i.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9-]{2,32}$/.test(s) && !/^\d{15,22}$/.test(s) ? s : null;
};

async function resolveInvite(code) {
  const r = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`, {
    headers: { 'User-Agent': 'HeRoShield (dashboard, 1.0)' },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!j || !j.guild) return null;
  return { guild_id: String(j.guild.id), name: j.guild.name || null, icon: j.guild.icon || null, members: j.approximate_member_count || null };
}

export default wrap(async (req, res) => {
  const user = await requireAccess(req, 'herocheck');

  if (req.method === 'GET') {
    const rows = await sb(`cheat_servers?owner_discord=eq.${enc(user.id)}&select=*&order=created_at.desc`);
    return send(res, 200, { servers: rows || [] });
  }

  // body: { links: "discord.gg/abc\ndiscord.gg/xyz" }  or  { guildId, name } for a server ID you already know
  if (req.method === 'POST') {
    const b = readBody(req);
    const added = [], failed = [];
    if (b.guildId) {
      const id = String(b.guildId).replace(/\D/g, '');
      if (!/^\d{15,22}$/.test(id)) throw httpError(400, 'Invalid server ID');
      added.push({ owner_discord: user.id, guild_id: id, name: str(b.name, 100) || null, icon: null, invite: null });
    }
    const parts = String(b.links || '').split(/[\s,]+/).filter(Boolean).slice(0, 50);
    for (const p of parts) {
      if (/^\d{15,22}$/.test(p)) { added.push({ owner_discord: user.id, guild_id: p, name: null, icon: null, invite: null }); continue; }
      const code = codeOf(p);
      if (!code) { failed.push(p); continue; }
      const g = await resolveInvite(code).catch(() => null);
      if (!g) { failed.push(p); continue; }
      added.push({ owner_discord: user.id, guild_id: g.guild_id, name: g.name, icon: g.icon, invite: `https://discord.gg/${code}` });
    }
    if (added.length)
      await sb('cheat_servers?on_conflict=owner_discord,guild_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: added });
    return send(res, 200, { added: added.map((a) => ({ id: a.guild_id, name: a.name })), failed });
  }

  if (req.method === 'DELETE') {
    await sb(`cheat_servers?id=eq.${enc(req.query.id)}&owner_discord=eq.${enc(user.id)}`, { method: 'DELETE' });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
