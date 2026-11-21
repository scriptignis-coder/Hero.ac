/**
 * v81 — where the scanned PC was connecting from.
 *
 * The scanner posts its report from the player's own machine, so the request that carries the
 * report comes from the player's connection. That is the one moment the country is knowable,
 * and it is worth knowing: a player whose PC says one country while his connection says another
 * is not proof of anything, but it is the question staff ask out loud in every screenshare.
 *
 * What is stored, and what deliberately is not:
 *
 *   country, countryCode   stored
 *   vpn / hosting flag     stored — a datacentre address is not a home connection
 *   the address itself     NOT stored in full. The last part is dropped (1.2.3.x,
 *                          2001:db8:1234:: ) — enough to see two scans came from the same
 *                          network, not enough to be a home address sitting in a database.
 *
 * The lookup is best effort. If it fails or times out the report is saved exactly as before
 * with `country: null`, which the dashboard shows as Unknown. It never invents one, and it
 * never delays or fails a scan upload.
 */

const cache = new Map();                 // masked ip -> { at, geo }
const TTL_MS = 60 * 60 * 1000;

/** The address the request really came from, behind Render's proxy. */
export function clientIp(req) {
  const xff = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xff || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');     // IPv4 inside an IPv6 socket
}

/** 1.2.3.4 -> 1.2.3.x · 2001:db8:1:2:3:4:5:6 -> 2001:db8:1:2:: */
export function mask(ip) {
  if (!ip) return null;
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + '::';
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.x` : null;
}

const PRIVATE = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd])/i;

/** "TN" -> "Tunisia", without shipping a country table. */
function nameOf(code) {
  if (!code) return null;
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch { return code; }
}

export async function geoOf(req) {
  const ip = clientIp(req);
  const masked = mask(ip);
  const h = req.headers || {};

  // 1. The edge may already have said it. Cloudflare sets cf-ipcountry on every proxied
  //    request; some hosts set their own header. This is free, instant and cannot fail, so it
  //    is tried before any outbound call.
  const edge = String(h['cf-ipcountry'] || h['x-vercel-ip-country'] || h['x-country-code'] || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(edge) && edge !== 'XX' && edge !== 'T1') {
    return { ip: masked, country: nameOf(edge), countryCode: edge, vpn: false, source: 'edge', at: new Date().toISOString() };
  }

  if (!ip || PRIVATE.test(ip)) return { ip: masked, country: null, countryCode: null, vpn: false, at: new Date().toISOString() };

  const hit = cache.get(masked);
  if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.geo, at: new Date().toISOString() };

  let geo = { ip: masked, country: null, countryCode: null, vpn: false };

  // 2. ipapi.co over HTTPS — no key, no account.
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { 'User-Agent': 'HeRoShield/1.0' }, signal: AbortSignal.timeout(2500),
    });
    if (r.ok) {
      const j = await r.json();
      if (j && j.country_code && !j.error) {
        geo = { ip: masked, country: j.country_name || nameOf(j.country_code), countryCode: j.country_code, isp: j.org || null, vpn: false, source: 'ipapi.co' };
      }
    }
  } catch { }

  // 3. ip-api, which is the one that also says whether the address is a VPN or a datacentre.
  //    Plain HTTP on the free tier, so it is the fallback and never the only source.
  if (!geo.countryCode || geo.vpn === false) {
    try {
      const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,isp,proxy,hosting`,
        { signal: AbortSignal.timeout(2500) });
      if (r.ok) {
        const j = await r.json();
        if (j && j.status === 'success') {
          geo = {
            ip: masked,
            country: j.country || geo.country || nameOf(j.countryCode),
            countryCode: j.countryCode || geo.countryCode,
            isp: j.isp || geo.isp || null,
            // "proxy" is a known VPN or proxy exit; "hosting" is a datacentre address, which a
            // player at home does not have. Either one is worth a line on the report.
            vpn: !!(j.proxy || j.hosting),
            vpnKind: j.proxy ? 'VPN or proxy' : j.hosting ? 'datacentre / hosting address' : null,
            source: 'ip-api',
          };
        }
      }
    } catch { /* offline, rate limited, timed out: the report is saved without a country */ }
  }

  if (geo.countryCode) cache.set(masked, { at: Date.now(), geo });
  return { ...geo, at: new Date().toISOString() };
}
