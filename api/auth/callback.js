import { parseCookies, setSession, sb, enc, CHEAT_NAME_RE } from '../_lib.js';

const fail = (res, code) => {
  res.writeHead(302, { Location: `/dashboard?error=${code}` });
  res.end();
};

export default async function handler(req, res) {
  try {
    const { code, state } = req.query || {};
    // player Discord check (started from /verify) — not a dashboard login
    if (String(state || '').startsWith('p.')) return playerCallback(req, res, String(code || ''), String(state));
    const saved = parseCookies(req).hs_state;
    if (!code || !state || !saved || state !== saved) return fail(res, 'state');

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) return fail(res, 'token');
    const { access_token } = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) return fail(res, 'user');
    const u = await userRes.json();

    setSession(res, {
      id: u.id,
      name: u.global_name || u.username,
      avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : null,
    });
    // also clear the state cookie
    const cookies = [].concat(res.getHeader('Set-Cookie') || []);
    cookies.push('hs_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    res.setHeader('Set-Cookie', cookies);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (e) {
    console.error(e);
    fail(res, 'server');
  }
}

async function playerCallback(req, res, code, state) {
  const [, nonce, pin] = state.split('.');
  const back = (q) => {
    res.setHeader('Set-Cookie', 'hs_pstate=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    res.writeHead(302, { Location: `/verify?pin=${encodeURIComponent(pin || '')}&${q}` });
    res.end();
  };
  try {
    if (!code || !nonce || !pin || parseCookies(req).hs_pstate !== nonce) return back('error=state');
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) return back('error=token');
    const { access_token } = await tokenRes.json();
    const H = { Authorization: `Bearer ${access_token}` };
    const [meRes, gRes] = await Promise.all([
      fetch('https://discord.com/api/users/@me', { headers: H }),
      fetch('https://discord.com/api/users/@me/guilds', { headers: H }),
    ]);
    if (!meRes.ok) return back('error=user');
    const u = await meRes.json();
    const guilds = gRes.ok ? await gRes.json() : [];
    const discord_check = {
      at: new Date().toISOString(),
      user: {
        id: String(u.id), name: u.global_name || u.username, username: u.username,
        avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : null,
        created: new Date(Number((BigInt(u.id) >> 22n) + 1420070400000n)).toISOString(),
      },
      guilds: (Array.isArray(guilds) ? guilds : []).slice(0, 250).map((g) => ({
        id: String(g.id), name: g.name, icon: g.icon || null, owner: !!g.owner,
      })),
    };
    // when did he JOIN the cheat servers he is in? (watch-list of any staff + cheat-looking names, max 8 calls)
    try {
      const ids = discord_check.guilds.map((g) => g.id);
      let listed = [];
      if (ids.length) listed = (await sb(`cheat_servers?guild_id=in.(${ids.map(enc).join(',')})&select=guild_id`).catch(() => [])) || [];
      const want = new Set(listed.map((x) => String(x.guild_id)));
      discord_check.guilds.forEach((g) => { if (CHEAT_NAME_RE.test(g.name || '')) want.add(g.id); });
      for (const id of [...want].slice(0, 8)) {
        const m = await fetch(`https://discord.com/api/users/@me/guilds/${id}/member`, { headers: H });
        if (m.status === 429) break;
        if (!m.ok) continue;
        const j = await m.json().catch(() => null);
        const g = discord_check.guilds.find((x) => x.id === id);
        if (g && j && j.joined_at) g.joined = j.joined_at;
      }
    } catch (e) { console.error('joined_at', e); }
    await sb(`scan_pins?pin=eq.${enc(pin)}`, { method: 'PATCH', body: { discord_check } });
    return back('done=1');
  } catch (e) {
    console.error('player discord check', e);
    const m = String((e && e.message) || e);
    // most common cause: the database was created before the Discord check existed
    if (/discord_check|column|schema cache|PGRST204|42703/i.test(m)) return back('error=db');
    if (/SUPABASE|unreachable|fetch failed|ENOTFOUND|ECONN/i.test(m)) return back('error=dbconn');
    return back('error=server');
  }
}
