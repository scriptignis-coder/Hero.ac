// HeRo Shield dashboard: Configuration panel + Multi-Stream
(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ===== detections: default action, value, range, description =====
  const D = {
    GodMode: ['ban', null, 'Player cannot take damage (invincible / damage proofs).'],
    Invisible: ['kick', null, 'Player is invisible for more than 10 seconds.'],
    HealthHack: ['ban', null, 'Health above the max health.'],
    ArmorHack: ['ban', null, 'Armor above 100.'],
    ShrinkPed: ['ban', null, 'Player made his ped small (shrink).'],
    TeleportWaypoint: ['ban', null, 'Teleport straight to the map waypoint.'],
    ChangePed: ['log', null, 'Player turned into an animal ped.'],
    Spectate: ['ban', null, 'Spectator mode used without being admin.'],
    VisionHack: ['log', null, 'Night or thermal vision outside an aircraft.'],
    DamageModifier: ['ban', null, 'Weapon damage boost or defense boost.'],
    SuperPunch: ['ban', null, 'Melee damage boost (one punch kill).'],
    MagicBullet: ['log', [350, 50, 2000, 'Max kill distance (m)'], 'Kill from further than the max distance.'],
    KillRate: ['log', [12, 1, 100, 'Max kills per minute'], 'Too many kills in one minute.'],
    SpeedHack: ['kick', [12, 5, 100, 'Max speed on foot (m/s)'], 'Running faster than possible.'],
    SuperJump: ['kick', [4, 1, 50, 'Max jump height (m)'], 'Jumping higher than possible.'],
    InfiniteStamina: ['log', null, 'Sprinting 60s without losing stamina.'],
    NoClip: ['ban', null, 'Flying / moving through walls on foot.'],
    VehicleNoClip: ['ban', null, 'Car flying / moving through walls.'],
    FreeCam: ['kick', [120, 30, 1000, 'Max camera distance (m)'], 'Camera far away from the player.'],
    VehicleBoost: ['kick', null, 'Vehicle power / speed boost.'],
    BlacklistedWeapon: ['ban', null, 'Holding a forbidden weapon (admins too).'],
    GiveWeaponOther: ['ban', null, 'Gives weapons to other players.'],
    RemoveWeaponOther: ['kick', null, 'Removes weapons of other players.'],
    RapidFire: ['kick', [25, 5, 100, 'Max shots per second'], 'Shooting faster than the weapon can.'],
    InfiniteAmmo: ['log', null, 'Shooting 40 times without the clip going down.'],
    WeaponDamage: ['log', [300, 50, 5000, 'Max damage per hit'], 'One hit does too much damage.'],
    BlacklistedEvent: ['ban', null, 'Triggers an event used by cheat menus (admins too).'],
    EventSpam: ['kick', [40, 5, 500, 'Max events per second'], 'Spams server events.'],
    ClearTasksOther: ['kick', null, 'Kicks players out of cars / freezes them.'],
    Injection: ['ban', null, 'Injected resource or fake anti-cheat token.'],
    Heartbeat: ['kick', [120, 30, 600, 'Seconds before kick'], 'Anti-cheat stopped on the player PC.'],
    BlacklistedEntity: ['ban', null, 'Spawns a forbidden vehicle / object (admins too).'],
    EntityInjection: ['ban', null, 'Entity spawned by an injected menu (admins too).'],
    VehicleSpam: ['ban', [4, 1, 100, 'Max vehicles per 10s'], 'Spawns too many vehicles.'],
    PedSpam: ['ban', [8, 1, 100, 'Max peds per 10s'], 'Spawns too many peds.'],
    ObjectSpam: ['ban', [15, 1, 300, 'Max objects per 10s'], 'Spawns too many objects.'],
    EntitySpam: ['kick', [60, 5, 500, 'Max entities per 10s'], 'Spawns too many entities.'],
    ParticleSpam: ['kick', [40, 5, 500, 'Max particles per 10s'], 'Spams particle effects.'],
    ParticleScale: ['ban', [5, 1, 50, 'Max particle size'], 'Giant particle effects.'],
    Explosion: ['kick', [10, 1, 100, 'Max explosions per 10s'], 'Spams explosions.'],
    ExplosionScale: ['ban', [1, 1, 20, 'Max damage scale'], 'Boosted (bigger) explosions.'],
    HiddenExplosion: ['log', null, 'Invisible and silent explosions (always blocked).'],
    BlacklistedExplosion: ['ban', null, 'Forbidden explosion types.'],
    FireSpam: ['kick', [15, 1, 200, 'Max fires per 10s'], 'Spams fire.'],
    ProjectileSpam: ['kick', [40, 5, 500, 'Max projectiles per 10s'], 'Spams rockets / projectiles.'],
    LuaTamper: ['ban', null, 'Game functions hooked / replaced by an injected Lua menu.'],
    LuaMenu: ['ban', null, 'A known Lua cheat menu is loaded in the game.'],
    ResourceStop: ['ban', null, 'Player stopped a server resource on his PC (anti-cheat bypass).'],
    DevTools: ['kick', null, 'NUI devtools opened (used to edit scripts / UIs).'],
    SemiGodMode: ['ban', null, 'Health comes back instantly after being hit by a player.'],
    GhostMode: ['log', null, 'Ped almost transparent for more than 10 seconds.'],
    SilentAim: ['ban', [2, 2, 20, 'Victims needed (60s)'], 'Hits players without line of sight. Reported by the victims (cannot be bypassed).'],
    AntiBurn: ['ban', null, 'Sets other players on fire.'],
    XssExploit: ['kick', null, 'HTML / script in the player name (breaks UIs, steals data).'],
    Hijack: ['log', null, 'Takes the car of another player instantly (no animation).'],
    ThrowVehicle: ['ban', [60, 30, 300, 'Max speed of an empty car (m/s)'], 'Throws empty vehicles at very high speed.'],
    VehicleSpeedModifier: ['log', null, 'Vehicle top speed modifier (speed hack).'],
    ChangePlate: ['log', null, 'Plate changed while driving.'],
  };
  const LABEL = (n) => 'Anti ' + n.replace(/^Anti/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

  const LISTS = {
    weapons: { label: 'Weapon blacklist', hint: 'One weapon per line, e.g. WEAPON_RPG',
      def: ['WEAPON_RAILGUN', 'WEAPON_RAILGUNXM3', 'WEAPON_MINIGUN', 'WEAPON_RPG', 'WEAPON_HOMINGLAUNCHER', 'WEAPON_GRENADELAUNCHER', 'WEAPON_EMPLAUNCHER', 'WEAPON_RAYMINIGUN', 'WEAPON_RAYPISTOL', 'WEAPON_RAYCARBINE', 'WEAPON_FIREWORK', 'WEAPON_COMPACTLAUNCHER'] },
    models: { label: 'Entity blacklist', hint: 'One model per line, e.g. rhino',
      def: ['cargoplane', 'jet', 'blimp', 'blimp2', 'blimp3', 'hydra', 'lazer', 'rhino', 'khanjali', 'p_spinning_anus_s', 'prop_windmill_01', 'stt_prop_stunt_track_start', 'prop_gold_cont_01', 'prop_fnclink_05crnr1', 'p_crahsed_heli_s', 'prop_juicestand', 'prop_beach_fire', 'prop_container_05a', 'prop_cs_dildo_01', 'prop_ld_ferris_wheel'] },
    events: { label: 'Event blacklist', hint: 'One event per line (events a normal player never triggers)',
      def: ['HCheat:TempDisableDetection', 'adminmenu:allowall', 'mellotrainer:adminKick', 'mellotrainer:adminTempBan', 'antilynx8:anticheat', 'lynx8:anticheat', 'esx_mafia:pay', 'esx_gopostaljob:pay', 'esx_garbagejob:pay', 'esx_truckerjob:pay', 'esx_pilot:success', 'esx_taxijob:success', 'esx_carthief:pay', 'esx_godirtyjob:pay', 'esx_pizza:pay', 'esx_ranger:pay', 'esx_slotmachine:sv:2', 'esx_banksecurity:pay', 'heroshield:honeypot'] },
    explosions: { label: 'Explosion blacklist', hint: 'One explosion type id per line (7 plane, 29 blimp, 59 orbital, 82 raygun)',
      def: ['7', '29', '33', '37', '59', '82'] },
  };

  const ICON = {
    gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.1-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4"/>',
    hook: '<path d="M18 16.1A5 5 0 0 0 15.9 6L15 6a5 5 0 0 0-8.1 4M6 16a5 5 0 1 0 8 0M12 12l-3 5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    gauge: '<path d="M12 14l4-4M3.3 19a10 10 0 1 1 17.4 0"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"/>',
    cam: '<path d="M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7M6.6 6.6A13 13 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6M2 2l20 20"/>',
    car: '<path d="M19 17h2v-4l-2-5H5L3 13v4h2M7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM13 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8"/>',
    fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2-.2-3.8 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.6 1.2 1.6 2.4 2.5 2.8Z"/>',
    bomb: '<circle cx="11" cy="13" r="8"/><path d="m16.5 7.5 2-2M19 3l2 2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    logs: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
  };
  const svg = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ''}</svg>`;

  // ===== layout like the screenshots =====
  const TABS = [
    { id: 'settings', label: 'Settings', icon: 'gear', cards: [
      { title: 'General', sub: 'Configure general settings', icon: 'gear', rows: [
        { t: 'text', k: 'general.DiscordInvite', l: 'Discord Invite', ph: 'https://discord.gg/xxxx', d: 'Shown on the ban screen.' },
        { t: 'bool', k: 'general.RevealBanReason', l: 'Reveal Ban Reason', def: true, d: 'Show the real reason to the banned player.' },
        { t: 'bool', k: 'general.TxAdminIntegration', l: 'TxAdmin Integration', def: true, d: 'Admins can use txAdmin noclip/godmode. Cheat noclip still bans.' },
        { t: 'bool', k: 'general.BanIP', l: 'Ban IP', def: true, d: 'Also ban the IP address.' },
      ] },
      { title: 'Connection', sub: 'Configure connection settings', icon: 'plug', rows: [
        { t: 'bool', k: 'general.AntiVpn', l: 'Anti VPN', def: false, d: 'Refuse VPN / proxy / hosting IPs.' },
        { t: 'bool', k: 'general.AntiSpoof', l: 'Anti Spoof', def: true, d: 'Refuse players with no Rockstar license, no hardware id or duplicated licenses (HWID spoofers).' },
        { t: 'bool', k: 'general.RequireSteam', l: 'Require Steam', def: false, d: 'Steam must be open to join. Needs set steam_webApiKey in server.cfg.' },
        { t: 'bool', k: 'general.RequireDiscord', l: 'Require Discord', def: false, d: 'Discord must be open to join.' },
        { t: 'bool', k: 'general.RequireNormalName', l: 'Require Normal Name', def: false, d: 'No html, emojis, links or too short names.' },
      ] },
      { title: 'Webhooks', sub: 'Configure webhooks settings', icon: 'hook', rows: [
        { t: 'text', k: 'webhook', l: 'Main Webhook', ph: 'https://discord.com/api/webhooks/...', d: 'Used when a webhook below is empty.' },
        { t: 'text', k: 'webhooks.Ban', l: 'Ban Webhook', ph: 'empty = main' },
        { t: 'text', k: 'webhooks.Kick', l: 'Kick Webhook', ph: 'empty = main' },
        { t: 'text', k: 'webhooks.Warn', l: 'Warn Webhook', ph: 'empty = main', d: 'Detections set to WARN (log).' },
        { t: 'text', k: 'webhooks.Object', l: 'Object Webhook', ph: 'empty = main', d: 'Blocked vehicles / objects / peds.' },
        { t: 'text', k: 'webhooks.Vpn', l: 'Vpn Webhook', ph: 'empty = main', d: 'Refused connections.' },
        { t: 'text', k: 'webhooks.Logs', l: 'Logs Webhook', ph: 'empty = main', d: 'Server logs (join, deaths, resources...).' },
      ] },
    ] },
    { id: 'client', label: 'Client', icon: 'user', cards: [
      { title: 'Internal', sub: 'Configure internal settings', icon: 'shield', rows: ['LuaTamper', 'LuaMenu', 'Injection', 'ResourceStop', 'DevTools'] },
      { title: 'Player', sub: 'Configure player settings', icon: 'user', rows: ['GodMode', 'SemiGodMode', 'Invisible', 'HealthHack', 'ArmorHack', 'GhostMode', 'ShrinkPed', 'TeleportWaypoint'] },
      { title: 'Combat', sub: 'Configure combat settings', icon: 'target', rows: ['SilentAim', 'MagicBullet', 'DamageModifier', 'SuperPunch'] },
      { title: 'Players', sub: 'Configure players settings', icon: 'user', rows: ['KillRate', 'XssExploit', 'Spectate', 'AntiBurn'] },
      { title: 'Misc', sub: 'Configure misc settings', icon: 'eye', rows: ['ChangePed', 'ClearTasksOther', 'VisionHack'] },
      { title: 'Vehicles', sub: 'Configure vehicles settings', icon: 'car', rows: ['Hijack', 'ThrowVehicle', 'VehicleSpeedModifier', 'ChangePlate'] },
    ] },
    { id: 'movement', label: 'Movement', icon: 'plane', cards: [
      { title: 'Speed', sub: 'Configure speed settings', icon: 'gauge', rows: ['SpeedHack', 'SuperJump', 'InfiniteStamina'] },
      { title: 'Noclip', sub: 'Configure noclip settings', icon: 'plane', rows: ['NoClip', 'VehicleNoClip'] },
      { title: 'Freecam', sub: 'Configure freecam settings', icon: 'cam', rows: ['FreeCam'] },
      { title: 'Vehicles', sub: 'Configure vehicles settings', icon: 'car', rows: ['VehicleBoost'] },
    ] },
    { id: 'weapons', label: 'Weapons', icon: 'sword', cards: [
      { title: 'General', sub: 'Configure general settings', icon: 'gear', rows: ['GiveWeaponOther', 'RemoveWeaponOther'] },
      { title: 'Accuracy', sub: 'Configure accuracy settings', icon: 'target', rows: ['RapidFire'] },
      { title: 'Damage', sub: 'Configure damage settings', icon: 'heart', rows: ['WeaponDamage'] },
      { title: 'Ammos', sub: 'Configure ammos settings', icon: 'pulse', rows: ['InfiniteAmmo'] },
      { title: 'Blacklist', sub: 'Configure blacklist settings', icon: 'ban', rows: [{ det: 'BlacklistedWeapon', list: 'weapons' }] },
    ] },
    { id: 'event', label: 'Event', icon: 'gear', cards: [
      { title: 'General', sub: 'Configure general settings', icon: 'gear', rows: ['Heartbeat'] },
      { title: 'Limiter', sub: 'Configure limiter settings', icon: 'shield', rows: ['EventSpam'] },
      { title: 'Blacklist', sub: 'Configure blacklist settings', icon: 'ban', rows: [{ det: 'BlacklistedEvent', list: 'events' }] },
    ] },
    { id: 'entity', label: 'Entity', icon: 'box', cards: [
      { title: 'General', sub: 'Configure general settings', icon: 'gear', rows: ['EntityInjection', 'EntitySpam'] },
      { title: 'Particles', sub: 'Configure particles settings', icon: 'fire', rows: ['ParticleScale', 'ParticleSpam'] },
      { title: 'Vehicles', sub: 'Configure vehicles settings', icon: 'car', rows: ['VehicleSpam'] },
      { title: 'Peds', sub: 'Configure peds settings', icon: 'user', rows: ['PedSpam'] },
      { title: 'Objects', sub: 'Configure objects settings', icon: 'box', rows: ['ObjectSpam', { det: 'BlacklistedEntity', list: 'models' }] },
    ] },
    { id: 'explosions', label: 'Explosions', icon: 'bomb', cards: [
      { title: 'General', sub: 'Configure general settings', icon: 'gear', rows: ['HiddenExplosion', 'ExplosionScale'] },
      { title: 'Limiter', sub: 'Configure limiter settings', icon: 'shield', rows: ['Explosion', 'FireSpam', 'ProjectileSpam'] },
      { title: 'Blacklist', sub: 'Configure blacklist settings', icon: 'ban', rows: [{ det: 'BlacklistedExplosion', list: 'explosions' }] },
    ] },
    { id: 'logs', label: 'Logs', icon: 'logs', cards: [
      { title: 'Server logs', sub: 'Sent to the dashboard + logs webhook', icon: 'logs', rows: [
        ['Startup', 'Anti-cheat started'], ['ResourceStart', 'Resource started'], ['ResourceStop', 'Resource stopped'],
        ['Join', 'Player joined'], ['Leave', 'Player left'], ['Death', 'Deaths and kills'], ['Revive', 'Player revived'],
        ['Weapon', 'New weapons'], ['Explosion', 'Every explosion (spam)', false], ['Admin', 'Admin actions'],
      ].map(([n, d, def = true]) => ({ t: 'bool', k: `logs.${n}`, l: n.replace(/([a-z])([A-Z])/g, '$1 $2'), d, def })) },
    ] },
  ];

  // ===== state =====
  let cfg = {};
  let ctab = 'settings';
  let dirty = false;
  let ctx = null;
  try { ctab = localStorage.getItem('hs_ctab') || 'settings'; } catch {}

  const get = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), cfg);
  const set = (path, v) => {
    const parts = path.split('.');
    let o = cfg;
    parts.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
    o[parts.at(-1)] = v;
    dirty = true;
    const b = document.querySelector('[data-cfg-save]');
    if (b) b.classList.add('pulse');
  };
  const det = (n) => {
    cfg.detections = cfg.detections || {};
    const s = cfg.detections[n] || {};
    const [action, val] = D[n];
    return { enabled: s.enabled ?? true, action: s.action || action, value: s.value ?? (val ? val[0] : undefined) };
  };
  const setDet = (n, patch) => {
    cfg.detections = cfg.detections || {};
    cfg.detections[n] = { ...det(n), ...patch };
    dirty = true;
    const b = document.querySelector('[data-cfg-save]');
    if (b) b.classList.add('pulse');
  };
  const list = (k) => (cfg.lists && Array.isArray(cfg.lists[k]) ? cfg.lists[k] : LISTS[k].def);

  const ACT = { ban: 'BAN', kick: 'KICK', log: 'WARN' };
  const NEXT = { ban: 'kick', kick: 'log', log: 'ban' };

  const toggle = (on, attrs) => `<label class="switch"><input type="checkbox" ${attrs} ${on ? 'checked' : ''}><span></span></label>`;
  const info = (d) => (d ? `<span class="cfg-info" title="${esc(d)}">i</span>` : '');

  function rowHTML(r) {
    if (typeof r === 'string') r = { det: r };
    if (r.det) {
      const n = r.det;
      const s = det(n);
      const hasOpt = !!D[n][1] || !!r.list;
      return `<div class="cfg-row" data-search="${esc(LABEL(n).toLowerCase())}">
        <div class="cfg-name">${esc(LABEL(n))} ${info(D[n][2])}</div>
        <div class="cfg-ctrl">
          ${hasOpt ? `<button class="cfg-ico" data-cfg-opt="${n}" data-cfg-list="${r.list || ''}" title="Options">${svg('list', 15)}</button>` : ''}
          <button class="cfg-act act-${s.action}" data-cfg-act="${n}" title="Click to change: BAN / KICK / WARN">${ACT[s.action]}</button>
          ${toggle(s.enabled, `data-cfg-det="${n}"`)}
        </div></div>`;
    }
    const v = get(r.k);
    if (r.t === 'bool') {
      const on = v ?? r.def;
      return `<div class="cfg-row" data-search="${esc(r.l.toLowerCase())}">
        <div class="cfg-name">${esc(r.l)} ${info(r.d)}</div>
        <div class="cfg-ctrl">${toggle(on, `data-cfg-bool="${r.k}"`)}</div></div>`;
    }
    return `<div class="cfg-row cfg-row-text" data-search="${esc(r.l.toLowerCase())}">
      <div class="cfg-name">${esc(r.l)} ${info(r.d)}</div>
      <input class="input cfg-input" data-cfg-text="${r.k}" placeholder="${esc(r.ph || '')}" value="${esc(v || '')}"></div>`;
  }

  function cardHTML(c) {
    return `<div class="card cfg-card">
      <div class="cfg-head"><span class="cfg-head-ico">${svg(c.icon)}</span><div><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></div></div>
      <div class="cfg-rows">${c.rows.map(rowHTML).join('')}</div></div>`;
  }

  function draw(view) {
    const tab = TABS.find((t) => t.id === ctab) || TABS[0];
    view.innerHTML = `
      <div class="cfg-top">
        <div class="cfg-tabs">${TABS.map((t) => `<button class="cfg-tab ${t.id === tab.id ? 'active' : ''}" data-ctab="${t.id}">${svg(t.icon, 16)}<span>${t.label}</span></button>`).join('')}</div>
        <div class="cfg-actions">
          <input class="input" id="cfg-search" placeholder="Search settings...">
          <button class="btn btn-ghost btn-sm" data-cfg-refresh>↻ Refresh</button>
          <button class="btn btn-primary btn-sm ${dirty ? 'pulse' : ''}" data-cfg-save>Save</button>
        </div>
      </div>
      <div class="cfg-grid">${tab.cards.map(cardHTML).join('')}</div>
      <p class="cfg-note">Your FiveM server gets the new configuration within 1 minute. WARN = log only (no punishment).</p>`;
  }

  async function load(view) {
    const { settings } = await ctx.api(`/api/settings?server=${ctx.state.server}`);
    cfg = settings || {};
    if (!cfg.webhook && cfg.webhooks?.Main) cfg.webhook = cfg.webhooks.Main;
    dirty = false;
    draw(view);
  }

  function optionsModal(n, listKey) {
    const range = D[n][1];
    const s = det(n);
    const bg = document.createElement('div');
    bg.className = 'modal-bg open';
    bg.innerHTML = `<div class="card modal" style="width:min(520px,100%)">
      <h3>${esc(LABEL(n))}</h3><p>${esc(D[n][2])}</p>
      ${range ? `<label class="cfg-lbl">${esc(range[3])} <small>(${range[1]} - ${range[2]})</small></label>
        <input class="input" id="opt-val" type="number" min="${range[1]}" max="${range[2]}" value="${esc(s.value)}" style="width:100%;margin-bottom:16px">` : ''}
      ${listKey ? `<label class="cfg-lbl">${esc(LISTS[listKey].label)} <small>${esc(LISTS[listKey].hint)}</small></label>
        <textarea class="input" id="opt-list" rows="10" style="width:100%;margin-bottom:16px;font-family:ui-monospace,Consolas,monospace;resize:vertical">${esc(list(listKey).join('\n'))}</textarea>` : ''}
      <div class="modal-actions">
        ${listKey ? '<button class="btn btn-ghost btn-sm" data-o="reset">Reset list</button>' : ''}
        <button class="btn btn-ghost btn-sm" data-o="cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" data-o="ok">Apply</button>
      </div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => {
      const o = e.target.closest('[data-o]')?.dataset.o || (e.target === bg ? 'cancel' : null);
      if (!o) return;
      if (o === 'reset') { bg.querySelector('#opt-list').value = LISTS[listKey].def.join('\n'); return; }
      if (o === 'ok') {
        if (range) {
          const v = Number(bg.querySelector('#opt-val').value);
          if (!Number.isFinite(v) || v < range[1] || v > range[2]) return ctx.toast(`Value must be ${range[1]} - ${range[2]}`, true);
          setDet(n, { value: v });
        }
        if (listKey) {
          cfg.lists = cfg.lists || {};
          cfg.lists[listKey] = bg.querySelector('#opt-list').value.split('\n').map((x) => x.trim()).filter(Boolean);
          set('lists.' + listKey, cfg.lists[listKey]);
        }
        ctx.toast('Applied - click Save');
      }
      bg.remove();
    });
  }

  function bind(view) {
    if (view.dataset.cfgBound) return;
    view.dataset.cfgBound = '1';
    view.addEventListener('click', async (e) => {
      if (ctx.state.tab !== 'settings') return;
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ctab) {
        ctab = b.dataset.ctab;
        try { localStorage.setItem('hs_ctab', ctab); } catch {}
        return draw(view);
      }
      if (b.dataset.cfgAct) {
        const n = b.dataset.cfgAct;
        const a = NEXT[det(n).action];
        setDet(n, { action: a });
        b.className = `cfg-act act-${a}`;
        b.textContent = ACT[a];
        return;
      }
      if (b.dataset.cfgOpt) return optionsModal(b.dataset.cfgOpt, b.dataset.cfgList || null);
      if (b.dataset.cfgRefresh !== undefined) {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        return load(view);
      }
      if (b.dataset.cfgSave !== undefined) {
        b.disabled = true;
        try {
          const { settings } = await ctx.api('/api/settings', { method: 'POST', body: { server: ctx.state.server, settings: cfg } });
          cfg = settings;
          dirty = false;
          b.classList.remove('pulse');
          ctx.toast('Configuration saved');
        } catch (err) { ctx.toast(err.message, true); }
        b.disabled = false;
      }
    });
    view.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.cfgDet) setDet(el.dataset.cfgDet, { enabled: el.checked });
      if (el.dataset.cfgBool) set(el.dataset.cfgBool, el.checked);
      if (el.dataset.cfgText) set(el.dataset.cfgText, el.value.trim());
    });
    view.addEventListener('input', (e) => {
      if (e.target.id !== 'cfg-search') return;
      const q = e.target.value.trim().toLowerCase();
      view.querySelectorAll('.cfg-row').forEach((r) => { r.style.display = !q || r.dataset.search.includes(q) ? '' : 'none'; });
      view.querySelectorAll('.cfg-card').forEach((c) => {
        c.style.display = [...c.querySelectorAll('.cfg-row')].some((r) => r.style.display !== 'none') ? '' : 'none';
      });
    });
  }

  // ===================== MULTI-STREAM =====================
  const tiles = new Map(); // identifier -> { name, alive, last, n }

  function showFrame(id, t, blob) {
    const url = URL.createObjectURL(blob);
    const img = document.querySelector(`[data-tile="${CSS.escape(id)}"] img`);
    if (!img) return URL.revokeObjectURL(url);
    const old = img.src;
    img.src = url;
    img.classList.add('on');
    if (old.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(old), 500);
    t.frames = (t.frames || 0) + 1;
    t.last = Date.now();
  }

  function setStatus(id, live) {
    const st = document.querySelector(`[data-tile="${CSS.escape(id)}"] .tile-status`);
    if (!st) return;
    st.textContent = live ? '● LIVE' : 'Connecting...';
    st.classList.toggle('live', live);
  }

  const askStart = (id) => ctx.api('/api/command', { method: 'POST', body: { server: ctx.state.server, type: 'stream', identifier: id } }).catch(() => {});

  // Live: WebSocket push (smooth). Falls back to HTTP polling if WebSocket is not available.
  async function streamLoop(id) {
    const t = tiles.get(id);
    t.last = 0;
    askStart(id);
    // keep the player streaming while the tile is open
    const keep = setInterval(() => {
      if (tiles.get(id) !== t) return clearInterval(keep);
      if (Date.now() - t.last > 6000 || Date.now() - (t.asked || 0) > 40000) { t.asked = Date.now(); askStart(id); }
      setStatus(id, Date.now() - t.last < 3000);
    }, 2000);

    let wsFailed = 0;
    while (tiles.get(id) === t) {
      if (wsFailed < 3 && 'WebSocket' in window) {
        const ok = await new Promise((resolve) => {
          const proto = location.protocol === 'https:' ? 'wss' : 'ws';
          const ws = new WebSocket(`${proto}://${location.host}/ws/view?server=${ctx.state.server}&identifier=${encodeURIComponent(id)}`);
          ws.binaryType = 'blob';
          let opened = false;
          t.ws = ws;
          ws.onopen = () => { opened = true; };
          ws.onmessage = (e) => { if (tiles.get(id) === t && e.data instanceof Blob) showFrame(id, t, e.data); };
          ws.onclose = () => resolve(opened);
          const check = setInterval(() => { if (tiles.get(id) !== t) { clearInterval(check); ws.close(); } }, 500);
          ws.addEventListener('close', () => clearInterval(check));
        });
        if (!ok) wsFailed++;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      // HTTP fallback
      try {
        const r = await fetch(`/api/stream?server=${ctx.state.server}&identifier=${encodeURIComponent(id)}&t=${Date.now()}`, { credentials: 'same-origin' });
        if (r.ok) {
          const n = Number(r.headers.get('X-Frame') || 0);
          const blob = await r.blob();
          if (n !== t.n) { t.n = n; showFrame(id, t, blob); }
        }
        await new Promise((res) => setTimeout(res, r.ok ? 100 : 1000));
      } catch {
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
    clearInterval(keep);
  }

  // fps counter
  setInterval(() => {
    tiles.forEach((t, id) => {
      const el = document.querySelector(`[data-tile="${CSS.escape(id)}"] .tile-fps`);
      if (el) el.textContent = `${t.frames || 0} fps`;
      t.frames = 0;
    });
  }, 1000);

  function drawTiles() {
    const grid = document.querySelector('#ms-grid');
    if (!grid) return;
    const count = tiles.size;
    const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const sub = document.querySelector('#ms-sub');
    if (sub) sub.textContent = `${count}/16 streams active`;
    if (!count) {
      grid.innerHTML = `<div class="ms-empty">${svg('cam', 42)}<b>No streams selected</b><span>Select players from the sidebar to start watching</span></div>`;
      return;
    }
    // keep existing tiles (no flicker)
    grid.querySelector('.ms-empty')?.remove();
    grid.querySelectorAll('[data-tile]').forEach((el) => { if (!tiles.has(el.dataset.tile)) el.remove(); });
    tiles.forEach((t, id) => {
      if (grid.querySelector(`[data-tile="${CSS.escape(id)}"]`)) return;
      const el = document.createElement('div');
      el.className = 'ms-tile';
      el.dataset.tile = id;
      el.innerHTML = `<div class="ms-tile-head"><span>${esc(t.name)}</span><span class="tile-fps"></span><span class="tile-status">Connecting...</span>
        <button class="cfg-ico" data-ms-full title="Fullscreen">⤢</button><button class="cfg-ico" data-ms-close title="Close">✕</button></div>
        <div class="ms-screen"><img alt=""><div class="ms-wait">Starting stream...<br><small>live from the player's game</small></div></div>`;
      grid.appendChild(el);
    });
  }

  async function renderStream(view) {
    const { rows } = await ctx.api(`/api/data?server=${ctx.state.server}&type=players`);
    const online = rows.filter((r) => r.online);
    view.innerHTML = `<div class="ms">
      <div class="ms-main">
        <div class="ms-bar"><span id="ms-sub" class="cfg-note" style="margin:0"></span>
          <button class="btn btn-ghost btn-sm" data-ms-reset>✕ Reset</button></div>
        <div id="ms-grid" class="ms-grid"></div>
      </div>
      <aside class="card ms-side">
        <div class="ms-side-head"><b>Players Online</b><small>${online.length} Active</small></div>
        <input class="input" id="ms-search" placeholder="Search players..." style="width:100%;margin-bottom:10px">
        <div class="ms-list">${online.length ? online.map((r) => `
          <button class="ms-player ${tiles.has(r.identifier) ? 'active' : ''}" data-ms-add="${esc(r.identifier)}" data-name="${esc(r.player)}">
            <span>${esc(r.player)}</span>${svg('cam', 15)}</button>`).join('') : '<div class="empty" style="padding:20px">No players online</div>'}</div>
      </aside></div>`;
    drawTiles();
    if (!view.dataset.msBound) {
      view.dataset.msBound = '1';
      view.addEventListener('click', (e) => {
        if (ctx.state.tab !== 'stream') return;
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.msAdd) {
          const id = b.dataset.msAdd;
          if (tiles.has(id)) { tiles.delete(id); b.classList.remove('active'); return drawTiles(); }
          if (tiles.size >= 16) return ctx.toast('Max 16 streams', true);
          tiles.set(id, { name: b.dataset.name, n: -1 });
          b.classList.add('active');
          drawTiles();
          streamLoop(id);
        }
        if (b.dataset.msClose !== undefined) {
          const id = b.closest('[data-tile]').dataset.tile;
          tiles.delete(id);
          document.querySelector(`[data-ms-add="${CSS.escape(id)}"]`)?.classList.remove('active');
          drawTiles();
        }
        if (b.dataset.msFull !== undefined) {
          const el = b.closest('[data-tile]').querySelector('.ms-screen');
          if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.();
        }
        if (b.dataset.msReset !== undefined) {
          tiles.clear();
          view.querySelectorAll('.ms-player.active').forEach((x) => x.classList.remove('active'));
          drawTiles();
        }
      });
      view.addEventListener('input', (e) => {
        if (e.target.id !== 'ms-search') return;
        const q = e.target.value.toLowerCase();
        view.querySelectorAll('.ms-player').forEach((p) => { p.style.display = p.dataset.name.toLowerCase().includes(q) ? '' : 'none'; });
      });
    }
  }

  window.HSConfig = {
    async render(view, c) { ctx = c; bind(view); await load(view); },
    async renderStream(view, c) { ctx = c; await renderStream(view); },
    stopStreams() { tiles.forEach((t) => { try { t.ws && t.ws.close(); } catch {} }); tiles.clear(); },
  };
})();
