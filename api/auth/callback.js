import { parseCookies, setSession } from '../_lib.js';

const fail = (res, code) => {
  res.writeHead(302, { Location: `/dashboard?error=${code}` });
  res.end();
};

export default async function handler(req, res) {
  try {
    const { code, state } = req.query || {};
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
    res.writeHead(302, { Location: '/dashboard' });
    res.end();
  } catch (e) {
    console.error(e);
    fail(res, 'server');
  }
}
