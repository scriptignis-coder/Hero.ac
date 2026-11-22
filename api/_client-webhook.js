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
const TITLES = { cheating: 'Cheat found', suspicious: 'Needs a look', clean: 'Clean' };
const MARKS  = { cheating: '🔴', suspicious: '🟠', clean: '🟢' };

/** A Discord field, or nothing at all when there is nothing to say. */
const field = (name, value, inline = false) =>
  (value === undefined || value === null || value === '' ? null : { name, value: String(value).slice(0, 1024), inline });

/** Discord lays inline fields out three to a row; this keeps a short row from stretching. */
const SPACER = { name: '​', value: '​', inline: true };

/** A one-line code box, which is what makes a value read as a value and not as prose. */
const box = (v) => '`' + String(v).replace(/`/g, '') + '`';

export function buildScanEmbed(p) {
  const v = ['cheating', 'suspicious', 'clean'].includes(p.verdict) ? p.verdict : 'suspicious';

  // The same cheat is found through several routes - the file, its name, its signature - and
  // the card was printing "SolaraV3" three times over. Staff need the list of THINGS, not the
  // list of hits: duplicates are counted, not repeated.
  const seen = new Map();
  for (const t of p.top || []) {
    const k = String(t).trim();
    if (!k) continue;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const found = [...seen.entries()].slice(0, 6)
    .map(([name, n]) => `\`${name}\`${n > 1 ? ` ×${n}` : ''}`).join('\n');

  const accounts = (p.discord || []).slice(0, 4).map((a) => (a.name ? `**${a.name}** ${box(a.id)}` : box(a.id))).join('\n');
  const steam    = (p.steam || []).slice(0, 4).map((a) => (a.name ? `**${a.name}** ${box(a.id)}` : box(a.id))).join('\n');

  // Row 1 is the three things staff read first, always in the same place.
  const row1 = [
    field('PIN', box(p.pin || 'unknown'), true),
    field('Game', p.gameName || p.game || '—', true),
    field('Findings', box(p.count ? `${p.count} detection${p.count === 1 ? '' : 's'}` : 'none'), true),
  ].filter(Boolean);

  const row2 = [
    field('PC', p.pcName ? box(p.pcName) : null, true),
    field('Windows', p.os || null, true),
    field('Connected from', p.country || null, true),
  ].filter(Boolean);
  // Two inline fields on their own sit stretched across the card; a blank third squares them up.
  if (row2.length === 2) row2.push(SPACER);

  const fields = [
    ...row1,
    ...(row1.length === 2 ? [SPACER] : []),
    ...row2,
    field(found ? 'What was found' : null, found),
    // The erased histories are a headline, not a footnote: a clean-looking scan on a wiped PC
    // is the one case where the number means more than the verdict.
    field(p.evidenceRemoved ? '⚠ Histories erased' : null,
          p.evidenceRemoved ? `${p.cleaningSigns} of the places Windows records what ran had been emptied before this check.` : null),
    field(accounts ? 'Discord' : null, accounts, true),
    field(steam ? 'Steam' : null, steam, true),
  ].filter(Boolean);

  const embed = {
    author: { name: `${MARKS[v]}  ${TITLES[v]}` },
    color: COLORS[v],
    description: p.reason ? `_${String(p.reason).slice(0, 300)}_` : undefined,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: p.scanner ? `HeRo Shield · scanner v${p.scanner}` : 'HeRo Shield' },
  };
  if (p.url) {
    embed.title = 'Open the full report  →';
    embed.url = p.url;
  }
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
