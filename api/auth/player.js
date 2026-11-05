import crypto from 'node:crypto';
import { sb, enc } from '../_lib.js';

// The PLAYER connects Discord during the check (scope: identify + guilds = their server list).
// It does NOT log them into the dashboard — it only attaches their Discord to the scan PIN.
export default async function handler(req, res) {
  const pin = String((req.query || {}).pin || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const back = (q) => { res.writeHead(302, { Location: `/verify?pin=${encodeURIComponent(pin)}&${q}` }); res.end(); };
  if (!pin) return back('error=pin');
  try {
    const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=id`);
    if (!rows || !rows.length) return back('error=pin');
  } catch { return back('error=server'); }

  const nonce = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || '',
    redirect_uri: process.env.DISCORD_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'identify guilds',
    state: `p.${nonce}.${pin}`,
    prompt: 'consent',
  });
  res.setHeader('Set-Cookie', `hs_pstate=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900`);
  res.writeHead(302, { Location: `https://discord.com/oauth2/authorize?${params}` });
  res.end();
}
