import crypto from 'node:crypto';
import {sb,enc} from './_lib.js';
function key(){const v=process.env.HS_WEBHOOK_ENCRYPTION_KEY||'';if(!/^[0-9a-f]{64}$/i.test(v))throw new Error('HS_WEBHOOK_ENCRYPTION_KEY must be 64 hex characters');return Buffer.from(v,'hex');}
export function encryptUrl(url){const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',key(),iv);const ct=Buffer.concat([c.update(url,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),ct]).toString('base64');}
export function decryptUrl(value){const b=Buffer.from(value,'base64');const d=crypto.createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}
export function validDiscordUrl(s){try{const u=new URL(s);return u.protocol==='https:'&&['discord.com','discordapp.com'].includes(u.hostname)&&/^\/api\/webhooks\/\d{17,20}\/[A-Za-z0-9_-]{40,}$/.test(u.pathname)&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}

/**
 * v82.3 — the scan card that lands in the operator's Discord.
 *
 * The old one was three lines in a description and a grey bar: it told you a scan happened and
 * made you open the site to learn anything. This is the card staff actually work from — the
 * PIN to quote, the verdict, who the player is on Discord and Steam, and a link straight to the
 * report — laid out as fields so Discord renders them as labelled boxes rather than a wall.
 *
 * Everything here comes from the report itself. A field with nothing behind it is left out
 * rather than printed as "Unknown": an empty box teaches staff to stop reading the card.
 */

const COLORS = { cheating: 0xf43f5e, suspicious: 0xf59e0b, clean: 0x3ecf8e };
const TITLES  = { cheating: 'Cheat found', suspicious: 'Needs a look', clean: 'Clean' };

/** A Discord field, or nothing at all when there is nothing to say. */
const field = (name, value, inline = false) =>
  (value === undefined || value === null || value === '' ? null : { name, value: String(value).slice(0, 1024), inline });

export function buildScanEmbed(p) {
  const v = ['cheating', 'suspicious', 'clean'].includes(p.verdict) ? p.verdict : 'suspicious';
  const accounts = (p.discord || []).slice(0, 4)
    .map((a) => `${a.name ? a.name + ' ' : ''}\`${a.id}\``).join('\n');
  const steam = (p.steam || []).slice(0, 4)
    .map((a) => `${a.name ? a.name + ' — ' : ''}\`${a.id}\``).join('\n');

  const fields = [
    field('PIN', '```' + (p.pin || '—') + '```', true),
    field('Result', '```' + (TITLES[v] + (p.count ? ` · ${p.count}` : '')) + '```', true),
    field('Game', p.gameName || p.game, true),
    field('Discord', accounts ? accounts : null),
    field('Steam', steam ? steam : null),
    field('PC', p.pcName ? `\`${p.pcName}\`${p.os ? ' · ' + p.os : ''}` : null, true),
    field('Connected from', p.country || null, true),
    // The top few findings, so a verdict is never just a colour. Staff can act on a name.
    field(p.top && p.top.length ? 'Found' : null, p.top && p.top.length ? p.top.slice(0, 5).map((t) => '• ' + t).join('\n') : null),
  ].filter(Boolean);

  const embed = {
    title: TITLES[v],
    color: COLORS[v],
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'HeRo Shield · heroshield.store' },
  };
  if (p.url) embed.description = `**[Open the full report](${p.url})**`;
  if (p.logo) embed.thumbnail = { url: p.logo };
  if (p.banner) embed.image = { url: p.banner };
  return embed;
}

export async function sendScanWebhook(owner, payload) {
  try {
    const rows = await sb(`hs_client_webhooks?owner_discord=eq.${enc(owner)}&enabled=eq.true&select=url_encrypted&limit=1`);
    if (!rows?.length) return;
    const url = decryptUrl(rows[0].url_encrypted);
    if (!validDiscordUrl(url)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'HeRo Shield', embeds: [buildScanEmbed(payload)] }),
        signal: controller.signal,
      });
      if (!response.ok) console.error('Discord webhook HTTP', response.status);
    } finally { clearTimeout(timer); }
  } catch (e) { console.error('Webhook delivery failed:', e.message); }
}
