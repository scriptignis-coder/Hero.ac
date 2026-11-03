import crypto from 'node:crypto';

export default function handler(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || '',
    redirect_uri: process.env.DISCORD_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'identify',
    state,
  });
  res.setHeader('Set-Cookie', `hs_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.writeHead(302, { Location: `https://discord.com/oauth2/authorize?${params}` });
  res.end();
}
