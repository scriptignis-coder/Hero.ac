// Dashboard: read / save server configuration
import { wrap, send, readBody, sb, httpError, requireUser, requireOwnedServer } from './_lib.js';

// name -> [min, max] for value (null = no value)
const DETECTIONS = {
  GodMode: null, Invisible: null, HealthHack: null, ArmorHack: null, ShrinkPed: null, TeleportWaypoint: null,
  ChangePed: null, Spectate: null, VisionHack: null, DamageModifier: null, SuperPunch: null,
  MagicBullet: [50, 2000], KillRate: [1, 100], SpeedHack: [5, 100], SuperJump: [1, 50], InfiniteStamina: null,
  NoClip: null, VehicleNoClip: null, FreeCam: [30, 1000], VehicleBoost: null, BlacklistedWeapon: null,
  GiveWeaponOther: null, RemoveWeaponOther: null, RapidFire: [5, 100], InfiniteAmmo: null, WeaponDamage: [50, 5000],
  BlacklistedEvent: null, EventSpam: [5, 500], ClearTasksOther: null, Injection: null, Heartbeat: [30, 600],
  BlacklistedEntity: null, EntityInjection: null, VehicleSpam: [1, 100], PedSpam: [1, 100], ObjectSpam: [1, 300],
  EntitySpam: [5, 500], ParticleSpam: [5, 500], ParticleScale: [1, 50], Explosion: [1, 100],
  ExplosionScale: [1, 20], HiddenExplosion: null, BlacklistedExplosion: null, FireSpam: [1, 200], ProjectileSpam: [5, 500],
  LuaTamper: null, LuaMenu: null, ResourceStop: null, DevTools: null, SemiGodMode: null, GhostMode: null,
  SilentAim: [2, 20], AntiBurn: null, XssExploit: null, Hijack: null, ThrowVehicle: [30, 300],
  VehicleSpeedModifier: null, ChangePlate: null,
};
const ACTIONS = ['ban', 'kick', 'log'];
const LOGS = ['Startup', 'ResourceStart', 'ResourceStop', 'Join', 'Leave', 'Death', 'Revive', 'Weapon', 'Explosion', 'Admin'];
const GENERAL_BOOL = ['RevealBanReason', 'TxAdminIntegration', 'BanIP', 'AntiVpn', 'AntiSpoof', 'RequireSteam', 'RequireDiscord', 'RequireNormalName'];
const WEBHOOKS = ['Ban', 'Kick', 'Warn', 'Object', 'Vpn', 'Logs'];
const WEBHOOK = /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

const cleanList = (v, re, max = 300) => (Array.isArray(v) ? v : [])
  .map((x) => String(x).trim()).filter((x) => x && re.test(x)).slice(0, max);

function clean(input) {
  const out = { webhook: '', logWebhook: '', webhooks: {}, general: {}, logs: {}, detections: {}, lists: {} };

  const hook = (url) => {
    url = String(url || '').trim();
    if (url && !WEBHOOK.test(url)) throw httpError(400, 'Invalid Discord webhook URL');
    return url;
  };
  out.webhook = hook(input?.webhook);
  out.logWebhook = hook(input?.logWebhook);
  for (const k of WEBHOOKS) if (input?.webhooks?.[k] !== undefined) out.webhooks[k] = hook(input.webhooks[k]);

  for (const k of GENERAL_BOOL) if (typeof input?.general?.[k] === 'boolean') out.general[k] = input.general[k];
  const invite = String(input?.general?.DiscordInvite || '').trim();
  if (invite && !/^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/.test(invite)) throw httpError(400, 'Invalid Discord invite link');
  out.general.DiscordInvite = invite;

  for (const name of LOGS) if (typeof input?.logs?.[name] === 'boolean') out.logs[name] = input.logs[name];

  for (const [name, range] of Object.entries(DETECTIONS)) {
    const d = input?.detections?.[name];
    if (!d || typeof d !== 'object') continue;
    const item = {};
    if (typeof d.enabled === 'boolean') item.enabled = d.enabled;
    if (ACTIONS.includes(d.action)) item.action = d.action;
    if (range && d.value !== undefined && d.value !== '') {
      const v = Number(d.value);
      if (!Number.isFinite(v) || v < range[0] || v > range[1]) throw httpError(400, `${name}: value must be between ${range[0]} and ${range[1]}`);
      item.value = v;
    }
    out.detections[name] = item;
  }

  const l = input?.lists || {};
  if (l.weapons) out.lists.weapons = cleanList(l.weapons, /^WEAPON_[A-Z0-9_]+$/i).map((x) => x.toUpperCase());
  if (l.models) out.lists.models = cleanList(l.models, /^[\w-]{2,64}$/);
  if (l.events) out.lists.events = cleanList(l.events, /^[\w:.\-]{2,100}$/);
  if (l.explosions) out.lists.explosions = cleanList(l.explosions, /^\d{1,3}$/).map(Number);
  return out;
}

export default wrap(async (req, res) => {
  const user = requireUser(req);

  if (req.method === 'GET') {
    const server = await requireOwnedServer(user, req.query.server);
    return send(res, 200, { settings: server.settings || {} });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    const server = await requireOwnedServer(user, b.server);
    const settings = clean(b.settings);
    await sb(`servers?id=eq.${server.id}`, { method: 'PATCH', body: { settings } });
    return send(res, 200, { ok: true, settings });
  }

  throw httpError(405, 'Method not allowed');
});
