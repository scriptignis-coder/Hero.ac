// HeRo Shield dashboard
(() => {
  // Load v70 theme without requiring dashboard.html replacement in lightweight patches.
  if (!document.querySelector('link[href*="hs-unified-v70.css"]')) {
    const theme = document.createElement('link');
    theme.rel = 'stylesheet'; theme.href = '/assets/hs-unified-v70.css?v=70';
    document.head.appendChild(theme);
  }
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const state = { user: null, servers: [], server: null, tab: 'pins', q: '', cat: '', accountLicense: null };
  try { state.server = localStorage.getItem('hs_server'); } catch {}

  const TITLES = {
    overview: 'Overview', detections: 'Detections', bans: 'Bans', players: 'Players', logs: 'Logs',
    settings: 'Configuration', stream: 'Multi Stream', servers: 'My servers',
    rolemanager: 'Permission Manager', scanner: 'Download scanner', pins: 'Scan PINs', signatures: 'Signatures', staff: 'Staff team', access: 'Access', partners: 'Partners',
    discord: 'Discord check', scannergui: 'Scanner GUI', tutorial: 'Tutorial', changelogs: 'Changelogs',
    auditlogs: 'Activity logs', enterprisemanagement: 'Enterprise Management', licenselist: 'License list', filecheck: 'File Check', signatures: 'My Strings', webhooks: 'Webhooks', troubleshooting: 'Troubleshooting', profile: 'My Profile', subscription: 'My License', enterprise: 'Enterprise', analytics: 'Analytics', scanactivity: 'Scan Activity', ranking: 'Leaderboard', quicktools: 'Quick Tools', teamdirectory: 'Team Directory',
  };
  // The verdict on a PIN, in one word and one colour. The scanner writes 'cheating',
  // 'clean' or 'suspicious'; staff read the table fastest when the word matches the colour
  // and nothing else in the row competes with it.
  function hsResultBadge(r) {
    if (!r) return '<span class="badge hs-res res-wait">Waiting</span>';
    const v = String(r).toLowerCase();
    if (/cheat|detect|ban/.test(v))  return '<span class="badge hs-res res-detected">Detected</span>';
    if (/suspic|kick|review/.test(v)) return '<span class="badge hs-res res-suspicious">Suspicious</span>';
    if (/clean|safe|ok/.test(v))      return '<span class="badge hs-res res-safe">Safe</span>';
    return `<span class="badge hs-res res-wait">${esc(r)}</span>`;
  }

  const SCANNER_URL = 'https://github.com/scriptignis-coder/SouthSide/releases/download/v1.0/HeRoShield.exe';
  const ERRORS = {
    state: 'Session expired, try again.', token: 'Discord refused the login.',
    user: 'Could not read your Discord profile.', server: 'Server error, try again.',
  };

  // Same defaults as shared/config.lua
  const DETECTIONS = [
    { name: 'GodMode', desc: 'Player cannot take damage', enabled: true, action: 'ban' },
    { name: 'SpeedHack', desc: 'Max speed on foot (m/s)', enabled: true, action: 'kick', value: 12, min: 5, max: 100 },
    { name: 'NoClip', desc: 'Flying / no collision', enabled: true, action: 'ban' },
    { name: 'Invisible', desc: 'Player is invisible', enabled: true, action: 'kick' },
    { name: 'SuperJump', desc: 'Max jump height (m)', enabled: true, action: 'kick', value: 4, min: 1, max: 50 },
    { name: 'Spectate', desc: 'Spectator mode', enabled: true, action: 'ban' },
    { name: 'BlacklistedWeapon', desc: 'Forbidden weapons', enabled: true, action: 'ban' },
    { name: 'DamageModifier', desc: 'One shot / damage boost', enabled: true, action: 'ban' },
    { name: 'HealthArmor', desc: 'Health or armor above max', enabled: true, action: 'ban' },
    { name: 'VehicleBoost', desc: 'Vehicle power boost', enabled: true, action: 'kick' },
    { name: 'FreeCam', desc: 'Max camera distance (m)', enabled: true, action: 'kick', value: 120, min: 30, max: 1000 },
    { name: 'VisionHack', desc: 'Night / thermal vision', enabled: true, action: 'log' },
    { name: 'Injection', desc: 'Injected resource or fake token', enabled: true, action: 'ban' },
    { name: 'Heartbeat', desc: 'Anti-cheat stopped (seconds)', enabled: true, action: 'kick', value: 120, min: 30, max: 600 },
    { name: 'BlacklistedEvent', desc: 'Cheat menu events', enabled: true, action: 'ban' },
    { name: 'EventSpam', desc: 'Events per second', enabled: true, action: 'kick', value: 40, min: 5, max: 500 },
    { name: 'Explosion', desc: 'Explosions per 10 seconds', enabled: true, action: 'kick', value: 10, min: 1, max: 100 },
    { name: 'EntitySpam', desc: 'Entities per 10 seconds', enabled: true, action: 'kick', value: 60, min: 5, max: 500 },
    { name: 'VehicleSpam', desc: 'Vehicles spawned per 10 seconds', enabled: true, action: 'ban', value: 4, min: 1, max: 100 },
    { name: 'ObjectSpam', desc: 'Objects spawned per 10 seconds', enabled: true, action: 'ban', value: 15, min: 1, max: 300 },
    { name: 'BlacklistedEntity', desc: 'Forbidden vehicles / props', enabled: true, action: 'ban' },
    { name: 'EntityInjection', desc: 'Entity spawned by an injected menu', enabled: true, action: 'ban' },
    { name: 'FireSpam', desc: 'Fires per 10 seconds', enabled: true, action: 'kick', value: 15, min: 1, max: 200 },
    { name: 'ParticleSpam', desc: 'Particles per 10 seconds', enabled: true, action: 'kick', value: 40, min: 5, max: 500 },
    { name: 'ProjectileSpam', desc: 'Projectiles per 10 seconds', enabled: true, action: 'kick', value: 40, min: 5, max: 500 },
    { name: 'GiveWeaponOther', desc: 'Gives weapons to other players', enabled: true, action: 'ban' },
    { name: 'RemoveWeaponOther', desc: 'Removes weapons of other players', enabled: true, action: 'kick' },
    { name: 'ClearTasksOther', desc: 'Kicks players out of cars / freezes them', enabled: true, action: 'kick' },
    { name: 'WeaponDamage', desc: 'Max damage per hit', enabled: true, action: 'log', value: 300, min: 50, max: 5000 },
  ];


  const LOGS = [
    { name: 'Startup', desc: 'Anti-cheat started' }, { name: 'ResourceStart', desc: 'Resource started' },
    { name: 'ResourceStop', desc: 'Resource stopped' }, { name: 'Join', desc: 'Player joined' },
    { name: 'Leave', desc: 'Player left' }, { name: 'Death', desc: 'Deaths and kills' },
    { name: 'Revive', desc: 'Player revived' }, { name: 'Weapon', desc: 'New weapons' },
    { name: 'Explosion', desc: 'Every explosion (spam)', off: true }, { name: 'Admin', desc: 'Admin actions' },
  ];

  // ---------- utils ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
  const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');
  const fmtTime = (s) => {
    s = Number(s || 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  };
  const ago = (d) => {
    if (!d) return 'never';
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  };

  let toastTimer;
  function toast(msg, err = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show${err ? ' err' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 3200);
  }

  // v74 — every request gets a deadline.
  //
  // fetch() has no timeout of its own: if the server accepts the connection and then never
  // answers, the promise simply never settles. Every caller here does `view.innerHTML =
  // loading()` and then awaits, so one hung request left the spinner turning for the rest of
  // the session with nothing on screen to say what happened. That is the "spinner that never
  // stops" - it was never a spinner bug, it was a request with no end.
  //
  // 20 seconds is past anything this API does normally and short enough that somebody is
  // still watching when it gives up.
  const API_TIMEOUT_MS = 20000;

  async function api(path, opts = {}) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeout || API_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(path, {
        method: opts.method || 'GET',
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'same-origin',
        signal: ac.signal,
      });
    } catch (e) {
      // Abort and a dropped connection arrive here the same way, and the difference matters
      // to whoever is reading it: one means the server is slow, the other that it is gone.
      const err = new Error(e && e.name === 'AbortError'
        ? 'The server did not answer within 20 seconds.'
        : 'Could not reach the server. Check your connection.');
      err.retryable = true;
      throw err;
    } finally {
      clearTimeout(timer);
    }
    let data = {};
    try { data = await r.json(); } catch {}
    if (r.status === 401 && !path.includes('/api/me')) { showLogin(); throw new Error('Not logged in'); }
    // A blacklisted account gets 403 on everything, so catching it here means the screen is
    // shown once, from whichever request happened to be first, instead of 20 error toasts.
    if (r.status === 403 && data && data.blacklisted) { showBlacklisted(data); throw new Error('blacklisted'); }
    if (!r.ok) {
      const err = new Error(data.error || `Error ${r.status}`);
      // 5xx and 429 are worth pressing Retry for; 400 and 404 never are, and offering a
      // button that cannot help is worse than offering none.
      err.retryable = r.status >= 500 || r.status === 429;
      throw err;
    }
    return data;
  }


  // The whole dashboard replaced by one explanation. It says what was seen, not just "blocked":
  // a block nobody can explain reads as a bug, and the operator then answers the same question
  // all evening. The way out is named too, because there is one.
  let _blShown = false;
  function showBlacklisted(data) {
    if (_blShown) return;
    _blShown = true;
    const reason = data.blacklistReason || data.error || 'This account is blacklisted.';
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
                  background:#09090b;color:#e8eaed;font-family:Inter,-apple-system,'Segoe UI',system-ui,sans-serif">
        <div style="max-width:520px;background:#121314;border:1px solid #1f1f1f;border-left:3px solid #e04b56;
                    border-radius:12px;padding:30px 32px">
          <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#f0959b;font-weight:700">
            Account blacklisted</div>
          <h1 style="margin:12px 0 10px;font-size:23px;font-weight:700;letter-spacing:-.02em;color:#fff">
            You cannot use the dashboard</h1>
          <p style="margin:0 0 16px;color:#8b8f96;font-size:14px;line-height:1.6">${esc(reason)}</p>
          <div style="background:#0d0d0f;border:1px solid #1f1f1f;border-radius:9px;padding:14px 16px;
                      color:#8b8f96;font-size:13px;line-height:1.6">
            Scans that start and never finish are recorded. A scanner killed once in a while is
            normal — antivirus, a crash, a PC switched off. Repeatedly is not, and that is what
            this is.
          </div>
          <p style="margin:16px 0 0;color:#5f636a;font-size:12.5px">
            If this is wrong, open a ticket in Discord. Staff can lift it.</p>
        </div>
      </div>`;
  }

  function modal({ title, text, input = false, value = '', ok = 'OK', danger = false }) {
    return new Promise((resolve) => {
      $('#modal-title').textContent = title;
      $('#modal-text').textContent = text || '';
      const inp = $('#modal-input');
      inp.hidden = !input;
      inp.value = value;
      const okBtn = $('#modal-ok');
      okBtn.textContent = ok;
      okBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;
      $('#modal').classList.add('open');
      if (input) setTimeout(() => inp.focus(), 50);
      const close = (val) => {
        $('#modal').classList.remove('open');
        okBtn.onclick = null; $('#modal-cancel').onclick = null; inp.onkeydown = null;
        resolve(val);
      };
      okBtn.onclick = () => close(input ? inp.value.trim() : true);
      $('#modal-cancel').onclick = () => close(null);
      inp.onkeydown = (e) => { if (e.key === 'Enter') okBtn.click(); if (e.key === 'Escape') close(null); };
    });
  }

  const loading = () => `
    <div class="kpis">${'<div class="card kpi"><div class="skeleton" style="height:54px"></div></div>'.repeat(4)}</div>
    <div class="card panel"><div class="skeleton" style="height:220px"></div></div>`;

  // ---------- auth ----------
  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    const err = new URLSearchParams(location.search).get('error');
    if (err) { $('#login-error').textContent = ERRORS[err] || 'Login error.'; $('#login-error').hidden = false; }
  }

  async function init() {
    try {
      state.user = await api('/api/me');
    } catch {
      return showLogin();
    }
    const acc = state.user.access || { heroshield: false, herocheck: false, admin: false };
    if (!acc.herocheck && !acc.admin) {
      $('#login').hidden = false; $('#app').hidden = true;
      $('#login-error').hidden = true;
      document.getElementById('login-intro').hidden = true;
      document.getElementById('hs-discord-login').hidden = true;
      document.getElementById('hs-activation-heading').hidden = false;
      document.getElementById('hs-activation-slot').hidden = false;
      await window.hsLicensePanel?.();
      return;
    }
    if (location.search) history.replaceState(null, '', '/dashboard');
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#u-name').textContent = state.user.name;
    if (state.user.avatar) {
      $('#u-avatar').src = state.user.avatar;
      $('#u-avatar').hidden = false;
      $('#u-fallback').hidden = true;
    }
    // 👁️ Admin (test): every tab is visible, but nothing can be changed (the server refuses every change)
    if (acc.viewer && !document.getElementById('viewonly-bar')) {
      document.body.classList.add('view-only');
      const bar = document.createElement('div');
      bar.id = 'viewonly-bar';
      bar.textContent = '👁️ Admin (test) — view only: you can open every tab, but you cannot change anything.';
      bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#0b0c0f;color:#cfe3ff;border:1px solid rgba(47,155,255,.45);border-radius:12px;padding:10px 16px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45);max-width:calc(100vw - 32px);text-align:center';
      document.body.appendChild(bar);
      const st = document.createElement('style');
      st.textContent = 'body.view-only main .btn-primary,body.view-only main .btn-danger,body.view-only main button[type=submit]{opacity:.45;cursor:not-allowed}';
      document.head.appendChild(st);
    }
    // Permission-based tab visibility
    state.access = acc;
    try {
      const licenseData = await api('/api/licenses');
      state.accountLicense = licenseData.license || null;
    } catch (error) {
      console.warn('Account license lookup failed:', error.message);
      state.accountLicense = null;
    }
    document.querySelectorAll('[data-enterprise-tab]').forEach(el => {
      el.hidden = !(state.accountLicense?.plan === 'enterprise' && state.accountLicense?.role === 'owner');
    });
    document.querySelectorAll('[data-perm]').forEach(el => {
      const p = el.dataset.perm;
      el.hidden = !acc[p];
    });
    // Scanner-only workspace does not require a FiveM server.
    state.servers = []; state.server = null;
    const hash = location.hash.slice(1);
    const defaultTab = acc.admin ? 'rolemanager' : 'pins';
    go(canAccess(hash) ? hash : defaultTab);
  }

  async function loadServers() {
    const { servers } = await api('/api/servers');
    state.servers = servers;
    if (!servers.find((s) => s.id === state.server)) state.server = servers[0] ? servers[0].id : null;
    try { if (state.server) localStorage.setItem('hs_server', state.server); } catch {}
    const sel = $('#server-select');
    sel.innerHTML = servers.length
      ? servers.map((s) => `<option value="${s.id}" ${s.id === state.server ? 'selected' : ''}>${esc(s.name)}</option>`).join('')
      : '<option>No server</option>';
    sel.disabled = !servers.length;
  }

  // ---------- navigation ----------
  const PERM_MAP = {
    overview:'heroshield', detections:'heroshield', bans:'heroshield',
    players:'heroshield', logs:'heroshield', stream:'heroshield', settings:'heroshield',
    scanner:'herocheck', pins:'herocheck', signatures:'herocheck', discord:'herocheck', scannergui:'herocheck',
    analytics:'heroshield', scanactivity:'herocheck', access:'admin', partners:'admin', rolemanager:'admin', staff:'admin', teamdirectory:'admin', auditlogs:'heroshield', enterprisemanagement:'heroshield', licenselist:'heroshield', filecheck:'herocheck', signatures:'herocheck'
  };
  function canAccess(tab) {
    if (tab === 'enterprise') return state.accountLicense?.plan === 'enterprise' && state.accountLicense?.role === 'owner';
    if (!TITLES[tab] || tab === 'quicktools' || ['overview','detections','bans','players','logs','stream','settings','servers','analytics'].includes(tab)) return false;
    const p = PERM_MAP[tab];
    if (!p) return true;
    const acc = state.access || {};
    return !!acc[p] || (p === 'herocheck' && !!acc.admin);
  }
  function go(tab) {
    if (!canAccess(tab)) return;
    if (tab !== 'stream' && window.HSConfig) window.HSConfig.stopStreams();
    state.tab = tab;
    state.q = '';
    $('#search').value = '';
    state.cat = '';
    $('#search').hidden = !['detections', 'bans', 'players', 'logs'].includes(tab);
    $('#server-select').style.display = 'none';
    $('#page-title').textContent = TITLES[tab];
    $$('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    history.replaceState(null, '', `#${tab}`);
    render();
  }

  // v74 — one safety net for every tab.
  //
  // Before this, the tabs fell into three groups: a few passed their failure to wsError, a few
  // showed a bare message with no way out, and MOST had no catch at all - `return renderX(view)`
  // and nothing else. Those last ones are where the endless spinner came from: the tab sets
  // `view.innerHTML = loading()`, its API call rejects, the rejection goes nowhere, and the
  // spinner is still turning an hour later with no error anywhere on screen.
  //
  // Rather than add a catch to thirty call sites and miss the thirty-first, `render` is wrapped
  // once. Whatever a tab throws, the person sees what happened and a Retry that re-runs that
  // same tab. A tab that handles its own errors is unaffected: it never throws this far.
  async function render() {
    const tabAtStart = state.tab;
    try {
      return await renderTab();
    } catch (e) {
      // A login redirect and the blacklist screen have already taken over the page; turning
      // them into an error card would hide what they are saying.
      if (e && (e.message === 'Not logged in' || e.message === 'blacklisted')) return;
      const view = $('#view');
      if (view) wsError(view, e, () => { state.tab = tabAtStart; render(); });
    }
  }

  async function renderTab() {
    const view = $('#view');
    
    if (state.tab === 'teamdirectory') return renderTeamDirectory(view);
    if (state.tab === 'profile') return renderProfile(view);
    if (state.tab === 'subscription') return renderSubscription(view);
    if (state.tab === 'enterprise') return renderEnterprise(view);
    if (state.tab === 'enterprisemanagement') return renderEnterpriseManagement(view);
    if (state.tab === 'licenselist') return renderLicenseList(view);
    if (state.tab === 'filecheck') return renderFileCheck(view);
    if (state.tab === 'webhooks') return renderWebhooks(view);
    if (state.tab === 'ranking') return renderRanking(view);
    if (state.tab === 'scanactivity') return renderScanActivity(view);
    // Server analytics are intentionally not exposed in scanner-only mode.
    // FiveM server management is not part of this scanner-only workspace.
    // v32: Discord check and Signatures pages were removed — the scan reads the Discord servers by itself and the scanner has its own signatures
    // v79 — Signatures is a page again. It was being bounced to Scan PINs, which left the
    // operator's own detection rules with no way in at all. Discord still redirects: that one
    // really did move into the report.
    if (state.tab === 'discord') state.tab = 'pins';
    if (state.tab === 'scanner') return renderScanner(view);
    if (state.tab === 'pins') {
      // show the last list at once, then refresh it in the background
      if (state.pinsResp) { try { await renderPins(view, state.pinsResp); } catch { } }
      else view.innerHTML = loading();
      try { await renderPins(view); } catch(e) { if (!state.pinsResp) wsError(view, e, () => renderPins(view)); }
      return;
    }
    if (state.tab === 'discord') { view.innerHTML = loading(); try { await renderDiscordCheck(view); } catch(e) { wsError(view, e, () => renderDiscordCheck(view)); } return; }
    if (state.tab === 'scannergui') { view.innerHTML = loading(); try { await renderScannerGui(view); } catch(e) { wsError(view, e, () => renderScannerGui(view)); } return; }
    if (state.tab === 'signatures') return renderSignatures(view);
    if (state.tab === 'staff') return renderStaff(view);
    if (state.tab === 'tutorial') return renderTutorial(view);
    if (state.tab === 'troubleshooting') return renderTroubleshooting(view);
    if (state.tab === 'changelogs') return renderChangelogs(view);
    if (state.tab === 'rolemanager') return renderRoleManager(view);   // v74: errors handled by the wrapper in render()
    if (state.tab === 'partners') return renderPartners(view);   // v74: errors handled by the wrapper in render()
    if (state.tab === 'access') return renderAccess(view);   // v74: errors handled by the wrapper in render()
    if (state.tab === 'auditlogs') return renderAuditLogs(view);   // v74: errors handled by the wrapper in render()
    if (!state.server) {
      view.innerHTML = `<div class="card empty">
        <p style="margin-bottom:16px">You don't have a server yet.</p>
        <button class="btn btn-primary" data-go="servers">Add a server</button></div>`;
      return;
    }
    view.innerHTML = loading();
    try {
      if (state.tab === 'overview') await renderOverview(view);
      else if (state.tab === 'settings') await window.HSConfig.render(view, { api, toast, state, modal });
      else if (state.tab === 'stream') await window.HSConfig.renderStream(view, { api, toast, state, modal });
      else if (state.tab === 'logs') await renderLogs(view);
      else if (state.tab === 'pins') await renderPins(view);
      else if (state.tab === 'discord') await renderDiscordCheck(view);
      else if (state.tab === 'scannergui') await renderScannerGui(view);
      else await renderTable(view, state.tab);
    } catch (e) {
      // Re-thrown so the wrapper in render() renders it with a Retry, instead of the bare
      // message this used to leave on screen.
      throw e;
    }
  }


  // 🤝 Partners on the website — only the Owner and Admins see this page (the server refuses everyone else)
  async function renderPartners(view) {
    view.innerHTML = loading();
    const d = await api('/api/partners');
    const list = d.partners || [];
    view.innerHTML = `
      <div class="workspace-section">
        <h3>Add a partner</h3>
        <p class="workspace-note">Paste the partner's Discord invite (make it <b>never expire</b>) and a short description. The server name, logo and member count are read from Discord automatically. It appears on the website in the Partners section.</p>
        <div style="display:grid;gap:10px;margin-top:14px">
          <input class="input" id="pt-invite" placeholder="https://discord.gg/xxxxxxx" maxlength="120">
          <textarea class="input" id="pt-desc" rows="3" maxlength="300" placeholder="Short description — e.g. FiveM RP server using HeRo Shield for every screenshare."></textarea>
          <div style="display:flex;gap:10px;align-items:center"><button class="btn btn-primary" id="pt-add">Add partner</button><span class="workspace-note" id="pt-count">0 / 300</span></div>
        </div>
      </div>
      <div class="workspace-section" style="margin-top:14px">
        <h3>Partners on the website (${list.length})</h3>
        ${list.length ? `<div style="display:grid;gap:10px;margin-top:12px">${list.map((p) => `
          <div style="display:flex;gap:14px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#0a0b0d">
            <img src="${esc(p.icon || '/assets/logo-neon-sm.jpg')}" alt="" style="width:46px;height:46px;border-radius:12px;object-fit:cover" referrerpolicy="no-referrer">
            <div style="flex:1;min-width:0"><b>${esc(p.name)}</b>${p.members ? ` <span class="workspace-note">· ${Number(p.members).toLocaleString()} members</span>` : ''}
              <div class="workspace-note" style="margin-top:2px">${esc(p.description)}</div>
              <a class="workspace-note" href="${esc(p.invite)}" target="_blank" rel="noopener" style="color:var(--cyan)">${esc(p.invite)}</a></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${p.icon ? `<a class="btn btn-ghost btn-sm" href="${esc(p.icon)}" target="_blank" rel="noopener">Logo</a>` : ''}<button class="btn btn-ghost btn-sm" data-pt-ref="${esc(p.invite)}" data-pt-desc="${esc(p.description)}">Refresh</button><button class="btn btn-danger btn-sm" data-pt-del="${Number(p.id)}">Remove</button></div>
          </div>`).join('')}</div>` : '<p class="workspace-note" style="margin-top:10px">No partner yet.</p>'}
      </div>`;
    const desc = $('#pt-desc', view);
    desc.addEventListener('input', () => { $('#pt-count', view).textContent = desc.value.length + ' / 300'; });
    $('#pt-add', view).addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        await api('/api/partners', { method: 'POST', body: { invite: $('#pt-invite', view).value, description: desc.value } });
        toast('Partner added — it is on the website now'); await renderPartners(view);
      } catch (err) { toast(err.message, true); b.disabled = false; }
    });
    // reads the name / logo / member count from Discord again (after the partner changed its server picture)
    view.querySelectorAll('[data-pt-ref]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await api('/api/partners', { method: 'POST', body: { invite: b.dataset.ptRef, description: b.dataset.ptDesc } }); toast('Updated from Discord'); await renderPartners(view); }
      catch (err) { toast(err.message, true); b.disabled = false; }
    }));
    view.querySelectorAll('[data-pt-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await modal({ title: 'Remove this partner?', text: 'It disappears from the website right away.', ok: 'Remove', danger: true }))) return;
      try { await api('/api/partners?id=' + b.dataset.ptDel, { method: 'DELETE' }); toast('Partner removed'); await renderPartners(view); }
      catch (err) { toast(err.message, true); }
    }));
  }

  // Workspace pages use existing authenticated endpoints, never client-side fake counters.
  // v74 — an error the person can act on: what happened, and a way out of it.
  // `retry` is the function that was being attempted; when one is passed and the error is the
  // kind that could succeed on a second try, the button re-runs it in place.
  function wsError(view, e, retry) {
    const msg = (e && e.message) || 'Could not load data';
    const can = !!retry && (!e || e.retryable !== false);
    view.innerHTML = `<div class="workspace-section" style="text-align:center;padding:38px 20px">
        <div style="font-size:15px;color:var(--text);margin-bottom:6px">Could not load this</div>
        <div style="color:var(--muted);font-size:13px;margin-bottom:${can ? '18px' : '0'}">${esc(msg)}</div>
        ${can ? '<button class="btn btn-primary btn-sm" data-ws-retry>Retry</button>' : ''}
      </div>`;
    if (can) view.querySelector('[data-ws-retry]').addEventListener('click', () => {
      view.innerHTML = loading();
      retry();
    });
  }
  function wsAvatar(user) { return user.avatar ? `<img class="workspace-avatar" src="${esc(user.avatar)}" alt="Discord avatar" referrerpolicy="no-referrer">` : `<div class="workspace-avatar-fallback">${esc((user.name || '?')[0])}</div>`; }
  function wsHero(user, sub) { return `<div class="workspace-hero">${wsAvatar(user)}<div><h2>${esc(user.display_name || user.name || 'Discord user')}</h2><p style="margin:4px 0;color:var(--muted)">@${esc(user.username || user.name || 'unknown')}</p><p>Discord ID · <span class="mono">${esc(user.id)}</span></p>${sub ? `<p>${sub}</p>` : ''}</div></div>`; }
  function wsStat(label, value) { return `<div class="workspace-card"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`; }
  function wsAccess() { const a=state.user.access || {}; if (a.viewer) return 'Admin (test) — view only'; return [a.admin&&'Admin',a.heroshield&&'Staff',a.herocheck&&'Scanner'].filter(Boolean).join(' · ') || 'No staff permissions'; }

  // The name and logo beside the shield, from the operator's saved appearance.
  function applyBrand() {
    const p = (window.HSAppearance && window.HSAppearance.read()) || {};
    const t = document.querySelector('.brand span, .brand b, .brand');
    if (t && p.brand) t.textContent = p.brand;
    const img = document.querySelector('.brand img');
    if (img && p.logo) img.src = p.logo;
  }

  async function renderProfile(view) {
    view.innerHTML=loading();
    try {
      const billing=await api('/api/billing-status');
      view.innerHTML=wsHero(state.user,'Your connected Discord identity')+`<div class="workspace-grid">${wsStat('Discord username','@'+(state.user.username||state.user.name||'Unknown'))}${wsStat('Display name',state.user.display_name||state.user.name||'Unknown')}${wsStat('Discord ID',state.user.id)}${wsStat('Staff permissions',wsAccess())}${wsStat('Scanner access',(state.access?.herocheck || state.access?.admin)?'Granted':'Not granted')}${wsStat('Access time', state.user?.expires_at ? (Date.parse(state.user.expires_at) > Date.now() ? 'Until ' + fmtDate(state.user.expires_at) : 'Expired') : 'Lifetime')}${wsStat('License',state.accountLicense?(state.accountLicense.plan==='enterprise'?'Enterprise':'Personal'):(state.access?.admin||state.access?.heroshield?'Staff permission':'Inactive'))}</div><div class="workspace-section"><h3>Account details</h3><p class="workspace-note">Your profile and avatar come from your authenticated Discord session. Permissions are managed by the HeRoShield administrator; a purchase does not grant staff privileges.</p><div class="workspace-actions"><button class="btn btn-primary" data-go="subscription">View license</button><button class="btn btn-ghost" data-go="pins">Scan PINs</button><a class="btn btn-ghost" href="/api/auth/logout">Log out</a></div></div>`;
      const opt=await api('/api/leaderboard-optin');
      view.innerHTML+=`<div class="workspace-section"><h3>Profile settings</h3><p class="workspace-note">Your name and avatar sync from Discord. Control whether your profile appears in the public leaderboard.</p><label style="display:flex;gap:12px;align-items:center"><input type="checkbox" id="profile-optin" ${opt.opted_in?'checked':''}> Show my Discord name/avatar on the leaderboard</label><div class="workspace-actions"><button class="btn btn-primary" data-saveprofile>Save settings</button></div></div>`;
      // ── Appearance ──────────────────────────────────────────────────────────────────
      // The operator's own colour, name and picture. It is kept in this browser rather than
      // on the server: it changes nothing a teammate sees, so there is nothing to sync and
      // nothing that can fail. The brand line at the top of the sidebar updates live.
      const A = window.HSAppearance;
      if (A) {
        const pref = A.read() || {};
        const cur = (A.PRESETS.find((p) => p.id === pref.preset) || A.PRESETS[0]);
        // insertAdjacentHTML, not innerHTML +=. The second one re-parses everything already
        // on the page, which silently throws away every listener attached before it — that is
        // why the colour buttons below did nothing the first time this was written.
        view.insertAdjacentHTML('beforeend', `<div class="workspace-section"><h3>Appearance</h3>
          <p class="workspace-note">Your colour, your name, your logo. Saved in this browser — your staff keep their own.</p>

          <label style="display:block;margin:16px 0 8px;font-size:13px;color:var(--muted)">Colour</label>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            ${A.PRESETS.map((p) => `<button data-ap-preset="${p.id}" title="${esc(p.name)}"
                 style="width:30px!important;height:30px!important;min-width:0!important;padding:0!important;
                        border-radius:50%!important;background:${p.accent}!important;cursor:pointer;
                        border:2px solid ${(pref.accent || cur.accent) === p.accent ? '#fff' : 'transparent'}!important;
                        box-shadow:0 0 0 1px var(--line2)"></button>`).join('')}
            <input type="color" data-ap-custom value="${esc(pref.accent || cur.accent)}"
                   title="Any colour" style="width:34px;height:30px;padding:0;border:none;background:none;cursor:pointer">
          </div>

          <label style="display:block;margin:18px 0 8px;font-size:13px;color:var(--muted)">
            Background — <span data-ap-depthlabel>${pref.depth > 0.5 ? 'lighter' : 'black'}</span></label>
          <input type="range" data-ap-depth min="0" max="1" step="0.1" value="${pref.depth || 0}" style="width:220px">

          <label style="display:block;margin:18px 0 8px;font-size:13px;color:var(--muted)">Name beside the logo</label>
          <input class="input" data-ap-name maxlength="24" placeholder="HeRo Shield" value="${esc(pref.brand || '')}" style="max-width:320px">

          <label style="display:block;margin:16px 0 8px;font-size:13px;color:var(--muted)">Logo</label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <img data-ap-logopreview src="${esc(pref.logo || '/assets/hero-icon.png')}" alt=""
                 style="width:38px;height:38px;border-radius:9px;object-fit:cover;background:var(--s2)">
            <button class="btn btn-ghost btn-sm" data-ap-logopick>Choose an image</button>
            ${pref.logo ? '<button class="btn btn-ghost btn-sm" data-ap-logoclear>Remove</button>' : ''}
            <input type="file" accept="image/*" hidden data-ap-logofile>
          </div>

          <div class="workspace-actions" style="margin-top:18px">
            <button class="btn btn-primary" data-ap-save>Save appearance</button>
            <button class="btn btn-ghost" data-ap-reset>Back to default</button>
          </div></div>`);

        const draft = { ...pref };
        const live = () => A.apply(draft);
        const q = (sel) => view.querySelector(sel);

        view.querySelectorAll('[data-ap-preset]').forEach((b) => b.addEventListener('click', () => {
          const p = A.PRESETS.find((x) => x.id === b.dataset.apPreset);
          draft.preset = p.id; draft.accent = p.accent; draft.ground = p.ground;
          view.querySelectorAll('[data-ap-preset]').forEach((o) => o.style.setProperty(
            'border-color', o.dataset.apPreset === p.id ? '#fff' : 'transparent', 'important'));
          q('[data-ap-custom]').value = p.accent;
          live();
        }));
        q('[data-ap-custom]').addEventListener('input', (e) => {
          draft.accent = e.target.value;
          view.querySelectorAll('[data-ap-preset]').forEach((o) => o.style.setProperty('border-color', 'transparent', 'important'));
          live();
        });
        q('[data-ap-depth]').addEventListener('input', (e) => {
          draft.depth = parseFloat(e.target.value);
          q('[data-ap-depthlabel]').textContent = draft.depth > 0.5 ? 'lighter' : 'black';
          live();
        });
        q('[data-ap-logopick]').addEventListener('click', () => q('[data-ap-logofile]').click());
        q('[data-ap-logofile]').addEventListener('change', (e) => {
          const f = e.target.files[0];
          if (!f) return;
          // 512 KB: it is stored as a data URL in this browser, and localStorage is small.
          if (f.size > 512 * 1024) return toast('Pick an image under 512 KB', true);
          const fr = new FileReader();
          fr.onload = () => { draft.logo = String(fr.result); q('[data-ap-logopreview]').src = draft.logo; };
          fr.readAsDataURL(f);
        });
        q('[data-ap-logoclear]')?.addEventListener('click', () => {
          delete draft.logo;
          q('[data-ap-logopreview]').src = '/assets/hero-icon.png';
        });
        q('[data-ap-save]').addEventListener('click', () => {
          draft.brand = q('[data-ap-name]').value.trim();
          A.save(draft);
          applyBrand();
          toast('Appearance saved');
        });
        q('[data-ap-reset]').addEventListener('click', () => {
          A.reset(); applyBrand(); renderProfile(view); toast('Back to the default look');
        });
      }

    } catch(e){wsError(view, e, () => renderProfile(view));}
  }
  async function renderSubscription(view) {
    view.innerHTML=loading();
    try {
      const [data, scanner] = await Promise.all([
        api('/api/licenses'),
        api('/api/scanner-licenses').catch(() => ({licenses:[]}))
      ]);
      const lic=data.license;
      state.accountLicense=lic||null;
      document.querySelectorAll('[data-enterprise-tab]').forEach(el => {
        el.hidden=!(lic?.plan==='enterprise' && lic?.role==='owner');
      });
      const staff=!!(state.access?.admin || state.access?.heroshield);
      const access=staff ? (state.access?.admin ? 'Admin' : 'Staff') : lic ? 'Licensed user' : 'No active license';
      const type=lic ? (lic.plan==='enterprise'?'Enterprise':'Personal') : 'None';
      const scannerLicenses=scanner.licenses||[];
      const expiry=lic?.expires_at ? Date.parse(lic.expires_at) : null;
      view.innerHTML=`<div class="workspace-hero"><div><h2>My License</h2><p>License linked to your Discord account.</p></div></div>
        <div class="workspace-grid">${wsStat('Access',access)}${wsStat('Account license',type)}${wsStat('Scanner access',state.access?.herocheck?'Granted':'Not granted')}</div>
        <div class="workspace-section"><h3>License remaining time</h3><div class="workspace-card"><strong id="hs-license-countdown" data-expiry="${expiry||''}">${lic?(expiry?'Calculating…':'Lifetime — Never expires'):'No active license'}</strong></div></div><div class="workspace-section"><h3>My account license</h3>
          ${lic ? `<div class="workspace-card"><strong>${esc(type)} · ${esc(lic.role==='owner'?'Owner':'Member')}</strong><p class="workspace-note">Active · Expires: ${lic.expires_at?fmtDate(lic.expires_at):'Lifetime'}${lic.plan==='enterprise'?' · Seats: '+Number(lic.seats):''}</p>${lic.role==='owner'&&lic.key_masked?`<p class="workspace-note">License key: ${esc(lic.key_masked)} (hidden for security)</p>`:''}${lic.plan==='enterprise'&&lic.role==='owner'?'<button class="btn btn-primary" data-go="enterprise">Manage Enterprise</button>':''}</div>` : '<p class="workspace-note">No active account license linked to your Discord account.</p>'}
        </div><div class="workspace-section"><h3>Scanner PIN licenses</h3><p class="workspace-note">Scan PINs are automatically linked to your active account license. ${scannerLicenses.filter(l=>!l.revoked_at).length} active PIN workspace(s).</p>
        ${scannerLicenses.map(l=>`<div class="workspace-card" style="margin:12px 0"><strong>${esc(l.label)}</strong><p class="workspace-note">${l.revoked_at?'Revoked':'Active'} · Created ${fmtDate(l.created_at)}</p><div class="workspace-actions"><code>${lic?.role==='owner'?esc(l.license_key):'••••••••'}</code>${lic?.role==='owner'?`<button class="btn btn-ghost btn-sm" data-copypin="${esc(l.license_key)}">Copy</button>`:''}${!l.revoked_at?`<button class="btn btn-primary btn-sm" data-use-license="${esc(l.id)}">View Scan PINs</button>`:''}</div></div>`).join('')||'<p class="workspace-note">No separate scanner PIN licenses assigned.</p>'}</div>`;
      if(window.hsLicenseTimer) clearInterval(window.hsLicenseTimer);
      const tick=()=>{const el=view.querySelector('#hs-license-countdown');if(!el)return;const t=Number(el.dataset.expiry);if(!t)return;const ms=t-Date.now();if(ms<=0){el.textContent='Expired';return;}const sec=Math.floor(ms/1000);el.textContent=`${Math.floor(sec/86400)}d ${String(Math.floor(sec%86400/3600)).padStart(2,'0')}h ${String(Math.floor(sec%3600/60)).padStart(2,'0')}m ${String(sec%60).padStart(2,'0')}s`;};tick();window.hsLicenseTimer=setInterval(tick,1000);
    } catch(e){wsError(view, e, () => renderSubscription(view));}
  }
  async function renderEnterprise(view) {
    view.innerHTML=loading();
    try {
      const data=await api('/api/licenses');
      const lic=data.license;
      if (!lic || lic.plan!=='enterprise' || lic.role!=='owner') {
        view.innerHTML='<div class="workspace-section">Enterprise owner access required.</div>';
        return;
      }
      const members=data.members||[];
      view.innerHTML=`<div class="workspace-hero"><div><h2>${esc(lic.enterprise_name||'Enterprise')}</h2><p>Share licensed dashboard access using Discord IDs. Members do not become Staff or Admin.</p></div></div>
        <div class="workspace-grid">${wsStat('Seats',Number(lic.seats)||1)}${wsStat('Used',members.length+1)}${wsStat('Available',Math.max(0,(Number(lic.seats)||1)-members.length-1))}</div>
        <div class="workspace-section"><h3>Add Member</h3><form id="enterprise-add-form" class="workspace-actions"><input id="enterprise-member-id" class="input" inputmode="numeric" maxlength="20" placeholder="Discord User ID" required pattern="[0-9]{17,20}"><button class="btn btn-primary" type="submit">Add Member</button></form></div>
        <div class="workspace-section"><h3>Members</h3>${members.map(m=>`<div class="workspace-card" style="margin:10px 0;display:flex;justify-content:space-between;align-items:center;gap:12px"><div><strong>${esc(m.identity)}</strong><p class="workspace-note">Added ${fmtDate(m.created_at)}</p></div><button class="btn btn-ghost btn-sm" data-enterprise-remove="${esc(m.identity)}">Remove</button></div>`).join('')||'<p class="workspace-note">No members yet. Owner occupies one seat.</p>'}</div>`;
      view.querySelector('#enterprise-add-form').addEventListener('submit',async event=>{
        event.preventDefault();
        const identity=view.querySelector('#enterprise-member-id').value.trim();
        if(!/^\d{17,20}$/.test(identity))return toast('Invalid Discord ID',true);
        try {await api('/api/licenses',{method:'POST',body:{action:'add',identity}});toast('Member added');await renderEnterprise(view);}
        catch(e){toast(e.message,true);}
      });
      view.querySelectorAll('[data-enterprise-remove]').forEach(button=>button.addEventListener('click',async()=>{
        try {await api('/api/licenses',{method:'POST',body:{action:'remove',identity:button.dataset.enterpriseRemove}});toast('Member removed');await renderEnterprise(view);}
        catch(e){toast(e.message,true);}
      }));
    } catch(e){wsError(view, e, () => renderEnterprise(view));}
  }
  async function renderEnterpriseManagement(view) {
    view.innerHTML=loading();
    try {
      const data=await api('/api/enterprise-management');
      view.innerHTML=`<div class="workspace-hero"><div><h2>Enterprise Management</h2><p>Owner, seats, duration and status. License keys are never displayed.</p></div></div><div class="workspace-section"><h3>${data.enterprises.length} enterprises</h3>${data.enterprises.map(e=>`<div class="workspace-card" style="margin:12px 0"><strong>${esc(e.name||'Unnamed enterprise')}</strong><p class="workspace-note">Owner Discord: ${esc(e.owner||'Unclaimed')} · ${Number(e.seats)} seats · ${e.revoked?'Revoked':e.expires_at&&Date.parse(e.expires_at)<Date.now()?'Expired':'Active'} · ${e.expires_at?fmtDate(e.expires_at):'Lifetime'}</p><div class="workspace-actions"><input class="input" data-rename-input="${esc(e.id)}" maxlength="80" value="${esc(e.name||'')}" placeholder="Enterprise name"><button class="btn btn-primary btn-sm" data-rename-enterprise="${esc(e.id)}">Rename</button></div></div>`).join('')||'<p>No enterprise licenses found.</p>'}</div>`;
      view.querySelectorAll('[data-rename-enterprise]').forEach(btn=>btn.addEventListener('click',async()=>{
        try{const id=btn.dataset.renameEnterprise;const name=view.querySelector('[data-rename-input="'+id+'"]').value.trim();await api('/api/enterprise-management',{method:'POST',body:{id,name}});toast('Enterprise renamed');await renderEnterpriseManagement(view);}catch(e){toast(e.message,true);}
      }));
    }catch(e){wsError(view, e, () => renderEnterpriseManagement(view));}
  }
  async function renderLicenseList(view) {
    view.innerHTML = loading();
    try {
      const data = await api('/api/license-list');
      const all = data.licenses || [];
      const f = state.licFilter || 'all';
      const counts = {
        all: all.length,
        active: all.filter((l) => l.state === 'active').length,
        unclaimed: all.filter((l) => l.state === 'unclaimed').length,
        expired: all.filter((l) => l.state === 'expired').length,
        revoked: all.filter((l) => l.state === 'revoked').length,
      };
      const list = f === 'all' ? all : all.filter((l) => l.state === f);
      // The state is what staff act on, so it carries the colour and leads the row.
      const tint = { active: '#22c55e', unclaimed: '#8b8f96', expired: '#f59e0b', revoked: '#ef4444' };

      view.innerHTML = `<div class="workspace-hero"><div><h2>License list</h2>
          <p>Every account license: who holds it, what it is and until when. License keys are never displayed — only their hash is stored.</p></div></div>
        <div class="workspace-section">
          <div class="hs-lookup-card">
            <div class="hs-lookup-heading"><div><strong>Discord License Lookup</strong><p class="workspace-note">Check whether a Discord user has a license. Staff only.</p></div><span class="hs-lookup-pill">LIVE DATABASE</span></div>
            <form id="hs-license-lookup-form" class="hs-lookup-form">
              <input id="hs-license-lookup-id" class="input" type="text" inputmode="numeric" pattern="[0-9]{17,20}" maxlength="20" placeholder="Discord User ID (17–20 digits)" aria-label="Discord User ID" required autocomplete="off">
              <button class="btn btn-primary" type="submit">Check License</button>
            </form>
            <div id="hs-license-lookup-result" aria-live="polite"></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            ${['all', 'active', 'unclaimed', 'expired', 'revoked'].map((k) => `<button class="btn ${f === k ? 'btn-primary' : 'btn-ghost'} btn-sm" data-licfilter="${k}">${k[0].toUpperCase() + k.slice(1)} <b style="opacity:.7">${counts[k]}</b></button>`).join('')}
          </div>
          ${list.length ? list.map((l) => `<div class="workspace-card" style="margin:12px 0;border-left:3px solid ${tint[l.state] || '#8b8f96'}">
              <strong>${esc(l.name || l.type)}${l.type === 'Enterprise' && l.name ? ' <span style="opacity:.6;font-weight:400">· Enterprise</span>' : ''}</strong>
              <p class="workspace-note">
                <b style="color:${tint[l.state]}">${l.state}</b>
                · holder ${esc(l.owner || '—')}${!l.claimed && l.issued_to ? ` <span style="opacity:.6">(issued to ${esc(l.issued_to)}, not redeemed)</span>` : ''}
                · ${Number(l.seats)} seat${Number(l.seats) > 1 ? 's' : ''}
                · ${esc(l.duration)}
                · ${l.expires_at ? 'until ' + fmtDate(l.expires_at) : 'no expiry'}
                · created ${l.created_at ? fmtDate(l.created_at) : '—'}</p>
              <div class="workspace-actions">
                <button class="btn ${l.state === 'revoked' ? 'btn-ghost' : 'btn-danger'} btn-sm" data-lic="${esc(l.id)}" data-licact="${l.state === 'revoked' ? 'restore' : 'revoke'}">${l.state === 'revoked' ? 'Restore' : 'Revoke'}</button>
              </div></div>`).join('')
            : `<p class="workspace-note">No ${f === 'all' ? '' : f + ' '}licenses.</p>`}
        </div>`;

      const lookupForm = view.querySelector('#hs-license-lookup-form');
      lookupForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = view.querySelector('#hs-license-lookup-id').value.trim();
        const out = view.querySelector('#hs-license-lookup-result');
        const button = lookupForm.querySelector('button');
        if (!/^\d{17,20}$/.test(id)) { out.textContent = 'Enter a valid Discord ID (17–20 digits).'; return; }
        button.disabled = true;
        out.innerHTML = '<p class="workspace-note">Checking license database…</p>';
        try {
          const result = await api('/api/license-lookup?discord_id=' + encodeURIComponent(id));
          const label = result.has_active_license ? 'ACTIVE LICENSE FOUND' : 'NO ACTIVE LICENSE';
          const cls = result.has_active_license ? 'hs-lookup-good' : 'hs-lookup-none';
          out.innerHTML = `<div class="hs-lookup-result ${cls}"><strong>${label}</strong><p class="workspace-note">Discord ID: ${esc(result.discord_id)}</p>
            ${(result.licenses || []).map(l => `<div class="hs-lookup-entry"><b>${esc(l.type)}</b> · ${esc(l.relation)} · <b>${esc(l.state)}</b> · ${l.expires_at ? 'Expires ' + fmtDate(l.expires_at) : 'No expiry'}${l.name ? ' · ' + esc(l.name) : ''}</div>`).join('') || '<p class="workspace-note">No license records found for this ID.</p>'}</div>`;
        } catch(e) { out.textContent = 'Lookup failed: ' + (e.message || 'Unknown error'); }
        finally { button.disabled = false; }
      });
      view.querySelectorAll('[data-licfilter]').forEach((b) => b.addEventListener('click', () => {
        state.licFilter = b.dataset.licfilter;
        renderLicenseList(view);
      }));
      view.querySelectorAll('[data-lic]').forEach((b) => b.addEventListener('click', async () => {
        const act = b.dataset.licact;
        // Revoking takes a license away from somebody who paid for it, so it is confirmed.
        if (act === 'revoke' && !confirm('Revoke this license? The holder loses access immediately.')) return;
        b.disabled = true;
        try {
          await api('/api/license-list', { method: 'POST', body: { id: b.dataset.lic, action: act } });
          toast(act === 'revoke' ? 'License revoked' : 'License restored');
          await renderLicenseList(view);
        } catch (e) { toast(e.message, true); b.disabled = false; }
      }));
    } catch (e) { wsError(view, e, () => renderLicenseList(view)); }
  }


  // ── File Check ────────────────────────────────────────────────────────────────────────
  // Drop a file, get a verdict. The file never leaves this machine: everything below runs in
  // the browser, which is the only honest way to offer this — staff drop files they were sent
  // by strangers in here, and quietly uploading those would be a worse betrayal than any bug.
  async function renderFileCheck(view) {
    if (!window.HSFileCheck) { wsError(view, new Error('File Check could not load (assets/file-check.js).')); return; }
    const r = state.fileCheck || null;

    const tint = { cheat: 'var(--bad,#f0556c)', suspicious: 'var(--warn,#efb152)', clean: 'var(--ok,#3ecf8e)' };
    const label = { cheat: 'CHEAT', suspicious: 'SUSPICIOUS', clean: 'NOTHING FOUND' };
    const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB';
    const tile = (k, v, mono) => `<div class="workspace-card"><small>${esc(k)}</small>`
      + `<strong class="${mono ? 'mono' : ''}" style="${mono ? 'font-size:12px;word-break:break-all;font-weight:500' : ''}">${esc(v)}</strong></div>`;

    view.innerHTML = `<div class="workspace-hero"><div><h2>File Check</h2>
        <p>Drop a program and find out what it does. The file is read here, in your browser —
           it is never uploaded, so you can check anything a player sends you.</p></div></div>

      <div class="workspace-section">
        <div id="fc-drop" style="border:1.5px dashed var(--line2);border-radius:14px;padding:38px 20px;text-align:center;cursor:pointer;transition:border-color .16s,background .16s">
          <div style="font-size:15px;color:var(--text);margin-bottom:5px">Drag a file here, or click to choose</div>
          <div style="color:var(--dim);font-size:12.5px">.exe · .dll · .sys · .asi · .jar — up to 256 MB</div>
          <input id="fc-file" type="file" hidden>
        </div>
        <div id="fc-progress" style="display:none;margin-top:14px">
          <div style="color:var(--muted);font-size:13px" id="fc-step">Reading…</div>
          <div style="height:4px;border-radius:999px;background:var(--s2,#11151c);margin-top:8px;overflow:hidden">
            <div id="fc-bar" style="height:100%;width:0;background:var(--accent,#4a8cf7);transition:width .15s linear"></div></div>
        </div>
      </div>

      ${r ? `
      <div class="workspace-section" style="border-left:3px solid ${tint[r.verdict]}">
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:4px">
          <h3 style="margin:0;color:${tint[r.verdict]}">${label[r.verdict]}</h3>
          <span style="color:var(--muted);font-size:13px">${esc(r.name)} · ${esc(kb(r.size))}</span>
        </div>
        ${r.why.map((x) => `<p class="workspace-note" style="margin:6px 0 0">${esc(x)}</p>`).join('')}
        ${r.knownAs ? `<p class="workspace-note" style="margin:6px 0 0;color:var(--bad,#f0556c)">Known to you as: ${esc(r.knownAs)}</p>` : ''}
      </div>

      <div class="workspace-section">
        <h3>File information</h3>
        <div class="grid-2" style="gap:10px">
          ${tile('File name', r.name)}
          ${tile('Size', kb(r.size))}
          ${tile('SHA-256', r.sha256 || '—', true)}
          ${tile('SHA-1', r.sha1 || '—', true)}
          ${tile('MD5', r.md5 || '—', true)}
          ${tile('Windows program', r.isPe ? `yes · ${r.importCount} imported functions` : 'no')}
        </div>
      </div>

      <div class="workspace-section">
        <h3>What it is wired to do</h3>
        <p class="workspace-note" style="margin:0 0 10px">Read from the import table — the list of Windows
          functions the compiler wrote into the file. Renaming the file does not change it.</p>
        ${r.does.length
          ? `<ul style="margin:0;padding-left:18px;color:var(--text);font-size:13.5px;line-height:1.85">
               ${r.does.map((d) => `<li>${esc(d)}</li>`).join('')}
               ${r.target ? `<li>names the game process <b>${esc(r.target)}</b></li>` : ''}</ul>`
          : `<p class="workspace-note" style="margin:0">It never opens, reads or writes another program, and loads no driver.</p>`}
      </div>

      ${r.markers.length ? `<div class="workspace-section">
        <h3>Names found inside it</h3>
        <p class="workspace-note" style="margin:0 0 10px">A lead, not proof: blocklists, anti-cheats and saved
          web pages contain these words too.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${r.markers.map((m) => `<span class="badge warn">${esc(m.brand || m.needle)}</span>`).join('')}
        </div></div>` : ''}
      ` : ''}`;

    const drop = view.querySelector('#fc-drop');
    const input = view.querySelector('#fc-file');
    const prog = view.querySelector('#fc-progress');
    const bar = view.querySelector('#fc-bar');
    const stepEl = view.querySelector('#fc-step');

    const run = async (file) => {
      if (!file) return;
      // 256 MB: past that the browser has to hold the whole file plus its string view in
      // memory, and the tab is killed rather than slowed.
      if (file.size > 256 * 1024 * 1024) return toast('That file is over 256 MB', true);
      prog.style.display = '';
      try {
        // The operator's own signature list, so an exact hash match can be named. Fetched
        // once; a failure here only costs the naming, not the analysis.
        if (!state.fcSigs) { try { state.fcSigs = (await api('/api/scanner-sigs')).signatures || []; } catch { state.fcSigs = []; } }
        state.fileCheck = await window.HSFileCheck.analyze(file, (p, l) => {
          bar.style.width = Math.round(p * 100) + '%';
          stepEl.textContent = l;
        }, state.fcSigs);
        renderFileCheck(view);
      } catch (e) {
        prog.style.display = 'none';
        toast(e.message || 'Could not read that file', true);
      }
    };

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => run(input.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.style.borderColor = 'var(--accent,#4a8cf7)';
      drop.style.background = 'var(--s2,#11151c)';
    }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.style.borderColor = '';
      drop.style.background = '';
    }));
    drop.addEventListener('drop', (e) => run(e.dataTransfer && e.dataTransfer.files[0]));
  }

  async function renderWebhooks(view) {
    view.innerHTML=loading();
    try {
      const data=await api('/api/client-webhook');
      const status = data.configured ? (data.enabled ? 'Enabled' : 'Disabled') : 'Not configured';
      const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—';
      view.innerHTML=`<div class="workspace-hero"><div><h2>Discord Webhooks</h2><p>Manage your personal Discord scan notifications. Full reports are not transmitted.</p></div></div>
        <div class="workspace-section"><h3>My saved webhook</h3>${data.configured
          ? `<div class="workspace-card" style="margin-bottom:18px"><small>Discord webhook · URL hidden for security</small><strong style="font-size:17px">••••••••••••••••••••</strong><p class="workspace-note">Status: <b>${status}</b> · Updated: ${esc(updated)}</p></div>`
          : '<p class="workspace-note">No webhook saved yet.</p>'}
        <h3>${data.configured?'Update webhook':'Add webhook'}</h3>
        <form id="hs-webhook-form"><input class="input" id="hs-webhook-url" type="password" autocomplete="off" placeholder="${data.configured?'Leave empty to keep current webhook':'https://discord.com/api/webhooks/...'}" style="width:100%;max-width:600px"><label style="display:block;margin:15px 0"><input id="hs-webhook-enabled" type="checkbox" ${data.enabled?'checked':''}> Enable notifications</label><button class="btn btn-primary" type="submit">Save webhook</button> ${data.configured?'<button class="btn btn-ghost" id="hs-webhook-remove" type="button">Remove</button>':''}</form>
        <p class="workspace-note">Only you can manage this webhook. Scan summaries are delivered for completed authorized scans.</p></div>`;
      view.querySelector('#hs-webhook-form').addEventListener('submit',async ev=>{ev.preventDefault();try{await api('/api/client-webhook',{method:'POST',body:{url:view.querySelector('#hs-webhook-url').value.trim(),enabled:view.querySelector('#hs-webhook-enabled').checked}});toast('Webhook saved');renderWebhooks(view);}catch(e){toast(e.message,true);}});
      view.querySelector('#hs-webhook-remove')?.addEventListener('click',async()=>{try{await api('/api/client-webhook',{method:'DELETE'});toast('Webhook removed');renderWebhooks(view);}catch(e){toast(e.message,true);}});
    }catch(e){wsError(view, e, () => renderWebhooks(view));}
  }
  async function renderAnalytics(view) {
    view.innerHTML=loading();
    if(!state.server) {view.innerHTML='<div class="workspace-section">Select a server to view analytics.</div>';return;}
    try {
      const d=await api(`/api/data?server=${encodeURIComponent(state.server)}&type=overview`);
      const days=d.days||[],max=Math.max(1,...days.map(x=>Number(x.count)||0));
      view.innerHTML=`<div class="workspace-hero"><div><h2>Server Analytics</h2><p>Live statistics from your selected server</p></div></div><div class="workspace-grid">${wsStat('Detections',fmtNum(d.stats?.detections))}${wsStat('Active bans',fmtNum(d.stats?.bans))}${wsStat('Unique players',fmtNum(d.stats?.players))}</div><div class="workspace-section"><h3>Last 7 days</h3><div class="bars">${days.map(x=>`<div class="bar-col"><b>${fmtNum(x.count)}</b><div class="bar" style="height:${Math.round(Number(x.count||0)/max*100)}%"></div><small>${esc(x.day)}</small></div>`).join('')}</div></div><div class="workspace-section"><h3>Top detection reasons</h3>${(d.top||[]).length?d.top.map(x=>`<div class="top-row"><span>${esc(x.reason)}</span><b>${fmtNum(x.n)}</b></div>`).join(''):'<p class="workspace-note">No detections recorded.</p>'}</div>`;
    }catch(e){wsError(view, e, () => renderAnalytics(view));}
  }
  async function renderScanActivity(view) {
    view.innerHTML=loading();
    try {
      const {pins:all=[]}=await api('/api/pins');
      const used=all.filter(p=>p.used).length;
      view.innerHTML=`<div class="workspace-hero"><div><h2>Scan Activity</h2><p>Your authorized screenshare scan sessions</p></div></div><div class="workspace-grid">${wsStat('Recent PINs',all.length)}${wsStat('Used PINs',used)}${wsStat('Available PINs',all.length-used)}</div><div class="workspace-section"><h3>Recent sessions</h3><div style="overflow-x:auto"><table class="workspace-table"><thead><tr><th>Server</th><th>PIN</th><th>Player</th><th>Status</th><th>Created</th></tr></thead><tbody>${all.slice(0,40).map(p=>`<tr><td>${esc(p.scanner_licenses?.label||'Scanner')}</td><td class="mono">${esc(p.pin)}</td><td>${esc(p.player||'—')}</td><td>${p.used?'Used':'Available'}</td><td>${fmtDate(p.created_at)}</td></tr>`).join('')||'<tr><td colspan="5">No scans yet</td></tr>'}</tbody></table></div><div class="workspace-actions"><button class="btn btn-primary" data-go="pins">Manage scan PINs</button></div></div>`;
    }catch(e){wsError(view, e, () => renderScanActivity(view));}
  }
  async function renderRanking(view,metric='checks') {
    view.innerHTML=loading();
    try {
      const d=await api(`/api/leaderboard?metric=${metric}`);
      if(d.degraded){ view.innerHTML='<div class="workspace-section"><h3>Leaderboard</h3><p>Ranking temporarily unavailable. Please retry later.</p></div>'; return; }
      view.innerHTML=`<div class="workspace-hero"><div><h2>Community Leaderboard</h2><p>Only users who opted in are shown. Findings are not proof of cheating.</p></div></div><div class="workspace-actions"><button class="btn ${metric==='checks'?'btn-primary':'btn-ghost'}" data-rank="checks">Top Checks</button><button class="btn ${metric==='findings'?'btn-primary':'btn-ghost'}" data-rank="findings">Top Findings</button></div><div class="workspace-section"><h3>${metric==='checks'?'Most completed checks':'Most reported findings'}</h3><div style="overflow-x:auto"><table class="workspace-table"><thead><tr><th>Rank</th><th>Discord user</th><th>${metric==='checks'?'Checks':'Findings'}</th></tr></thead><tbody>${(d.entries||[]).map((u,i)=>`<tr><td>#${i+1}</td><td style="display:flex;align-items:center;gap:10px">${u.avatar?`<img src="${esc(u.avatar)}" width="32" height="32" style="border-radius:50%" alt="">`:''}${esc(u.name)}</td><td><b>${fmtNum(u.value)}</b></td></tr>`).join('')||'<tr><td colspan="3">No opted-in results yet.</td></tr>'}</tbody></table></div></div>`;
      view.querySelectorAll('[data-rank]').forEach(b=>b.addEventListener('click',()=>renderRanking(view,b.dataset.rank)));
    }catch(e){wsError(view, e, () => renderRanking(view));}
  }

  // ---------- views ----------
  async function renderOverview(view) {
    const d = await api(`/api/data?server=${state.server}&type=overview`);
    const max = Math.max(1, ...d.days.map((x) => x.count));
    const online = d.server.last_seen && Date.now() - new Date(d.server.last_seen) < 5 * 60000;
    view.innerHTML = `
      <div class="kpis">
        <div class="card kpi"><span><i class="dot" style="background:var(--cyan)"></i>Detections</span><strong>${fmtNum(d.stats.detections)}</strong></div>
        <div class="card kpi"><span><i class="dot" style="background:var(--red)"></i>Active bans</span><strong>${fmtNum(d.stats.bans)}</strong></div>
        <div class="card kpi"><span><i class="dot" style="background:var(--green)"></i>Online</span><strong>${fmtNum(d.stats.online)}</strong></div>
        <div class="card kpi"><span><i class="dot" style="background:var(--violet)"></i>Unique players</span><strong>${fmtNum(d.stats.players)}</strong></div>
      </div>
      <div class="grid-2">
        <div class="card panel">
          <h3>Detections - last 7 days
            <span class="badge ${online ? 'on' : 'off'}">${online ? '● Server online' : 'Seen ' + ago(d.server.last_seen)}</span></h3>
          <div class="bars">
            ${d.days.map((x) => `
              <div class="bar-col">
                <b>${x.count}</b>
                <div class="bar" style="height:${Math.round((x.count / max) * 100)}%"></div>
                <small>${new Date(x.day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</small>
              </div>`).join('')}
          </div>
        </div>
        <div class="card panel">
          <h3>Top detections</h3>
          ${d.top.length ? d.top.map((t) => `<div class="top-row"><span>${esc(t.reason)}</span><b>${t.n}</b></div>`).join('') : '<div class="empty">Nothing this week</div>'}
        </div>
      </div>
      <div class="card panel">
        <h3>Latest detections <button class="btn btn-ghost btn-sm" data-go="detections">See all</button></h3>
        ${d.recent.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Player</th><th>Detection</th><th>Action</th><th>Date</th></tr></thead>
          <tbody>${d.recent.map((r) => `<tr>
            <td>${esc(r.player)}</td><td>${esc(r.reason)}<div class="mono">${esc(r.info)}</div></td>
            <td><span class="badge ${esc(r.action)}">${esc(r.action)}</span></td><td class="mono">${fmtDate(r.created_at)}</td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="empty">No detections yet.</div>'}
      </div>`;
  }

  async function renderTable(view, type) {
    const { rows } = await api(`/api/data?server=${state.server}&type=${type}&q=${encodeURIComponent(state.q)}`);
    if (!rows.length) {
      view.innerHTML = `<div class="card empty">${state.q ? 'No results.' : 'Nothing here yet.'}</div>`;
      return;
    }
    let head, body;
    if (type === 'detections') {
      head = '<th>Player</th><th>Detection</th><th>Action</th><th>Identifier</th><th>Date</th>';
      body = rows.map((r) => `<tr>
        <td>${esc(r.player)}</td><td>${esc(r.reason)}<div class="mono">${esc(r.info)}</div></td>
        <td><span class="badge ${esc(r.action)}">${esc(r.action)}</span></td>
        <td class="mono">${esc(r.identifier)}</td><td class="mono">${fmtDate(r.created_at)}</td></tr>`).join('');
    } else if (type === 'bans') {
      head = '<th>Ban ID</th><th>Player</th><th>Reason</th><th>Status</th><th>Date</th><th></th>';
      body = rows.map((r) => `<tr>
        <td class="mono" style="color:var(--cyan)">${esc(r.ban_id)}</td><td>${esc(r.player)}<div class="mono">${esc(r.identifier)}</div></td>
        <td>${esc(r.reason)}<div class="mono">${esc(r.info)}</div></td>
        <td><span class="badge ${r.active ? 'ban' : 'off'}">${r.active ? 'Active' : r.unban_pending ? 'Unbanning' : 'Removed'}</span></td>
        <td class="mono">${fmtDate(r.created_at)}</td>
        <td><div class="actions-cell">
          <button class="btn btn-ghost btn-sm" data-proof="${esc(r.ban_id)}" data-name="${esc(r.player)}">Proof</button>
          ${r.active ? `<button class="btn btn-ghost btn-sm" data-unban="${esc(r.ban_id)}">Unban</button>` : ''}
        </div></td></tr>`).join('');
    } else {
      head = '<th>Player</th><th>Status</th><th>Playtime</th><th>Sessions</th><th>Last seen</th><th></th>';
      body = rows.map((r) => `<tr>
        <td>${esc(r.player)}<div class="mono">${esc(r.identifier)}</div></td>
        <td><span class="badge ${r.online ? 'on' : 'off'}">${r.online ? 'Online' : 'Offline'}</span></td>
        <td>${fmtTime(r.playtime)}</td><td>${fmtNum(r.sessions)}</td><td class="mono">${fmtDate(r.last_seen)}</td>
        <td>${r.online ? `<div class="actions-cell">
          <button class="btn btn-primary btn-sm" data-live="${esc(r.identifier)}" data-name="${esc(r.player)}">● Live</button>
          <button class="btn btn-ghost btn-sm" data-act="kick" data-id="${esc(r.identifier)}" data-name="${esc(r.player)}">Kick</button>
          <button class="btn btn-danger btn-sm" data-act="ban" data-id="${esc(r.identifier)}" data-name="${esc(r.player)}">Ban</button>
        </div>` : ''}</td></tr>`).join('');
    }
    view.innerHTML = `<div class="card panel"><div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  }

  async function renderLogs(view) {
    const { rows } = await api(`/api/data?server=${state.server}&type=logs&cat=${state.cat}&q=${encodeURIComponent(state.q)}`);
    const chips = [{ name: '', label: 'All' }, ...LOGS.map((l) => ({ name: l.name, label: l.name }))]
      .map((c) => `<button class="chip-btn ${state.cat === c.name ? 'active' : ''}" data-cat="${c.name}">${c.label}</button>`).join('');
    view.innerHTML = `<div class="chips-bar">${chips}</div>
      <div class="card panel">${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Type</th><th>Event</th><th>Player</th><th>Date</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td><span class="cat cat-${esc(r.category)}">${esc(r.category)}</span></td>
          <td>${esc(r.title)}<div class="mono">${esc(r.message)}</div></td>
          <td>${esc(r.player) || '-'}<div class="mono">${esc(r.identifier)}</div></td>
          <td class="mono">${fmtDate(r.created_at)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">No logs yet.</div>'}</div>`;
  }

  async function renderSettings(view) {
    const { settings } = await api(`/api/settings?server=${state.server}`);
    const saved = settings?.detections || {};
    const rows = DETECTIONS.map((d) => {
      const s = { ...d, ...(saved[d.name] || {}) };
      return `<div class="card set-row" data-det="${d.name}">
        <div><b>${d.name}</b><small>${esc(d.desc)}</small></div>
        <select class="input" data-f="action">
          ${['ban', 'kick', 'log'].map((a) => `<option value="${a}" ${s.action === a ? 'selected' : ''}>${a.toUpperCase()}</option>`).join('')}
        </select>
        ${d.value !== undefined
          ? `<input class="input" data-f="value" type="number" min="${d.min}" max="${d.max}" value="${esc(s.value)}" title="${d.min} - ${d.max}">`
          : '<span></span>'}
        <label class="switch"><input type="checkbox" data-f="enabled" ${s.enabled ? 'checked' : ''}><span></span></label>
      </div>`;
    }).join('');

    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Discord webhook</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:12px">Bans, kicks and logs are sent here. Leave empty to use the one in config.lua.</p>
        <input id="webhook" class="input" style="width:100%" placeholder="https://discord.com/api/webhooks/..." value="${esc(settings?.webhook || '')}">
      </div>
      <div class="card panel" style="margin-bottom:18px">
        <h3>Logs</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:12px">Logs webhook (empty = same as above).</p>
        <input id="log-webhook" class="input" style="width:100%;margin-bottom:16px" placeholder="https://discord.com/api/webhooks/..." value="${esc(settings?.logWebhook || '')}">
        <div class="log-toggles">${LOGS.map((l) => {
          const on = settings?.logs?.[l.name] ?? !l.off;
          return `<div class="card log-toggle"><div><b>${l.name}</b><small style="display:block;color:var(--dim);font-size:12px">${l.desc}</small></div>
            <label class="switch"><input type="checkbox" data-log="${l.name}" ${on ? 'checked' : ''}><span></span></label></div>`;
        }).join('')}</div>
      </div>
      <div class="card panel">
        <h3>Detections <button class="btn btn-ghost btn-sm" data-reset>Reset to default</button></h3>
        <div class="set-row set-head" style="padding-top:0"><span>Name</span><span>Action</span><span>Limit</span><span>On</span></div>
        <div class="set-grid">${rows}</div>
      </div>
      <div class="save-bar"><button class="btn btn-primary" data-save>Save settings</button></div>
      <p style="color:var(--dim);font-size:13px;text-align:right;margin-top:8px">Your server gets the new settings within 1 minute.</p>`;
  }

  function readSettings() {
    const detections = {};
    $$('[data-det]').forEach((row) => {
      const item = {
        enabled: row.querySelector('[data-f="enabled"]').checked,
        action: row.querySelector('[data-f="action"]').value,
      };
      const v = row.querySelector('[data-f="value"]');
      if (v) item.value = Number(v.value);
      detections[row.dataset.det] = item;
    });
    const logs = {};
    $$('[data-log]').forEach((el) => { logs[el.dataset.log] = el.checked; });
    return { webhook: $('#webhook').value.trim(), logWebhook: $('#log-webhook').value.trim(), logs, detections };
  }

  // ---------- scanner / pins / signatures / staff ----------
  function renderScanner(view) {
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>HeRo Scanner — PC check</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:18px">A read-only Windows tool players run during a screenshare. It checks running programs, kernel drivers, startup & scheduled tasks, Windows execution traces (Prefetch, BAM, ShimCache — even deleted cheats), live connections, event logs, anti-cleaning tells, the FiveM folder and the recycle bin, then sends the result here.</p>
        <a class="btn btn-primary" href="${SCANNER_URL}"><svg style="width:18px;height:18px" aria-hidden="true"><use href="#i-download"/></svg>Download scanner (.exe)</a>
        <p class="mono" style="margin-top:12px;color:var(--dim)">Generic download (player types the PIN). Better: send the per-player link from Scan PINs — the PIN is already inside.</p>
      </div>
      <div class="card panel">
        <h3>How a check works</h3>
        <div class="steps" style="margin-top:4px">
          <div class="step"><h3>Create a PIN</h3><p>Open Scan PINs, type the player's name, get a PIN.</p></div>
          <div class="step"><h3>Player runs it</h3><p>They download the scanner, type the PIN, accept the check.</p></div>
          <div class="step"><h3>Read the result</h3><p>The PIN turns Clean or Cheating with the full report.</p></div>
        </div>
      </div>`;
  }

  // v30: one PIN = one game. The scanner runs the common checks + only the checks of that game.
  const GAMES = [
    { k: 'fivem', name: 'FiveM', sub: 'GTA V roleplay', c: '#ff8a3d',
      ic: '<path d="M5 15.5l1.6-5a2 2 0 0 1 1.9-1.4h7a2 2 0 0 1 1.9 1.4l1.6 5" /><rect x="3.5" y="15" width="17" height="4.5" rx="1.6"/><circle cx="7.5" cy="17.3" r="1"/><circle cx="16.5" cy="17.3" r="1"/>' },
    { k: 'redm', name: 'RedM', sub: 'Red Dead roleplay', c: '#ff5a5f',
      ic: '<path d="M4 15c2.5 1.6 13.5 1.6 16 0"/><path d="M7.2 14.6c.3-4 1.3-8.1 4.8-8.1s4.5 4.1 4.8 8.1"/><path d="M8 11.5c2.5.8 5.5.8 8 0"/>' },
    { k: 'minecraft', name: 'Minecraft', sub: 'Java & clients', c: '#4ade80',
      ic: '<path d="M14.5 4.5c2.8.3 4.7 2.2 5 5"/><path d="M5 19l9.5-9.5"/><path d="M11 6.5l6.5 6.5"/><path d="M12.8 4.4c-2.4.6-4.6 2-6.2 4"/><path d="M19.6 11.2c-.6 2.4-2 4.6-4 6.2"/>' },
    { k: 'roblox', name: 'Roblox', sub: 'executors & scripts', c: '#8cc8ff',
      ic: '<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M12 12l7.5-4.3M12 12L4.5 7.7M12 12v8.5"/>' },
  ];
  const gameOf = (k) => GAMES.find((g) => g.k === (k || 'fivem')) || GAMES[0];
  // Real game logos: put /assets/games/<game>.png (fivem.png, redm.png, minecraft.png, roblox.png).
  // If a file is missing, the drawn icon is shown instead.
  // each logo file is checked once per visit; icons get the logo only when the file exists
  const LOGO_OK = {};
  const logoImg = (k, px) => `<img class="gm-logo" src="/assets/games/${k}.png" alt="" width="${px}" height="${px}">`;
  GAMES.forEach((g) => {
    const im = new Image();
    im.onload = () => { LOGO_OK[g.k] = true; document.querySelectorAll(`.gm-ic[data-g="${g.k}"]`).forEach((el) => { if (!el.querySelector('.gm-logo')) el.insertAdjacentHTML('afterbegin', logoImg(g.k, el.offsetWidth || 34)); }); };
    im.src = `/assets/games/${g.k}.png`;
  });
  const gameIcon = (k, size = 22) => {
    const g = gameOf(k);
    const svg = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${g.ic}</svg>`;
    return `<span class="gm-ic" data-g="${g.k}" style="--gc:${g.c};width:${size + 12}px;height:${size + 12}px">${LOGO_OK[g.k] ? logoImg(g.k, size + 12) : ''}${svg}</span>`;
  };

  function pinSound(){
    if(localStorage.getItem('hs_pin_sfx')==='off')return;
    try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=new C();const now=ctx.currentTime;for(const [i,freq] of [660,880].entries()){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0,now+i*.09);g.gain.linearRampToValueAtTime(.045,now+i*.09+.012);g.gain.exponentialRampToValueAtTime(.001,now+i*.09+.15);o.connect(g);g.connect(ctx.destination);o.start(now+i*.09);o.stop(now+i*.09+.16);}setTimeout(()=>ctx.close().catch(()=>{}),500);}catch{}
  }
  async function renderPins(view, cached) {
    const resp = cached || await api('/api/pins');
    if (!cached) {
      const same = state.pinsResp && JSON.stringify(state.pinsResp) === JSON.stringify(resp);
      state.pinsResp = resp;
      if (state.tab !== 'pins') return;                       // the user already went to another tab
      if (same && view.querySelector('[data-newpin]')) return; // nothing changed: keep what is on screen
    }
    const keepPlayer = view.querySelector('#pin-player')?.value || '';
    const keepLicense = view.querySelector('#pin-license')?.value || '';
    const { pins, licenses, quota } = resp;
    state.pins = pins;
    const q = quota || { unlimited: true };
    const quotaHtml = ''; // Daily PIN counter intentionally removed from UI; server quotas remain enforced.
    const activeLicenses=(licenses||[]).filter(l=>!l.revoked_at);
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Generate a scan PIN</h3>
        <p class="workspace-note">Choose the game: the scanner checks the PC (macros, HWID history, USB, deleted files…) plus only the files and cheats of that game.</p>
        <div class="gm-grid" role="radiogroup" aria-label="Game">
          ${GAMES.map((g) => `<button type="button" class="gm-opt ${(state.pinGame || 'fivem') === g.k ? 'on' : ''}" data-pingame="${g.k}" role="radio" aria-checked="${(state.pinGame || 'fivem') === g.k}">
            ${gameIcon(g.k, 26)}<span><b>${g.name}</b></span><i class="gm-check">✓</i></button>`).join('')}
        </div>
        ${quotaHtml}
        ${activeLicenses.length?`<select id="pin-license" class="input" style="width:100%;margin-bottom:12px">${activeLicenses.map(l=>`<option value="${esc(l.id)}" ${state.selectedLicense===l.id?'selected':''}>${esc(l.label)}</option>`).join('')}</select>`:'<p class="workspace-note">No active account license. Activate your key through the HeRoShield dashboard or contact staff.</p>'}
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="pin-player" class="input" style="flex:1;min-width:180px" placeholder="Player name (optional)">
          <button class="btn btn-primary" data-newpin ${activeLicenses.length && (q.unlimited || q.left > 0)?'':'disabled'}>Generate ${esc(gameOf(state.pinGame).name)} PIN</button>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;color:var(--muted);font-size:12px"><input type="checkbox" id="hs-pin-sfx" ${localStorage.getItem('hs_pin_sfx')==='off'?'':'checked'}> PIN sound FX</label>
        <div id="pin-out" hidden style="margin-top:14px"></div>
      </div>
      <div class="card panel" style="margin-bottom:18px">
        <h3>View a result by PIN</h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:10px">Paste the PIN you gave the player to open its scan result.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="pin-lookup" class="input" style="flex:1;min-width:180px;text-transform:uppercase;letter-spacing:2px"
                 placeholder="e.g. ABCD1234" maxlength="8">
          <button class="btn btn-primary" data-lookuppin>View result</button>
        </div>
      </div>
      <div class="card panel"><h3>Recent PINs</h3>
        ${pins.length ? `<div class="table-wrap"><table><thead><tr><th>Game</th><th>PIN</th><th>Player</th><th>Used</th><th>Result</th><th>Date</th><th></th></tr></thead>
          <tbody>${pins.map((p) => `<tr>
            <td><div style="display:flex;align-items:center;gap:8px" title="${esc(gameOf(p.game).name)}">${gameIcon(p.game, 16)}<span style="font-size:13px">${esc(gameOf(p.game).name)}</span></div></td>
            <td class="mono" style="color:var(--cyan);font-size:14px">${esc(p.pin)}</td>
            <td>${esc(p.player) || '-'}${p.discord_check && p.discord_check.user ? ` <span class="badge log" title="${esc(p.discord_check.user.name)}">Discord ✓</span>` : ''}</td>
            <td><span class="badge hs-used ${p.used ? 'used-yes' : 'used-no'}">${p.used ? 'Used' : 'Pending'}</span></td>
            <td>${hsResultBadge(p.result)}${p.self_scan ? '<div class="hs-selfscan" title="The Discord account on the scanned PC is this licence\'s own owner — nobody was screenshared.">own PC</div>' : ''}</td>
            <td class="mono">${fmtDate(p.created_at)}</td>
            <td><div class="actions-cell">
              ${p.used ? `<button class="btn btn-ghost btn-sm" data-viewpin="${esc(p.pin)}">View</button>` : ''}
              ${!p.used ? `<button class="btn btn-ghost btn-sm" data-copypin="${esc(location.origin)}/dl/${esc(p.pin)}">Link</button>` : ''}
              <button class="btn btn-ghost btn-sm" data-copypin="${esc(p.pin)}">Copy</button>
              ${!p.used ? `<button class="btn btn-danger btn-sm" data-delpin="${esc(p.id)}" data-delpin-code="${esc(p.pin)}" title="Delete this pending PIN">Delete</button>` : ''}</div></td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="empty">No PINs yet.</div>'}
      </div>`;
    view.querySelector('#hs-pin-sfx')?.addEventListener('change',e=>localStorage.setItem('hs_pin_sfx',e.target.checked?'on':'off'));
    const pp = view.querySelector('#pin-player'); if (pp && keepPlayer) pp.value = keepPlayer;
    const pl = view.querySelector('#pin-license'); if (pl && keepLicense && [...pl.options].some((o) => o.value === keepLicense)) pl.value = keepLicense;
  }

  // ---------- scan report (HeRo Scanner v4) — napse-style ----------
  const METHODS = ['Running now', 'Prefetch', 'BAM', 'Game file', 'Service', 'On disk', 'Recycle bin', 'FiveM plugin',
    'Startup', 'Scheduled task', 'Event log', 'Recent file', 'Network', 'Kernel driver', 'AmCache', 'ShimCache', 'Hidden stream',
    'File journal', 'Inside FiveM', 'Service memory', 'Hardware', 'USB drive', 'Jump list', 'Macro'];
  const SEV = ['low', 'medium', 'high'];
  const discordIcon = (g) => g.icon ? `https://cdn.discordapp.com/icons/${g.id || g.guild_id}/${g.icon}.png?size=64` : '';

  function ensureReportCss() {
    if (document.getElementById('rp-css')) return;
    const st = document.createElement('style');
    st.id = 'rp-css';
    st.textContent = `
      .rp { display:grid; grid-template-columns:270px 1fr; gap:18px; align-items:start }
      @media (max-width:900px){ .rp { grid-template-columns:1fr } .rp-side { position:static !important } }
      .rp > section { padding:0 !important; margin:0 !important; min-height:0 !important; min-width:0 }
      .rp-side { position:sticky; top:16px; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px }
      .rp-side h4 { display:flex; gap:8px; align-items:center; font-size:15px; margin:0 0 4px }
      .rp-side .sub { color:var(--dim); font-size:12px; margin-bottom:12px }
      .rp-cat { width:100%; display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; border:1px solid transparent;
                background:none; color:var(--muted); font:500 13.5px var(--font); cursor:pointer; text-align:left }
      .rp-cat:hover { background:rgba(255,255,255,.03); color:var(--text) }
      .rp-cat.on { background:rgba(125,180,255,.07); border-color:var(--line-strong); color:var(--text) }
      .rp-cat .dot { width:8px; height:8px; border-radius:50%; flex:none }
      .rp-cat .n { margin-left:auto; min-width:24px; text-align:center; font-size:11.5px; font-weight:700; padding:2px 7px; border-radius:7px; background:rgba(255,255,255,.05); color:var(--muted) }
      .rp-cat .n.red { background:rgba(244,63,94,.15); color:#fb7185 } .rp-cat .n.orange { background:rgba(245,158,11,.15); color:#fbbf24 }
      .rp-cat .n.green { background:rgba(16,185,129,.15); color:#34d399 } .rp-cat .n.yellow { background:rgba(234,179,8,.14); color:#facc15 }
      .rp-cat .n.purple { background:rgba(168,85,247,.15); color:#c084fc } .rp-cat .n.blue { background:rgba(59,130,246,.15); color:#93c5fd }
      .rp-sep { height:1px; background:var(--line); margin:8px 4px }
      /* v81.5 - the Signatures page: drop target and the result of a dropped file. */
      .sig-drop { border:1.5px dashed var(--line-strong,var(--line)); border-radius:14px; padding:26px 18px; text-align:center;
        cursor:pointer; display:flex; flex-direction:column; gap:6px; align-items:center; transition:border-color .15s, background .15s }
      .sig-drop:hover, .sig-drop.over { border-color:var(--accent,#4a8cf7); background:rgba(74,140,247,.06) }
      .sig-drop b { color:var(--text); font-size:14.5px }
      .sig-drop span { color:var(--muted); font-size:12.5px }
      .sig-hit { margin-top:12px; padding:13px 14px; border:1px solid var(--line); border-radius:12px; background:rgba(255,255,255,.025) }
      .sig-hit-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:7px }
      .sig-hit-top b { color:var(--text); font-size:14px }
      .sig-hit-hash { color:var(--dim); font-size:11.5px; word-break:break-all; line-height:1.6 }
      .sig-hit-add { display:flex; gap:9px; margin-top:11px; flex-wrap:wrap }
      .sig-hit-add .input { flex:1; min-width:150px }
      /* v81 - PC & accounts: the map and the two panels beside it. Static only: no
         backdrop-filter, no blur, no animated gradient, so a scroll never repaints. */
      .hs-acc-wrap { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; align-items:start }
      @media (max-width:1180px) { .hs-acc-wrap { grid-template-columns:minmax(0,1fr) } }
      .hs-acc-col { display:flex; flex-direction:column; gap:14px; min-width:0 }
      .hs-pane { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 15px; min-width:0 }
      .hs-pane.map { display:flex; flex-direction:column; justify-content:center; padding:18px }
      .hs-pane.warn { border-color:rgba(244,63,94,.28) }
      .hs-pane-h { display:flex; align-items:center; gap:8px; font:700 13.5px var(--font); color:var(--text); margin:0 0 12px }
      .hs-pane-h span { font-weight:600; font-size:11.5px; color:var(--dim); background:rgba(255,255,255,.05); border:1px solid var(--line); border-radius:999px; padding:1px 8px }
      .hs-map { position:relative; width:100%; max-width:420px; margin:0 auto; aspect-ratio:1 }
      .hs-map svg { position:absolute; inset:0; width:100%; height:100% }
      .hs-map svg circle.hs-map-ring { fill:none; stroke:var(--line); stroke-width:.35; stroke-dasharray:1.4 2.2 }
      .hs-map svg line.hs-map-link { stroke-width:.3; opacity:.45 }
      .hs-map-pc { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); text-align:center;
        display:flex; flex-direction:column; align-items:center; gap:2px; width:min(62%,200px) }
      .hs-map-core { width:58px; height:58px; border-radius:50%; display:grid; place-items:center; font:800 14px var(--font);
        letter-spacing:.5px; color:#fff; background:var(--accent,#4a8cf7); box-shadow:0 0 0 7px var(--accent-ring,rgba(74,140,247,.18)); margin-bottom:8px }
      .hs-map-pc b { font-size:13.5px; color:var(--text) }
      .hs-map-pc span { font-size:11.5px; color:var(--muted); line-height:1.45 }
      .hs-map-vpn { color:#ffb35c !important; font-weight:600 }
      .hs-map-node { position:absolute; transform:translate(-50%,-50%); width:38px; height:38px; border-radius:50%;
        border:2px solid; background:var(--card); display:grid; place-items:center; overflow:hidden }
      .hs-map-node img { width:100%; height:100%; object-fit:cover }
      .hs-map-node em { font-style:normal; font-weight:700; font-size:14px; color:var(--text) }
      .hs-map-key { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin-top:12px; font-size:11.5px; color:var(--muted) }
      .hs-map-key i { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:middle }
      .hs-srv { display:flex; align-items:center; gap:12px; padding:11px 12px; border-radius:11px;
        background:rgba(255,255,255,.025); border:1px solid var(--line); border-left:3px solid var(--line) }
      .hs-srv.red { border-left-color:#f43f5e } .hs-srv.orange { border-left-color:#f59e0b }
      .hs-srv > img, .hs-srv > em { width:38px; height:38px; border-radius:12px; flex:none; object-fit:cover; background:#5865f2;
        display:grid; place-items:center; font-style:normal; font-weight:700; color:#fff }
      .hs-srv > div { flex:1; min-width:0 }
      .hs-srv b { color:var(--text); font-size:14px; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
      .hs-srv-why { color:var(--muted); font-size:12px; margin-top:2px }
      .hs-srv-id { color:var(--dim); font-size:11px; margin-top:2px }
      .rp-head { display:flex; align-items:center; gap:10px; margin:2px 0 14px; font:600 17px var(--font) }
      .rp-head .cnt { color:var(--dim); font-weight:500; font-size:13px }
      .rp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px }
      .rp-card { position:relative; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 16px 14px; overflow:hidden }
      .rp-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--c) }
      .rp-card.red { --c:#f43f5e; border-color:rgba(244,63,94,.28); background:linear-gradient(180deg,rgba(244,63,94,.07),transparent 60%),var(--card) }
      .rp-card.orange { --c:#f59e0b; border-color:rgba(245,158,11,.26); background:linear-gradient(180deg,rgba(245,158,11,.06),transparent 60%),var(--card) }
      .rp-card.yellow { --c:#eab308; border-color:rgba(234,179,8,.22) } .rp-card.green { --c:#10b981; border-color:rgba(16,185,129,.24) }
      .rp-card.purple { --c:#a855f7; border-color:rgba(168,85,247,.24) } .rp-card.blue { --c:#3b82f6; border-color:rgba(59,130,246,.24) }
      .rp-card.grey { --c:#5a6276 }
      .rp-top { display:flex; align-items:flex-start; gap:10px }
      .rp-ic { width:34px; height:34px; flex:none; border-radius:10px; display:grid; place-items:center; background:color-mix(in srgb,var(--c) 16%,transparent); color:var(--c) }
      .rp-ic svg { width:18px; height:18px }
      .rp-title { font-weight:600; font-size:14px; line-height:1.35; word-break:break-word; flex:1; padding-top:2px }
      .rp-tag { flex:none; font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:7px; border:1px solid color-mix(in srgb,var(--c) 45%,transparent); color:var(--c); background:color-mix(in srgb,var(--c) 10%,transparent); white-space:nowrap }
      .rp-meta { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px }
      .rp-chip { font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,.05); color:var(--muted) }
      .rp-txt { color:var(--muted); font-size:12.5px; margin-top:8px; line-height:1.5 }
      .rp-code { margin-top:8px; font:11.5px ui-monospace,Consolas,monospace; color:var(--dim); background:rgba(0,0,0,.25); border:1px solid var(--line); border-radius:8px; padding:7px 9px; word-break:break-all; line-height:1.5 }
      .rp-rows { display:flex; flex-direction:column; gap:8px }
      .rp-row { position:relative; display:flex; gap:12px; align-items:center; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 14px 10px 16px; font:12.5px ui-monospace,Consolas,monospace; color:var(--muted); word-break:break-all }
      .rp-row::before { content:''; position:absolute; left:0; top:8px; bottom:8px; width:3px; border-radius:3px; background:var(--c,#5a6276) }
      .rp-row.red{--c:#f43f5e;color:#fecdd3} .rp-row.orange{--c:#f59e0b} .rp-row.yellow{--c:#eab308} .rp-row.green{--c:#10b981} .rp-row.purple{--c:#a855f7} .rp-row.blue{--c:#3b82f6}
      .rp-row .r { margin-left:auto; flex:none; font-family:var(--font); font-size:11px; color:var(--dim) }
      .rp-verdict { display:flex; align-items:center; gap:16px; padding:18px 20px; border-radius:16px; border:1px solid var(--c); background:linear-gradient(90deg,color-mix(in srgb,var(--c) 14%,transparent),transparent),var(--card); margin-bottom:16px; --c:#10b981 }
      .rp-verdict.cheating{--c:#f43f5e} .rp-verdict.suspicious{--c:#f59e0b}
      .rp-verdict .big { font:800 26px var(--display); color:var(--c); text-transform:uppercase; letter-spacing:.04em }
      .rp-verdict .who { color:var(--muted); font-size:13px }
      .rp-verdict .pin { margin-left:auto; font:600 13px ui-monospace,monospace; color:var(--dim); text-align:right }
      .rp-stats { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-bottom:16px }
      .rp-stat { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 14px }
      .rp-stat b { display:block; font:700 22px var(--display); color:var(--c,var(--text)) } .rp-stat span { color:var(--dim); font-size:12px }
      .rp-kv { display:grid; grid-template-columns:150px 1fr; gap:8px 14px; font-size:13px } .rp-kv span { color:var(--dim) } .rp-kv b { font:500 12.5px ui-monospace,monospace; word-break:break-all }
      .rp-empty { padding:40px 20px; text-align:center; color:var(--dim); border:1px dashed var(--line); border-radius:14px }
      .rp-guild { display:flex; align-items:center; gap:12px }
      .rp-guild img, .rp-guild .gi { width:38px; height:38px; border-radius:12px; flex:none; background:#1e2130; display:grid; place-items:center; font-weight:700; color:var(--muted) }
      .rp-filter { width:100%; margin-bottom:12px }
    `;
    document.head.appendChild(st);
  }

  const IC = {
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>',
    disc: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.4C.6 9.1-.3 13.6.2 18.1A19.8 19.8 0 0 0 6.2 21l1.3-2.1a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.6-5.2-.9-9.7-3.5-13.6Z"/></svg>',
  };

  async function renderPinReport(view, pin, tab, q) {
    ensureReportCss();
    // the report is loaded only when it is opened, then kept for the session
    state.reports = state.reports || {};
    if (!state.reports[pin]) {
      view.innerHTML = loading();
      try { state.reports[pin] = (await api(`/api/pins?pin=${encodeURIComponent(pin)}`)).pin; }
      catch (e) {
        // The Results view is the one people wait on, so it gets the full treatment: what
        // happened, a Retry that fetches the report again, and the way back to the list.
        view.innerHTML = `<button class="btn btn-ghost btn-sm" data-go="pins" style="margin-bottom:14px">← Back to PINs</button>
          <div class="card empty" style="text-align:center;padding:34px 20px">
            <div style="font-size:15px;color:var(--text);margin-bottom:6px">Could not open this report</div>
            <div style="color:var(--muted);font-size:13px;margin-bottom:18px">${esc(e.message)}</div>
            <button class="btn btn-primary btn-sm" data-report-retry>Retry</button>
          </div>`;
        view.querySelector('[data-report-retry]').addEventListener('click', () => {
          delete state.reports[pin];          // without this the failure is cached and Retry does nothing
          renderPinReport(view, pin, tab, q);
        });
        return;
      }
    }
    const row = state.reports[pin];
    const r = row && row.report ? row.report : {};
    const R = (k) => r[k] ?? r[k[0].toLowerCase() + k.slice(1)];
    const F = (o, k) => (o ? (o[k] ?? o[k[0].toLowerCase() + k.slice(1)]) : undefined);
    const L = (k) => R(k) || [];
    const s = R('System') || {};
    const S = (k) => F(s, k);

    // the owner's cheat-server list (cached for the session)
    if (!state.cheatServers) { try { state.cheatServers = (await api('/api/cheat-servers')).servers || []; } catch { state.cheatServers = []; } }
    const cheatIds = new Map(state.cheatServers.map((c) => [String(c.guild_id), c]));
    // servers known only by their ID / invite → ask the site to look up the name and logo on Discord (cached)
    {
      state.guildInfo = state.guildInfo || {};
      const need = L('DiscordTraces').filter((t) => !F(t, 'Name') || !F(t, 'Icon'));
      const ids = [...new Set(need.map((t) => String(F(t, 'GuildId') || '')).filter((x) => /^\d{17,20}$/.test(x) && !(x in state.guildInfo)))].slice(0, 60);
      const invs = [...new Set(need.filter((t) => !F(t, 'GuildId') && F(t, 'Invite')).map((t) => String(F(t, 'Invite')).toLowerCase()).filter((x) => !('inv:' + x in state.guildInfo)))].slice(0, 30);
      if (ids.length || invs.length) {
        try {
          const g = await api(`/api/guild-info?ids=${ids.join(',')}&inv=${invs.map(encodeURIComponent).join(',')}`);
          Object.assign(state.guildInfo, g.info || {});
          for (const x of ids) if (!(x in state.guildInfo)) state.guildInfo[x] = null;
          for (const x of invs) if (!('inv:' + x in state.guildInfo)) state.guildInfo['inv:' + x] = null;
        } catch {}
      }
    }

    const dets = L('Detections').slice().sort((a, b) => (F(b, 'Severity') || 0) - (F(a, 'Severity') || 0));
    const warns = L('Warnings'), mods = L('Mods'), suspAll = L('Suspicious');
    const entropy = suspAll.filter((x) => /entropy/i.test(F(x, 'Kind') || ''));
    const susp = suspAll.filter((x) => !/entropy/i.test(F(x, 'Kind') || ''));
    const executed = L('ExecutedPrograms'), cmds = L('Commands'), deleted = L('DeletedFiles');
    const journal = L('Journal'), journalInfo = R('JournalInfo') || '';
    const jRed = journal.filter((x) => F(x, 'Level') === 2).length, jOrange = journal.filter((x) => F(x, 'Level') === 1).length;
    const memory = L('MemoryTraces'), memoryInfo = R('MemoryInfo') || '';
    const hw = L('Hardware'), hwInfo = R('HardwareInfo') || '';
    const timeline = L('Timeline'), usbs = L('UsbStorage'), jumps = L('JumpLists');
    const macros = L('Macros');
    const hist = R('PcHistory') || null;
    const bh = R('BanHistory') || null;
    const histBad = (hist ? (hist.cheating || 0) + (hist.hwidChanged ? 1 : 0) : 0) + (bh ? bh.count || 0 : 0);
    const maRed = macros.filter((x) => F(x, 'Level') === 2).length, maOrange = macros.filter((x) => F(x, 'Level') === 1).length;
    const tRed = timeline.filter((x) => F(x, 'Level') === 2).length, tOrange = timeline.filter((x) => F(x, 'Level') === 1).length;
    const uOrange = usbs.filter((x) => F(x, 'Level') >= 1).length + dets.filter((d) => F(d, 'Method') === 21).length;
    const jRed2 = jumps.filter((x) => F(x, 'Level') === 2).length, jOrange2 = jumps.filter((x) => F(x, 'Level') === 1).length;
    const hRed = hw.filter((x) => F(x, 'Level') === 2).length, hOrange = hw.filter((x) => F(x, 'Level') === 1).length;
    const mRed = memory.filter((x) => F(x, 'Level') === 2).length, mOrange = memory.filter((x) => F(x, 'Level') === 1).length;
    // v77 — the sources Windows records a program from, split out.
    //
    // They were all poured into one "Execution history" list, which hid what each one MEANS.
    // BAM says a program ran and when, to the second. DPS/DusmSvc says how much network a
    // program used — a cheat that talks to a server shows up there and nowhere else. PcaSvc
    // keeps compatibility records that survive a delete. Dnscache says which hostnames this PC
    // looked up. Four different kinds of proof, each worth its own tab.
    const bySource = (re) => executed.filter((e) => re.test(String(F(e, 'Source') || '')));
    const bam      = bySource(/^bam$|background activity/i);
    const dataUse  = bySource(/dusm|data usage|^dps$/i);
    const pca      = bySource(/pca/i);
    const dns      = bySource(/dns/i);
    // DMA boards and the hardware that pretends to be a mouse: the Kind the scanner already
    // writes for each device, filtered to the ones that cheat.
    const dma      = hw.filter((x) => /dma|fpga|pcie|squirrel|captain|lambda/i.test(String(F(x, 'Kind') || '') + ' ' + String(F(x, 'Name') || '')));
    // Hits that came from a string the OPERATOR wrote, rather than from the shipped list.
    const myStrings = dets.filter((d) => (F(d, 'Features') || []).some((f) => /operator string/i.test(String(f))));
    // Processes whose memory does not match the file they were loaded from.
    const hollows  = memory.filter((x) => /hollow|unbacked|unmapped|replaced|injected/i.test(
                       String(F(x, 'Kind') || '') + ' ' + String(F(x, 'Detail') || '') + ' ' + String(F(x, 'Name') || '')));
    const startup = L('StartupEntries'), tasks = L('ScheduledTasks'), drivers = L('LoadedDrivers');
    const recent = L('RecentFiles'), conns = L('NetworkConnections'), fw = L('FirewallRules');

    // NOTE: this block must stay AFTER `recent` is declared, just above.
    // It used to sit twenty lines earlier and read `recent` there. `const` is hoisted but
    // left uninitialised until its own line runs, so reading it early does not give undefined
    // - it throws "Cannot access 'recent' before initialization". That threw while a report
    // was being built, so the Results view never finished and the spinner turned for ever.
    // PC checker activity comes from the HeRoShield scan evidence, not staff imports.
    // A tool-name match is only a candidate; never fabricate a provider verdict.
    // Each tool, with the strings it actually leaves ON DISK.
    //
    // This used to be a list of display names matched literally, and it found nothing — ever.
    // "Ocean.ac" is a domain; the files it writes are Ocean.exe, .oceancache and
    // OceanGraper.sys, and none of those contains the letters "oceanac". The section said
    // "no PC checker trace" on a machine that had run Ocean twenty minutes earlier.
    //
    // Every needle below is a real file, folder or driver name. They are deliberately long and
    // specific: a short or ordinary word here would match somebody's holiday photos and put a
    // false accusation in a report, which costs far more than missing a tool.
    const checkerNames = [
      { name: 'Ocean.ac',        needles: ['oceanac', 'oceangraper', 'oceancache', 'oceanscanner'] },
      { name: 'Napse.ac',        needles: ['napseac', 'napsescanner', 'napsecache'] },
      { name: 'Echo AntiCheat',  needles: ['echoanticheat'] },
      { name: 'Paladin',         needles: ['paladinanticheat'] },
      { name: 'AnyDesk',         needles: ['anydesk'] },
      { name: 'TeamViewer',      needles: ['teamviewer'] },
      { name: 'RustDesk',        needles: ['rustdesk'] },
      { name: 'UltraViewer',     needles: ['ultraviewer'] },
      { name: 'Supremo',         needles: ['supremoremote', 'supremohelper'] },
      { name: 'AeroAdmin',       needles: ['aeroadmin'] },
      { name: 'Chrome Remote Desktop', needles: ['remotedesktophost', 'chromeremotedesktop'] },
      { name: 'Quick Assist',    needles: ['quickassist'] },
      { name: 'Process Hacker',  needles: ['processhacker'] },
      { name: 'System Informer', needles: ['systeminformer'] },
      { name: 'Process Explorer',needles: ['procexp64', 'procexp.exe', 'processexplorer'] },
      { name: 'Autoruns',        needles: ['autoruns'] },
      { name: 'Everything',      needles: ['everything.exe', 'everything64.dll', 'everything.db'] },
      { name: 'LastActivityView',needles: ['lastactivityview'] },
      { name: 'USBDeview',       needles: ['usbdeview'] },
      { name: 'ExecutedProgramsList', needles: ['executedprogramslist'] },
      { name: 'WinPrefetchView', needles: ['winprefetchview'] },
      { name: 'ShellBagsView',   needles: ['shellbagsview'] },
      { name: 'BrowsingHistoryView', needles: ['browsinghistoryview'] },
      { name: 'Registry Explorer', needles: ['registryexplorer'] },
      { name: 'PECmd',           needles: ['pecmd.exe'] },
      { name: 'AmcacheParser',   needles: ['amcacheparser'] },
      { name: 'AppCompatCacheParser', needles: ['appcompatcacheparser'] },
      { name: 'Timeline Explorer', needles: ['timelineexplorer'] },
      { name: 'Chainsaw',        needles: ['chainsaw.exe'] },
      { name: 'Hayabusa',        needles: ['hayabusa'] },
      { name: 'Velociraptor',    needles: ['velociraptor'] },
      { name: 'KAPE',            needles: ['kape.exe', 'gkape.exe'] },
      { name: 'FTK Imager',      needles: ['ftkimager'] },
      { name: 'Autopsy',         needles: ['autopsy64', 'autopsy.exe'] },
    ];
    // v74 — one entry per tool, not one per matching line.
    //
    // The old shape produced a row for every file that happened to contain the name, so a
    // single copy of Ocean.ac could fill the section with eight near-identical lines and
    // staff had to read all of them to learn one fact. What they actually need per tool is
    // three things: is it installed, did it run, and when was it last seen.
    //
    // Each half of the corpus means something different and is kept apart on purpose:
    //   ExecutedPrograms  Windows' own record that the program RAN
    //   RecentFiles       the file was opened or touched, which is not the same thing
    // Nothing is inferred beyond that, and no provider verdict is ever invented: whether
    // Ocean.ac called somebody a cheater is not in this PC's files, so it stays Unknown.
    const INSTALL_DIR = /\\(program files|program files \(x86\)|appdata\\local\\programs|appdata\\roaming)\\/i;
    const checkerHits = [
      ...executed.map((e) => ({ e, ran: true })),
      ...recent.map((e) => ({ e, ran: false })),
    ].flatMap(({ e, ran }) => {
      const path = String(F(e, 'Path') || F(e, 'Executable') || '');
      const raw = [F(e, 'Name'), path, F(e, 'FileName'), F(e, 'CommandLine')].filter(Boolean).join(' ');
      if (!raw) return [];
      const haystack = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      return checkerNames.filter((t) => t.needles.some((n) => {
        const needle = n.toLowerCase().replace(/[^a-z0-9]/g, '');
        return needle.length >= 6 && haystack.includes(needle);
      })).map((t) => ({ name: t.name, ran, path, raw: raw.slice(0, 280), when: F(e, 'When') || F(e, 'LastRun') || '' }));
    });

    // Fold the hits into one record per tool.
    const checkerTools = [...new Map(checkerHits.map((h) => [h.name, null])).keys()].map((name) => {
      const mine = checkerHits.filter((h) => h.name === name);
      const ran = mine.filter((h) => h.ran);
      const dates = mine.map((h) => h.when).filter(Boolean).sort();
      return {
        name,
        executed: ran.length > 0,
        installed: mine.some((h) => INSTALL_DIR.test(h.path)),
        lastSeen: dates.length ? dates[dates.length - 1] : '',
        paths: [...new Set(mine.map((h) => h.path).filter(Boolean))].slice(0, 4),
        sample: mine[0].raw,
      };
    }).sort((a, b) => (b.executed - a.executed) || a.name.localeCompare(b.name));

    // kept for anything still reading the old name
    const checkerEvidence = checkerTools;
    const browserHistory = Array.isArray(R('BrowserSearchHistory')) ? R('BrowserSearchHistory') : [];
    const browserDownloads = Array.isArray(R('BrowserDownloads')) ? R('BrowserDownloads') : [];
    const events = L('EventLogEntries').filter((e) => !(F(e, 'Category') === 'ServiceInstall' && /microsoft|system32\\drivers|\\windows\\/i.test(F(e, 'Message') || '')));
    const verdict = R('Verdict') || (row && row.result) || 'clean';
    const shot = R('ScreenshotJpegBase64');
    const dc = row && row.discord_check;
    const guilds = (dc && dc.guilds) || [];
    const cheatGuilds = guilds.filter((g) => cheatIds.has(String(g.id)));
    const localDiscord = R('DiscordId');
    // ---- Discord history: servers he was in and LEFT (PC cache + his earlier checks) ----
    const CHEAT_NAME = /\b(cheats?|cheating|hacks?|hacking|hacker|mod ?menus?|executors?|injectors?|spoofers?|hwid|aimbot|triggerbot|silent ?aim|bypass|undetected|eulen|red ?engine|skript(?:\.gg)?|hx ?software|tz ?project|lumia|macho|susano|lynx ?menu|desudo|brutan|kiddions?|cherax|2take1|stand ?menu|ozark|phaze|gosth|keyser|nightfall|hammafia|lua ?(?:menu|executor)|fivem ?(?:menu|mods? ?menu)|unlock ?all|cheat ?(?:shop|store|market|hub)|fivem ?cheats?|gta ?(?:v ?)?cheats?|recovery ?(?:menu|service)|d3ad ?space|external ?menu|injector ?shop|paid ?(?:menu|cheat)|private ?(?:menu|cheat)|hack ?(?:shop|dev|devs|developers?))\b/i;
    const curIds = new Set(guilds.map((g) => String(g.id)));
    const invCode = (u) => ((/(?:discord(?:app)?\.gg|invite)\/([A-Za-z0-9-]+)/i.exec(u || '') || [])[1] || '').toLowerCase();
    const cheatByInvite = new Map(state.cheatServers.filter((c) => c.invite).map((c) => [invCode(c.invite), c]));
    const traceMap = new Map();
    for (const t of L('DiscordTraces')) {
      const inv = String(F(t, 'Invite') || '').toLowerCase();
      const listed = (F(t, 'GuildId') && cheatIds.get(String(F(t, 'GuildId')))) || (inv && cheatByInvite.get(inv)) || null;
      const id = String(F(t, 'GuildId') || (listed && listed.guild_id) || '');
      const key = id || 'inv:' + inv;
      const name = F(t, 'Name') || (listed && listed.name) || (guilds.find((g) => String(g.id) === id) || {}).name || '';
      const prev = traceMap.get(key);
      const x = { id, inv, name: name || (prev && prev.name) || '', icon: F(t, 'Icon') || (prev && prev.icon) || (listed && listed.icon) || '', listed: listed || (prev && prev.listed), last: F(t, 'LastSeen') || '', first: F(t, 'FirstSeen') || '',
        src: [...new Set([...(prev ? prev.src : []), ...(F(t, 'Sources') || [])])], inNow: !!id && curIds.has(id) };
      if (prev && prev.last > x.last) x.last = prev.last;
      traceMap.set(key, x);
    }
    // names / icons the site looked up on Discord for servers we only knew by ID
    const gi = state.guildInfo || {};
    for (const x of traceMap.values()) { const r = gi[x.id] || (x.inv && gi['inv:' + x.inv]); if (r) { if (!x.name && r.name) x.name = r.name; if (!x.icon && r.icon) x.icon = r.icon; if (!x.id && r.id) x.id = r.id; } }
    const traces = [...traceMap.values()].map((x) => ({ ...x, nameHit: CHEAT_NAME.test(x.name) }));
    const pastCheat = traces.filter((x) => (x.listed || x.nameHit) && !x.inNow).sort((a, b) => (b.listed ? 1 : 0) - (a.listed ? 1 : 0) || (b.last > a.last ? 1 : -1));
    const pastOther = traces.filter((x) => !x.listed && !x.nameHit && !x.inNow && x.id);
    const nameGuilds = guilds.filter((g) => !cheatIds.has(String(g.id)) && CHEAT_NAME.test(g.name || ''));
    // his earlier checks (other PINs) with Discord connected → what he left / joined since
    let history = [];
    if (dc && dc.user && dc.user.id) {
      state.discHist = state.discHist || {};
      if (!state.discHist[dc.user.id]) {
        try { state.discHist[dc.user.id] = ((await api(`/api/data?server=${state.server}&type=lookup&id=${encodeURIComponent(dc.user.id)}`)).scans || []); }
        catch { state.discHist[dc.user.id] = []; }
      }
      history = state.discHist[dc.user.id].filter((h) => h.pin !== pin && h.discord_check && Array.isArray(h.discord_check.guilds) && (h.discord_check.at || h.created_at) < dc.at);
    }
    const byId = !!(dc && dc.source === 'id');
    const leftSince = new Map();   // guild id → { name, at (last check he was still in it) }
    for (const h of history) for (const g of h.discord_check.guilds) {
      const id = String(g.id), at = h.discord_check.at || h.created_at;
      if (curIds.has(id)) continue;
      const p = leftSince.get(id);
      if (!p || p.at < at) leftSince.set(id, { id, name: g.name, icon: g.icon, at, pin: h.pin });
    }
    const lastHist = history.slice().sort((a, b) => ((b.discord_check.at || '') > (a.discord_check.at || '') ? 1 : -1))[0];
    const joinedSince = lastHist && !byId ? guilds.filter((g) => !lastHist.discord_check.guilds.some((o) => String(o.id) === String(g.id))) : [];
    const leftList = [...leftSince.values()].map((x) => ({ ...x, listed: cheatIds.get(x.id), nameHit: CHEAT_NAME.test(x.name || '') }));
    const leftCheat = leftList.filter((x) => x.listed || x.nameHit);
    const discRed = cheatGuilds.length + pastCheat.filter((x) => x.listed).length + leftCheat.filter((x) => x.listed && !pastCheat.some((p) => p.id === x.id)).length;
    const discOrange = nameGuilds.length + pastCheat.filter((x) => !x.listed).length + leftCheat.filter((x) => !x.listed && !pastCheat.some((p) => p.id === x.id)).length;
    // v30: the game of the PIN. FiveM / RedM keep the FiveM section; Minecraft / Roblox use GameFiles.
    const rGame = String(R('Game') || (row && row.game) || 'fivem').toLowerCase();
    const isCfx = rGame === 'fivem' || rGame === 'redm';
    const gName = gameOf(rGame).name;
    const fivem = L(isCfx ? 'FiveM' : 'GameFiles').slice().sort((a, b) => (F(b, 'Level') || 0) - (F(a, 'Level') || 0));
    const fivemBad = fivem.filter((x) => F(x, 'Level') === 2).length, fivemLook = fivem.filter((x) => F(x, 'Level') === 1).length;

    const flaggedRuns = executed.filter((e) => F(e, 'Flagged'));
    const has = (re) => warns.some((w) => re.test(F(w, 'Title') || ''));
    const av = L('Antivirus');
    const integrity = [
      ['Prefetch history is intact', !has(/prefetch/i)],
      ['Event logs were not cleared', !has(/event log|log looks cleared|logs were cleared/i)],
      ['Execution history present', executed.length >= 8 && !has(/very little execution|bam\) almost empty/i)],
      ['AmCache / Recent files not wiped', !has(/amcache|recent files list/i)],
      ['Antivirus real-time protection on', av.length ? av.some((a) => /\(on\)/.test(a)) && !has(/defender.*(disabled|turned off)|protection is off/i) : !has(/defender/i)],
      ['No Defender exclusions', !has(/defender exclusion/i)],
      ['Test-signing / debug mode off', !has(/test-signing|debug mode|signature enforcement/i)],
      ['No injection hooks (AppInit / IFEO)', !has(/appinit|ifeo/i)],
      ['Not a virtual machine', !S('IsVirtualMachine')],
      ['Hardware IDs look real', !S('SpooferFlag')],
      ['Hosts file normal', !/MODIFIED/i.test(S('HostsFileStatus') || '')],
      ['Secure Boot on', !!S('SecureBoot')],
      ['Clock not changed by hand', !has(/clock changed/i)],
      ['Discord connected', !!dc],
    ];
    const passed = integrity.filter((i) => i[1]).length;

    const sevC = (d) => (F(d, 'Severity') === 2 ? 'red' : F(d, 'Severity') === 1 ? 'orange' : 'yellow');
    const warnC = (w) => (/cleaning|injection|evasion/i.test(F(w, 'Category') || '') ? 'orange' : 'yellow');
    const card = (c, icon, title, tag, inner = '') => `<div class="rp-card ${c}"><div class="rp-top"><div class="rp-ic">${icon}</div>
        <div class="rp-title">${title}</div>${tag ? `<span class="rp-tag">${tag}</span>` : ''}</div>${inner}</div>`;
    const rowL = (c, text, right = '') => `<div class="rp-row ${c}"><span>${text}</span>${right ? `<span class="r">${right}</span>` : ''}</div>`;
    const grid = (items, empty) => (items.length ? `<div class="rp-grid">${items.join('')}</div>` : `<div class="rp-empty">${empty}</div>`);
    const rows = (items, empty) => (items.length ? `<div class="rp-rows">${items.join('')}</div>` : `<div class="rp-empty">${empty}</div>`);
    const head = (title, n, sub = '') => `<div class="rp-head">${title} <span class="cnt">${n !== '' ? n + ' entries' : ''}</span></div>${sub ? `<p style="color:var(--dim);font-size:12.5px;margin:-8px 0 14px">${sub}</p>` : ''}`;
    const qf = (q || '').toLowerCase();
    const match = (...xs) => !qf || xs.some((x) => String(Array.isArray(x) ? x.join(' ') : x || '').toLowerCase().includes(qf));
    const fl = (list, ...keys) => list.filter((o) => match(...(typeof o === 'string' ? [o] : keys.map((k) => F(o, k)))));

    // v76 — the nav is grouped.
    //
    // Twenty-six buttons in one column with two unlabelled gaps gave staff no way to find
    // anything: the order was historical, not meaningful. Named groups say what each run of
    // buttons is FOR, so somebody who wants "what ran on this PC" knows to look under
    // EXECUTION instead of reading all twenty-six.
    const catsRaw = [
      { group: 'Detections' },
      ['overview', 'Overview', '', 'blue'],
      ['detects', 'Detects', dets.length, 'red'],
      ['timeline', 'Timeline 24h', tRed ? tRed + ' cheat' : tOrange ? tOrange + ' check' : timeline.length || '–', tRed ? 'red' : tOrange ? 'orange' : 'blue'],
      ['integrity', 'Integrity', `${passed}/${integrity.length}`, 'green'],
      ['warnings', 'Warnings', warns.length, 'orange'],
      R('Hardware') ? ['dma', 'DMA', dma.length, dma.length ? 'red' : 'blue'] : null,
      ['suspicious', 'Suspicious', susp.length, 'yellow'],
      ['entropy', 'Entropy', entropy.length, 'purple'],
      ['fivem', gName, fivemBad ? fivemBad + ' cheat' : fivem.filter((x) => F(x, 'Kind') !== 'Folder').length, fivemBad ? 'red' : fivemLook ? 'orange' : 'green'],
      { group: 'Execution' },
      bam.length      ? ['bam', 'BAM', bam.length, 'red'] : null,
      dataUse.length  ? ['datausage', 'Data usage', dataUse.length, 'orange'] : null,
      pca.length      ? ['pcasvc', 'PcaSvc', pca.length, 'blue'] : null,
      R('Memory')     ? ['hollows', 'Hollows Hunter', hollows.length, hollows.length ? 'red' : 'blue'] : null,
      ['exec', 'Programs that ran', flaggedRuns.length || executed.length, flaggedRuns.length ? 'red' : 'blue'],
      ['persist', 'Startup & tasks', startup.filter((x) => F(x, 'Suspicious')).length + tasks.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['drivers', 'Drivers', drivers.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['network', 'Network', conns.filter((x) => F(x, 'Suspicious')).length + fw.length, 'orange'],
      ['usb', 'USB drives', uOrange ? uOrange + ' check' : usbs.length || '–', uOrange ? 'orange' : 'blue'],
      ['opened', 'Opened files', jRed2 ? jRed2 + ' cheat' : jOrange2 ? jOrange2 + ' check' : jumps.length || '–', jRed2 ? 'red' : jOrange2 ? 'orange' : 'blue'],
      ['macros', 'Macros & recoil', maRed ? maRed + ' cheat' : maOrange ? maOrange + ' check' : (R('Macros') ? macros.length || '0' : '–'), maRed ? 'red' : maOrange ? 'orange' : 'blue'],
      ['hardware', 'Cheat hardware', hRed ? hRed + ' cheat' : hOrange ? hOrange + ' check' : (R('Hardware') ? '0' : '–'), hRed ? 'red' : hOrange ? 'orange' : 'blue'],
      ['memory', 'Service memory', mRed ? mRed + ' cheat' : mOrange ? mOrange + ' check' : memory.length || '–', mRed ? 'red' : mOrange ? 'orange' : 'blue'],
      { group: 'Artifacts' },
      ['journal', 'File journal', jRed ? jRed + ' cheat' : jOrange ? jOrange + ' check' : journal.length || '–', jRed ? 'red' : jOrange ? 'orange' : 'blue'],
      ['files', 'Files & mods', deleted.length + recent.filter((x) => F(x, 'Flagged')).length + mods.length, 'blue'],
      ['cmds', 'Commands', cmds.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['events', 'Event log', events.length, 'blue'],
      ['deleted', 'Deleted files', deleted.length, deleted.length ? 'red' : 'blue'],
      dns.length ? ['dnshistory', 'DNS history', dns.length, 'blue'] : null,
      ['browserhistory', 'Browser history', browserHistory.length, 'blue'],
      ['browserdownloads', 'Browser downloads', browserDownloads.length, 'blue'],
      { group: 'Session' },
      ['pc', 'PC & accounts', '', 'blue'],
    ];
    // A tab the scanner collected nothing for is left out rather than shown empty: "DMA: 0"
    // reads as "we looked and there is no DMA board", which is a different claim from "this
    // scanner does not read hardware", and only one of them is true for an older report.
    const cats = catsRaw.filter(Boolean);

    tab = tab || (dets.length ? 'detects' : 'overview');
    // Player history was removed; an old link or a remembered tab must not open a blank pane.
    if (tab === 'pchistory') tab = 'overview';
    // v81 - the Discord tab is gone. Its one useful half (the cheat servers) is in PC & accounts.
    if (tab === 'discord') tab = 'pc';
    if (!cats.some((c) => Array.isArray(c) && c[0] === tab)) tab = 'overview';
    const total = dets.length + warns.length + susp.length + entropy.length;

    // Read only the browser data explicitly included in this PIN's report.
    // No collection, upload, or cross-PIN access is initiated by these panels.
    const browserPane = (entries, title) => head(title, entries.length,
      'Only browser records shared with consent during this scan appear here. A search or download is not proof of cheating.')
      + rows(entries.filter(e => match(typeof e === 'object' ? JSON.stringify(e) : String(e))).slice(0, 300).map(e => {
        const obj = e && typeof e === 'object' ? e : { Value: e };
        return rowL('blue', Object.entries(obj).slice(0, 10).map(([k, v]) =>
          `<b>${esc(k)}:</b> ${esc(typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''))}`).join(' · '));
      }), 'No browser records shared in this scan report.');
    const panes = {
      browserhistory: () => browserPane(browserHistory, 'Browser Search History'),
      browserdownloads: () => browserPane(browserDownloads, 'Browser Downloads'),
      overview: () => `
        <div class="rp-stats">
          ${[['Detects', dets.length, dets.length ? '#fb7185' : ''], ['Warnings', warns.length, warns.length ? '#fbbf24' : ''],
             ['Suspicious', susp.length, ''], ['Integrity', `${passed}/${integrity.length}`, passed === integrity.length ? '#34d399' : ''],
             ['Cheat servers', dc ? cheatGuilds.length : '–', cheatGuilds.length ? '#fb7185' : ''], ['Files scanned', fmtNum(R('FilesScanned')), ''],
             ['Scan time', (R('DurationSeconds') || 0) + 's', ''], ['Scanner', 'v' + (R('ScannerVersion') || '?'), '']]
            .map(([k, v, c]) => `<div class="rp-stat" style="${c ? `--c:${c}` : ''}"><b>${esc(v)}</b><span>${k}</span></div>`).join('')}
        </div>
        ${(hist && (hist.seen || hist.hwidChanged)) || (bh && bh.count) ? (() => {
          const last = hist && hist.scans && hist.scans[0];
          const title = bh && bh.count ? `Banned on ${bh.servers} HeRo Shield server${bh.servers === 1 ? '' : 's'} — ${esc(bh.bans[0].server)}: “${esc(bh.bans[0].reason)}”`
            : hist.cheating ? `Already caught cheating ${hist.cheating}× — last scan ${esc(fmtDate(last.at))} on ${esc(last.server)}`
            : hist.hwidChanged ? 'Same PC, but the HWID changed since the last scan (spoofer?)'
            : `Already scanned ${hist.seen}× — last on ${esc(last.server)}, ${esc(fmtDate(last.at))}: ${last.verdict === 'clean' ? 'safe' : esc(last.verdict)}`;
          const sub = [hist ? `${hist.seen} earlier scan${hist.seen === 1 ? '' : 's'} · ${hist.cheating} cheater · ${hist.clean} safe` : '', bh && bh.count ? `${bh.count} FiveM ban${bh.count === 1 ? '' : 's'} (${bh.active} active)` : ''].filter(Boolean).join(' · ');
          return `<div class="rp-card ${histBad ? 'red' : hist && hist.suspicious ? 'orange' : 'blue'}" style="margin:14px 0;cursor:pointer" data-goto-tab="pchistory"><div class="rp-top"><div class="rp-ic">${IC.alert}</div>
          <div><b>${title}</b><div style="color:var(--dim);font-size:12.5px;margin-top:3px">${sub} — open Player history</div></div></div></div>`;
        })() : ''}
        <div class="rp-head">Most important</div>
        ${grid([
          ...dets.slice(0, 6).map((d) => card(sevC(d), IC.alert, esc(F(d, 'Signature')), F(d, 'Deleted') ? 'File deleted' : esc(METHODS[F(d, 'Method')] || ''))),
          ...fivem.filter((x) => F(x, 'Level') === 2).slice(0, 4).map((x) => card('red', IC.alert, 'FiveM mod: ' + esc(F(x, 'Name')), 'FiveM')),
          ...cheatGuilds.slice(0, 4).map((g) => card('red', IC.disc, 'In cheat Discord: ' + esc(g.name), 'Discord')),
          ...pastCheat.filter((x) => x.listed).slice(0, 3).map((x) => card('red', IC.disc, 'Was in cheat Discord (left): ' + esc(x.name || x.id || x.inv), 'Discord · PC')),
          ...leftCheat.filter((x) => x.listed && !pastCheat.some((p) => p.listed && p.id === x.id)).slice(0, 3).map((x) => card('red', IC.disc, 'Left cheat Discord: ' + esc(x.name), 'Discord · history')),
          ...warns.slice(0, 6).map((w) => card(warnC(w), IC.alert, esc(F(w, 'Title')), esc(F(w, 'Category') || 'System'))),
        ], 'Nothing found — the PC looks clean.')}
        ${shot ? `<div class="rp-head" style="margin-top:18px">Screenshot at the end of the scan</div><img src="${esc(shot)}" alt="Player screen" style="width:100%;border-radius:14px;border:1px solid var(--line)">` : ''}`,

      detects: () => head('Detects Logs', dets.length) + grid(fl(dets, 'Signature', 'Path', 'Explain', 'Features', 'Sha256').map((d) => card(sevC(d), IC.alert, esc(F(d, 'Signature')),
          F(d, 'Deleted') ? 'File deleted' : F(d, 'Method') === 0 ? 'Running' : 'On disk',
          `<div class="rp-meta"><span class="rp-chip">${SEV[F(d, 'Severity')] || ''}</span><span class="rp-chip">${esc(METHODS[F(d, 'Method')] || '')}</span>
            ${(F(d, 'Features') || []).slice(0, 5).map((f) => `<span class="rp-chip">${esc(f)}</span>`).join('')}<span class="rp-chip">${esc(F(d, 'When'))}</span></div>
           <div class="rp-txt">${esc(F(d, 'Explain'))}</div>
           <div class="rp-code">${esc(F(d, 'Path'))}${F(d, 'Sha256') ? '<br>SHA-256 ' + esc(F(d, 'Sha256')) : ''}</div>`)), 'No cheat found.'),

      integrity: () => head('Integrity checks', `${passed}/${integrity.length} passed`, 'Green = normal. Red = something was changed, disabled or cleaned before the check.')
        + grid(integrity.map(([t, ok]) => card(ok ? 'green' : 'red', ok ? IC.check : IC.x, t, ok ? 'Passed' : 'Failed')), ''),

      warnings: () => head('Warnings Logs', warns.length) + grid(fl(warns, 'Title', 'Detail', 'Category').map((w) => card(warnC(w), IC.alert, esc(F(w, 'Title')), esc(F(w, 'Category') || 'System'),
          `<div class="rp-txt">${esc(F(w, 'Detail'))}</div>`)), 'No warnings.'),

      suspicious: () => head('Suspicious Logs', susp.length, 'Not proof on their own — files worth a look.')
        + rows(susp.filter((x) => match(F(x, 'Kind'), F(x, 'Path'))).map((x) => rowL('yellow', esc(F(x, 'Path')), esc(F(x, 'Kind')))), 'Nothing suspicious.'),

      entropy: () => head('Entropy', entropy.length, 'Programs whose content is packed / encrypted (entropy > 7.2 of 8) and unsigned — cheats do this to hide their strings.')
        + rows(fl(entropy, 'Path', 'Kind').map((x) => rowL('purple', esc(F(x, 'Path')), esc((F(x, 'Kind') || '').replace(/\s*\(.*/, '')))), 'No packed programs found.'),

      fivem: () => {
        const lvC = (x) => (F(x, 'Level') === 2 ? 'red' : F(x, 'Level') === 1 ? 'orange' : 'green');
        const lvT = (x) => (F(x, 'Level') === 2 ? 'CHEAT' : F(x, 'Level') === 1 ? 'Check' : 'OK');
        const folders = fivem.filter((x) => F(x, 'Kind') === 'Folder');
        const items = fl(fivem.filter((x) => F(x, 'Kind') !== 'Folder'), 'Kind', 'Name', 'Path', 'Detail', 'Files');
        const GH = {
          fivem: ['FiveM files & mods', 'Every mod in the FiveM folders is opened and read — .rpf archives (weapons.meta, visualsettings, timecycle, nested archives), plugins, scripts and proxy DLLs. Red = cheat mod (also listed in Detects). Orange = changes game settings, check it. Green = normal.'],
          redm: ['RedM files & mods', 'Every mod in the RedM folders is opened and read — archives, plugins, scripts and proxy DLLs. Red = cheat mod (also listed in Detects). Orange = changes game settings, check it. Green = normal.'],
          minecraft: ['Minecraft — launchers, mods & clients', 'Every launcher folder (.minecraft, Lunar, Badlion, Feather, Prism, CurseForge, Modrinth, TLauncher…) is read. Each mod .jar is opened: a hacked client is found by the code inside, even when the jar was renamed. Game logs show clients loaded before (chat lines are ignored). Red = cheat client / mod. Orange = allowed only on some servers (x-ray, freecam…). Green = normal mod.'],
          roblox: ['Roblox — executors, scripts & FFlags', 'Roblox, Bloxstrap / Fishstrap, executor folders (the workspace + autoexec layout every executor uses, also when renamed), saved scripts, executors that ran, and FFlags that change physics / network (desync, hitbox tricks). Red = executor. Orange = check it.'],
        }[rGame] || ['Game files', ''];
        return head(GH[0], items.length, GH[1])
          + (folders.length ? `<div class="rp-meta" style="margin-bottom:14px">${folders.map((f) => `<span class="rp-chip">${esc(F(f, 'Path') || F(f, 'Name'))}${F(f, 'Detail') ? ' · ' + esc(F(f, 'Detail')) : ''}</span>`).join('')}</div>` : '')
          + grid(items.map((x) => card(lvC(x), lvC(x) === 'green' ? IC.check : IC.alert, esc(F(x, 'Name')), lvT(x),
            `<div class="rp-meta"><span class="rp-chip">${esc(F(x, 'Kind'))}</span>${F(x, 'SizeMb') ? `<span class="rp-chip">${esc(F(x, 'SizeMb'))} MB</span>` : ''}${F(x, 'When') ? `<span class="rp-chip">${esc(F(x, 'When'))}</span>` : ''}</div>
             ${F(x, 'Detail') ? `<div class="rp-txt">${esc(F(x, 'Detail'))}</div>` : ''}
             <div class="rp-code">${esc(F(x, 'Path'))}${(F(x, 'Files') || []).length ? '<br>' + (F(x, 'Files') || []).slice(0, 8).map(esc).join('<br>') + ((F(x, 'Files') || []).length > 8 ? `<br>… +${(F(x, 'Files') || []).length - 8} more` : '') : ''}</div>`)),
            isCfx ? (R('FiveM') ? `No mods found in the ${gName} folders.` : 'This report has no FiveM section — the player used an older scanner (needs v4.1+).')
              : (R('GameFiles') ? `Nothing found for ${gName}.` : `This report has no ${gName} section — the player used an older scanner (needs v4.10+).`));
      },

      exec: () => head('Execution history', executed.length, 'Programs Windows recorded running (Prefetch, BAM, PCA, UserAssist, ShimCache) — even if deleted since.')
        + rows(executed.filter((e) => match(F(e, 'Name'), F(e, 'Path'))).slice(0, 500).map((e) =>
          rowL(F(e, 'Flagged') ? 'red' : '', esc(F(e, 'Path') || F(e, 'Name')), `${esc(F(e, 'LastRun'))} · ${esc(F(e, 'Source'))}`)), 'No execution history — it may have been wiped.'),

      dma: () => head('DMA & cheat hardware', dma.length,
          'A DMA board reads the game\'s memory from a second PC, so nothing cheat-like ever runs on this one. It is found by the device it leaves behind, not by a file.')
        + rows(dma.filter((x) => match(F(x, 'Name'), F(x, 'Kind'))).map((x) =>
          rowL(F(x, 'Level') === 2 ? 'red' : 'orange',
            `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b> <span style="color:var(--dim)">${esc(F(x, 'Kind'))}</span>`
            + (F(x, 'Detail') ? `<div style="color:var(--dim);font-size:12px;margin-top:3px">${esc(F(x, 'Detail'))}</div>` : ''),
            esc(F(x, 'When') || ''))),
          R('Hardware') ? 'No DMA board or spoofing hardware on this PC.' : 'This report has no hardware scan (older scanner).'),

      bam: () => head('BAM — what Windows timestamped', bam.length,
          'The Background Activity Moderator records the last time each program ran, to the second. It is kept per user and survives the file being deleted.')
        + rows(bam.filter((e) => match(F(e, 'Name'), F(e, 'Path'))).slice(0, 500).map((e) =>
          rowL(F(e, 'Flagged') ? 'red' : '', esc(F(e, 'Path') || F(e, 'Name')), esc(F(e, 'LastRun') || ''))),
          'No BAM records in this report.'),

      datausage: () => head('Data usage', dataUse.length,
          'How much network each program used, from Windows\' own counter. A cheat that talks to a licence server appears here even when every file it came from is gone.')
        + rows(dataUse.filter((e) => match(F(e, 'Name'), F(e, 'Path'))).slice(0, 500).map((e) =>
          rowL(F(e, 'Flagged') ? 'red' : '',
            `${esc(F(e, 'Path') || F(e, 'Name'))}${F(e, 'Detail') ? `<div style="color:var(--dim);font-size:12px;margin-top:3px">${esc(F(e, 'Detail'))}</div>` : ''}`,
            esc(F(e, 'LastRun') || ''))),
          'No network usage records in this report.'),

      pcasvc: () => head('PcaSvc', pca.length,
          'Program Compatibility Assistant records. Windows keeps them so it can offer compatibility help later, which means they outlive the program itself.')
        + rows(pca.filter((e) => match(F(e, 'Name'), F(e, 'Path'))).slice(0, 500).map((e) =>
          rowL(F(e, 'Flagged') ? 'red' : '', esc(F(e, 'Path') || F(e, 'Name')), esc(F(e, 'LastRun') || ''))),
          'No PcaSvc records in this report.'),

      dnshistory: () => head('DNS history', dns.length,
          'Hostnames this PC looked up. A cheat loader has to reach its server by name, and the lookup is cached here even when the program is gone.')
        + rows(dns.filter((e) => match(F(e, 'Name'), F(e, 'Path'))).slice(0, 500).map((e) =>
          rowL(F(e, 'Flagged') ? 'red' : '', esc(F(e, 'Name') || F(e, 'Path')), esc(F(e, 'LastRun') || ''))),
          'No DNS records in this report — the cache is cleared on every reboot.'),

      hollows: () => head('Hollowed processes', hollows.length,
          'A process whose memory no longer matches the file it was started from: something replaced the code after it loaded. That is injection, and it leaves nothing on disk.')
        + rows(hollows.filter((x) => match(F(x, 'Name'), F(x, 'Detail'))).map((x) =>
          rowL(F(x, 'Level') === 2 ? 'red' : 'orange',
            `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b>`
            + (F(x, 'Detail') ? `<div style="color:var(--dim);font-size:12px;margin-top:3px">${esc(F(x, 'Detail'))}</div>` : ''),
            esc(F(x, 'When') || ''))),
          R('Memory') ? 'No hollowed or injected process found.' : 'This report has no memory scan (older scanner).'),

      deleted: () => head('Deleted files', deleted.length,
          'Files that were on this PC and are not any more. Windows remembers the name and when it went, which is usually minutes before a check.')
        + rows(deleted.filter((x) => match(F(x, 'Name'), F(x, 'Path'))).slice(0, 500).map((x) =>
          rowL(F(x, 'Flagged') ? 'red' : '', esc(F(x, 'Path') || F(x, 'Name')), esc(F(x, 'When') || ''))),
          'Nothing recorded as deleted.'),

      persist: () => head('Starts with Windows', startup.length) + rows(fl(startup, 'Name', 'Command', 'Location').map((x) =>
          rowL(F(x, 'Suspicious') ? 'orange' : '', `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b> &nbsp;${esc(F(x, 'Command'))}`, esc(F(x, 'Location')))), 'No startup entries.')
        + '<div style="height:18px"></div>' + head('Scheduled tasks (non-Microsoft)', tasks.length) + rows(fl(tasks, 'Name', 'Command').map((x) =>
          rowL(F(x, 'Suspicious') ? 'orange' : '', `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b> &nbsp;${esc(F(x, 'Command'))}`, esc(F(x, 'LastRun')))), 'None.'),

      drivers: () => head('Kernel drivers (non-Microsoft)', drivers.length, 'Kernel cheats need a driver. Orange = unsigned, from a user folder, or an exploitable driver (some RGB tools use them too — ask).')
        + rows(fl(drivers, 'Name', 'Path').map((x) => rowL(F(x, 'Suspicious') ? (F(x, 'Signed') ? 'orange' : 'red') : '', `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b> &nbsp;${esc(F(x, 'Path'))}`,
          F(x, 'Signed') ? 'signed' : 'UNSIGNED')), 'No third-party drivers.'),

      network: () => head('Live connections', conns.length) + rows(fl(conns, 'Process', 'RemoteAddress', 'State').map((x) => rowL(F(x, 'Suspicious') ? 'red' : '', `${esc(F(x, 'Process'))} → ${esc(F(x, 'RemoteAddress'))}`, esc(F(x, 'State')))), 'No outside connections.')
        + '<div style="height:18px"></div>' + head('Firewall / hosts', fw.length) + rows([
          ...fl(fw).map((x) => rowL('orange', esc(x))),
          rowL(/MODIFIED/i.test(S('HostsFileStatus') || '') ? 'red' : 'green', 'hosts file: ' + esc(S('HostsFileStatus') || 'normal')),
        ], ''),

      journal: () => {
        const lv = (x) => (F(x, 'Level') === 2 ? 'red' : F(x, 'Level') === 1 ? 'orange' : '');
        const act = (x) => ({ Deleted: 'deleted', Recycled: 'sent to recycle bin', Renamed: 'renamed', Created: 'created' }[F(x, 'Action')] || F(x, 'Action'));
        const items = fl(journal, 'Name', 'OldName', 'Action', 'Why', 'When');
        return head('File-change journal (last 7 days)', items.length,
            'Windows writes every file created / deleted / renamed into the NTFS journal — it still shows cheats the player deleted or renamed, even after emptying the recycle bin. '
            + 'Red = cheat file or cheat-named file. Orange = random-named or deleted just before the check.' + (journalInfo ? ' · ' + esc(journalInfo) : ''))
          + rows(items.slice(0, 600).map((x) => rowL(lv(x),
              `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b>${F(x, 'OldName') ? ` <span style="color:var(--dim)">← was ${esc(F(x, 'OldName'))}</span>` : ''} &nbsp;<span style="color:var(--dim)">${esc(act(x))}${F(x, 'Why') ? ' · ' + esc(F(x, 'Why')) : ''}</span>`,
              esc(F(x, 'When')))),
            R('Journal') ? 'Nothing deleted or renamed in the last 7 days.' : 'This report has no journal — the player used an older scanner (needs v4.3+).');
      },

      timeline: () => {
        const lv = (x) => (F(x, 'Level') === 2 ? 'red' : F(x, 'Level') === 1 ? 'orange' : '');
        const icon = { Ran: '▶️', Deleted: '🗑️', Renamed: '✏️', USB: '🔌', Opened: '📂', Injected: '💉', Log: '📋', Scan: '🛡️', Macro: '🖱️' };
        const items = fl(timeline, 'Text', 'Path', 'Kind', 'At');
        return head('Timeline — the 24 hours before the check', items.length,
            'Everything Windows recorded with a time, newest first: programs that ran, files deleted / renamed, USB drives, files opened, cleared logs. '
            + 'Look at what happened just before the check started — a cheat that ran, then a cleaner, a USB stick pulled out, files deleted… Red = cheat, orange = check it.')
          + rows(items.slice(0, 500).map((x) => rowL(lv(x),
              `${icon[F(x, 'Kind')] || '•'} <b style="color:var(--text)">${esc(F(x, 'Text'))}</b>${F(x, 'Path') && !String(F(x, 'Text')).includes(F(x, 'Path')) ? `<div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">${esc(F(x, 'Path'))}</div>` : ''}`,
              esc(F(x, 'At') || ''))),
            R('Timeline') ? 'Nothing recorded in the last 24 hours.' : 'This report has no timeline — the player used an older scanner (needs v4.7+).');
      },

      usb: () => {
        const items = fl(usbs, 'Name', 'Serial', 'Why', 'LastConnected');
        const ran = dets.filter((d) => F(d, 'Method') === 21);

        // Drives that are no longer here. This is the part staff actually look for after a
        // screenshare where a stick came out, so it sits at the top of the tab rather than
        // being split across a warning and a detection somewhere else.
        const goneDrives = (R('RemovedDrives') || []).map((d) => {
          const folders = F(d, 'Folders') || [], files = F(d, 'Files') || [], hits = F(d, 'Hits') || [];
          const list = (arr, label, cls) => arr.length
            ? `<div style="margin-top:9px"><div style="color:var(--dim);font-size:11px;margin-bottom:4px">${label} · ${arr.length}</div>`
              + arr.slice(0, 40).map((x) => `<div class="mono" style="font-size:11.5px;color:${cls};word-break:break-all;padding:1px 0">${esc(x)}</div>`).join('')
              + (arr.length > 40 ? `<div style="color:var(--dim);font-size:11px;margin-top:3px">+${arr.length - 40} more</div>` : '')
              + '</div>'
            : '';
          return `<div style="background:var(--s1,#121314);border:1px solid var(--line,#1f1f1f);border-left:3px solid #ffb35c;
                              border-radius:10px;padding:14px 16px;margin-bottom:10px">
            <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
              <b style="color:var(--text);font-size:15px">Drive ${esc(F(d, 'Letter'))}</b>
              <span style="color:#ffb35c;font-size:12px;font-weight:600">not connected now</span>
              ${F(d, 'Device') ? `<span style="color:var(--dim);font-size:12px">${esc(F(d, 'Device'))}</span>` : ''}
              ${F(d, 'Serial') ? `<span class="mono" style="color:var(--dim);font-size:11px">serial ${esc(F(d, 'Serial'))}</span>` : ''}
            </div>
            <div style="color:var(--dim);font-size:12px;margin-top:6px;line-height:1.5">
              The files left with the drive and cannot be read. This is what Windows still
              remembers about it — ask the player to plug it back in and run the check again.
            </div>
            ${list(hits, 'Matched your signatures', '#ff8597')}
            ${list(files, 'Programs and archives remembered on it', 'var(--text)')}
            ${list(folders, 'Folders opened on it', 'var(--dim)')}
          </div>`;
        }).join('');

        // USBSTOR puts a memory stick, an external SSD and the laptop's own card reader in one
        // list. They answer different questions, so they are shown as three, with the sticks
        // first: a stick pulled out before a check is the line staff came here to read, and it
        // was being buried under hardware that never leaves the machine.
        const usbRow = (x) => rowL(F(x, 'Level') >= 1 ? 'orange' : '',
          `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b> ${F(x, 'Present') ? '<span style="margin-left:6px;padding:2px 8px;border-radius:999px;background:rgba(47,155,255,.15);color:#8cc8ff;font-size:11px;font-weight:700">plugged in now</span>' : ''}`
          + `${F(x, 'Why') ? `<div style="color:#ffb35c;font-size:12px;margin-top:2px">${esc(F(x, 'Why'))}</div>` : ''}${F(x, 'Serial') ? `<div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">serial ${esc(F(x, 'Serial'))}</div>` : ''}`,
          esc(F(x, 'LastConnected') || ''));
        // Reports from before v4.14.5 carry no Kind; everything in them stays a stick, which is
        // how they were read before, rather than silently moving into a group they never had.
        const kindOf = (x) => F(x, 'Kind') || 'stick';
        const group = (kind, title, note) => {
          const g = items.filter((x) => kindOf(x) === kind);
          if (!g.length) return '';
          return `<div style="margin-top:14px"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">`
            + `<b style="color:var(--text);font-size:13.5px">${title}</b><span style="color:var(--dim);font-size:12px">${g.length} · ${note}</span></div>`
            + rows(g.map(usbRow), '') + '</div>';
        };

        return head('USB drives', items.length,
            'Every storage device Windows remembers attaching, with the last time it was plugged in. Orange = plugged in shortly before the check and pulled out. '
            + 'Cheats are sometimes kept on a USB stick and removed before a screenshare.')
          + goneDrives
          + (ran.length ? rows(ran.map((d) => rowL(F(d, 'Severity') === 2 ? 'red' : 'orange', `<b style="color:var(--text)">${esc(F(d, 'Signature'))}</b><div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">${esc(F(d, 'Path'))}</div>`, esc(F(d, 'When') || ''))), '') + '<div style="height:12px"></div>' : '')
          + (items.length
            ? group('stick', 'USB sticks', 'what a cheat would be carried on')
              + group('disk', 'External disks & SSDs', 'big drives — a whole game install can live here')
              + group('reader', 'Card readers & built-in controllers', 'part of the machine, not something carried in')
            : rows([], R('UsbStorage') ? 'No USB drive in Windows\' history.' : 'This report has no USB history — the player used an older scanner (needs v4.7+).'));
      },

      opened: () => {
        const lv = (x) => (F(x, 'Level') === 2 ? 'red' : F(x, 'Level') === 1 ? 'orange' : '');
        const items = fl(jumps, 'Path', 'Why', 'Source', 'When');
        return head('Opened files (Jump Lists + Recent shortcuts)', items.length,
            'Windows remembers the full path of programs and scripts that were opened (the lists you see when you right-click an app in the taskbar). It stays after the file is deleted. '
            + 'Red = cheat file / cheat name. Orange = random-named program, or a program opened from Downloads / Temp that is now deleted.')
          + rows(items.slice(0, 300).map((x) => rowL(lv(x),
              `<b style="color:var(--text)">${esc(String(F(x, 'Path') || '').split('\\').pop())}</b> ${F(x, 'Exists') ? '' : '<span style="color:#ff8597;font-size:12px">· deleted</span>'}`
              + `<div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">${esc(F(x, 'Path'))}</div>${F(x, 'Why') ? `<div style="color:var(--dim);font-size:12px;margin-top:2px">${esc(F(x, 'Why'))} · ${esc(F(x, 'Source'))}</div>` : ''}`,
              esc(F(x, 'When') || ''))),
            R('JumpLists') ? 'No program or script in the Jump Lists.' : 'This report has no Jump Lists — the player used an older scanner (needs v4.7+).');
      },

      pchistory: () => {
        const vc = (v) => (v === 'cheating' ? 'red' : v === 'suspicious' ? 'orange' : v === 'clean' ? 'green' : '');
        const vt = (v) => (v === 'cheating' ? 'Cheater' : v === 'suspicious' ? 'Suspicious' : v === 'clean' ? 'Safe' : 'Unknown');
        const pill = (t, bg, fg) => `<span style="margin-left:6px;padding:2px 9px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:700">${t}</span>`;
        const scans = (hist && hist.scans) || [];
        const bans = (bh && bh.bans) || [];
        const stat = (n, label, c) => `<div style="flex:1;min-width:120px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--line)"><div style="font-size:22px;font-weight:800;color:${c || 'var(--text)'}">${n}</div><div style="color:var(--dim);font-size:12px;margin-top:2px">${label}</div></div>`;
        let html = head('Player history — every HeRo Shield server', scans.length + bans.length,
          'Earlier scans of this same PC (recognised by its hardware IDs, so a new HWID does not hide it) and the FiveM bans of this player on HeRo Shield servers (matched by the Discord ID and Steam accounts found on the PC).');
        html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${stat(hist ? hist.seen : 0, 'earlier scans')}${stat(hist ? hist.cheating : 0, 'times cheater', hist && hist.cheating ? '#ff8597' : '')}${stat(hist ? hist.clean : 0, 'times safe', hist && hist.clean ? '#6ff0a8' : '')}${stat(bh ? bh.count : 0, 'FiveM bans', bh && bh.count ? '#ff8597' : '')}</div>`;
        if (hist && hist.hwidChanged) html += `<div class="rp-card red" style="margin-bottom:12px"><div class="rp-top"><div class="rp-ic">${IC.alert}</div><div><b>HWID changed</b><div style="color:var(--dim);font-size:12.5px;margin-top:3px">Other IDs of this PC match an earlier scan, but the HWID is different — usually a HWID spoofer was used between the two scans.</div></div></div></div>`;
        // bans
        html += `<div class="rp-head" style="margin-top:6px">FiveM bans on HeRo Shield servers</div>`;
        html += !bh ? '<div class="empty">No Discord ID or Steam account was found on this PC, so bans could not be looked up.</div>'
          : bans.length ? rows(bans.map((x) => rowL(x.active ? 'red' : 'orange',
              `<b style="color:var(--text)">${esc(x.server)}</b>${pill(x.active ? 'banned' : 'unbanned', x.active ? 'rgba(255,90,110,.16)' : 'rgba(255,255,255,.06)', x.active ? '#ff8597' : 'var(--muted)')}`
              + `<div style="color:var(--text);font-size:13px;margin-top:4px">Reason: ${esc(x.reason)}</div>`
              + `<div style="color:var(--dim);font-size:12px;margin-top:3px">${x.player ? 'as “' + esc(x.player) + '” · ' : ''}matched by ${esc((x.matchedBy || []).join(', ') || 'identifier')}${x.banId ? ' · ban ' + esc(x.banId) : ''}</div>`,
              esc(fmtDate(x.at)))), '')
          : `<div class="empty">No ban found for this player (${esc((bh.lookedUp || []).join(', '))} checked).</div>`;
        // v76 — the PC-checker block was removed from Player history.
        //
        // It was answering a question nobody had asked in the middle of the one they had:
        // this tab is "what do we know about THIS player", and a list of forensic tools
        // installed on the machine is a different subject. The detection still runs — the
        // tools show up under PC & accounts, where machine facts belong.
        // scans
        html += `<div class="rp-head" style="margin-top:16px">Earlier scans of this PC</div>`;
        html += !hist ? '<div class="empty">No scan history for this report yet (run supabase-v29-pc-history.sql).</div>'
          : scans.length ? rows(scans.map((x) => rowL(vc(x.verdict),
              `<b style="color:var(--text)">${esc(x.server)}</b>${pill(vt(x.verdict), x.verdict === 'cheating' ? 'rgba(255,90,110,.16)' : x.verdict === 'clean' ? 'rgba(62,224,138,.14)' : 'rgba(255,179,92,.14)', x.verdict === 'cheating' ? '#ff8597' : x.verdict === 'clean' ? '#6ff0a8' : '#ffb35c')}`
              + ` <span style="display:inline-flex;align-items:center;gap:6px;margin-left:6px;vertical-align:middle">${gameIcon(x.game || 'fivem', 12)}<span style="color:var(--muted);font-size:12px">${esc(gameOf(x.game || 'fivem').name)}</span></span>`
              + ((x.top || []).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${x.top.map((d) => `<span style="padding:2px 8px;border-radius:7px;background:rgba(255,90,110,.10);color:#ffb3bd;font-size:11.5px">${esc(d)}</span>`).join('')}</div>`
                 : x.detections ? `<div style="color:var(--dim);font-size:12px;margin-top:4px">${x.detections} detection${x.detections === 1 ? '' : 's'}</div>` : '')
              + `<div style="color:var(--dim);font-size:12px;margin-top:4px">recognised by ${esc((x.matchedBy || []).join(', '))}${x.hwidSame ? '' : ' · <span style="color:#ff8597">different HWID</span>'}</div>`,
              esc(fmtDate(x.at)))), '')
          : '<div class="empty">First time this PC is checked with HeRo Shield.</div>';
        return html;
      },

      macros: () => {
        const lv = (x) => (F(x, 'Level') === 2 ? 'red' : F(x, 'Level') === 1 ? 'orange' : '');
        const items = fl(macros, 'Name', 'Tool', 'Why', 'Path', 'Snippet', 'Kind');
        const pill = (t, c) => `<span style="margin-left:6px;padding:2px 8px;border-radius:999px;background:${c}22;color:${c};font-size:11px;font-weight:700">${t}</span>`;
        return head('Macros & no-recoil', items.length,
            'Mouse / macro software (Logitech G HUB, LGS, Razer Synapse, Bloody, AutoHotkey, X-Mouse) and the scripts it runs. '
            + 'A gaming mouse app alone is normal (grey). Red = a script that moves the mouse by itself while the left button is held (no-recoil). Orange = a script that moves the mouse or is named for recoil — read the line shown.')
          + rows(items.slice(0, 200).map((x) => rowL(lv(x),
              `<b style="color:var(--text)">${esc(F(x, 'Name') || F(x, 'Tool'))}</b>${F(x, 'Running') ? pill('running now', '#ff8597') : ''}${pill(esc(F(x, 'Tool')), '#8cc8ff')}`
              + `<div style="color:${F(x, 'Level') >= 1 ? '#ffb35c' : 'var(--dim)'};font-size:12px;margin-top:3px">${esc(F(x, 'Kind'))} · ${esc(F(x, 'Why') || '')}</div>`
              + (F(x, 'Snippet') ? `<div class="mono" style="margin-top:5px;padding:6px 9px;border-radius:8px;background:rgba(255,255,255,.04);color:var(--text);font-size:11.5px;white-space:pre-wrap;word-break:break-all">${esc(F(x, 'Snippet'))}</div>` : '')
              + (F(x, 'Path') ? `<div class="mono" style="color:var(--dim);font-size:11px;margin-top:3px">${esc(F(x, 'Path'))}</div>` : ''),
              esc(F(x, 'When') || ''))),
            R('Macros') ? 'No macro software or script on this PC.' : 'This report has no macro check — the player used an older scanner (needs v4.9+).');
      },

      hardware: () => {
        const lv = (x) => (F(x, 'Level') === 2 ? 'red' : 'orange');
        const items = fl(hw, 'Name', 'Kind', 'Why', 'LastSeen', 'InstanceId');
        return head('Cheat hardware (DMA / KMBox / Cronus / XIM / Arduino)', items.length,
            'Windows keeps every device that was ever connected — even unplugged. Red = cheat hardware (DMA card, KMBox, Cronus, XIM, Titan). Orange = hardware that can be used for cheating (FPGA board, Arduino mouse board, DMA data port) — check it.' + (hwInfo ? ' · ' + esc(hwInfo) : ''))
          + rows(items.map((x) => rowL(lv(x),
              `<b style="color:var(--text)">${esc(F(x, 'Kind'))}</b> — ${esc(F(x, 'Name'))} ${F(x, 'Present') ? '<span style="margin-left:6px;padding:2px 8px;border-radius:999px;background:rgba(255,77,106,.15);color:#ff8597;font-size:11px;font-weight:700">plugged in now</span>' : ''}`
              + `<div style="color:var(--dim);margin-top:3px">${esc(F(x, 'Why') || '')}</div><div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">${esc(F(x, 'InstanceId') || '')}</div>`,
              esc(F(x, 'LastSeen') || ''))),
            R('Hardware') ? 'No cheat hardware was ever connected to this PC.' : 'This report has no hardware check — the player used an older scanner (needs v4.5+).');
      },

      memory: () => {
        const lv = (x) => (F(x, 'Level') === 2 ? 'red' : F(x, 'Level') === 1 ? 'orange' : '');
        const items = fl(memory, 'Name', 'Path', 'Source', 'Why', 'When');
        return head('Service memory (DPS / PcaSvc / Explorer / DNS)', items.length,
            'Windows services keep a list of programs that ran and websites that were opened in their memory until the PC restarts. Deleting the file or clearing the logs does not remove it — pro screenshare tools read the same place. '
            + 'Only what matters is shown: Red = known cheat file or cheat-named program that was deleted. Orange = random-named or loader / spoofer-type program, or a cheat-looking website. Normal programs (installers, Windows tools, old app versions) are hidden.' + (memoryInfo ? ' · ' + esc(memoryInfo) : ''))
          + rows(items.slice(0, 600).map((x) => rowL(lv(x),
              `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b>${F(x, 'Path') && F(x, 'Path') !== F(x, 'Name') ? ` <span style="color:var(--dim)">${esc(F(x, 'Path'))}</span>` : ''}`
              + ` &nbsp;<span style="color:var(--dim)">${F(x, 'Exists') ? '' : 'gone · '}${esc(F(x, 'Why') || '')} · ${esc(F(x, 'Source') || '')}</span>`,
              esc(F(x, 'When') || ''))),
            R('MemoryTraces') ? 'Nothing suspicious in service memory.' : 'This report has no service memory — the player used an older scanner (needs v4.4+).');
      },

      files: () => head('Recycle bin', deleted.length, 'Every file in the recycle bin with its real name, where it was and when it was deleted. Red = cheat file / cheat name. Orange = random-named program.')
        + rows(fl(deleted, 'File', 'Path', 'Why').map((x) => rowL(F(x, 'Flag') === 2 ? 'red' : F(x, 'Flag') === 1 || (F(x, 'Executable') && !F(x, 'Path')) ? 'orange' : '',
            `<b style="color:var(--text)">${esc(F(x, 'File'))}</b>${F(x, 'Folder') ? ' <span style="color:var(--dim)">(folder)</span>' : ''}`
            + (F(x, 'Path') ? `<div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">${esc(F(x, 'Path'))}${F(x, 'SizeKb') ? ' · ' + esc(String(F(x, 'SizeKb'))) + ' KB' : ''}</div>` : '')
            + (F(x, 'Why') ? `<div style="color:#ff8597;font-size:12px;margin-top:2px">${esc(F(x, 'Why'))}</div>` : ''),
            esc(F(x, 'DeletedAt') || F(x, 'When')))), 'Empty.')
        + '<div style="height:18px"></div>' + head('Recently opened', recent.length) + rows(fl(recent, 'Name', 'Path').slice(0, 150).map((x) => rowL(F(x, 'Flagged') ? 'red' : '', esc(F(x, 'Name')), esc(F(x, 'When')))), 'Nothing (may have been cleared).')
        + '<div style="height:18px"></div>' + head('Game mods', mods.length) + rows(fl(mods, 'Path', 'File').slice(0, 300).map((m) => rowL('blue', esc(F(m, 'Path') || F(m, 'File')), (F(m, 'SizeMb') || 0) + ' MB')), 'No mods.'),

      cmds: () => head('PowerShell / CMD / Run history', cmds.length) + rows(fl([...cmds.filter((x) => F(x, 'Suspicious')), ...cmds.filter((x) => !F(x, 'Suspicious'))], 'Text', 'Source').slice(0, 400)
          .map((x) => rowL(F(x, 'Suspicious') ? 'orange' : '', esc(F(x, 'Text')), esc(F(x, 'Source')))), 'No command history.'),

      events: () => head('Windows event log', events.length, 'Third-party driver/service installs, cleared logs, Defender alerts, clock changes.')
        + rows(fl(events, 'Category', 'EventId', 'Message').map((x) => rowL(/clear/i.test(F(x, 'Category')) ? 'red' : F(x, 'Category') === 'Defender' ? 'orange' : 'blue',
          `<b style="color:var(--text)">${esc(F(x, 'Category'))} ${esc(F(x, 'EventId'))}</b> &nbsp;${esc(F(x, 'Message'))}`, esc((F(x, 'When') || '').slice(0, 16).replace('T', ' ')))), 'No relevant events.'),

      pc: () => {
        const kv = (list) => `<div class="rp-kv">${list.map(([k, v]) => `<span>${k}</span><b>${esc(v || '-')}</b>`).join('')}</div>`;

        // ── Every Discord account this PC has seen ───────────────────────────────────────────
        // Not only the one signed in now. A player who is asked to screenshare signs out of the
        // account that everyone knows and signs into a clean one; the one that bought the cheat
        // is the one that was there before. Each row gets a Check button so staff can run the
        // bot lookup on any of them without retyping the id.
        const seen = L('DiscordAccountsSeen').map((a) => ({
          id: String(F(a, 'Id') || ''),
          source: String(F(a, 'Source') || ''),
          current: !!F(a, 'Current'),
        })).filter((a) => /^\d{17,20}$/.test(a.id));
        // One row per id: an account can show up in Discord and Discord PTB both.
        const byId = new Map();
        for (const a of seen) {
          const prev = byId.get(a.id);
          if (prev) { prev.current = prev.current || a.current; if (a.source && !prev.sources.includes(a.source)) prev.sources.push(a.source); }
          else byId.set(a.id, { id: a.id, current: a.current, sources: a.source ? [a.source] : [] });
        }
        if (localDiscord && /^\d{17,20}$/.test(String(localDiscord)) && !byId.has(String(localDiscord)))
          byId.set(String(localDiscord), { id: String(localDiscord), current: true, sources: ['Discord'] });
        const allIds = [...byId.values()].sort((x, y) => (y.current ? 1 : 0) - (x.current ? 1 : 0));

        // v75.1 — an id Discord says is not a user is not an account.
        //
        // Discord's local storage is full of 17-20 digit snowflakes that are NOT accounts:
        // guild ids, channel ids, message ids. A few of them used to reach this list, and the
        // result was a column of "Discord account — account no longer exists" rows with no
        // picture, burying the one real second account among them.
        //
        // The bot settles it: ask Discord, and keep what it confirms. An id still waiting on
        // an answer is shown (so the list is not empty while the request is in flight); one
        // Discord has denied is dropped to the footnote below, where it is called what it is.
        const known = (a) => (state.dprofiles || {})[a.id];
        // v81.2 - a bot is not an account.
        //
        // Discord's desktop cache holds the ids of every bot in every server the player opened:
        // ProBot, the verification bot, the server's own utility bots. To Discord they are user
        // objects, so they survived the found-check and were shown as "accounts used on this
        // PC" - with a picture and a name, which made them look more real than the real ones.
        // Nobody signs into a bot. Discord marks them, so they are dropped here and counted in
        // the footnote with the ids that are not users at all.
        const accs = allIds.filter((a) => { const p = known(a); return !p || (p.found !== false && !p.bot); });
        const bots = allIds.filter((a) => { const p = known(a); return p && p.bot; });
        const notUsers = allIds.filter((a) => { const p = known(a); return p && p.found === false; });
        // Did we ever get a real answer? If not, the names and pictures are missing because the
        // site could not ask Discord, not because the accounts are not there. The panel says so
        // rather than showing a column of bare ids with no explanation.
        const noBot = allIds.length > 0 && allIds.every((a) => { const p = known(a); return p && p.found === null; });
        const checkedId = dc && dc.user && dc.user.id ? String(dc.user.id) : '';
        const extra = accs.filter((a) => !a.current).length;

        const accRow = (a) => {
          const isChecked = checkedId && a.id === checkedId;
          // The profile, when the bot has already told us who this is. Until it answers the
          // row still renders - with the id and a placeholder - because a list that appears
          // only after a network call reads as a page that is broken.
          const p = (state.dprofiles || {})[a.id] || null;
          const name = p && p.display ? p.display : (isChecked && dc.user && dc.user.name) || null;
          const handle = p && p.username ? p.username : (isChecked && dc.user && dc.user.username) || null;
          const pfp = p && p.avatar ? p.avatar : null;
          const gone = p && p.found === false;
          return `<div class="rp-card ${a.current ? 'blue' : 'orange'}" style="padding:12px 14px;display:flex;align-items:center;gap:13px;flex-wrap:wrap">
            ${pfp
              ? `<img src="${esc(pfp)}" alt="" referrerpolicy="no-referrer" loading="lazy"
                      style="width:40px;height:40px;border-radius:50%;flex:none;object-fit:cover;background:#1b1f27">`
              : `<span class="hs-acc-ic" style="width:40px;height:40px;border-radius:50%;background:#5865f2;display:inline-flex;align-items:center;justify-content:center;flex:none">${IC.disc}</span>`}
            <div style="flex:1;min-width:200px">
              <b style="color:var(--text);font-size:14.5px">${esc(name || 'Discord account')}</b>
              ${handle ? `<span style="color:var(--muted);font-size:13px;margin-left:6px">@${esc(handle)}</span>` : ''}
              ${gone ? `<span style="color:#ffb35c;font-size:12px;margin-left:6px">account no longer exists</span>` : ''}
              <div class="mono" style="color:var(--dim);font-size:11.5px;margin-top:3px">${esc(a.id)}
                · ${esc(a.sources.join(' · ') || 'Discord')}${p && p.created ? ' · made ' + esc(fmtDate(p.created)) : ''}</div>
            </div>
            <span class="rp-tag">${a.current ? 'SIGNED IN NOW' : 'SIGNED OUT — used on this PC'}</span>
            <button class="btn ${isChecked ? '' : 'btn-primary'}" data-dcheck="${esc(a.id)}" style="padding:6px 12px;font-size:12px">${isChecked ? 'Checked — open' : 'Check this account'}</button>
          </div>`;
        };

        // Ask the bot for every id at once, then redraw. One request for the whole list rather
        // than one per row, and it is fired only when there is something new to look up.
        {
          state.dprofiles = state.dprofiles || {};
          const need = allIds.map((a) => a.id).filter((id) => !(id in state.dprofiles));
          if (need.length) {
            api(`/api/discord-profiles?ids=${need.join(',')}`)
              .then((r) => {
                // Mark every id we asked about, so a failed lookup is not asked again on
                // every redraw: an unknown account is an answer, not a reason to retry.
                // v81.1 - "Discord says this is not a user" and "we could not ask Discord" are
                // NOT the same answer, and treating them as one emptied the whole list: with no
                // bot token on the server every id came back unanswered, was written down as
                // found:false, and every real account was filed under "not a user account".
                // found:false is now written ONLY when the bot really answered (r.bot) and
                // Discord had no such user. Otherwise found stays null - unknown - and the row
                // is shown with its id, which is what the scanner actually proved.
                for (const id of need) state.dprofiles[id] = (r.profiles || {})[id] || { id, found: r.bot ? false : null };
                // Redraw only if this same report is still the thing on screen. `view` is
                // reused by every tab, so without this a slow lookup could overwrite whatever
                // the person moved on to.
                if (view.isConnected && view.querySelector(`[data-dcheck="${need[0]}"]`)) renderPinReport(view, pin, tab, q);
              })
              .catch(() => { for (const id of need) state.dprofiles[id] = { id, found: null }; });
          }
        }

        const gameAcc = (label, list, note) => {
          const items = L(list);
          return `<div class="rp-card blue" style="padding:12px 14px">
            <div class="rp-head" style="font-size:14px;padding:0 0 6px">${label} <span style="color:var(--dim);font-weight:400">· ${items.length}</span></div>
            ${items.length
              ? `<div style="display:flex;flex-direction:column;gap:4px">${items.map((v) => `<b class="mono" style="color:var(--text);font-size:12.5px">${esc(String(v))}</b>`).join('')}</div>`
              : `<div style="color:var(--dim);font-size:12px">${esc(note)}</div>`}
          </div>`;
        };

        // ── v81 · the map ────────────────────────────────────────────────────────────────
        // Everything this PC is tied to, drawn around the PC itself: the Discord accounts that
        // signed in on it (inner ring) and the cheat servers those accounts are — or were — in
        // (outer ring). It is the same data as the list beside it. The picture is there so the
        // shape is read in one look: one account and nothing around it is a different machine
        // from three accounts with two cheat shops orbiting them.
        //
        // Nothing here is decorative. A ring with no dots means the scan found nothing to put
        // on it, and it says so in words underneath.
        const net = R('Net') || {};
        const warnSeen = new Set();
        const gIcon = (id, icon) => (id && icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=64` : '');
        const warnServers = [
          ...cheatGuilds.map((g) => ({ id: String(g.id), name: g.name || 'Unknown server', icon: discordIcon(g), listed: true, where: 'In it right now' })),
          ...nameGuilds.map((g) => ({ id: String(g.id), name: g.name || 'Unknown server', icon: discordIcon(g), listed: false, where: 'In it right now' })),
          // v81.4 - the ids Discord itself stores (scanner v4.16+).
          //
          // The cache only remembers a server the player opened recently, so a cheat shop he
          // joined months ago and has been quietly sitting in left no trace at all - which is
          // the exact player this tool exists for. Discord's own storage keeps those servers
          // for years. The scanner sends every snowflake it holds, WITHOUT claiming to know
          // what any of them is, and the only question asked of them is this one: is it in
          // your cheat-server list? An id that matches nothing is never shown or named.
          ...L('DiscordIdsSeen').map(String).filter((id) => cheatIds.has(id)).map((id) => {
            const c = cheatIds.get(id);
            return { id, name: c.name || 'Cheat server', icon: c.icon ? gIcon(id, c.icon) : '', listed: true,
              where: 'Found in Discord\'s own storage on this PC — he is in it, or was and the client still holds it' };
          }),
          ...pastCheat.map((x) => ({ id: x.id, inv: x.inv, name: x.name || 'Unknown server', icon: gIcon(x.id, x.icon), listed: !!x.listed,
            where: 'Left it — the traces are still on the PC' + (x.last ? ' · last seen ' + fmtDate(x.last) : '') })),
          ...leftCheat.filter((x) => !pastCheat.some((p) => p.id === x.id)).map((x) => ({ id: x.id, name: x.name || 'Unknown server', icon: gIcon(x.id, x.icon), listed: !!x.listed,
            where: `Still in it at his check of ${fmtDate(x.at)} (PIN ${x.pin})` })),
        ].filter((s) => { const k = s.id || 'inv:' + (s.inv || ''); if (!k || warnSeen.has(k)) return !!k && false; warnSeen.add(k); return true; })
         .sort((a, b) => (b.listed ? 1 : 0) - (a.listed ? 1 : 0));

        // Node positions: polar, in percent of the square, so the map scales with the column
        // and needs no measuring at runtime.
        const polar = (r, i, n, off) => {
          const a = ((off + (360 / Math.max(n, 1)) * i) - 90) * Math.PI / 180;
          return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
        };
        const ringNodes = (list, r, off, cls) => list.map((x, i) => {
          const [cx, cy] = polar(r, i, list.length, off);
          return { x: cx, y: cy, cls, ...x };
        });
        const mapNodes = [
          ...ringNodes(accs.map((a) => {
            const pr = (state.dprofiles || {})[a.id] || {};
            return { label: pr.display || a.id, img: pr.avatar || '', kind: a.current ? 'acc-now' : 'acc-old' };
          }), 30, 18, 'acc'),
          ...ringNodes(warnServers.slice(0, 10).map((s) => ({ label: s.name, img: s.icon, kind: s.listed ? 'srv-red' : 'srv-orange' })), 44, 55, 'srv'),
        ];
        const COL = { 'acc-now': 'var(--accent,#4a8cf7)', 'acc-old': '#f59e0b', 'srv-red': '#f43f5e', 'srv-orange': '#f59e0b' };
        const radar = `<div class="hs-map">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" class="hs-map-ring"></circle>
            <circle cx="50" cy="50" r="30" class="hs-map-ring"></circle>
            <circle cx="50" cy="50" r="16" class="hs-map-ring"></circle>
            ${mapNodes.map((n) => `<line x1="50" y1="50" x2="${n.x.toFixed(2)}" y2="${n.y.toFixed(2)}" class="hs-map-link" style="stroke:${COL[n.kind]}"></line>`).join('')}
          </svg>
          <div class="hs-map-pc">
            <div class="hs-map-core">PC</div>
            <b>This PC</b>
            <span>${esc((S('Os') || 'Windows') + (S('WinBuild') ? ' · ' + S('WinBuild') : ''))}</span>
            <span>${net.country
              ? esc(net.country) + (net.vpn ? '' : '')
              : '<i style="color:var(--dim);font-style:normal">Country unknown</i>'}</span>
            ${net.vpn ? `<span class="hs-map-vpn">${esc(net.vpnKind || 'VPN or proxy')}</span>` : ''}
          </div>
          ${mapNodes.map((n) => `<span class="hs-map-node ${n.cls}" title="${esc(n.label)}"
              style="left:${n.x.toFixed(2)}%;top:${n.y.toFixed(2)}%;border-color:${COL[n.kind]}">
              ${n.img ? `<img src="${esc(n.img)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : `<em>${esc(((n.label || '?').trim()[0] || '?').toUpperCase())}</em>`}
            </span>`).join('')}
        </div>
        <div class="hs-map-key">
          <span><i style="background:var(--accent,#4a8cf7)"></i>Signed in now</span>
          <span><i style="background:#f59e0b"></i>Used before / to check</span>
          <span><i style="background:#f43f5e"></i>Cheat server</span>
        </div>
        ${!mapNodes.length ? '<p class="rp-txt" style="text-align:center;color:var(--dim)">Nothing is tied to this PC yet — no Discord account was found on it and no cheat server was traced.</p>' : ''}`;

        // ── the two panels on the right ──────────────────────────────────────────────────
        const onPc = `<div class="hs-pane">
          <div class="hs-pane-h">On this PC<span>${accs.length}</span></div>
          ${accs.length
            ? `<div style="display:flex;flex-direction:column;gap:8px">${accs.map(accRow).join('')}</div>`
              + (extra ? `<div class="rp-txt" style="color:#fbbf24;margin-top:10px">${extra} other Discord account${extra > 1 ? 's have' : ' has'} been used on this PC besides the one signed in now.</div>` : '')
            : `<p style="color:var(--dim);font-size:12.5px;margin:0">No Discord account on this PC — Discord is not installed, or the player used an older scanner (needs v4.11+).</p>`}
          ${noBot ? `<p class="rp-txt" style="color:#ffb35c;margin:10px 0 0">
              The names and pictures could not be loaded: the site could not ask Discord who these IDs are.
              Set <b class="mono">DISCORD_BOT_TOKEN</b> on the server, and make sure <b class="mono">/api/discord-profiles</b> is deployed.
              The IDs below are what the scanner read off the PC — they are correct with or without the bot.</p>` : ''}
          ${bots.length ? `<p style="color:var(--faint,var(--dim));font-size:11.5px;margin:10px 0 0">
              ${bots.length} Discord bot${bots.length > 1 ? 's' : ''} (${esc(bots.map((b) => (known(b) || {}).display || b.id).slice(0, 4).join(', '))}${bots.length > 4 ? '…' : ''})
              also left ${bots.length > 1 ? 'their ids' : 'its id'} in the cache. A bot is not an account — not shown.</p>` : ''}
          ${notUsers.length ? `<p style="color:var(--faint,var(--dim));font-size:11.5px;margin:10px 0 0">
              ${notUsers.length} other ID${notUsers.length > 1 ? 's' : ''} in Discord's storage ${notUsers.length > 1 ? 'are' : 'is'} not a user account
              (a server or a channel). Not shown.</p>` : ''}
        </div>`;

        // v81 — this replaces the Discord tab. That tab listed hundreds of servers, almost all
        // of them harmless, and the two that mattered were lost in the middle. Only the ones
        // worth a word to the player are here: in your own cheat-server list, or named like a
        // cheat shop. Each row says plainly whether he is in it now or left it, because those
        // are two different conversations.
        const srvRow = (s) => `<div class="hs-srv ${s.listed ? 'red' : 'orange'}">
          ${s.icon ? `<img src="${esc(s.icon)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">`
            : `<em>${esc(((s.name || '?').trim()[0] || '?').toUpperCase())}</em>`}
          <div>
            <b>${esc(s.name)}</b>
            <div class="hs-srv-why">${esc(s.where)}</div>
            <div class="mono hs-srv-id">${esc(s.id || (s.inv ? 'discord.gg/' + s.inv : ''))}</div>
          </div>
          <span class="rp-tag">${s.listed ? 'ON YOUR LIST' : 'NAME LOOKS LIKE A CHEAT'}</span>
        </div>`;
        const warnPane = `<div class="hs-pane ${warnServers.length ? 'warn' : ''}">
          <div class="hs-pane-h">Warning — Discord servers<span>${warnServers.length}</span></div>
          ${warnServers.length
            ? `<div style="display:flex;flex-direction:column;gap:8px">${warnServers.map(srvRow).join('')}</div>`
              + `<p class="rp-txt" style="color:var(--dim);margin:10px 0 0">Red = a server in your own cheat-server list. Orange = the name alone looks like a cheat shop — read it before you act on it. Leaving a server does not erase it: Discord and the browsers keep the icons, invite pages and channel links on the PC.</p>`
            : `<p style="color:var(--dim);font-size:12.5px;margin:0">${L('DiscordTraces').length || history.length
                ? 'No cheat server found — not in one now, and none in what the PC remembers.'
                : 'No Discord traces on this PC (cache cleared, or an older scanner) and no earlier check.'}</p>`}
        </div>`;

        const accounts = head('Accounts', accs.length, 'The accounts on this PC, and the Discord servers worth a word.')
          + `<div class="hs-acc-wrap"><div class="hs-pane map">${radar}</div><div class="hs-acc-col">${onPc}${warnPane}</div></div>`
          + `<div style="height:18px"></div>` + head('Game accounts', 0, 'Steam, Rockstar Social Club and Epic accounts read from the PC.')
          + `<div class="rp-grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
              ${gameAcc('Steam', 'SteamAccounts', 'No Steam account on this PC.')}
              ${gameAcc('Rockstar Social Club', 'RockstarAccounts', 'No Rockstar account on this PC.')}
              ${gameAcc('Epic Games', 'EpicAccounts', 'No Epic account on this PC.')}
            </div><div style="height:18px"></div>`;

        return accounts + `<div class="rp-grid" style="grid-template-columns:repeat(auto-fill,minmax(360px,1fr))">
          <div class="rp-card blue"><div class="rp-head" style="font-size:15px">PC information</div>${kv([
            ['System', (S('Os') || '-') + ' ' + (S('WinBuild') || '')], ['CPU', S('Cpu')], ['GPU', S('Gpu')], ['RAM', S('RamGb')], ['Motherboard', S('Motherboard')],
            ['Time zone', S('TimeZone')], ['Windows installed', S('WindowsInstall')], ['Boot', S('BootTime')], ['Uptime', S('Uptime')],
            ['FiveM last launch', S('FiveMLastLaunch')], ['Recycle bin', S('RecycleModified')], ['Antivirus', av.join(', ')],
            ['Disabled services', (S('DisabledServices') || []).join(', ') || 'none']])}</div>
          <div class="rp-card blue"><div class="rp-head" style="font-size:15px">Hardware IDs (for bans)</div>${kv([
            ['HWID', S('Hwid')], ['UUID', S('Uuid')], ['Machine GUID', S('MachineGuid')], ['BIOS serial', S('BiosSerial')],
            ['Disk serials', S('DiskSerials')], ['MAC', S('MacAddresses')], ['Windows SID', S('Sid')]])}</div>
          <div class="rp-card blue"><div class="rp-head" style="font-size:15px">Other</div>${kv([
            ['Discord signed in now', localDiscord], ['Discord accounts seen', String(accs.length)],
            ['Discord checked here', dc && dc.user ? `${dc.user.name} · ${dc.user.id}` : 'not checked'],
            ['Browsers', L('Browsers').join(', ')], ['USB devices', L('UsbDevices').join(', ')],
            ['Connected from', net.country ? net.country + (net.countryCode ? ' (' + net.countryCode + ')' : '') : 'unknown'],
            ['Connection', net.vpn ? (net.vpnKind || 'VPN or proxy') : net.countryCode ? 'home / normal address' : '-'],
            ['Network', net.isp || '-'], ['Address (last part removed)', net.ip || '-']])}</div>
        </div>`;
      },
    };

    view.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-go="pins" style="margin-bottom:14px">← Back to PINs</button>
      <div class="rp-verdict ${esc(verdict)}"><div class="rp-ic" style="width:46px;height:46px">${IC.shield}</div>
        <div><div class="big">${esc(verdict)}</div><div class="who" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${gameIcon(rGame, 14)}<b style="color:var(--text)">${esc(gName)}</b>${[row && row.player, S('Os')].filter(Boolean).map((x) => ' · ' + esc(x)).join('')}</div></div>
        <div class="pin">PIN ${esc(pin)}<br>${fmtDate(row && row.created_at)}</div></div>
      <div class="rp">
        <aside class="rp-side">
          <h4>${IC.shield.replace('<svg', '<svg style="width:18px;height:18px;color:var(--cyan)"')} Detection Results</h4>
          <div class="sub">${total} total logs found</div>
          ${cats.map((c) => c === 'sep' ? '<div class="rp-sep"></div>'
            : c && c.group ? (cats[cats.indexOf(c) + 1] && !cats[cats.indexOf(c) + 1].group
                ? `<div class="rp-group">${esc(c.group)}</div>` : '')
            : `<button class="rp-cat ${c[0] === tab ? 'on' : ''}" data-rtab="${c[0]}">
            <span class="dot" style="background:${{ red: '#f43f5e', orange: '#f59e0b', green: '#10b981', yellow: '#eab308', purple: '#a855f7', blue: '#3b82f6' }[c[3]]}"></span>${c[1]}
            ${c[2] !== '' ? `<span class="n ${c[2] && c[2] !== 0 && c[2] !== '–' ? c[3] : ''}">${esc(c[2])}</span>` : ''}</button>`).join('')}
        </aside>
        <section>${['overview', 'integrity', 'pc'].includes(tab) || !panes[tab] ? '' : `<input class="input rp-filter" data-rpq placeholder="Filter this tab…" value="${esc(q || '')}">`}${(panes[tab] || panes.overview)()}</section>
      </div>`;

    view.querySelectorAll('[data-rtab]').forEach((b) => b.addEventListener('click', () => renderPinReport(view, pin, b.dataset.rtab)));
    view.querySelectorAll('[data-goto-tab]').forEach((b) => b.addEventListener('click', () => renderPinReport(view, pin, b.dataset.gotoTab)));
    // Check button on a Discord account row in PC & accounts: same lookup, no retyping.
    view.querySelectorAll('[data-dcheck]').forEach((b) => b.addEventListener('click', async (ev) => {
      const id = String(b.dataset.dcheck || '').replace(/\D/g, '');
      if (!/^\d{17,20}$/.test(id)) return toast('Not a Discord ID', true);
      if (dc && dc.user && String(dc.user.id) === id) return renderPinReport(view, pin, 'pc');
      ev.target.disabled = true; ev.target.textContent = 'Checking…';
      try {
        await api('/api/discord-lookup', { method: 'POST', body: { pin, id } });
        if (state.reports) delete state.reports[pin];
        if (state.discHist) delete state.discHist[id];
        renderPinReport(view, pin, 'pc');
      } catch (e) { toast(e.message, true); ev.target.disabled = false; ev.target.textContent = 'Check this account'; }
    }));
    view.querySelector('[data-dlookup]')?.addEventListener('click', async (ev) => {
      const id = (view.querySelector('#disc-id').value || '').replace(/\D/g, '');
      if (!/^\d{17,20}$/.test(id)) return toast('Enter a Discord ID (17–20 digits)', true);
      ev.target.disabled = true; ev.target.textContent = 'Checking…';
      try {
        await api('/api/discord-lookup', { method: 'POST', body: { pin, id } });
        if (state.reports) delete state.reports[pin];   // reload the updated report
        if (state.discHist) delete state.discHist[id];
        renderPinReport(view, pin, 'pc');
      } catch (e) { toast(e.message, true); ev.target.disabled = false; ev.target.textContent = 'Check this Discord'; }
    });
    const qi = view.querySelector('[data-rpq]');
    if (qi) {
      qi.addEventListener('input', () => { clearTimeout(qi._t); qi._t = setTimeout(() => { renderPinReport(view, pin, tab, qi.value).then(() => { const n = view.querySelector('[data-rpq]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }, 250); });
    }
  }

  async function renderScannerGui(view) {
    const { licenses } = await api('/api/scanner-licenses');
    const active = (licenses || []).filter(l => !l.revoked_at);
    if (!active.length) {
      view.innerHTML = '<div class="card panel"><h3>No scanner license</h3><p>Create a license in My License first, then return here to customize its scanner background.</p><button class="btn btn-primary" data-tab="subscription">Go to My License</button></div>';
      return;
    }
    if (!active.some(l => l.id === state.guiLicenseId)) state.guiLicenseId = active[0].id;
    const { bg } = await api(`/api/scanner-bg?license_id=${encodeURIComponent(state.guiLicenseId)}`);
    state.scanbg = bg || '';
    const COLORS = ['#3b82f6', '#22d3ee', '#a855f7', '#ef4444', '#22c55e', '#f59e0b', '#ec4899', '#e5e7eb'];
    if (!state.bgGen) state.bgGen = { name: '', sub: 'think. scan. find.', color: COLORS[0], design: 'aurora' };
    const G = state.bgGen;
    const genOk = !!window.HSBG;

    view.innerHTML = `
      ${genOk ? `<div class="card panel" style="margin-bottom:18px">
        <h3>Background generator</h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:16px">
          Make the animated background here — your name, your colour, no image to find.
          <b>Add to scanner</b> builds the GIF and puts it straight on this license's scanner, same as an upload.</p>
        <div class="grid-2">
          <div>
            <canvas id="bg-prev" width="500" height="300" style="width:100%;border:1px solid var(--line);border-radius:14px;background:#05070c;display:block"></canvas>
            <p style="color:var(--dim);font-size:11px;margin-top:8px">Live preview — 500×300 · 16 frames · loops</p>
          </div>
          <div>
            <label style="display:block" for="bg-name">Your name</label>
            <input id="bg-name" class="input" maxlength="24" placeholder="Your server or your name" value="${esc(G.name)}" style="margin:6px 0 14px">
            <label style="display:block" for="bg-sub">Line under it</label>
            <input id="bg-sub" class="input" maxlength="32" placeholder="optional" value="${esc(G.sub)}" style="margin:6px 0 14px">
            <label style="display:block">Colour</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px">
              ${COLORS.map((c) => `<button data-bgcolor="${c}" title="${c}" style="width:26px!important;height:26px!important;min-width:0!important;padding:0!important;border-radius:50%!important;background:${c}!important;cursor:pointer;border:2px solid ${G.color === c ? '#fff' : 'transparent'}!important;box-shadow:0 0 0 1px var(--line)"></button>`).join('')}
              <input type="color" data-bgcustom value="${esc(G.color)}" style="width:30px;height:26px;padding:0;border:none;background:none;cursor:pointer">
            </div>
            <label style="display:block">Design</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 18px">
              ${HSBG.designs.map((d) => `<button class="btn ${G.design === d.id ? 'btn-primary' : 'btn-ghost'}" data-bgdesign="${d.id}" title="${esc(d.note)}" style="padding:6px 12px;font-size:12.5px">${esc(d.name)}</button>`).join('')}
            </div>
            <button class="btn btn-primary" data-bgadd style="min-width:190px">Add to scanner</button>
            <p style="color:var(--dim);font-size:11px;margin-top:10px">Takes a few seconds — the GIF is built in your browser, nothing is uploaded.</p>
          </div>
        </div>
      </div>` : ''}
      <div class="card panel" style="margin-bottom:18px">
        <h3>Scanner background</h3>
        <label for="sg-license">Scanner license</label>
        <select id="sg-license" class="input" style="margin:10px 0 18px;max-width:440px">${active.map(l => `<option value="${esc(l.id)}" ${l.id === state.guiLicenseId ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>
        <p style="color:var(--muted);font-size:13px;margin-bottom:14px">
          Upload an image shown behind your scanner window while a PIN scan runs. PNG / JPG / GIF, best 500×300.
          It shows automatically on <b>every</b> PIN of this license — as soon as the player types the PIN.</p>
        <div class="grid-2">
          <div>
            <div id="sg-preview" style="position:relative;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#07090d;aspect-ratio:5/3;display:flex;align-items:center;justify-content:center">
              ${bg ? `<img src="${esc(bg)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : '<span style="color:var(--dim)">No background — default storm</span>'}
              <div style="position:relative;color:#7dd3fc;font-weight:700;font-size:26px;text-shadow:0 2px 10px #000">0%</div>
            </div>
            <p style="color:var(--dim);font-size:11px;margin-top:8px">Preview — how the scanner looks while scanning.</p>
          </div>
          <div>
            <label class="btn btn-ghost" style="display:block;text-align:center;cursor:pointer;margin-bottom:10px">
              Choose image<input id="sg-file" type="file" accept="image/png,image/jpeg,image/gif" hidden></label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary" data-sgsave disabled>Save background</button>
              ${bg ? '<button class="btn btn-danger" data-sgremove>Remove</button>' : ''}
            </div>
            <p style="color:var(--dim);font-size:11px;margin-top:12px">Inappropriate images may get your account banned. Background is private to your PINs.</p>
          </div>
        </div>
      </div>`;
    $('#sg-license').addEventListener('change', e => { state.guiLicenseId = e.target.value; state.scannewbg = null; renderScannerGui(view); });

    // ── background generator ────────────────────────────────────────────────────────────
    if (genOk) {
      const cv = $('#bg-prev'), cx = cv.getContext('2d');
      // One preview loop for the whole tab. It is cancelled when the tab is left, otherwise a
      // few tab switches leave several loops drawing into canvases that are no longer shown.
      if (state.bgRaf) cancelAnimationFrame(state.bgRaf);
      const T = 2000;                                   // one full loop, matching 16 frames @ 12fps-ish
      const loop = () => {
        if (!document.body.contains(cv)) { state.bgRaf = 0; return; }
        HSBG.draw(cx, G, (Date.now() % T) / T);
        state.bgRaf = requestAnimationFrame(loop);
      };
      loop();

      const redraw = () => HSBG.draw(cx, G, 0);
      $('#bg-name').addEventListener('input', (e) => { G.name = e.target.value; });
      $('#bg-sub').addEventListener('input', (e) => { G.sub = e.target.value; });
      view.querySelectorAll('[data-bgcolor]').forEach((b) => b.addEventListener('click', () => {
        G.color = b.dataset.bgcolor;
        view.querySelectorAll('[data-bgcolor]').forEach((o) => o.style.setProperty('border-color', o.dataset.bgcolor === G.color ? '#fff' : 'transparent', 'important'));
        redraw();
      }));
      view.querySelector('[data-bgcustom]')?.addEventListener('input', (e) => {
        G.color = e.target.value;
        view.querySelectorAll('[data-bgcolor]').forEach((o) => o.style.setProperty('border-color', 'transparent', 'important'));
        redraw();
      });
      view.querySelectorAll('[data-bgdesign]').forEach((b) => b.addEventListener('click', () => {
        G.design = b.dataset.bgdesign;
        view.querySelectorAll('[data-bgdesign]').forEach((o) => {
          o.className = 'btn ' + (o.dataset.bgdesign === G.design ? 'btn-primary' : 'btn-ghost');
        });
        redraw();
      }));
      view.querySelector('[data-bgadd]')?.addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        if (!(G.name || '').trim()) return toast('Type a name first', true);
        btn.disabled = true;
        try {
          const url = await HSBG.gif({ ...G, frames: 16, fps: 12 }, (p) => {
            btn.textContent = p < 1 ? `Building… ${Math.round(p * 100)}%` : 'Saving…';
          });
          await api('/api/scanner-bg', { method: 'POST', body: { license_id: state.guiLicenseId, image: url } });
          toast('Background added — it shows on every PIN of this license');
          state.scannewbg = null;
          renderScannerGui(view);
        } catch (e) {
          toast(e.message, true); btn.disabled = false; btn.textContent = 'Add to scanner';
        }
      });
    }
    const file = $('#sg-file'), saveBtn = $('[data-sgsave]');
    file.addEventListener('change', () => {
      const f = file.files && file.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        // downscale to 500x300 jpeg (gif kept as-is so it animates)
        if (f.type === 'image/gif') { state.scannewbg = rd.result; showPrev(rd.result); saveBtn.disabled = false; return; }
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = 500; c.height = 300;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0, 500, 300);
          state.scannewbg = c.toDataURL('image/jpeg', 0.85);
          showPrev(state.scannewbg); saveBtn.disabled = false;
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    });
    function showPrev(src) {
      const p = $('#sg-preview');
      p.innerHTML = `<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
        <div style="position:relative;color:#7dd3fc;font-weight:700;font-size:26px;text-shadow:0 2px 10px #000">0%</div>`;
    }
  }

  async function renderDiscordCheck(view, id) {
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Check a Discord ID</h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:10px">
          Enter a player's Discord ID to see everything on record for them on this server:
          anticheat bans, in-game detections and screenshare scan results.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="disc-id" class="input" style="flex:1;min-width:200px" inputmode="numeric"
                 placeholder="e.g. 123456789012345678" value="${esc(id || '')}">
          <button class="btn btn-primary" data-disccheck>Check</button>
        </div>
        <p style="color:var(--dim);font-size:11px;margin-top:8px">
          The scanner reads the Discord ID from the player's PC during a scan. This only searches
          your own records — it cannot read someone's Discord servers or messages.</p>
      </div>

      <div class="card panel" style="margin-bottom:18px">
        <h3>Investigate Discord servers <span style="color:var(--dim);font-weight:500;font-size:13px">(via your bot)</span></h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:10px">
          Checks which of <b>your bot's</b> servers the user is a member of, with join date and role count.
          Add your bot to the cheat / community servers you want to monitor.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="disc-id2" class="input" style="flex:1;min-width:200px" inputmode="numeric"
                 placeholder="e.g. 123456789012345678" value="${esc(id || '')}">
          <button class="btn btn-primary" data-discinvest>Investigate</button>
        </div>
        <div id="disc-inv" style="margin-top:12px"></div>
        <p style="color:var(--dim);font-size:11px;margin-top:8px">
          Only servers your bot has joined are visible — this never reads someone's full server list.</p>
      </div>

      <div class="card panel" style="margin-bottom:18px">
        <h3>Cheat Discord servers <span style="color:var(--dim);font-weight:500;font-size:13px">(your watch-list)</span></h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:10px">
          Paste invite links of cheat / seller servers (one per line). When a player connects his Discord during a check,
          every server from this list he is in shows <b style="color:var(--red)">red</b> in his report.</p>
        <textarea id="cs-links" class="input" rows="3" style="width:100%;resize:vertical;font-family:ui-monospace,monospace"
          placeholder="https://discord.gg/xxxxxx&#10;discord.gg/yyyyyy&#10;123456789012345678 (server ID)"></textarea>
        <div style="display:flex;gap:10px;margin-top:10px"><button class="btn btn-primary" data-csadd>Add servers</button><span id="cs-msg" style="color:var(--muted);font-size:13px;align-self:center"></span></div>
        <div id="cs-list" style="margin-top:14px"></div>
      </div>

      <div id="disc-out"></div>`;
    await renderCheatServerList();
    view.querySelector('[data-csadd]').addEventListener('click', async (ev) => {
      const links = $('#cs-links').value.trim();
      if (!links) return toast('Paste at least one invite link', true);
      ev.target.disabled = true; $('#cs-msg').textContent = 'Checking links…';
      try {
        const r = await api('/api/cheat-servers', { method: 'POST', body: { links } });
        $('#cs-msg').textContent = `${r.added.length} added${r.failed.length ? ` · ${r.failed.length} not valid / expired: ${r.failed.join(', ')}` : ''}`;
        $('#cs-links').value = '';
        state.cheatServers = null;
        await renderCheatServerList();
      } catch (e) { $('#cs-msg').textContent = e.message; }
      ev.target.disabled = false;
    });
    if (id) await runDiscordCheck(id);
  }

  async function renderCheatServerList() {
    ensureReportCss();
    const box = $('#cs-list'); if (!box) return;
    const { servers } = await api('/api/cheat-servers');
    state.cheatServers = servers;
    box.innerHTML = servers.length ? `<div class="rp-grid">${servers.map((g) => `<div class="rp-card red"><div class="rp-guild">
        ${g.icon ? `<img src="${esc(discordIcon(g))}" alt="">` : `<div class="gi">${esc((g.name || '?')[0])}</div>`}
        <div style="flex:1;min-width:0"><div class="rp-title" style="padding:0">${esc(g.name || 'Server ' + g.guild_id)}</div>
          <div class="mono" style="color:var(--dim);font-size:11px">${esc(g.guild_id)}${g.invite ? ' · ' + esc(g.invite.replace('https://', '')) : ''}</div></div>
        <button class="btn btn-danger btn-sm" data-csdel="${esc(g.id)}">Remove</button></div></div>`).join('')}</div>`
      : '<div class="empty">No cheat servers yet.</div>';
    box.querySelectorAll('[data-csdel]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/cheat-servers?id=${encodeURIComponent(b.dataset.csdel)}`, { method: 'DELETE' }); state.cheatServers = null; renderCheatServerList(); }
      catch (e) { toast(e.message, true); }
    }));
  }

  async function runDiscordInvestigate(id) {
    const out = $('#disc-inv'); out.innerHTML = loading();
    try {
      const d = await api(`/api/discord-investigate?id=${encodeURIComponent(id)}`);
      if (!d.found.length) { out.innerHTML = `<div class="empty">Not found in any of your bot's ${fmtNum(d.servers || 0)} servers.</div>`; return; }
      out.innerHTML = `<div style="color:var(--cyan);font-weight:700;margin-bottom:10px">${d.found.length} server${d.found.length === 1 ? '' : 's'} found</div>
        ${d.found.map((s) => `<div class="top-row" style="align-items:center">
          <span><b>${esc(s.server)}</b><div class="mono" style="color:var(--dim);font-size:11px">joined ${esc((s.joined || '').slice(0, 10))}</div></span>
          <span class="badge log">${s.roles} role${s.roles === 1 ? '' : 's'}</span></div>`).join('')}`;
    } catch (e) { out.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function runDiscordCheck(id) {
    const out = $('#disc-out');
    out.innerHTML = loading();
    try {
      const d = await api(`/api/data?server=${state.server}&type=lookup&id=${encodeURIComponent(id)}`);
      if (!state.cheatServers) { try { state.cheatServers = (await api('/api/cheat-servers')).servers || []; } catch { state.cheatServers = []; } }
      const total = d.bans.length + d.detections.length + d.scans.length;
      const verdict = d.bans.some((b) => b.active) ? ['BANNED', 'var(--red)']
        : total === 0 ? ['NO RECORD', 'var(--dim)']
        : d.scans.some((s) => s.result === 'cheating') || d.detections.length ? ['FLAGGED', 'var(--orange)']
        : ['SEEN', 'var(--green)'];
      const rowsTbl = (title, head, body, n) => `<div class="card panel" style="margin-bottom:14px">
        <h3>${title} <span style="color:var(--dim);font-weight:500">(${n})</span></h3>
        ${n ? `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
            : '<div class="empty">None.</div>'}</div>`;
      out.innerHTML = `
        <div class="card panel" style="margin-bottom:14px;text-align:center">
          <h3 style="margin:0">Discord <span class="mono" style="color:var(--cyan)">${esc(d.id)}</span>
            — <span style="color:${verdict[1]}">${verdict[0]}</span></h3>
        </div>
        ${rowsTbl('Anticheat bans', '<th>Ban ID</th><th>Player</th><th>Reason</th><th>Status</th><th>Date</th>',
          d.bans.map((b) => `<tr><td class="mono" style="color:var(--cyan)">${esc(b.ban_id)}</td><td>${esc(b.player)}</td>
            <td>${esc(b.reason)}<div class="mono" style="color:var(--dim);font-size:11px">${esc(b.info)}</div></td>
            <td><span class="badge ${b.active ? 'ban' : 'off'}">${b.active ? 'Active' : 'Removed'}</span></td>
            <td class="mono">${fmtDate(b.created_at)}</td></tr>`).join(''), d.bans.length)}
        ${rowsTbl('In-game detections', '<th>Player</th><th>Detection</th><th>Action</th><th>Date</th>',
          d.detections.map((x) => `<tr><td>${esc(x.player)}</td>
            <td>${esc(x.reason)}<div class="mono" style="color:var(--dim);font-size:11px">${esc(x.info)}</div></td>
            <td><span class="badge ${esc(x.action)}">${esc(x.action)}</span></td>
            <td class="mono">${fmtDate(x.created_at)}</td></tr>`).join(''), d.detections.length)}
        ${(() => {
          const cheat = new Map((state.cheatServers || []).map((c) => [String(c.guild_id), c]));
          const seen = new Map();
          d.scans.forEach((sc) => ((sc.discord_check && sc.discord_check.guilds) || []).forEach((g) => seen.set(String(g.id), g)));
          const list = [...seen.values()].sort((a, b) => (cheat.has(String(b.id)) ? 1 : 0) - (cheat.has(String(a.id)) ? 1 : 0));
          const nCheat = list.filter((g) => cheat.has(String(g.id))).length;
          if (!list.length) return `<div class="card panel" style="margin-bottom:14px"><h3>Discord servers</h3><div class="empty">No connected Discord for this ID yet — servers show after the player connects Discord during a check.</div></div>`;
          ensureReportCss();
          return `<div class="card panel" style="margin-bottom:14px"><h3>${list.length} servers found
              ${nCheat ? `<span class="badge ban" style="margin-left:8px">${nCheat} cheat server${nCheat > 1 ? 's' : ''}</span>` : '<span class="badge on" style="margin-left:8px">no cheat servers</span>'}</h3>
            <div class="rp-grid">${list.map((g) => `<div class="rp-card ${cheat.has(String(g.id)) ? 'red' : 'grey'}"><div class="rp-guild">
              ${g.icon ? `<img src="${esc(discordIcon(g))}" alt="">` : `<div class="gi">${esc((g.name || '?')[0])}</div>`}
              <div style="flex:1;min-width:0"><div class="rp-title" style="padding:0">${esc(g.name)}</div><div class="mono" style="color:var(--dim);font-size:11px">${esc(g.id)}</div></div>
              ${cheat.has(String(g.id)) ? '<span class="rp-tag">CHEAT</span>' : ''}</div></div>`).join('')}</div></div>`;
        })()}
        ${rowsTbl('Screenshare scans', '<th>PIN</th><th>Player</th><th>Result</th><th>Date</th>',
          d.scans.map((s) => `<tr><td class="mono" style="color:var(--cyan)">${esc(s.pin)}</td><td>${esc(s.player) || '-'}</td>
            <td>${s.result ? `<span class="badge ${s.result === 'cheating' ? 'ban' : s.result === 'clean' ? 'on' : 'kick'}">${esc(s.result)}</span>` : '-'}</td>
            <td class="mono">${fmtDate(s.created_at)}</td></tr>`).join(''), d.scans.length)}`;
    } catch (e) { out.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
  }


  function renderQuickTools(view) {
    const a = state.access || {};
    const links = [
      ['My Profile','profile',true,'Discord identity and assigned roles'],
      ['My License','subscription',true,'Plan and expiry details'],
      ['Leaderboard','ranking',true,'Opt-in community rankings'],
      ['Scan PINs','pins',a.herocheck,'Generate and review screenshare PINs'],
      ['Scan Activity','scanactivity',a.herocheck,'Review your scans'],
      ['Discord Check','discord',a.herocheck,'Investigate an ID with authorization'],
      ['Access','access',a.admin,'Manage staff permissions'],
    ].filter(x=>x[2]);
    view.innerHTML = `<div class="workspace-hero"><div><h2>Quick Tools</h2><p>Actions available to your Discord account</p></div></div><div class="workspace-grid">${links.map(([label,tab,,desc])=>`<div class="workspace-card"><small>${esc(desc)}</small><strong style="font-size:19px">${esc(label)}</strong><div class="workspace-actions"><button class="btn btn-primary btn-sm" data-go="${esc(tab)}">Open</button></div></div>`).join('')}</div>`;
  }

  async function renderTeamDirectory(view) {
    view.innerHTML = loading();
    try {
      const {staff} = await api('/api/staff');
      view.innerHTML = `<div class="workspace-hero"><div><h2>Team Directory</h2><p>Authorized team entries — managed by the owner</p></div></div><div class="workspace-grid">${(staff||[]).map(m=>`<div class="workspace-card"><small>${esc(m.role||'Staff')}</small><strong style="font-size:19px">${esc(m.name)}</strong><p class="mono">${esc(m.discord_id||'No Discord ID')}</p></div>`).join('')||'<div class="workspace-card">No team members yet.</div>'}</div><div class="workspace-actions"><button class="btn btn-primary" data-go="staff">Manage Staff</button><button class="btn btn-ghost" data-go="access">Manage Access</button></div>`;
    } catch(e) { view.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
  }

  // ---------- troubleshooting (everyone): scanner won't open, antivirus, PIN, report, Discord, access ----------
  const TS_ISSUES = [
    { icon: '⚙', tag: 'Scanner', title: "The scanner doesn't open",
      text: 'The scanner (v4.2 and newer) runs on <b>.NET Framework 4.8</b>, which is already part of Windows 10 and 11 — nothing to install on a normal PC. It needs administrator rights to read the PC.',
      steps: ['Right-click the .exe → <b>Run as administrator</b> and accept the Windows prompt.',
              'If Windows shows <b>"Windows protected your PC"</b>: click <b>More info</b> → <b>Run anyway</b>.',
              'Still nothing? Install / repair <b>.NET Framework 4.8</b> from Microsoft, restart, try again.',
              'An older scanner (before v4.2) needs the <b>.NET 8 Desktop Runtime (x64)</b> instead — download the scanner again from a new PIN link to get the new one.',
              'If an error window appears, send staff the file <span class="mono">%TEMP%\\HeRoShield-startup-error.log</span>.'],
      links: [['https://dotnet.microsoft.com/en-us/download/dotnet-framework/net48', '.NET Framework 4.8 (Microsoft)'], ['https://dotnet.microsoft.com/en-us/download/dotnet/8.0', '.NET 8 Desktop Runtime (old scanners)']] },
    { icon: '🛡', tag: 'Antivirus', title: 'The antivirus removed or blocked the scanner',
      text: 'A brand-new download can be stopped by Microsoft Defender or another antivirus. You do <b>not</b> need to turn your antivirus off.',
      steps: ['Open <b>Windows Security → Virus & threat protection → Protection history</b>.',
              'Select the HeRoShield entry → <b>Actions → Restore</b> (or "Allow on device").',
              'Or download the scanner again from the same PIN link and run it right away.'] },
    { icon: '#', tag: 'PIN', title: 'PIN not found / already used',
      text: 'Each PIN works for one scan only. "Not found" means a typo or a deleted PIN.',
      steps: ['Use the download link staff sent you — the PIN is already inside the scanner.',
              'If it says <b>already used</b>, ask staff for a new link.',
              'Staff: clients can create <b>1 PIN per day</b> (resets at midnight). Admins have no limit.'] },
    { icon: '☁', tag: 'Connection', title: 'Report not delivered / "could not reach the server"',
      text: 'The server can take up to a minute to wake up. The scanner retries by itself 3 times.',
      steps: ['Keep the scanner open until it shows 100% — do not close it during the scan.',
              'Check your internet connection (VPN / school or work network can block it).',
              'Optional: install <b>Cloudflare WARP</b>, turn it on, run the scanner again.',
              'Nothing is saved on the player\'s PC — the report only goes to the website, so the scan must be run again if the upload failed.'],
      links: [['https://one.one.one.one/', 'Cloudflare WARP (optional)']] },
    { icon: '◎', tag: 'Discord', title: 'Discord connect shows an error',
      text: 'The scanner opens the Discord connect page in your browser. Use the Discord account you play with.',
      steps: ['If the page did not open, ask staff for the <span class="mono">/verify?pin=…</span> link.',
              '<b>"This PIN does not exist"</b>: the PIN was deleted — ask for a new one.',
              '<b>"Database is not up to date"</b> (staff): run the Supabase SQL files from the setup guide.'] },
    { icon: '⏱', tag: 'Dashboard', title: 'No access / access expired',
      text: 'Dashboard permissions can be given for a limited time (1 hour, 1 day, 1 month…). When the time ends, the access stops by itself.',
      steps: ['See your remaining time in <b>My Profile → Access time</b>.',
              'Expired? Ask an admin to give it again (Permission Manager or Access).',
              'Admins can see every change in <b>Activity logs</b>.'] },
  ];
  function renderTroubleshooting(view) {
    view.innerHTML = `<div class="workspace-hero"><div><h2>Troubleshooting</h2><p>Scanner won't open, antivirus, PIN, report or Discord problems — follow the steps in order.</p></div></div>
      <div class="ts-grid">${TS_ISSUES.map((i, n) => `<section class="card panel ts-card">
        <div class="ts-head"><span class="ts-ic">${i.icon}</span><div><small>${esc(i.tag)} · ${String(n + 1).padStart(2, '0')}</small><h3>${esc(i.title)}</h3></div></div>
        <p class="ts-text">${i.text}</p>
        <ol class="ts-steps">${i.steps.map((st) => `<li>${st}</li>`).join('')}</ol>
        ${i.links ? `<div class="ts-links">${i.links.map(([u, l]) => `<a class="btn btn-ghost btn-sm" href="${u}" target="_blank" rel="noopener noreferrer">↗ ${esc(l)}</a>`).join('')}</div>` : ''}
      </section>`).join('')}</div>
      <div class="card panel" style="margin-top:18px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center">
        <div><b>Still stuck?</b><p class="workspace-note" style="margin:4px 0 0">Open a support ticket with your PIN and a screenshot of the error.</p></div>
        <a class="btn btn-primary" href="https://discord.gg/V7gvW7ncP" target="_blank" rel="noopener noreferrer">Open Discord support</a>
      </div>`;
  }

  function renderTutorial(view) {
    const step = (t, d) => `<li><b>${t}</b><p style="color:var(--muted);margin:4px 0 0">${d}</p></li>`;
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:16px">
        <h3>How a screenshare works (HeRo Check)</h3>
        <ol style="display:flex;flex-direction:column;gap:16px;padding-left:22px;margin:0">
          ${step('Set your scanner background (once)', 'Scanner GUI → choose an image → Save. Every PIN you generate after that shows this image in the scanner automatically.')}
          ${step('Generate a PIN', 'Scan PINs → type the player name → Generate PIN → <b>Copy link</b>. It appears in Recent PINs right away.')}
          ${step('Send the link to the player', 'The player opens the link — the scanner downloads with his PIN already inside (HeRoShield-PIN.exe). He runs it and clicks Accept, no PIN to type. Your background loads by itself.')}
          ${step('Player accepts the check', 'The scan takes 1–3 minutes and reads the whole PC: execution history (even deleted cheats), drivers, startup, tasks, network, event logs, files.')}
          ${step('Open the result', 'Scan PINs → View (or paste the PIN in "View a result by PIN"). Check the tabs: Detections, Timeline, PC history, Macros, Discord (the servers he is in are read from his PC automatically), Execution, Files…')}
          ${step('Review the verdict', 'The scanner says <b style="color:var(--red)">cheating</b>, <b style="color:var(--orange)">suspicious</b> or <b style="color:var(--green)">clean</b>. Always review the evidence yourself before a ban.')}
        </ol>
      </div>
      <div class="card panel">
        <h3>Giving access to your staff</h3>
        <ol style="display:flex;flex-direction:column;gap:16px;padding-left:22px;margin:0">
          ${step('The staff member logs in once', 'They open this dashboard and log in with Discord. They see "no access" and their Discord ID — that is normal.')}
          ${step('Option A — Render (fixed list)', 'Render → Environment: <span class="mono">HEROCHECK_IDS</span> = Discord IDs for screenshare, <span class="mono">HEROSHIELD_IDS</span> = Discord IDs for anticheat, <span class="mono">ADMIN_DISCORD_IDS</span> = you. Separate IDs with a comma. Save → Render restarts.')}
          ${step('Option B — Access page (no restart)', 'Open Access (owner only). It lists everyone who logged in; you can also add someone by Discord ID before they log in.')}
          ${step('Tick what they can open', '<b>HeRo Check</b> = screenshare (scanner, PINs, Scanner GUI). <b>HeRo Shield</b> = in-game anticheat (overview, detections, bans, players, logs, live, configuration). Tick both for full access.')}
          ${step('Done', 'They refresh the page and see only their tabs. Untick to remove access at any time — it applies immediately.')}
        </ol>
      </div>`;
  }

  function renderChangelogs(view) {
    const log = [
      ['v35', 'Player history (was PC history): every earlier scan of the PC on any HeRo Shield server — server name, date, game, cheater / safe and its main detections — plus the FiveM bans of the player on HeRo Shield servers (server name, reason, banned / unbanned), matched by the Discord ID and Steam accounts found on the PC. It is read again each time the report is opened. Run supabase-v35-player-history.sql once.'],
      ['v34', 'Scan PINs: a pending PIN (not used yet) can be deleted with the Delete button. A used PIN cannot be deleted — its report is kept as proof.'],
      ['v33', 'Faster Scan PINs tab: the list no longer downloads every report (a report can be several MB) — a report loads only when you click View, then stays open instantly. Choosing a game no longer reloads the page, and the last list shows at once while it refreshes. Real game logos: drop fivem.png / redm.png / minecraft.png / roblox.png in assets/games.'],
      ['v32', 'Simpler menu: the Discord check and Signatures pages are gone. The scan reads the Discord servers from the player\'s PC by itself (Discord tab of the report), and the scanner already has its own cheat signatures for every game.'],
      ['v31', 'Games: a scan PIN is now made for one game — FiveM, RedM, Minecraft or Roblox. The scanner runs the common checks (macros, PC history, USB, timeline, deleted files…) plus only the checks of that game. Minecraft: launchers (.minecraft, Lunar, Badlion, Feather, Prism, CurseForge, Modrinth, TLauncher), every mod jar opened (hacked clients found by their code, even renamed), game logs (chat ignored), autoclickers. Roblox: executors (by name and by their workspace + autoexec folders), saved scripts, executors that ran, physics / network FFlags. RedM: the RedM folder and DLLs inside RedM. Signatures can be set per game. Run supabase-v30-games.sql once.'],
      ['v30', 'Scanner v4.9: new Macros & recoil tab — Logitech G HUB / LGS Lua scripts, Razer Synapse and Bloody macros, AutoHotkey scripts (also a compiled AutoHotkey .exe running now). A script that moves the mouse by itself while the left button is held is a no-recoil detection, with the line of the script shown. New PC history tab: the same PC is recognised on every HeRo Shield server by its hardware IDs (HWID, Machine ID, UUID, BIOS and disk serials) — you see how many times it was checked before and how it went, and a red flag when the HWID changed (spoofer). Run supabase-v29-pc-history.sql once.'],
      ['v29', 'Permissions: the Permission Manager now uses tick boxes — give one or more permissions to the same person (Scanner + Staff, Admin + Staff…). Edit loads what the person has; an unticked box is removed. Staff opens the anticheat tabs without a paid plan. Scanner v4.8: new black + blue design.'],
      ['v27', 'Scanner v4.7: new tabs Timeline 24h (everything that happened before the check, newest first), USB drives (sticks plugged in / pulled out, programs that ran from a USB stick) and Opened files (Jump Lists — programs and scripts opened, even deleted). Injection: a DLL running inside FiveM whose file was deleted, or a random-named unsigned DLL from Downloads / Temp, is now a detection.'],
      ['v26', 'New permission 👁️ Admin (test): sees every tab of the dashboard like an Admin, but every change is refused (view only). Admins also get the scanner with unlimited PINs. Run supabase-v26-viewer.sql once in Supabase.'],
      ['v25', 'Discord check without login: the player no longer has to log in with Discord. Type his Discord ID (or keep the one read from his PC) in the Discord tab — the site gets his profile and checks every server your bot is in, and the scanner reads the servers he is in and left from the PC. The login page stays available as an option.'],
      ['v24', 'Discord: servers he left now show their name and logo (scanner v4.5.2 reads the logo from the Discord cache, and the site looks up names on Discord). Recycle bin: every deleted file shows its real name, where it was and when it was deleted — cheat names in red.'],
      ['v23', 'Scanner v4.5.1: Service memory is now quiet on normal PCs — deleted installers, old Discord versions and Windows tools are no longer listed, glued paths are split correctly, and the fake DPS dates (they are the program\'s build date, not the run date) are no longer shown.'],
      ['v22', 'Scanner v4.5: new Cheat hardware tab — DMA cards (PCILeech FPGA), KMBox, Cronus Zen / StrikePack, XIM, Titan and Arduino mouse boards, even if they were unplugged before the check. New spoofer checks in Warnings (MAC changed by hand, Machine ID rewritten recently). The scan bar now moves at a steady pace from start to finish, and the scan takes a little longer to be thorough.'],
      ['v21', 'Scanner v4.4.1: the scanner no longer saves hero-report-PIN.json on the player\'s PC (Desktop / Downloads). The report goes only to the website. Old leftover hero-report files are deleted and never flagged.'],
      ['v20', 'Scanner v4.4: new Service memory tab. The scanner now reads what Windows services remember in RAM (DPS, PcaSvc, SysMain, Explorer, DNS cache) — programs that ran and cheat websites that were opened, even after the file was deleted and the logs were cleared, until the PC restarts. Cheat files found there are real detections; random / loader names and deleted Downloads / Temp programs are orange for you to check.'],
      ['v19', 'Permissions with a time: give HeRo Check / HeRo Shield / Admin for 1 hour, 1 day, 2 days, 1 week, 1 month, any amount of hours / days / weeks / months / years, or Lifetime — it stops by itself and shows "Expired". New Activity logs page (admin): every permission given / removed, every license created / revoked, every PIN created / deleted and every purchase, with who did it and when. Clients (non-admin) can create 1 scan PIN per day. Scanner v4.3 File journal tab. Fixes: a used PIN could be sent again (the "used" check never ran); scanner-only licenses did not send your signatures to the scanner; Discord history lookup did not work without a FiveM server.'],
      ['4.1.0', 'New FiveM tab in the scan report: every mod in the FiveM folders is opened and read, including .rpf archives (and archives inside archives). No-recoil / no-spread / damage-boosted weapons.meta and no-bush / no-grass / no-water visibility mods are shown as red lines, in the FiveM tab and in Detects. Graphics mods (visualsettings, timecycle) are orange, ReShade / ENB green. Plugins and scripts are judged by their code, not their name. Filter box on every report tab. Discord tab: cheat servers he LEFT are shown too — found in the Discord / browser cache on his PC (server icons, invite pages, channel links) and in his earlier checks; the date he joined the cheat servers he is in; servers he joined since his last check; cheat-looking server names in orange.'],
      ['4.0.0', 'Much stronger cheat detection: reads UTF-16 strings (C#/.NET cheats were invisible before), cheat score per program (menu features like triggerbot / silent aim / no recoil, FiveM executor code, injection APIs, ImGui overlay, unsigned, cheat-named folder), menu names found even in renamed loaders in Downloads/Temp/AppData, cheat-named programs that ran (even deleted), cheat files inside .zip archives, ReShade/ENB recognised. Startup &amp; scheduled-task persistence, loaded kernel drivers (unsigned / user-folder / exploitable), live network connections, ShimCache &amp; PCA execution history, Windows event log (cleared logs, driver installs, Defender alerts, clock changes), hosts file &amp; firewall blocking, hidden NTFS streams, VM detection, Rockstar / Epic accounts, cheat tools running (Cheat Engine, injectors, ReClass). Fewer false positives: RGB / motherboard drivers and normal apps (Discord, Steam) no longer flagged as cheating. Tabbed report on the dashboard.'],
      ['3.7.0', 'Antivirus detection (Security Center, Defender exclusions), injection hooks (AppInit_DLLs, IFEO, test-signing), USB device history, browser detection, unsigned exe flagging, warning categories'],
      ['3.6.0', 'C2 domain + DNS cache detection, SHA-256 hash matching, bulk string import, domains &amp; hashes in signatures'],
      ['3.5.0', 'False-positive guards: skip own project files, OneDrive, node_modules, recycle bin. Multi-match fix (3+ cheat names = list, not cheat)'],
      ['3.4.0', 'PowerShell &amp; Run (Win+R) command history, bypass &amp; cleaning tells, UserAssist, MUICache'],
      ['3.3.0', 'Whole-disk deep scan, script obfuscation detection (encoded PowerShell, base64 Lua), packer detection (Themida, VMProtect, Enigma, UPX)'],
      ['3.2.0', 'Prefetch, BAM, PCA execution timeline. FiveM plugin scan. Recycle bin analysis'],
      ['3.1.0', 'Running process scan, network/DNS indicators, drop folder scan'],
      ['3.0.0', 'Initial release — system info, signature matching, screenshot capture, backend upload'],
    ];
    view.innerHTML = log.map(([ver, text]) => `<div class="card panel" style="margin-bottom:10px">
        <b style="color:var(--cyan)">v${ver}</b><div style="margin-top:6px;color:var(--muted)">${text}</div></div>`).join('');
  }

  // ── Signatures ────────────────────────────────────────────────────────────────────────
  //
  // A signature is what the scanner looks for. Three ways to make one, because operators get
  // their cheats in three different states:
  //
  //   drop the file   you have the cheat itself. The hash is computed here, in the browser -
  //                   the file is never uploaded anywhere. That is the strongest signature
  //                   there is: a hash matches the exact build and nothing else, and it still
  //                   matches after the player renames the file.
  //   type it         you only know the name: "Eulen", eulen.exe. Weaker, but it is what you
  //                   have when the cheat was deleted before you arrived.
  //   import          a list from somebody else, or your own backup.
  //
  // Export is there because a list you cannot take with you is a list you are renting. JSON
  // round-trips exactly; CSV is for reading in Excel.
  async function renderSignatures(view) {
    const { signatures } = await api('/api/signatures');
    const H = (s) => esc(s == null ? '' : String(s));
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Drop the cheat here</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:12px">
          The hash is worked out <b>in your browser</b> — the file is never uploaded, not to this site and not anywhere else.
          A hash signature catches the exact build even after the player renames it.</p>
        <div id="sig-drop" class="sig-drop">
          <b>Drag a cheat file here</b>
          <span>or <button class="btn btn-ghost btn-sm" data-sigpick>choose a file</button> — several at once is fine</span>
          <input type="file" id="sig-file" multiple hidden>
        </div>
        <div id="sig-drop-out"></div>
      </div>

      <div class="card panel" style="margin-bottom:18px">
        <h3>Write one yourself</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:12px">
          The scanner pulls this list live — add a cheat and every check from then on looks for it.
          Pick the game: a FiveM cheat is not looked for in a Minecraft scan (spoofers and loaders → All games).</p>
        <div class="set-grid" style="display:grid;gap:10px">
          <input id="sig-name" class="input" placeholder="Cheat name (e.g. Eulen)">
          <input id="sig-files" class="input" placeholder="File names: eulen.exe, eulen.dll">
          <input id="sig-hashes" class="input mono" placeholder="Hashes (SHA-256, SHA-1 or MD5), comma separated">
          <input id="sig-domains" class="input" placeholder="Domains: eulencheats.com, cdn.eulen.cc">
          <input id="sig-feats" class="input" placeholder="Features: Aimbot, No recoil, ESP">
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <select id="sig-game" class="input" style="flex:1;min-width:150px" title="Which game this cheat is for"><option value="">All games</option>${GAMES.map((g) => `<option value="${g.k}">${g.name} only</option>`).join('')}</select>
            <select id="sig-sev" class="input" style="flex:1;min-width:120px"><option value="high">High (cheating)</option><option value="medium">Medium</option><option value="low">Low</option></select>
            <button class="btn btn-primary" data-addsig>Add</button>
          </div>
        </div>
        <p style="color:var(--dim);font-size:12.5px;margin:10px 0 0">A signature needs at least one of: a file name, a hash or a domain. The name alone matches nothing.</p>
      </div>

      <div class="card panel" style="margin-bottom:18px">
        <h3>Import and export</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-ghost btn-sm" data-sigimport>Import a file (JSON or CSV)</button>
          <input type="file" id="sig-import" accept=".json,.csv,.txt" hidden>
          <button class="btn btn-ghost btn-sm" data-sigexport="json" ${signatures.length ? '' : 'disabled'}>Export JSON</button>
          <button class="btn btn-ghost btn-sm" data-sigexport="csv" ${signatures.length ? '' : 'disabled'}>Export CSV</button>
        </div>
        <details style="margin-top:12px">
          <summary style="cursor:pointer;color:var(--muted);font-size:13px">Or paste a list</summary>
          <p style="color:var(--dim);font-size:12.5px;margin:8px 0">One per line: <span class="mono">name, file.exe, &lt;hash&gt;, domain.com</span> — order does not matter, each piece is recognised by its shape.</p>
          <textarea id="sig-paste" class="input mono" rows="6" placeholder="Eulen, eulen.exe, eulencheats.com&#10;RedEngine, redengine.exe"></textarea>
          <button class="btn btn-primary btn-sm" style="margin-top:8px" data-sigpaste>Add these</button>
        </details>
      </div>

      <div class="card panel"><h3>Signatures (${signatures.length})</h3>
        ${signatures.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Game</th><th>Files</th><th>Hashes</th><th>Domains</th><th>Severity</th><th></th></tr></thead>
          <tbody>${signatures.map((s) => `<tr><td><b>${H(s.name)}</b>${(s.features || []).length ? `<div>${(s.features || []).map((f) => `<span class="cat">${H(f)}</span>`).join(' ')}</div>` : ''}</td>
            <td>${(s.games || []).length ? (s.games || []).map((g) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:6px">${gameIcon(g, 12)}${H(gameOf(g).name)}</span>`).join('') : '<span style="color:var(--dim)">All games</span>'}</td>
            <td class="mono">${H((s.file_names || []).join(', '))}</td>
            <td class="mono" style="font-size:11px">${(s.hashes || []).map((h) => `<div title="${H(h)}">${H(h.slice(0, 16))}…</div>`).join('') || '<span style="color:var(--dim)">—</span>'}</td>
            <td class="mono" style="font-size:11.5px">${H((s.domains || []).join(', ')) || '<span style="color:var(--dim)">—</span>'}</td>
            <td><span class="badge ${s.severity === 'high' ? 'ban' : s.severity === 'medium' ? 'kick' : 'off'}">${H(s.severity)}</span></td>
            <td><button class="btn btn-danger btn-sm" data-delsig="${H(s.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">No signatures yet. Drop a cheat file above, or write one by hand.</div>'}
      </div>`;

    // ── dropping files ──────────────────────────────────────────────────────────────────
    const drop = view.querySelector('#sig-drop');
    const input = view.querySelector('#sig-file');
    const out = view.querySelector('#sig-drop-out');
    if (!drop || !input || !out) return;

    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { stop(e); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { stop(e); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => take(e.dataTransfer && e.dataTransfer.files));
    drop.addEventListener('click', (e) => { if (!e.target.closest('button')) input.click(); });
    input.addEventListener('change', () => take(input.files));

    async function take(files) {
      const list = [...(files || [])].slice(0, 20);
      if (!list.length) return;
      if (!window.HSFileCheck) { toast('The hashing script did not load — reload the page', true); return; }
      out.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:12px 0 0">Reading ${list.length} file${list.length > 1 ? 's' : ''}…</p>`;
      const rows = [];
      for (const f of list) {
        try {
          const r = await window.HSFileCheck.analyze(f, () => {}, signatures);
          rows.push({ ok: true, file: f, r });
        } catch (e) { rows.push({ ok: false, file: f, err: e.message || 'could not read this file' }); }
      }
      // The name is a guess from the file name - "eulen_loader.exe" -> "Eulen loader" - and it
      // sits in an input so it can be corrected before anything is saved. Nothing is written
      // to the list until the operator presses Add.
      const guess = (n) => n.replace(/\.[a-z0-9]+$/i, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/^./, (c) => c.toUpperCase()).slice(0, 80);
      out.innerHTML = rows.map((x, i) => x.ok ? `
        <div class="sig-hit">
          <div class="sig-hit-top">
            <b>${H(x.file.name)}</b>
            <span class="rp-tag ${x.r.verdict === 'cheat' ? 'red' : x.r.verdict === 'suspicious' ? 'orange' : ''}">${H(x.r.verdict)}</span>
            <span style="color:var(--dim);font-size:12px">${(x.file.size / 1024).toFixed(0)} KB${x.r.knownAs ? ' · already in your list as ' + H(x.r.knownAs) : ''}</span>
          </div>
          <div class="mono sig-hit-hash">SHA-256 ${H(x.r.sha256 || '—')}</div>
          <div class="mono sig-hit-hash">MD5 ${H(x.r.md5 || '—')} · SHA-1 ${H(x.r.sha1 || '—')}</div>
          ${x.r.why && x.r.why.length ? `<div style="color:var(--muted);font-size:12.5px;margin-top:6px">${x.r.why.map(H).join(' · ')}</div>` : ''}
          <div class="sig-hit-add">
            <input class="input" data-dropname="${i}" value="${H(guess(x.file.name))}" placeholder="Cheat name">
            <select class="input" data-dropgame="${i}"><option value="">All games</option>${GAMES.map((g) => `<option value="${g.k}">${g.name} only</option>`).join('')}</select>
            <button class="btn btn-primary btn-sm" data-dropadd="${i}" ${x.r.knownAs ? 'disabled' : ''}>${x.r.knownAs ? 'Already added' : 'Add as signature'}</button>
          </div>
        </div>` : `<div class="sig-hit"><b>${H(x.file.name)}</b><div style="color:#f87171;font-size:13px">${H(x.err)}</div></div>`).join('');

      out.querySelectorAll('[data-dropadd]').forEach((btn) => btn.addEventListener('click', async () => {
        const i = btn.dataset.dropadd;
        const x = rows[i]; if (!x || !x.ok) return;
        const name = (out.querySelector(`[data-dropname="${i}"]`) || {}).value;
        if (!name || !name.trim()) { toast('Give it a name first', true); return; }
        const g = (out.querySelector(`[data-dropgame="${i}"]`) || {}).value || '';
        btn.disabled = true; btn.textContent = 'Adding…';
        try {
          await api('/api/signatures', { method: 'POST', body: {
            name: name.trim(), fileNames: x.file.name.toLowerCase(),
            hashes: [x.r.sha256, x.r.sha1, x.r.md5].filter(Boolean).join(','),
            features: (x.r.does || []).join(','), severity: 'high', games: g ? [g] : [],
          } });
          btn.textContent = 'Added';
          toast('Signature added — every check from now on looks for it');
        } catch (e) { btn.disabled = false; btn.textContent = 'Add as signature'; toast(e.message || 'Could not add it', true); }
      }));
    }

    // ── import / export ─────────────────────────────────────────────────────────────────
    const imp = view.querySelector('#sig-import');
    if (imp) imp.addEventListener('change', async () => {
      const f = imp.files && imp.files[0]; if (!f) return;
      let text = '';
      try { text = await f.text(); } catch { toast('Could not read that file', true); return; }
      const bulk = parseSigText(text, f.name);
      if (!bulk.length) { toast('Nothing usable in that file', true); return; }
      try {
        await api('/api/signatures', { method: 'POST', body: { bulk } });
        toast(`Imported ${bulk.length} signature${bulk.length > 1 ? 's' : ''}`);
        render();
      } catch (e) { toast(e.message || 'Import failed', true); }
    });
  }

  /**
   * Reads a pasted or imported list. JSON keeps whatever shape it was exported in; anything
   * else is read line by line, and each piece is recognised BY ITS SHAPE rather than by its
   * column position - a 32-to-64 character hex run is a hash, something with a dot and no
   * slash is a file name or a domain, the rest is the name. So a list copied out of a Discord
   * message works as well as a tidy CSV.
   */
  function parseSigText(text, fileName = '') {
    const t = String(text || '').trim();
    if (!t) return [];
    if (t[0] === '[' || t[0] === '{' || /\.json$/i.test(fileName)) {
      try {
        const j = JSON.parse(t);
        const arr = Array.isArray(j) ? j : Array.isArray(j.signatures) ? j.signatures : [j];
        return arr.filter((x) => x && x.name).slice(0, 500).map((x) => ({
          name: String(x.name).slice(0, 80),
          fileNames: x.fileNames || x.file_names || '',
          hashes: x.hashes || '', domains: x.domains || '', features: x.features || '',
          severity: x.severity || 'high', games: x.games || [],
        }));
      } catch { /* not JSON after all: fall through and read it as lines */ }
    }
    const out = [];
    for (const line of t.split(/\r?\n/).slice(0, 500)) {
      const parts = line.split(/[,;\t]+/).map((x) => x.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (/^(name|cheat)\b/i.test(parts[0]) && /hash|file|domain/i.test(line)) continue;   // a CSV header
      const hashes = [], files = [], domains = [], rest = [];
      for (const p of parts) {
        if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(p)) hashes.push(p.toLowerCase());
        else if (/\.(exe|dll|sys|bat|cmd|jar|lua|asi|rpf|zip|rar|7z)$/i.test(p)) files.push(p.toLowerCase());
        else if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p) && !p.includes(' ')) domains.push(p.toLowerCase());
        else rest.push(p);
      }
      const name = rest.shift() || files[0] || domains[0] || hashes[0];
      if (!name || (!hashes.length && !files.length && !domains.length)) continue;
      out.push({ name: name.slice(0, 80), fileNames: files.join(','), hashes: hashes.join(','),
                 domains: domains.join(','), features: rest.join(','), severity: 'high', games: [] });
    }
    return out;
  }

  /** Hands the operator their own list back, in a file they can keep or give to someone else. */
  function exportSignatures(rows, kind) {
    const stamp = new Date().toISOString().slice(0, 10);
    let blob, name;
    if (kind === 'csv') {
      const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const lines = [['name', 'games', 'file_names', 'hashes', 'domains', 'features', 'severity'].join(',')];
      for (const s of rows) lines.push([s.name, (s.games || []).join(' '), (s.file_names || []).join(' '),
        (s.hashes || []).join(' '), (s.domains || []).join(' '), (s.features || []).join(' '), s.severity].map(q).join(','));
      blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      name = `heroshield-signatures-${stamp}.csv`;
    } else {
      // Exported in the same shape the import reads, so a backup restores exactly.
      blob = new Blob([JSON.stringify({ signatures: rows.map((s) => ({
        name: s.name, fileNames: s.file_names || [], hashes: s.hashes || [], domains: s.domains || [],
        features: s.features || [], severity: s.severity, games: s.games || [],
      })) }, null, 2)], { type: 'application/json' });
      name = `heroshield-signatures-${stamp}.json`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------- permission duration: Duration (number) + Unit (hours … years / Lifetime) + live preview ----------
  const UNITS = [['hour', 'Hours'], ['day', 'Days'], ['week', 'Weeks'], ['month', 'Months'], ['year', 'Years'], ['lifetime', 'Lifetime']];
  function durationPicker(id, def = [1, 'day']) {
    return `<div class="perm-dur" data-dur="${id}">
      <div class="perm-dur-grid">
        <label><span>Duration</span><input type="number" min="1" max="1000" class="input" id="${id}-n" value="${def[0] || 1}" ${def[1] === 'lifetime' ? 'disabled' : ''}></label>
        <label><span>Unit</span><select class="input" id="${id}-u">${UNITS.map(([u, l]) => `<option value="${u}" ${u === def[1] ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <div class="perm-preview"><small>Permission preview</small><b id="${id}-title">—</b><p id="${id}-txt"></p></div>
    </div>`;
  }
  const durLabel = (d) => (d.unit === 'lifetime' ? 'Lifetime' : `${d.amount} ${d.unit}${d.amount === 1 ? '' : 's'}`);
  // labelFn() → what is being given ("HeRoCheck", "Admin", "HeRo Shield + HeRo Check"…)
  function wireDuration(root, id, labelFn = () => 'Access') {
    const n = root.querySelector(`#${id}-n`), u = root.querySelector(`#${id}-u`);
    const title = root.querySelector(`#${id}-title`), txt = root.querySelector(`#${id}-txt`);
    if (!n || !u) return () => {};
    const show = () => {
      n.disabled = u.value === 'lifetime';
      const d = readDuration(root, id);
      const what = labelFn() || 'No permission selected';
      title.textContent = `${what} — ${durLabel(d)}`;
      txt.textContent = d.unit === 'lifetime' ? 'Never expires — stays until you remove it.'
        : `Access expires automatically after the selected duration (${fmtDate(new Date(endOf(d)).toISOString())}).`;
    };
    n.addEventListener('input', show); u.addEventListener('change', show); show();
    return show;   // call it again when the permission choice changes
  }
  function readDuration(root, id) {
    const u = root.querySelector(`#${id}-u`)?.value || 'lifetime';
    const n = Math.max(1, Math.min(1000, parseInt(root.querySelector(`#${id}-n`)?.value || '1', 10) || 1));
    return u === 'lifetime' ? { amount: 0, unit: 'lifetime' } : { amount: n, unit: u };
  }
  function endOf(d) {
    const t = new Date();
    if (d.unit === 'hour') t.setTime(t.getTime() + d.amount * 3600e3);
    else if (d.unit === 'day') t.setTime(t.getTime() + d.amount * 86400e3);
    else if (d.unit === 'week') t.setTime(t.getTime() + d.amount * 7 * 86400e3);
    else if (d.unit === 'month') t.setMonth(t.getMonth() + d.amount);
    else if (d.unit === 'year') t.setFullYear(t.getFullYear() + d.amount);
    return t.getTime();
  }
  function timeLeft(iso) {
    if (!iso) return '<span class="badge on">Lifetime</span>';
    const ms = Date.parse(iso) - Date.now();
    if (ms <= 0) return `<span class="badge ban" title="${esc(fmtDate(iso))}">Expired</span>`;
    const h = ms / 3600e3, d = h / 24;
    const left = d >= 60 ? `${Math.round(d / 30)} months` : d >= 7 ? `${Math.round(d)} days` : d >= 1 ? `${Math.floor(d)} d ${Math.floor(h % 24)} h` : h >= 1 ? `${Math.floor(h)} h ${Math.floor((ms % 3600e3) / 60e3)} min` : `${Math.max(1, Math.floor(ms / 60e3))} min`;
    return `<span class="badge ${d < 1 ? 'kick' : 'log'}" title="ends ${esc(fmtDate(iso))}">${left} left</span>`;
  }

  async function renderStaff(view) {
    const { staff } = await api('/api/staff');
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Add a staff member</h3><p class="workspace-note">Discord ID is linked directly to staff permissions. The invited user can log in with Discord and open the permitted dashboard without a personal paid plan. Staff roles do not grant owner access.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="staff-name" class="input" style="flex:1;min-width:150px" placeholder="Name">
          <input id="staff-did" class="input" style="flex:1;min-width:150px" placeholder="Discord user ID (required)">
          <input type="hidden" id="staff-role" value="staff">
          <label><input type="checkbox" id="staff-hs" checked> HeRo Shield</label><label><input type="checkbox" id="staff-hc" checked> HeRo Check</label><button class="btn btn-primary" data-addstaff>Add & Grant Access</button>
        </div>
        ${durationPicker('staffdur', [1, 'lifetime'])}
      </div>
      <div class="card panel"><h3>Team (${staff.length})</h3>
        ${staff.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Discord ID</th><th>Role</th><th>Added</th><th></th></tr></thead>
          <tbody>${staff.map((m) => `<tr><td><b>${esc(m.name)}</b></td><td class="mono">${esc(m.discord_id) || '-'}</td>
            <td><span class="badge ${m.role === 'admin' ? 'log' : 'off'}">${esc(m.role)}</span></td>
            <td class="mono">${fmtDate(m.created_at)}</td>
            <td><button class="btn btn-danger btn-sm" data-delstaff="${esc(m.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">No staff yet.</div>'}
      </div>`;
    const staffShow = wireDuration(view, 'staffdur', () => [$('#staff-hs')?.checked && 'HeRo Shield', $('#staff-hc')?.checked && 'HeRo Check'].filter(Boolean).join(' + '));
    ['#staff-hs', '#staff-hc'].forEach((q) => view.querySelector(q)?.addEventListener('change', staffShow));
    view.querySelector('[data-addstaff]')?.addEventListener('click', async () => {
      const name = $('#staff-name').value.trim(), discordId = $('#staff-did').value.trim();
      if (!name || !/^\d{15,22}$/.test(discordId)) return toast('Enter a name and valid Discord user ID', true);
      try {
        await api('/api/staff', {method:'POST',body:{name,discordId,role:$('#staff-role').value,heroshield:$('#staff-hs').checked,herocheck:$('#staff-hc').checked,duration:readDuration(view,'staffdur')}});
        toast('Staff access granted. Ask them to log in with Discord.');
        renderStaff(view);
      } catch(e) { toast(e.message,true); }
    });
    view.querySelectorAll('[data-delstaff]').forEach(btn => btn.addEventListener('click', async () => {
      if (!await modal({title:'Remove staff entry',text:'This removes the team entry. Revoke dashboard access separately from Access.',ok:'Remove',danger:true})) return;
      try { await api('/api/staff?id='+encodeURIComponent(btn.dataset.delstaff),{method:'DELETE'}); toast('Staff entry removed'); renderStaff(view); } catch(e){toast(e.message,true);}
    }));
  }

  // Several permissions per person: tick any mix (Scanner + Staff, Admin + Staff…).
  // Saving sends every box, so an unticked box is removed.
  const PERM_LIST = [
    { k: 'herocheck', name: 'Scanner', icon: '🔍', badge: 'on',  text: 'scanner, scan PINs, Scanner GUI' },
    { k: 'heroshield', name: 'Staff', icon: '🛡️', badge: 'log', text: 'anticheat tabs (detections, bans, players, logs, live)' },
    { k: 'viewer', name: 'Admin (test)', icon: '👁️', badge: 'off', text: 'sees every tab, cannot change anything' },
    { k: 'admin', name: 'Admin', icon: '👑', badge: 'ban', text: 'management dashboard + everything (unlimited PINs)', ownerOnly: true },
  ];
  const permsOfUser = (u) => ({ herocheck: !!(u.herocheck || u.envHerocheck), heroshield: !!(u.heroshield || u.envHeroshield), viewer: !!u.viewer, admin: !!u.admin });
  function roleBadges(u) {
    const p = permsOfUser(u);
    const list = PERM_LIST.filter((x) => p[x.k]);
    if (!list.length) return '<span style="color:var(--dim)">No access</span>';
    return `<div style="display:flex;gap:6px;flex-wrap:wrap">${list.map((x) => `<span class="badge ${x.badge}">${x.icon} ${x.name}</span>`).join('')}</div>`;
  }

  async function renderRoleManager(view) {
    view.innerHTML = loading();
    const { users } = await api('/api/access');
    const owner = (users || []).some(u => String(u.discord_id) === String(state.user.id) && u.owner);
    const boxes = PERM_LIST.filter((x) => !x.ownerOnly || owner);
    view.innerHTML = `<div class="workspace-hero"><div><h2>Permission Manager</h2><p>Admin workspace · Assign dashboard access using Discord user IDs</p></div></div>
      <div class="card panel perm-card" style="margin-bottom:18px">
        <h3>Give permissions</h3>
        <label class="perm-field"><span>Discord User ID</span><input class="input" id="role-id" placeholder="Enter Discord user ID" inputmode="numeric"></label>
        <div class="perm-field"><span>Dashboard permissions <small style="color:var(--dim);font-weight:400">— tick one or more</small></span>
          ${boxes.map((x) => `<label class="perm-radio"><input type="checkbox" name="role-perm" value="${x.k}" ${x.k === 'herocheck' ? 'checked' : ''}> ${x.icon} <b>${x.name}</b> — ${x.text}</label>`).join('')}
        </div>
        ${durationPicker('roledur', [1, 'day'])}
        <button class="btn btn-primary perm-save" id="role-save">Save permissions</button>
        <p class="workspace-note" style="margin-top:10px">Tick several boxes to give several permissions (for example Scanner + Staff, or Admin + Staff). Saving replaces what the person had: an unticked box is removed. Admin and Admin (test) cannot be given together. Only the environment owner can grant Admin. Every change is written to Activity logs.</p>
      </div>
      <div class="card panel"><h3>Accounts (${users.length})</h3><div class="table-wrap"><table><thead><tr><th>Discord user</th><th>ID</th><th>Permissions</th><th>Time left</th><th>Action</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.name||'Not logged in')}</td><td class="mono">${esc(u.discord_id)}</td><td>${roleBadges(u)}</td><td>${u.owner || u.envHerocheck || u.envHeroshield ? '<span class="badge on">Permanent (env)</span>' : (u.admin || u.viewer || u.herocheck || u.heroshield) ? timeLeft(u.expires_at) : '-'}</td><td>${u.owner ? 'Environment owner' : u.admin && !owner ? 'Owner-managed' : `<div class="actions-cell"><button class="btn btn-ghost btn-sm" data-role-id="${esc(u.discord_id)}">Edit</button>${(u.admin || u.viewer || u.herocheck || u.heroshield) ? `<button class="btn btn-danger btn-sm" data-role-revoke="${esc(u.discord_id)}">Revoke</button>` : ''}</div>`}</td></tr>`).join('')}</tbody></table></div></div>`;

    const checked = () => Object.fromEntries([...view.querySelectorAll('input[name="role-perm"]')].map((c) => [c.value, c.checked]));
    const roleShow = wireDuration(view, 'roledur', () => PERM_LIST.filter((x) => checked()[x.k]).map((x) => x.name).join(' + ') || 'No permission');
    const boxEls = [...view.querySelectorAll('input[name="role-perm"]')];
    boxEls.forEach((c) => c.addEventListener('change', () => {
      // Admin and Admin (test) exclude each other
      if (c.checked && (c.value === 'admin' || c.value === 'viewer')) {
        const other = view.querySelector(`input[name="role-perm"][value="${c.value === 'admin' ? 'viewer' : 'admin'}"]`);
        if (other) other.checked = false;
      }
      roleShow();
    }));

    view.querySelectorAll('[data-role-id]').forEach(b => b.addEventListener('click', () => {
      view.querySelector('#role-id').value = b.dataset.roleId;
      const u = users.find(x => String(x.discord_id) === b.dataset.roleId) || {};
      const p = permsOfUser(u);
      boxEls.forEach((c) => { c.checked = !!p[c.value]; });
      roleShow();
      view.querySelector('#role-id').scrollIntoView({ behavior: 'smooth', block: 'center' }); view.querySelector('#role-id').focus();
    }));
    view.querySelectorAll('[data-role-revoke]').forEach(b => b.addEventListener('click', async () => {
      if (!(await modal({ title: 'Revoke access', text: `Remove every dashboard permission for ${b.dataset.roleRevoke}?`, ok: 'Revoke', danger: true }))) return;
      const payload = { discordId: b.dataset.roleRevoke, herocheck: false, heroshield: false, viewer: false };
      if (owner) payload.admin = false;
      try { await api('/api/access', { method: 'POST', body: payload }); toast('Access revoked'); await renderRoleManager(view); } catch (e) { toast(e.message, true); }
    }));
    view.querySelector('#role-save').addEventListener('click', async () => {
      const discordId = view.querySelector('#role-id').value.trim();
      if (!/^\d{15,22}$/.test(discordId)) return toast('Enter a valid Discord user ID', true);
      const c = checked();
      if (c.admin && c.viewer) return toast('Admin and Admin (test) cannot be given together', true);
      if (!Object.values(c).some(Boolean)) return toast('Tick at least one permission (use Revoke to remove everything)', true);
      const payload = { discordId, herocheck: !!c.herocheck, heroshield: !!c.heroshield, viewer: !!c.viewer };
      if (owner) payload.admin = !!c.admin;
      payload.duration = readDuration(view, 'roledur');
      try { await api('/api/access', { method: 'POST', body: payload }); toast('Permissions saved'); await renderRoleManager(view); }
      catch (e) { toast(e.message, true); }
    });
  }

  // ---------- access (admin only): who sees HeRo Shield / HeRo Check ----------
  async function renderAccess(view) {
    view.innerHTML = loading();
    const { users } = await api('/api/access');
    const box = (u, perm) => {
      const fromEnv = perm === 'heroshield' ? u.envHeroshield : u.envHerocheck;
      const label = perm === 'heroshield' ? 'HeRo Shield' : 'HeRo Check';
      if (fromEnv) return `<label title="Set in Render: ${perm === 'heroshield' ? 'HEROSHIELD_IDS' : 'HEROCHECK_IDS'}" style="display:inline-flex;gap:6px;align-items:center;opacity:.85">
        <input type="checkbox" checked disabled> ${label} <span class="badge log" style="font-size:10px">env</span></label>`;
      return `<label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer">
        <input type="checkbox" data-acc="${perm}" data-uid="${esc(u.discord_id)}" ${u[perm] ? 'checked' : ''}> ${label}</label>`;
    };
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Give access</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:12px"><b>HeRo Shield</b> = anticheat tabs (overview, detections, bans, players, logs, live, configuration).
          <b>HeRo Check</b> = screenshare tabs (scanner, scan PINs, Scanner GUI). People appear below after their first login — or add them now by Discord ID.
          IDs you put in Render (<span class="mono">HEROSHIELD_IDS</span> / <span class="mono">HEROCHECK_IDS</span>) show an <span class="badge log" style="font-size:10px">env</span> tag and can only be changed in Render.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <input id="acc-id" class="input" style="flex:1;min-width:200px" placeholder="Discord user ID (e.g. 123456789012345678)">
          <label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="acc-hs"> HeRo Shield</label>
          <label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="acc-hc" checked> HeRo Check</label>
          <button class="btn btn-primary" data-addacc>Save</button>
        </div>
        ${durationPicker('accdur')}
        <p style="color:var(--dim);font-size:12px;margin-top:8px">When the time is over the access stops by itself (the person stays in the list, marked <b>Expired</b>). Every change is written to <b>Activity logs</b>.</p>
      </div>
      <div class="card panel"><h3>Accounts (${users.length})</h3>
        ${users.length ? `<div class="table-wrap"><table><thead><tr><th>User</th><th>Discord ID</th><th>Access</th><th>Time left</th><th>Last login</th><th></th></tr></thead>
          <tbody>${users.map((u) => `<tr>
            <td><div style="display:flex;gap:10px;align-items:center">${u.avatar ? `<img src="${esc(u.avatar)}" alt="" style="width:28px;height:28px;border-radius:50%">` : ''}<b>${esc(u.name) || '<span style="color:var(--dim)">not logged in yet</span>'}</b></div></td>
            <td class="mono">${esc(u.discord_id)}</td>
            <td>${u.admin ? '<span class="badge log">Owner — full access</span>' : `<div style="display:flex;gap:14px;flex-wrap:wrap">${box(u, 'heroshield')}${box(u, 'herocheck')}</div>`}</td>
            <td>${u.owner || u.envHeroshield || u.envHerocheck ? '<span class="badge on">Permanent (env)</span>' : (u.admin || u.heroshield || u.herocheck) ? timeLeft(u.expires_at) + ` <button class="btn btn-ghost btn-sm" data-extend="${esc(u.discord_id)}" title="Set a new duration from now (uses the Duration above)">Set time</button>` : '-'}</td>
            <td class="mono">${u.last_login ? fmtDate(u.last_login) : 'never'}</td>
            <td>${u.admin ? '' : `<button class="btn btn-danger btn-sm" data-delacc="${esc(u.discord_id)}">Remove</button>`}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">Nobody yet. Ask your staff to log in once, or add them by Discord ID.</div>'}
      </div>`;

    const save = async (body, msg) => {
      try { await api('/api/access', { method: 'POST', body }); toast(msg); } catch (e) { toast(e.message, true); }
    };
    const accShow = wireDuration(view, 'accdur', () => [$('#acc-hs')?.checked && 'HeRo Shield', $('#acc-hc')?.checked && 'HeRo Check'].filter(Boolean).join(' + '));
    ['#acc-hs', '#acc-hc'].forEach((q) => view.querySelector(q)?.addEventListener('change', accShow));
    view.querySelectorAll('[data-acc]').forEach((cb) => cb.addEventListener('change', async () => {
      const body = { discordId: cb.dataset.uid, [cb.dataset.acc]: cb.checked };
      if (cb.checked) body.duration = readDuration(view, 'accdur');   // ticking = giving it for the chosen time
      await save(body, 'Access updated'); renderAccess(view);
    }));
    view.querySelectorAll('[data-extend]').forEach((b) => b.addEventListener('click', async () => {
      const u = users.find((x) => String(x.discord_id) === b.dataset.extend) || {};
      const d = readDuration(view, 'accdur');
      await save({ discordId: b.dataset.extend, heroshield: !!u.heroshield, herocheck: !!u.herocheck, duration: d }, d.unit === 'lifetime' ? 'Access is now lifetime' : 'New end time saved');
      renderAccess(view);
    }));
    view.querySelector('[data-addacc]').addEventListener('click', async () => {
      const id = $('#acc-id').value.trim();
      if (!/^\d{5,25}$/.test(id)) return toast('Enter a Discord user ID (numbers only)', true);
      await save({ discordId: id, heroshield: $('#acc-hs').checked, herocheck: $('#acc-hc').checked, duration: readDuration(view, 'accdur') }, 'Saved');
      renderAccess(view);
    });
    view.querySelectorAll('[data-delacc]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await modal({ title: 'Remove access', text: `Remove all access for ${b.dataset.delacc}?`, ok: 'Remove', danger: true }))) return;
      try { await api(`/api/access?id=${encodeURIComponent(b.dataset.delacc)}`, { method: 'DELETE' }); toast('Removed'); renderAccess(view); }
      catch (e) { toast(e.message, true); }
    }));
  }

  // ---------- activity logs (admin): permissions, licenses, PINs, purchases ----------
  const ACT = {
    'permission.grant': ['Permission given', 'on'], 'permission.revoke': ['Permission removed', 'kick'], 'permission.remove': ['Account removed', 'ban'],
    'license.create': ['License created', 'log'], 'license.revoke': ['License revoked', 'kick'], 'pin.create': ['PIN created', 'off'], 'pin.delete': ['PIN deleted', 'off'],
    'plan.purchase': ['Plan bought', 'on'], 'staff.remove': ['Staff removed', 'kick'],
  };
  function auditDetail(l) {
    const d = l.detail || {};
    const bits = [];
    if (d.permissions) bits.push(`<b>${esc([].concat(d.permissions).join(', '))}</b>`);
    if (d.had) bits.push(`had ${esc([].concat(d.had).join(', ') || 'nothing')}`);
    if (d.duration) bits.push(d.duration === 'lifetime' ? 'lifetime' : `for ${esc(d.duration)}`);
    if (d.expires_at) bits.push(`until ${esc(fmtDate(d.expires_at))}`);
    if (d.via) bits.push(`via ${esc(d.via)}`);
    if (d.label) bits.push(`“${esc(d.label)}”`);
    if (d.key_end) bits.push(`key …${esc(d.key_end)}`);
    if (d.pin) bits.push(`PIN <span class="mono">${esc(d.pin)}</span>`);
    if (d.player) bits.push(`player ${esc(d.player)}`);
    if (d.license) bits.push(`license ${esc(d.license)}`);
    if (d.plan) bits.push(`plan ${esc(d.plan)}`);
    return bits.join(' · ');
  }
  async function renderAuditLogs(view) {
    const f = state.auditFilter || '', q = state.auditQ || '';
    view.innerHTML = loading();
    const { logs } = await api(`/api/audit-logs?limit=400${f ? '&action=' + encodeURIComponent(f) : ''}${q ? '&q=' + encodeURIComponent(q) : ''}`);
    const who = (id, name) => id ? `${name ? `<b>${esc(name)}</b> ` : ''}<span class="mono" style="color:var(--dim)">${esc(id)}</span>` : '<span style="color:var(--dim)">system</span>';
    view.innerHTML = `<div class="workspace-hero"><div><h2>Activity logs</h2><p>Every permission given or removed, every license and PIN created — who did it and when.</p></div></div>
      <div class="card panel" style="margin-bottom:18px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        ${[['', 'All'], ['permission', 'Permissions'], ['license', 'Licenses'], ['pin', 'PINs'], ['plan', 'Purchases']].map(([v, l]) => `<button class="btn ${f === v ? 'btn-primary' : 'btn-ghost'} btn-sm" data-auditf="${v}">${l}</button>`).join('')}
        <input class="input" id="audit-q" placeholder="Discord ID or name" value="${esc(q)}" style="flex:1;min-width:200px">
        <button class="btn btn-ghost btn-sm" data-auditsearch>Search</button>
      </div></div>
      <div class="card panel"><h3>${logs.length} entries</h3>
        ${logs.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>By</th><th>For</th><th>Details</th></tr></thead><tbody>
          ${logs.map((l) => { const a = ACT[l.action] || [l.action, 'off']; return `<tr>
            <td class="mono">${fmtDate(l.created_at)}</td><td><span class="badge ${a[1]}">${esc(a[0])}</span></td>
            <td>${who(l.actor_discord, l.actor_name)}</td><td>${who(l.target_discord, l.target_name)}</td><td style="font-size:13px">${auditDetail(l)}</td></tr>`; }).join('')}
        </tbody></table></div>` : '<div class="empty">Nothing logged yet.</div>'}</div>`;
    view.querySelectorAll('[data-auditf]').forEach((b) => b.addEventListener('click', () => { state.auditFilter = b.dataset.auditf; renderAuditLogs(view).catch((e) => toast(e.message, true)); }));
    const search = () => { state.auditQ = view.querySelector('#audit-q').value.trim(); renderAuditLogs(view).catch((e) => toast(e.message, true)); };
    view.querySelector('[data-auditsearch]').addEventListener('click', search);
    view.querySelector('#audit-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
  }

  function renderServers(view) {
    const cards = state.servers.map((s) => {
      const on = s.last_seen && Date.now() - new Date(s.last_seen) < 5 * 60000;
      return `<div class="card server-card">
        <h4>${esc(s.name)} <span class="badge ${on ? 'on' : 'off'}">${on ? '● Online' : 'Seen ' + ago(s.last_seen)}</span></h4>
        <div>
          <div class="side-label" style="padding:0 0 6px">License key</div>
          <div class="license-box">
            <code data-lic>${esc(s.license)}</code>
            <button class="btn btn-ghost btn-sm" data-show>Show</button>
            <button class="btn btn-ghost btn-sm" data-copy="${esc(s.license)}">Copy</button>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-open="${s.id}">Open</button>
          <button class="btn btn-ghost btn-sm" data-regen="${s.id}">New key</button>
          <button class="btn btn-danger btn-sm" data-del="${s.id}">Delete</button>
        </div>
      </div>`;
    }).join('');
    view.innerHTML = `
      <div style="margin-bottom:18px"><button class="btn btn-primary" data-add>+ Add server</button></div>
      ${state.servers.length ? `<div class="server-cards">${cards}</div>` : '<div class="card empty">Add your first server to get a license key.</div>'}
      <div class="card panel" style="margin-top:18px">
        <h3>Setup</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:10px">Paste your key in <b>heroshield/shared/config.lua</b> and restart the resource:</p>
        <div class="license-box"><code class="show">Config.LicenseKey = 'HS-XXXXXX-XXXXXX-XXXXXX-XXXXXX'</code></div>
      </div>`;
  }

  // ---------- viewer (live view + proof replay) ----------
  const viewer = { timer: null, play: null, frames: [], index: 0 };

  function openViewer(title, sub) {
    closeViewer(true);
    viewer.frames = [];
    viewer.index = 0;
    if ($('#viewer-warn')) $('#viewer-warn').hidden = true;
    $('#viewer-title').textContent = title;
    $('#viewer-sub').textContent = sub || '';
    $('#viewer-img').className = '';
    $('#viewer-img').removeAttribute('src');
    $('#viewer-empty').textContent = 'Loading...';
    $('#viewer-badge').textContent = '';
    $('#viewer-badge').className = 'viewer-badge';
    $('#viewer-controls').innerHTML = '';
    $('#viewer').classList.add('open');
  }

  function closeViewer(keepOpen) {
    clearInterval(viewer.timer); viewer.timer = null;
    clearInterval(viewer.play); viewer.play = null;
    if (!keepOpen) $('#viewer').classList.remove('open');
  }

  // true if the picture is almost fully black
  function isBlack(img) {
    try {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 18;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 32, 18);
      const d = ctx.getImageData(0, 0, 32, 18).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / (d.length / 4) / 3 < 6;
    } catch { return false; }
  }

  function showImage(url) {
    const img = $('#viewer-img');
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      img.className = 'on';
      $('#viewer-empty').textContent = '';
      const warn = $('#viewer-warn');
      if (warn) warn.hidden = !isBlack(img);
    };
    img.onerror = () => {};
    img.src = url;
  }

  async function startLive(identifier, name) {
    openViewer(`Live view - ${name}`, 'New screenshot every few seconds.');
    $('#viewer-badge').textContent = '● LIVE';
    $('#viewer-badge').className = 'viewer-badge live';
    $('#viewer-empty').textContent = 'Waiting for the player screen... (can take ~10s)';
    let lastAt = null;
    let waiting = false;
    const tick = async () => {
      if (waiting) return;
      waiting = true;
      try {
        await api('/api/command', { method: 'POST', body: { server: state.server, type: 'screenshot', identifier } });
        // wait for a new image (max ~12s)
        for (let i = 0; i < 8 && viewer.timer; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const live = await api(`/api/live?server=${state.server}&identifier=${encodeURIComponent(identifier)}`);
          if (live.url && live.at !== lastAt) {
            lastAt = live.at;
            showImage(live.url);
            $('#viewer-sub').textContent = live.size < 15000
              ? 'Screen looks black: the player game is minimized / alt-tabbed, or use the screencapture resource.'
              : `Updated ${new Date(live.at).toLocaleTimeString('en-GB')}`;
            break;
          }
        }
      } catch (e) {
        $('#viewer-empty').textContent = e.message;
      }
      waiting = false;
    };
    viewer.timer = setInterval(tick, 4000);
    tick();
  }

  function setFrame(i) {
    viewer.index = Math.max(0, Math.min(viewer.frames.length - 1, i));
    const f = viewer.frames[viewer.index];
    showImage(f.url);
    $('#viewer-badge').textContent = f.label;
    const range = $('#replay-range');
    if (range) range.value = viewer.index;
    const t = $('#replay-time');
    if (t) t.textContent = f.time;
    $$('.thumbs img').forEach((el, n) => el.classList.toggle('active', n === viewer.index));
  }

  async function openProof(banId, name) {
    openViewer(`Proof - ${banId}`, name);
    try {
      const { shots, replay, interval = 8 } = await api(`/api/proof?server=${state.server}&banId=${encodeURIComponent(banId)}`);
      const fmt = (sec) => `-${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      viewer.frames = replay.map((url, i) => ({ url, label: '● REPLAY', time: fmt((replay.length - i) * interval) }));
      shots.forEach((url, i) => viewer.frames.push({ url, label: shots.length > 1 ? `BAN MOMENT ${i + 1}/${shots.length}` : 'BAN MOMENT', time: '0:00' }));
      if (!viewer.frames.length) {
        $('#viewer-empty').innerHTML = 'No proof saved for this ban.<br><small>Needs screencapture or screenshot-basic started on your server, and the dashboard (or Config.Screenshot.UploadUrl) reachable at ban time.</small>';
        return;
      }
      $('#viewer-sub').textContent = `${name} • ${replay.length ? `replay ${fmt(replay.length * interval).slice(1)} before ban` : 'no replay (player banned too soon after joining)'}`;
      $('#viewer-controls').innerHTML = `
        <button class="btn btn-ghost btn-sm" data-rp="prev">◀</button>
        <button class="btn btn-primary btn-sm" data-rp="play">▶ Play</button>
        <button class="btn btn-ghost btn-sm" data-rp="next">▶</button>
        <button class="btn btn-ghost btn-sm" data-rp="speed">1x</button>
        <input id="replay-range" type="range" min="0" max="${viewer.frames.length - 1}" value="0">
        <span id="replay-time" class="time"></span>
        <div class="thumbs" style="width:100%">${viewer.frames.map((f) => `<img src="${esc(f.url)}" alt="" loading="lazy">`).join('')}</div>`;
      $('#replay-range').oninput = (e) => setFrame(Number(e.target.value));
      $$('.thumbs img').forEach((el, n) => { el.onclick = () => setFrame(n); });
      setFrame(0);
      // preload all frames then autoplay like a video
      viewer.frames.forEach((f) => { const i = new Image(); i.src = f.url; });
      if (replay.length) setTimeout(() => { const b = document.querySelector('[data-rp="play"]'); if (b && !viewer.play) replayControl('play', b); }, 600);
    } catch (e) {
      $('#viewer-empty').textContent = e.message;
    }
  }

  function replayControl(action, btn) {
    if (action === 'speed') {
      viewer.speed = viewer.speed === 4 ? 1 : (viewer.speed || 1) * 2;
      btn.textContent = `${viewer.speed}x`;
      if (viewer.play) { const p = document.querySelector('[data-rp="play"]'); clearInterval(viewer.play); viewer.play = null; replayControl('play', p); }
      return;
    }
    if (action === 'prev') return setFrame(viewer.index - 1);
    if (action === 'next') return setFrame(viewer.index + 1);
    if (viewer.play) {
      clearInterval(viewer.play); viewer.play = null;
      btn.textContent = '▶ Play';
      return;
    }
    if (viewer.index >= viewer.frames.length - 1) setFrame(0);
    btn.textContent = '❚❚ Pause';
    viewer.play = setInterval(() => {
      if (viewer.index >= viewer.frames.length - 1) {
        clearInterval(viewer.play); viewer.play = null;
        btn.textContent = '▶ Play';
        return;
      }
      setFrame(viewer.index + 1);
    }, 700 / (viewer.speed || 1));
  }

  // ---------- events ----------
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-go]');
    if (!t) return;

    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.dataset.cat !== undefined) { state.cat = t.dataset.cat; return render(); }
    if (t.dataset.closeViewer !== undefined) return closeViewer();
    if (t.dataset.rp) return replayControl(t.dataset.rp, t);
    if (t.dataset.live) return startLive(t.dataset.live, t.dataset.name);
    if (t.dataset.proof) return openProof(t.dataset.proof, t.dataset.name);
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.viewpin) return renderPinReport($('#view'), t.dataset.viewpin);
    if (t.dataset.lookuppin !== undefined) {
      const code = ($('#pin-lookup').value || '').trim().toUpperCase();
      if (!code) return toast('Enter a PIN', true);
      const found = (state.pins || []).find((p) => p.pin === code);
      if (!found) return toast('No PIN like that on this server', true);
      if (!(found.used && found.report)) return toast('No result yet for ' + code + ' — the player has not finished the scan', true);
      return renderPinReport($('#view'), code);
    }
    if (t.dataset.sgsave !== undefined) {
      if (!state.scannewbg) return toast('Choose an image first', true);
      t.disabled = true; t.textContent = 'Saving…';
      try { await api('/api/scanner-bg', { method: 'POST', body: { license_id: state.guiLicenseId, image: state.scannewbg } });
        toast('Background saved — it shows on every PIN'); state.scannewbg = null; renderScannerGui($('#view')); }
      catch (e) { toast(e.message, true); t.disabled = false; t.textContent = 'Save background'; }
      return;
    }
    if (t.dataset.sgremove !== undefined) {
      try { await api(`/api/scanner-bg?license_id=${encodeURIComponent(state.guiLicenseId)}`, { method: 'DELETE' }); toast('Background removed'); renderScannerGui($('#view')); }
      catch (e) { toast(e.message, true); }
      return;
    }
    if (t.dataset.disccheck !== undefined) {
      const id = ($('#disc-id').value || '').replace(/[^0-9]/g, '');
      if (!id) return toast('Enter a Discord ID', true);
      return runDiscordCheck(id);
    }
    if (t.dataset.discinvest !== undefined) {
      const id = ($('#disc-id2').value || '').replace(/[^0-9]/g, '');
      if (!id) return toast('Enter a Discord ID', true);
      return runDiscordInvestigate(id);
    }
    if (t.dataset.delpin) {
      const code = t.dataset.delpinCode || '';
      if (!(await modal({ title: 'Delete PIN', text: `Delete the pending PIN ${code}? The player will not be able to use it any more.`, ok: 'Delete', danger: true }))) return;
      try {
        await api(`/api/pins?id=${encodeURIComponent(t.dataset.delpin)}`, { method: 'DELETE' });
        toast('PIN deleted');
        if (state.pinsResp) state.pinsResp = { ...state.pinsResp, pins: (state.pinsResp.pins || []).filter((p) => String(p.id) !== t.dataset.delpin) };
        await renderPins($('#view'));
      } catch (e) { toast(e.message, true); }
      return;
    }
    if (t.dataset.copypin) {
      try { await navigator.clipboard.writeText(t.dataset.copypin); toast(t.dataset.copypin.includes('/') ? 'Link copied' : 'PIN copied'); } catch { toast('Copy failed', true); }
      return;
    }

    if (t.dataset.show !== undefined) {
      const code = t.parentElement.querySelector('[data-lic]');
      code.classList.toggle('show');
      t.textContent = code.classList.contains('show') ? 'Hide' : 'Show';
      return;
    }
    if (t.dataset.copy) {
      try { await navigator.clipboard.writeText(t.dataset.copy); toast('Key copied'); } catch { toast('Copy failed', true); }
      return;
    }
    if (t.dataset.open) {
      state.server = t.dataset.open;
      try { localStorage.setItem('hs_server', state.server); } catch {}
      $('#server-select').value = state.server;
      return go('overview');
    }
    if (t.dataset.reset !== undefined) {
      $$('[data-det]').forEach((row) => {
        const d = DETECTIONS.find((x) => x.name === row.dataset.det);
        row.querySelector('[data-f="enabled"]').checked = d.enabled;
        row.querySelector('[data-f="action"]').value = d.action;
        const v = row.querySelector('[data-f="value"]');
        if (v) v.value = d.value;
      });
      toast('Defaults loaded - click Save');
      return;
    }

    try {
      if (t.dataset.save !== undefined) {
        t.disabled = true;
        await api('/api/settings', { method: 'POST', body: { server: state.server, settings: readSettings() } });
        t.disabled = false;
        toast('Settings saved');
      } else if (t.dataset.add !== undefined) {
        const name = await modal({ title: 'New server', text: 'Give your FiveM server a name.', input: true, ok: 'Create' });
        if (!name) return;
        const { server } = await api('/api/servers', { method: 'POST', body: { name } });
        state.server = server.id;
        // Scanner-only workspace does not require a FiveM server.
    state.servers = []; state.server = null;
        toast('Server created');
        render();
      } else if (t.dataset.regen) {
        const ok = await modal({ title: 'Create a new key?', text: 'The old key will stop working. Put the new one in config.lua.', ok: 'New key', danger: true });
        if (!ok) return;
        await api('/api/servers', { method: 'PATCH', body: { id: t.dataset.regen } });
        // Scanner-only workspace does not require a FiveM server.
    state.servers = []; state.server = null;
        toast('New key created');
        render();
      } else if (t.dataset.del) {
        const ok = await modal({ title: 'Delete this server?', text: 'All its detections, bans and players will be deleted.', ok: 'Delete', danger: true });
        if (!ok) return;
        await api(`/api/servers?id=${t.dataset.del}`, { method: 'DELETE' });
        // Scanner-only workspace does not require a FiveM server.
    state.servers = []; state.server = null;
        toast('Server deleted');
        render();
      } else if (t.dataset.unban) {
        const ok = await modal({ title: `Unban ${t.dataset.unban}?`, text: 'The player can join again within 1 minute.', ok: 'Unban' });
        if (!ok) return;
        t.disabled = true;
        await api('/api/unban', { method: 'POST', body: { server: state.server, banId: t.dataset.unban } });
        toast('Player unbanned');
        render();
      } else if (t.dataset.act) {
        const action = t.dataset.act;
        const reason = await modal({
          title: `${action === 'ban' ? 'Ban' : 'Kick'} ${t.dataset.name}?`,
          text: 'Reason (shown to the player). Admins cannot be punished.',
          input: true, value: action === 'ban' ? 'Cheating' : 'Kicked by staff', ok: action === 'ban' ? 'Ban' : 'Kick', danger: true,
        });
        if (!reason) return;
        await api('/api/command', { method: 'POST', body: { server: state.server, type: action, identifier: t.dataset.id, reason } });
        toast(`${action === 'ban' ? 'Ban' : 'Kick'} sent - done in a few seconds`);
      } else if (t.dataset.revokelicense !== undefined) {
        if(!confirm('Revoke this license? Its unused scan PINs will stop working.')) return;
        await api('/api/scanner-licenses',{method:'DELETE',body:{id:t.dataset.revokelicense}});
        toast('License revoked'); await renderSubscription($('#view'));
      } else if (t.dataset.useLicense !== undefined) {
        state.selectedLicense=t.dataset.useLicense; go('pins');
      } else if (t.dataset.saveprofile !== undefined) {
        await api('/api/leaderboard-optin',{method:'POST',body:{opted_in:!!$('#profile-optin')?.checked}});
        toast('Profile settings saved');
      } else if (t.dataset.pingame !== undefined) {
        // instant: just move the selection, no reload
        state.pinGame = t.dataset.pingame;
        $$('[data-pingame]').forEach((b) => { const on = b.dataset.pingame === state.pinGame; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        const gb = $('[data-newpin]'); if (gb) gb.textContent = `Generate ${gameOf(state.pinGame).name} PIN`;
      } else if (t.dataset.newpin !== undefined) {
        t.disabled = true;
        const player = $('#pin-player').value.trim();
        let pin;
        try { ({ pin } = await api('/api/pins', { method: 'POST', body: { license_id: $('#pin-license')?.value, player, game: state.pinGame || 'fivem' } })); }
        catch (err) { t.disabled = false; throw err; }
        t.disabled = false;pinSound();
        if ($('#pin-player')) $('#pin-player').value = '';
        await renderPins($('#view'));   // the new PIN appears in "Recent PINs" right away
        const out = $('#pin-out');
        out.hidden = false;
        const dl = `${location.origin}/dl/${pin.pin}`;
        out.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">${gameIcon(pin.game, 16)}<b>${esc(gameOf(pin.game).name)} PIN</b></div>
          <div style="color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.06em;margin-bottom:6px">DOWNLOAD LINK — SEND THIS TO THE PLAYER</div>
          <div class="license-box"><code class="show" style="font-size:15px;color:var(--cyan)">${esc(dl)}</code>
            <button class="btn btn-primary btn-sm" data-copypin="${esc(dl)}">Copy link</button></div>
          <p style="color:var(--muted);font-size:13px;margin-top:8px">The player opens the link, the scanner downloads with the PIN already inside — he just runs it and clicks Accept.</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:var(--dim);font-size:12.5px;align-items:center">
            <span>PIN <b class="mono" style="color:var(--text);letter-spacing:2px">${esc(pin.pin)}</b></span>
            <button class="btn btn-ghost btn-sm" data-copypin="${esc(pin.pin)}">Copy PIN</button>
            <button class="btn btn-ghost btn-sm" data-copypin="${esc(location.origin)}/verify?pin=${esc(pin.pin)}">Copy Discord link</button>
          </div>`;
      } else if (t.dataset.addsig !== undefined) {
        const name = $('#sig-name').value.trim();
        const fileNames = $('#sig-files').value.trim();
        const hashes = ($('#sig-hashes')?.value || '').trim();
        const domains = ($('#sig-domains')?.value || '').trim();
        // A name on its own matches nothing - the scanner looks for files, hashes and domains,
        // not for the label. Refusing here is kinder than saving a signature that can never fire.
        if (!name) { toast('Give the cheat a name', true); return; }
        if (!fileNames && !hashes && !domains) { toast('Add at least a file name, a hash or a domain - a name alone matches nothing', true); return; }
        const sg = $('#sig-game')?.value || '';
        await api('/api/signatures', { method: 'POST', body: { name, fileNames, hashes, domains, features: $('#sig-feats').value.trim(), severity: $('#sig-sev').value, games: sg ? [sg] : [] } });
        toast('Signature added');
        render();
      } else if (t.dataset.sigpick !== undefined) {
        $('#sig-file')?.click();
      } else if (t.dataset.sigimport !== undefined) {
        $('#sig-import')?.click();
      } else if (t.dataset.sigexport) {
        const { signatures } = await api('/api/signatures');
        if (!signatures || !signatures.length) { toast('Nothing to export yet', true); return; }
        exportSignatures(signatures, t.dataset.sigexport);
      } else if (t.dataset.sigpaste !== undefined) {
        const bulk = parseSigText($('#sig-paste')?.value || '');
        if (!bulk.length) { toast('Nothing usable in that - each line needs a file name, a hash or a domain', true); return; }
        await api('/api/signatures', { method: 'POST', body: { bulk } });
        toast(`Added ${bulk.length} signature${bulk.length > 1 ? 's' : ''}`);
        render();
      } else if (t.dataset.delsig) {
        await api(`/api/signatures?id=${encodeURIComponent(t.dataset.delsig)}`, { method: 'DELETE' });
        render();
      } else if (t.dataset.addstaff !== undefined) {
        const name = $('#staff-name').value.trim();
        if (!name) { toast('Name required', true); return; }
        await api('/api/staff', { method: 'POST', body: { name, discordId: $('#staff-did').value.trim(), role: $('#staff-role').value } });
        toast('Staff added');
        render();
      } else if (t.dataset.delstaff) {
        await api(`/api/staff?id=${encodeURIComponent(t.dataset.delstaff)}`, { method: 'DELETE' });
        render();
      } else if (t.id === 'refresh') {
        // Scanner-only workspace does not require a FiveM server.
    state.servers = []; state.server = null;
        render();
      }
    } catch (err) {
      t.disabled = false;
      toast(err.message, true);
    }
  });

  $('#server-select').addEventListener('change', (e) => {
    state.server = e.target.value;
    try { localStorage.setItem('hs_server', state.server); } catch {}
    render();
  });

  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 300);
  });

  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal-cancel').click(); });
  $('#viewer').addEventListener('click', (e) => { if (e.target.id === 'viewer') closeViewer(); });
  document.addEventListener('keydown', (e) => {
    if (!$('#viewer').classList.contains('open')) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft' && viewer.frames.length) setFrame(viewer.index - 1);
    if (e.key === 'ArrowRight' && viewer.frames.length) setFrame(viewer.index + 1);
  });

  setInterval(() => { if (!$('#app').hidden && state.tab === 'overview' && !document.hidden) render(); }, 30000);

  init();
})();

// Allow retry after an owner grants a permission without requiring a new Discord OAuth login.
document.getElementById('retry-access')?.addEventListener('click', () => location.reload());
