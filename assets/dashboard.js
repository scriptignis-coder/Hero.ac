// HeRo Shield dashboard
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const state = { user: null, servers: [], server: null, tab: 'pins', q: '', cat: '' };
  try { state.server = localStorage.getItem('hs_server'); } catch {}

  const TITLES = {
    overview: 'Overview', detections: 'Detections', bans: 'Bans', players: 'Players', logs: 'Logs',
    settings: 'Configuration', stream: 'Multi Stream', servers: 'My servers',
    rolemanager: 'Permission Manager', scanner: 'Download scanner', pins: 'Scan PINs', signatures: 'Signatures', staff: 'Staff team', access: 'Access',
    discord: 'Discord check', scannergui: 'Scanner GUI', tutorial: 'Tutorial', changelogs: 'Changelogs',
    auditlogs: 'Activity logs', troubleshooting: 'Troubleshooting', profile: 'My Profile', subscription: 'My License', analytics: 'Analytics', scanactivity: 'Scan Activity', ranking: 'Leaderboard', quicktools: 'Quick Tools', teamdirectory: 'Team Directory',
  };
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

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await r.json(); } catch {}
    if (r.status === 401 && !path.includes('/api/me')) { showLogin(); throw new Error('Not logged in'); }
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
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
      $('#login-error').textContent = `Discord login OK (ID: ${state.user.id}), but no Admin / HeRoCheck role was found. Ask the owner to grant your Discord ID in Permission Manager, or check ADMIN_DISCORD_IDS / HEROCHECK_IDS on the deployed backend. After the update, click Check access again.`;
      $('#login-error').hidden = false;
      const retry = document.getElementById('retry-access');
      if (retry) retry.hidden = false;
      return;
    }
    const retry = document.getElementById('retry-access');
    if (retry) retry.hidden = true;
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
      bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#1b2440;color:#cfe3ff;border:1px solid #2f9bff;border-radius:12px;padding:10px 16px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45);max-width:calc(100vw - 32px);text-align:center';
      document.body.appendChild(bar);
      const st = document.createElement('style');
      st.textContent = 'body.view-only main .btn-primary,body.view-only main .btn-danger,body.view-only main button[type=submit]{opacity:.45;cursor:not-allowed}';
      document.head.appendChild(st);
    }
    // Permission-based tab visibility
    state.access = acc;
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
    analytics:'heroshield', scanactivity:'herocheck', access:'admin', rolemanager:'admin', staff:'admin', teamdirectory:'admin', auditlogs:'admin'
  };
  function canAccess(tab) {
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

  async function render() {
    const view = $('#view');
    
    if (state.tab === 'teamdirectory') return renderTeamDirectory(view);
    if (state.tab === 'profile') return renderProfile(view);
    if (state.tab === 'subscription') return renderSubscription(view);
    if (state.tab === 'ranking') return renderRanking(view);
    if (state.tab === 'scanactivity') return renderScanActivity(view);
    // Server analytics are intentionally not exposed in scanner-only mode.
    // FiveM server management is not part of this scanner-only workspace.
    if (state.tab === 'scanner') return renderScanner(view);
    if (state.tab === 'pins') { view.innerHTML = loading(); try { await renderPins(view); } catch(e) { wsError(view,e); } return; }
    if (state.tab === 'discord') { view.innerHTML = loading(); try { await renderDiscordCheck(view); } catch(e) { wsError(view,e); } return; }
    if (state.tab === 'scannergui') { view.innerHTML = loading(); try { await renderScannerGui(view); } catch(e) { wsError(view,e); } return; }
    if (state.tab === 'signatures') return renderSignatures(view);
    if (state.tab === 'staff') return renderStaff(view);
    if (state.tab === 'tutorial') return renderTutorial(view);
    if (state.tab === 'troubleshooting') return renderTroubleshooting(view);
    if (state.tab === 'changelogs') return renderChangelogs(view);
    if (state.tab === 'rolemanager') return renderRoleManager(view).catch((e) => { view.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
    if (state.tab === 'access') return renderAccess(view).catch((e) => { view.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
    if (state.tab === 'auditlogs') return renderAuditLogs(view).catch((e) => { view.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
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
      view.innerHTML = `<div class="card empty">${esc(e.message)}</div>`;
    }
  }


  // Workspace pages use existing authenticated endpoints, never client-side fake counters.
  function wsError(view, e) { view.innerHTML = `<div class="workspace-section">${esc(e.message || 'Could not load data')}</div>`; }
  function wsAvatar(user) { return user.avatar ? `<img class="workspace-avatar" src="${esc(user.avatar)}" alt="Discord avatar" referrerpolicy="no-referrer">` : `<div class="workspace-avatar-fallback">${esc((user.name || '?')[0])}</div>`; }
  function wsHero(user, sub) { return `<div class="workspace-hero">${wsAvatar(user)}<div><h2>${esc(user.name || 'Discord user')}</h2><p>Discord account · ${esc(user.id)}</p>${sub ? `<p>${sub}</p>` : ''}</div></div>`; }
  function wsStat(label, value) { return `<div class="workspace-card"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`; }
  function wsAccess() { const a=state.user.access || {}; if (a.viewer) return 'Admin (test) — view only'; return [a.admin&&'Admin',a.heroshield&&'Legacy HeRoShield role',a.herocheck&&'HeRoCheck'].filter(Boolean).join(' · ') || 'No staff permissions'; }
  async function renderProfile(view) {
    view.innerHTML=loading();
    try {
      const billing=await api('/api/billing-status');
      view.innerHTML=wsHero(state.user,'Your connected Discord identity')+`<div class="workspace-grid">${wsStat('Staff permissions',wsAccess())}${wsStat('Scanner access',(state.access?.herocheck || state.access?.admin)?'Granted':'Not granted')}${wsStat('Access time', state.user?.expires_at ? (Date.parse(state.user.expires_at) > Date.now() ? 'Until ' + fmtDate(state.user.expires_at) : 'Expired') : 'Lifetime')}${wsStat('License',billing.staffAccess?'Staff access (no payment)':billing.active?(billing.lifetime?'Lifetime':'Active'):'Inactive')}</div><div class="workspace-section"><h3>Account details</h3><p class="workspace-note">Your profile and avatar come from your authenticated Discord session. Permissions are managed by the HeRoShield administrator; a purchase does not grant staff privileges.</p><div class="workspace-actions"><button class="btn btn-primary" data-go="subscription">View license</button><button class="btn btn-ghost" data-go="pins">Scan PINs</button><a class="btn btn-ghost" href="/api/auth/logout">Log out</a></div></div>`;
      const opt=await api('/api/leaderboard-optin');
      view.innerHTML+=`<div class="workspace-section"><h3>Profile settings</h3><p class="workspace-note">Your name and avatar sync from Discord. Control whether your profile appears in the public leaderboard.</p><label style="display:flex;gap:12px;align-items:center"><input type="checkbox" id="profile-optin" ${opt.opted_in?'checked':''}> Show my Discord name/avatar on the leaderboard</label><div class="workspace-actions"><button class="btn btn-primary" data-saveprofile>Save settings</button></div></div>`;
    } catch(e){wsError(view,e);}
  }
  async function renderSubscription(view) {
    view.innerHTML=loading();
    try {
      const [b, data] = await Promise.all([api('/api/billing-status'), api('/api/scanner-licenses')]);
      const licenses=data.licenses||[];
      view.innerHTML=`<div class="workspace-hero"><div><h2>My Scanner Licenses</h2><p>Generate a scanner license and use it to create scan PINs.</p></div></div>
      <div class="workspace-grid">${wsStat('Access',b.staffAccess?'Staff role':b.active?'Paid plan active':'Inactive')}${wsStat('Licenses',licenses.length)}${wsStat('Scanner access',(state.access?.admin||state.access?.herocheck)?'Granted':'Check your subscription')}</div>
      <div class="workspace-section"><h3>Create scanner license</h3><p class="workspace-note">Each license belongs to your Discord account. Only you can manage its PINs.</p><div class="workspace-actions"><input class="input" id="license-label" placeholder="License name (e.g. Screenshare Team)" maxlength="80"><button class="btn btn-primary" data-createlicense>Create license</button></div></div>
      <div class="workspace-section"><h3>Your licenses</h3>${licenses.length?licenses.map(l=>`<div class="workspace-card" style="margin:12px 0"><strong>${esc(l.label)}</strong><p class="workspace-note">${l.revoked_at?'Revoked':'Active'} · Created ${fmtDate(l.created_at)}</p><div class="workspace-actions"><code>${esc(l.license_key)}</code><button class="btn btn-ghost btn-sm" data-copypin="${esc(l.license_key)}">Copy</button>${!l.revoked_at?`<button class="btn btn-primary btn-sm" data-use-license="${esc(l.id)}">Use for Scan PINs</button><button class="btn btn-ghost btn-sm" data-revokelicense="${esc(l.id)}">Revoke</button>`:''}</div></div>`).join(''):'<p class="workspace-note">No licenses yet. Create your first license above.</p>'}</div>`;
    } catch(e){wsError(view,e);}
  }
  async function renderAnalytics(view) {
    view.innerHTML=loading();
    if(!state.server) {view.innerHTML='<div class="workspace-section">Select a server to view analytics.</div>';return;}
    try {
      const d=await api(`/api/data?server=${encodeURIComponent(state.server)}&type=overview`);
      const days=d.days||[],max=Math.max(1,...days.map(x=>Number(x.count)||0));
      view.innerHTML=`<div class="workspace-hero"><div><h2>Server Analytics</h2><p>Live statistics from your selected server</p></div></div><div class="workspace-grid">${wsStat('Detections',fmtNum(d.stats?.detections))}${wsStat('Active bans',fmtNum(d.stats?.bans))}${wsStat('Unique players',fmtNum(d.stats?.players))}</div><div class="workspace-section"><h3>Last 7 days</h3><div class="bars">${days.map(x=>`<div class="bar-col"><b>${fmtNum(x.count)}</b><div class="bar" style="height:${Math.round(Number(x.count||0)/max*100)}%"></div><small>${esc(x.day)}</small></div>`).join('')}</div></div><div class="workspace-section"><h3>Top detection reasons</h3>${(d.top||[]).length?d.top.map(x=>`<div class="top-row"><span>${esc(x.reason)}</span><b>${fmtNum(x.n)}</b></div>`).join(''):'<p class="workspace-note">No detections recorded.</p>'}</div>`;
    }catch(e){wsError(view,e);}
  }
  async function renderScanActivity(view) {
    view.innerHTML=loading();
    try {
      const {pins:all=[]}=await api('/api/pins');
      const used=all.filter(p=>p.used).length;
      view.innerHTML=`<div class="workspace-hero"><div><h2>Scan Activity</h2><p>Your authorized screenshare scan sessions</p></div></div><div class="workspace-grid">${wsStat('Recent PINs',all.length)}${wsStat('Used PINs',used)}${wsStat('Available PINs',all.length-used)}</div><div class="workspace-section"><h3>Recent sessions</h3><div style="overflow-x:auto"><table class="workspace-table"><thead><tr><th>Server</th><th>PIN</th><th>Player</th><th>Status</th><th>Created</th></tr></thead><tbody>${all.slice(0,40).map(p=>`<tr><td>${esc(p.scanner_licenses?.label||'Scanner')}</td><td class="mono">${esc(p.pin)}</td><td>${esc(p.player||'—')}</td><td>${p.used?'Used':'Available'}</td><td>${fmtDate(p.created_at)}</td></tr>`).join('')||'<tr><td colspan="5">No scans yet</td></tr>'}</tbody></table></div><div class="workspace-actions"><button class="btn btn-primary" data-go="pins">Manage scan PINs</button></div></div>`;
    }catch(e){wsError(view,e);}
  }
  async function renderRanking(view,metric='checks') {
    view.innerHTML=loading();
    try {
      const d=await api(`/api/leaderboard?metric=${metric}`);
      view.innerHTML=`<div class="workspace-hero"><div><h2>Community Leaderboard</h2><p>Only users who opted in are shown. Findings are not proof of cheating.</p></div></div><div class="workspace-actions"><button class="btn ${metric==='checks'?'btn-primary':'btn-ghost'}" data-rank="checks">Top Checks</button><button class="btn ${metric==='findings'?'btn-primary':'btn-ghost'}" data-rank="findings">Top Findings</button></div><div class="workspace-section"><h3>${metric==='checks'?'Most completed checks':'Most reported findings'}</h3><div style="overflow-x:auto"><table class="workspace-table"><thead><tr><th>Rank</th><th>Discord user</th><th>${metric==='checks'?'Checks':'Findings'}</th></tr></thead><tbody>${(d.entries||[]).map((u,i)=>`<tr><td>#${i+1}</td><td style="display:flex;align-items:center;gap:10px">${u.avatar?`<img src="${esc(u.avatar)}" width="32" height="32" style="border-radius:50%" alt="">`:''}${esc(u.name)}</td><td><b>${fmtNum(u.value)}</b></td></tr>`).join('')||'<tr><td colspan="3">No opted-in results yet.</td></tr>'}</tbody></table></div></div>`;
      view.querySelectorAll('[data-rank]').forEach(b=>b.addEventListener('click',()=>renderRanking(view,b.dataset.rank)));
    }catch(e){wsError(view,e);}
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

  async function renderPins(view) {
    const { pins, licenses, quota } = await api('/api/pins');
    state.pins = pins;
    const q = quota || { unlimited: true };
    const quotaHtml = q.unlimited ? '' : `<div class="license-box" style="margin-bottom:12px;justify-content:space-between">
        <span style="font-size:13px">${q.left > 0 ? `<b style="color:var(--green)">${q.left}</b> of ${q.limit} PIN left today` : `<b style="color:var(--red)">Daily limit reached</b> (${q.limit} PIN per day)`}</span>
        <span style="color:var(--dim);font-size:12px">new PIN ${q.left > 0 ? 'available now' : 'after ' + esc(new Date(q.resetAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</span></div>`;
    const activeLicenses=(licenses||[]).filter(l=>!l.revoked_at);
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Generate a scan PIN</h3>
        <p class="workspace-note">Select a scanner license (no FiveM server required).</p>
        ${quotaHtml}
        ${activeLicenses.length?`<select id="pin-license" class="input" style="width:100%;margin-bottom:12px">${activeLicenses.map(l=>`<option value="${esc(l.id)}" ${state.selectedLicense===l.id?'selected':''}>${esc(l.label)} · ${esc(l.license_key)}</option>`).join('')}</select>`:'<p class="workspace-note">No active license. Open My License to create one.</p>'}
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="pin-player" class="input" style="flex:1;min-width:180px" placeholder="Player name (optional)">
          <button class="btn btn-primary" data-newpin ${activeLicenses.length && (q.unlimited || q.left > 0)?'':'disabled'}>Generate PIN</button>
        </div>
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
        ${pins.length ? `<div class="table-wrap"><table><thead><tr><th>PIN</th><th>Player</th><th>Used</th><th>Result</th><th>Date</th><th></th></tr></thead>
          <tbody>${pins.map((p) => `<tr>
            <td class="mono" style="color:var(--cyan);font-size:14px">${esc(p.pin)}</td>
            <td>${esc(p.player) || '-'}${p.discord_check && p.discord_check.user ? ` <span class="badge log" title="${esc(p.discord_check.user.name)}">Discord ✓</span>` : ''}</td>
            <td><span class="badge ${p.used ? 'on' : 'off'}">${p.used ? 'Yes' : 'Pending'}</span></td>
            <td>${p.result ? `<span class="badge ${p.result === 'cheating' ? 'ban' : p.result === 'clean' ? 'on' : 'kick'}">${esc(p.result)}</span>` : '-'}</td>
            <td class="mono">${fmtDate(p.created_at)}</td>
            <td><div class="actions-cell">
              ${p.used && p.report ? `<button class="btn btn-ghost btn-sm" data-viewpin="${esc(p.pin)}">View</button>` : ''}
              ${!p.used ? `<button class="btn btn-ghost btn-sm" data-copypin="${esc(location.origin)}/dl/${esc(p.pin)}">Link</button>` : ''}
              <button class="btn btn-ghost btn-sm" data-copypin="${esc(p.pin)}">Copy</button></div></td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="empty">No PINs yet.</div>'}
      </div>`;
  }

  // ---------- scan report (HeRo Scanner v4) — napse-style ----------
  const METHODS = ['Running now', 'Prefetch', 'BAM', 'Game file', 'Service', 'On disk', 'Recycle bin', 'FiveM plugin',
    'Startup', 'Scheduled task', 'Event log', 'Recent file', 'Network', 'Kernel driver', 'AmCache', 'ShimCache', 'Hidden stream',
    'File journal', 'Inside FiveM', 'Service memory', 'Hardware', 'USB drive', 'Jump list'];
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
    const row = (state.pins || []).find((p) => p.pin === pin);
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
    const tRed = timeline.filter((x) => F(x, 'Level') === 2).length, tOrange = timeline.filter((x) => F(x, 'Level') === 1).length;
    const uOrange = usbs.filter((x) => F(x, 'Level') >= 1).length + dets.filter((d) => F(d, 'Method') === 21).length;
    const jRed2 = jumps.filter((x) => F(x, 'Level') === 2).length, jOrange2 = jumps.filter((x) => F(x, 'Level') === 1).length;
    const hRed = hw.filter((x) => F(x, 'Level') === 2).length, hOrange = hw.filter((x) => F(x, 'Level') === 1).length;
    const mRed = memory.filter((x) => F(x, 'Level') === 2).length, mOrange = memory.filter((x) => F(x, 'Level') === 1).length;
    const startup = L('StartupEntries'), tasks = L('ScheduledTasks'), drivers = L('LoadedDrivers');
    const recent = L('RecentFiles'), conns = L('NetworkConnections'), fw = L('FirewallRules');
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
    const CHEAT_NAME = /\b(cheats?|cheating|hacks?|hacking|hacker|mod ?menus?|executors?|injectors?|spoofers?|hwid|aimbot|triggerbot|silent ?aim|bypass|undetected|eulen|red ?engine|skript(?:\.gg)?|hx ?software|tz ?project|lumia|macho|susano|lynx ?menu|desudo|brutan|kiddions?|cherax|2take1|stand ?menu|ozark|phaze|gosth|keyser|nightfall|hammafia|lua ?(?:menu|executor)|fivem ?(?:menu|mods? ?menu))\b/i;
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
    const fivem = L('FiveM').slice().sort((a, b) => (F(b, 'Level') || 0) - (F(a, 'Level') || 0));
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

    const cats = [
      ['overview', 'Overview', '', 'blue'],
      ['detects', 'Detects', dets.length, 'red'],
      ['timeline', 'Timeline 24h', tRed ? tRed + ' cheat' : tOrange ? tOrange + ' check' : timeline.length || '–', tRed ? 'red' : tOrange ? 'orange' : 'blue'],
      ['integrity', 'Integrity', `${passed}/${integrity.length}`, 'green'],
      ['warnings', 'Warnings', warns.length, 'orange'],
      ['suspicious', 'Suspicious', susp.length, 'yellow'],
      ['entropy', 'Entropy', entropy.length, 'purple'],
      ['fivem', 'FiveM', fivemBad ? fivemBad + ' cheat' : fivem.filter((x) => F(x, 'Kind') !== 'Folder').length, fivemBad ? 'red' : fivemLook ? 'orange' : 'green'],
      ['discord', 'Discord', discRed ? discRed + ' cheat' : discOrange ? discOrange + ' check' : dc ? guilds.length : '–', discRed ? 'red' : discOrange || !dc ? 'orange' : 'blue'],
      'sep',
      ['exec', 'Execution', flaggedRuns.length || executed.length, flaggedRuns.length ? 'red' : 'blue'],
      ['persist', 'Startup & tasks', startup.filter((x) => F(x, 'Suspicious')).length + tasks.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['drivers', 'Drivers', drivers.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['network', 'Network', conns.filter((x) => F(x, 'Suspicious')).length + fw.length, 'orange'],
      ['usb', 'USB drives', uOrange ? uOrange + ' check' : usbs.length || '–', uOrange ? 'orange' : 'blue'],
      ['opened', 'Opened files', jRed2 ? jRed2 + ' cheat' : jOrange2 ? jOrange2 + ' check' : jumps.length || '–', jRed2 ? 'red' : jOrange2 ? 'orange' : 'blue'],
      ['hardware', 'Cheat hardware', hRed ? hRed + ' cheat' : hOrange ? hOrange + ' check' : (R('Hardware') ? '0' : '–'), hRed ? 'red' : hOrange ? 'orange' : 'blue'],
      ['memory', 'Service memory', mRed ? mRed + ' cheat' : mOrange ? mOrange + ' check' : memory.length || '–', mRed ? 'red' : mOrange ? 'orange' : 'blue'],
      ['journal', 'File journal', jRed ? jRed + ' cheat' : jOrange ? jOrange + ' check' : journal.length || '–', jRed ? 'red' : jOrange ? 'orange' : 'blue'],
      ['files', 'Files & mods', deleted.length + recent.filter((x) => F(x, 'Flagged')).length + mods.length, 'blue'],
      ['cmds', 'Commands', cmds.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['events', 'Event log', events.length, 'blue'],
      ['pc', 'PC & accounts', '', 'blue'],
      'sep',
      ['browserhistory', 'Browser Search History', browserHistory.length, 'blue'],
      ['browserdownloads', 'Browser Downloads', browserDownloads.length, 'blue'],
    ];
    tab = tab || (dets.length ? 'detects' : 'overview');
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

      discord: () => {
        const ago = (d) => (d ? fmtDate(d) : '?');
        const icon = (g) => (discordIcon(g) ? `<img src="${esc(discordIcon(g))}" alt="" onerror="this.outerHTML='<div class=&quot;gi&quot;>${esc(((g && g.name) || '?')[0])}</div>'">` : `<div class="gi">${esc(((g && g.name) || '?')[0])}</div>`);
        const gcard = (g, c, tag, sub = '') => `<div class="rp-card ${c}"><div class="rp-guild">${icon(g)}
            <div style="flex:1;min-width:0"><div class="rp-title" style="padding:0">${esc(g.name || 'Unknown server')}</div><div class="mono" style="color:var(--dim);font-size:11px">${esc(g.id || (g.inv ? 'invite discord.gg/' + g.inv : ''))}${g.owner ? ' · owner' : ''}</div>
            ${sub ? `<div style="color:var(--muted);font-size:12px;margin-top:4px">${sub}</div>` : ''}</div>
            ${tag ? `<span class="rp-tag">${tag}</span>` : ''}</div></div>`;
        const legend = state.cheatServers.length ? `Red = in your cheat-server list (${state.cheatServers.length}). Orange = the server name looks like a cheat shop — add its invite on the Discord check page to make it red.` : 'Add cheat-server invite links on the Discord check page — they turn red here. Orange = the server name looks like a cheat shop.';

        // 1) servers he LEFT — from the PC (Discord / browser cache) and from his earlier checks
        const leftCards = [
          ...pastCheat.map((x) => gcard({ id: x.id, name: x.name, inv: x.inv, icon: x.icon }, x.listed ? 'red' : 'orange', x.listed ? 'LEFT · CHEAT SERVER' : 'LEFT · looks like cheat',
            `Not in it any more — found on this PC (${esc(x.src.slice(0, 3).join(', '))}) · last seen ${esc(ago(x.last))}${x.first && x.first !== x.last ? ' · first seen ' + esc(ago(x.first)) : ''}`)),
          ...leftCheat.filter((x) => !pastCheat.some((p) => p.id === x.id)).map((x) => gcard(x, x.listed ? 'red' : 'orange', x.listed ? 'LEFT · CHEAT SERVER' : 'LEFT · looks like cheat',
            byId ? `He was in it at his check of ${esc(ago(x.at))} (PIN ${esc(x.pin)}) — may still be in it` : `He was in it at his check of ${esc(ago(x.at))} (PIN ${esc(x.pin)}) — left since`)),
        ].filter((h) => match(h.replace(/<[^>]+>/g, ' ')));
        const leftSection = head('Cheat servers he LEFT', leftCards.length, 'Leaving a server does not erase it: Discord and the browsers keep the server icons, invite pages and channel links on the PC, and earlier checks keep his old server list.')
          + grid(leftCards, L('DiscordTraces').length || history.length ? 'No cheat server found in his past servers.' : 'No Discord traces on the PC (cache cleared, or an older scanner) and no earlier check.');

        // 2) all servers he was in before but not now (not cheat-looking)
        const otherRows = [
          ...[...leftList.filter((x) => !x.listed && !x.nameHit)].map((x) => rowL('', `<span style="display:inline-flex;align-items:center;gap:10px">${x.icon ? `<img src="https://cdn.discordapp.com/icons/${esc(x.id)}/${esc(x.icon)}.png?size=32" alt="" onerror="this.style.visibility='hidden'" style="width:24px;height:24px;border-radius:50%">` : ''}<b style="color:var(--text)">${esc(x.name)}</b> <span class="mono" style="color:var(--dim)">${esc(x.id)}</span></span>`, 'left after ' + esc(ago(x.at)))),
          ...pastOther.filter((x) => !leftSince.has(x.id)).map((x) => rowL('', `<span style="display:inline-flex;align-items:center;gap:10px">${x.icon ? `<img src="https://cdn.discordapp.com/icons/${esc(x.id)}/${esc(x.icon)}.png?size=32" alt="" onerror="this.style.visibility='hidden'" style="width:24px;height:24px;border-radius:50%">` : `<span style="width:24px;height:24px;border-radius:50%;background:#5865f2;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${esc(((x.name || '?')[0] || '?').toUpperCase())}</span>`}${x.name ? `<b style="color:var(--text)">${esc(x.name)}</b>` : '<span style="color:var(--dim)">Unknown name</span>'} <span class="mono" style="color:var(--dim)">${esc(x.id)}</span></span>`, 'seen on PC ' + esc(ago(x.last)))),
        ].filter((h) => match(h.replace(/<[^>]+>/g, ' ')));
        const otherSection = `<div style="height:18px"></div>` + head('Other servers he is not in now', otherRows.length, 'Servers seen on the PC or in earlier checks that he is not in today. Without a name = only the server ID is known (open discord.com/channels/ID if you share it).')
          + rows(otherRows.slice(0, 300), 'None.');

        const joinedSection = joinedSince.length ? `<div style="height:18px"></div>` + head('Joined since his last check', joinedSince.length, `Servers he is in now but was not in at his check of ${esc(ago(lastHist.discord_check.at || lastHist.created_at))}.`)
          + grid(joinedSince.filter((g) => match(g.name, g.id)).map((g) => gcard(g, cheatIds.has(String(g.id)) ? 'red' : CHEAT_NAME.test(g.name || '') ? 'orange' : 'grey', 'NEW')), '') : '';

        const lookupBox = (title, tag, note) => `<div class="rp-card ${dc ? 'blue' : 'orange'}" style="margin-bottom:16px"><div class="rp-top"><div class="rp-ic">${IC.disc}</div>
            <div class="rp-title">${title}</div><span class="rp-tag">${tag}</span></div>
            <div class="rp-txt">${note}</div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
              <input id="disc-id" class="input mono" style="flex:1;min-width:220px" placeholder="Discord ID (17–20 digits)" value="${esc((dc && dc.source === 'id' && dc.user && dc.user.id) || localDiscord || '')}">
              <button class="btn btn-primary" data-dlookup>Check this Discord</button></div>
            ${localDiscord ? `<div class="rp-txt" style="margin-top:8px">Discord ID read from the PC: <b class="mono">${esc(localDiscord)}</b></div>` : ''}
            <div class="rp-txt" style="color:var(--dim);margin-top:8px">Servers he is in and left are read from the PC (Discord & browser cache) — no login needed. With the ID, the site also gets his profile and checks every server <b>your bot</b> is in. Optional: the player can still log in at <span class="mono">${esc(location.origin)}/verify?pin=${esc(pin)}</span> for his full server list.</div></div>`;
        if (!dc) return lookupBox('Discord check by ID', 'No login needed', 'Type the player\'s Discord ID (or keep the one read from his PC) and click Check.')
          + `<p style="color:var(--dim);font-size:12.5px;margin:-4px 0 14px">${legend}</p>` + leftSection + otherSection;

        const u = dc.user || {};
        const mismatch = localDiscord && u.id && String(localDiscord) !== String(u.id);
        const nowCards = [
          ...cheatGuilds.map((g) => gcard(g, 'red', 'IN NOW · CHEAT SERVER', g.joined ? `Joined ${esc(ago(g.joined))}` : '')),
          ...nameGuilds.map((g) => gcard(g, 'orange', 'IN NOW · looks like cheat', g.joined ? `Joined ${esc(ago(g.joined))}` : '')),
          ...guilds.filter((g) => !cheatIds.has(String(g.id)) && !CHEAT_NAME.test(g.name || '')).map((g) => gcard(g, 'grey', '')),
        ].filter((h) => match(h.replace(/<[^>]+>/g, ' ')));
        return `<div class="rp-card ${discRed ? 'red' : discOrange ? 'orange' : 'green'}" style="margin-bottom:16px"><div class="rp-guild">
            ${u.avatar ? `<img src="${esc(u.avatar)}" alt="" style="border-radius:50%">` : `<div class="gi">${IC.disc}</div>`}
            <div style="flex:1"><div class="rp-title" style="padding:0">${esc(u.name)} <span style="color:var(--dim);font-weight:400">@${esc(u.username)}</span></div>
              <div class="mono" style="color:var(--dim);font-size:11.5px">${esc(u.id)} · account created ${esc((u.created || '').slice(0, 10))} · ${dc.source === 'id' ? 'checked by ID' : 'connected'} ${fmtDate(dc.at)}</div></div>
            <span class="rp-tag">${discRed ? discRed + ' cheat server' + (discRed > 1 ? 's' : '') + ' (now + left)' : discOrange ? discOrange + ' to check' : 'No cheat servers'}</span></div>
            ${mismatch ? `<div class="rp-txt" style="color:#fbbf24">⚠ The Discord logged in on the PC (${esc(localDiscord)}) is NOT the one ${dc.source === 'id' ? 'checked here' : 'connected here'} — the player may be hiding his main account.</div>` : ''}
          </div>
          ${dc.source === 'id' ? lookupBox('Checked by Discord ID', dc.bot ? `${dc.botServers} bot servers checked` : 'No bot set', dc.bot ? 'Profile and the servers your bot is in were checked. Check another ID:' : 'Set DISCORD_BOT_TOKEN on Render to get his profile and the servers your bot is in. The PC traces below work without it.') : ''}
          <p style="color:var(--dim);font-size:12.5px;margin:-4px 0 14px">${legend}</p>
          ${head(dc.source === 'id' ? 'Servers he is in (servers your bot is in)' : 'Servers he is in now', guilds.length)}
          ${grid(nowCards, dc.source === 'id' ? 'He is in none of the servers your bot is in.' : 'The player is in no servers.')}
          <div style="height:18px"></div>${leftSection}${joinedSection}${otherSection}`;
      },

      fivem: () => {
        const lvC = (x) => (F(x, 'Level') === 2 ? 'red' : F(x, 'Level') === 1 ? 'orange' : 'green');
        const lvT = (x) => (F(x, 'Level') === 2 ? 'CHEAT' : F(x, 'Level') === 1 ? 'Check' : 'OK');
        const folders = fivem.filter((x) => F(x, 'Kind') === 'Folder');
        const items = fl(fivem.filter((x) => F(x, 'Kind') !== 'Folder'), 'Kind', 'Name', 'Path', 'Detail', 'Files');
        return head('FiveM files & mods', items.length, 'Every mod in the FiveM folders is opened and read — .rpf archives (weapons.meta, visualsettings, timecycle, nested archives), plugins, scripts and proxy DLLs. Red = cheat mod (also listed in Detects). Orange = changes game settings, check it. Green = normal.')
          + (folders.length ? `<div class="rp-meta" style="margin-bottom:14px">${folders.map((f) => `<span class="rp-chip">${esc(F(f, 'Path') || F(f, 'Name'))}${F(f, 'Detail') ? ' · ' + esc(F(f, 'Detail')) : ''}</span>`).join('')}</div>` : '')
          + grid(items.map((x) => card(lvC(x), lvC(x) === 'green' ? IC.check : IC.alert, esc(F(x, 'Name')), lvT(x),
            `<div class="rp-meta"><span class="rp-chip">${esc(F(x, 'Kind'))}</span>${F(x, 'SizeMb') ? `<span class="rp-chip">${esc(F(x, 'SizeMb'))} MB</span>` : ''}${F(x, 'When') ? `<span class="rp-chip">${esc(F(x, 'When'))}</span>` : ''}</div>
             ${F(x, 'Detail') ? `<div class="rp-txt">${esc(F(x, 'Detail'))}</div>` : ''}
             <div class="rp-code">${esc(F(x, 'Path'))}${(F(x, 'Files') || []).length ? '<br>' + (F(x, 'Files') || []).slice(0, 8).map(esc).join('<br>') + ((F(x, 'Files') || []).length > 8 ? `<br>… +${(F(x, 'Files') || []).length - 8} more` : '') : ''}</div>`)),
            R('FiveM') ? 'No mods found in the FiveM folders.' : 'This report has no FiveM section — the player used an older scanner (needs v4.1+).');
      },

      exec: () => head('Execution history', executed.length, 'Programs Windows recorded running (Prefetch, BAM, PCA, UserAssist, ShimCache) — even if deleted since.')
        + rows(executed.filter((e) => match(F(e, 'Name'), F(e, 'Path'))).slice(0, 500).map((e) =>
          rowL(F(e, 'Flagged') ? 'red' : '', esc(F(e, 'Path') || F(e, 'Name')), `${esc(F(e, 'LastRun'))} · ${esc(F(e, 'Source'))}`)), 'No execution history — it may have been wiped.'),

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
        const icon = { Ran: '▶️', Deleted: '🗑️', Renamed: '✏️', USB: '🔌', Opened: '📂', Injected: '💉', Log: '📋', Scan: '🛡️' };
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
        return head('USB drives', items.length,
            'Every USB stick / external drive Windows remembers, with the last time it was plugged in. Orange = plugged in shortly before the check and pulled out. '
            + 'Cheats are sometimes kept on a USB stick and removed before a screenshare.')
          + (ran.length ? rows(ran.map((d) => rowL(F(d, 'Severity') === 2 ? 'red' : 'orange', `<b style="color:var(--text)">${esc(F(d, 'Signature'))}</b><div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">${esc(F(d, 'Path'))}</div>`, esc(F(d, 'When') || ''))), '') + '<div style="height:12px"></div>' : '')
          + rows(items.map((x) => rowL(F(x, 'Level') >= 1 ? 'orange' : '',
              `<b style="color:var(--text)">${esc(F(x, 'Name'))}</b> ${F(x, 'Present') ? '<span style="margin-left:6px;padding:2px 8px;border-radius:999px;background:rgba(47,155,255,.15);color:#8cc8ff;font-size:11px;font-weight:700">plugged in now</span>' : ''}`
              + `${F(x, 'Why') ? `<div style="color:#ffb35c;font-size:12px;margin-top:2px">${esc(F(x, 'Why'))}</div>` : ''}${F(x, 'Serial') ? `<div class="mono" style="color:var(--dim);font-size:11px;margin-top:2px">serial ${esc(F(x, 'Serial'))}</div>` : ''}`,
              esc(F(x, 'LastConnected') || ''))),
            R('UsbStorage') ? 'No USB drive in Windows\' history.' : 'This report has no USB history — the player used an older scanner (needs v4.7+).');
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
        return `<div class="rp-grid" style="grid-template-columns:repeat(auto-fill,minmax(360px,1fr))">
          <div class="rp-card blue"><div class="rp-head" style="font-size:15px">PC information</div>${kv([
            ['System', (S('Os') || '-') + ' ' + (S('WinBuild') || '')], ['CPU', S('Cpu')], ['GPU', S('Gpu')], ['RAM', S('RamGb')], ['Motherboard', S('Motherboard')],
            ['Time zone', S('TimeZone')], ['Windows installed', S('WindowsInstall')], ['Boot', S('BootTime')], ['Uptime', S('Uptime')],
            ['FiveM last launch', S('FiveMLastLaunch')], ['Recycle bin', S('RecycleModified')], ['Antivirus', av.join(', ')],
            ['Disabled services', (S('DisabledServices') || []).join(', ') || 'none']])}</div>
          <div class="rp-card blue"><div class="rp-head" style="font-size:15px">Hardware IDs (for bans)</div>${kv([
            ['HWID', S('Hwid')], ['UUID', S('Uuid')], ['Machine GUID', S('MachineGuid')], ['BIOS serial', S('BiosSerial')],
            ['Disk serials', S('DiskSerials')], ['MAC', S('MacAddresses')], ['Windows SID', S('Sid')]])}</div>
          <div class="rp-card blue"><div class="rp-head" style="font-size:15px">Linked accounts</div>${kv([
            ['Discord (PC)', localDiscord], ['Discord (connected)', dc && dc.user ? `${dc.user.name} · ${dc.user.id}` : 'not connected'],
            ['Steam', L('SteamAccounts').join(', ')], ['Rockstar', L('RockstarAccounts').join(', ')], ['Epic Games', L('EpicAccounts').join(', ')],
            ['Browsers', L('Browsers').join(', ')], ['USB devices', L('UsbDevices').join(', ')]])}</div>
        </div>`;
      },
    };

    view.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-go="pins" style="margin-bottom:14px">← Back to PINs</button>
      <div class="rp-verdict ${esc(verdict)}"><div class="rp-ic" style="width:46px;height:46px">${IC.shield}</div>
        <div><div class="big">${esc(verdict)}</div><div class="who">${row && row.player ? esc(row.player) + ' · ' : ''}${esc(S('Os') || '')}</div></div>
        <div class="pin">PIN ${esc(pin)}<br>${fmtDate(row && row.created_at)}</div></div>
      <div class="rp">
        <aside class="rp-side">
          <h4>${IC.shield.replace('<svg', '<svg style="width:18px;height:18px;color:var(--cyan)"')} Detection Results</h4>
          <div class="sub">${total} total logs found</div>
          ${cats.map((c) => c === 'sep' ? '<div class="rp-sep"></div>' : `<button class="rp-cat ${c[0] === tab ? 'on' : ''}" data-rtab="${c[0]}">
            <span class="dot" style="background:${{ red: '#f43f5e', orange: '#f59e0b', green: '#10b981', yellow: '#eab308', purple: '#a855f7', blue: '#3b82f6' }[c[3]]}"></span>${c[1]}
            ${c[2] !== '' ? `<span class="n ${c[2] && c[2] !== 0 && c[2] !== '–' ? c[3] : ''}">${esc(c[2])}</span>` : ''}</button>`).join('')}
        </aside>
        <section>${['overview', 'integrity', 'pc'].includes(tab) || !panes[tab] ? '' : `<input class="input rp-filter" data-rpq placeholder="Filter this tab…" value="${esc(q || '')}">`}${(panes[tab] || panes.overview)()}</section>
      </div>`;

    view.querySelectorAll('[data-rtab]').forEach((b) => b.addEventListener('click', () => renderPinReport(view, pin, b.dataset.rtab)));
    view.querySelector('[data-dlookup]')?.addEventListener('click', async (ev) => {
      const id = (view.querySelector('#disc-id').value || '').replace(/\D/g, '');
      if (!/^\d{17,20}$/.test(id)) return toast('Enter a Discord ID (17–20 digits)', true);
      ev.target.disabled = true; ev.target.textContent = 'Checking…';
      try {
        await api('/api/discord-lookup', { method: 'POST', body: { pin, id } });
        state.pins = (await api('/api/pins')).pins || state.pins;
        if (state.discHist) delete state.discHist[id];
        renderPinReport(view, pin, 'discord');
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
    view.innerHTML = `
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
          ${step('Send the link to the player', 'The player opens the link — the scanner downloads with his PIN already inside (HeRoShield-PIN.exe). He runs it and clicks Accept, no PIN to type. Your background and the Discord check load by themselves.')}
          ${step('Player accepts the check', 'The scan takes 1–3 minutes and reads the whole PC: execution history (even deleted cheats), drivers, startup, tasks, network, event logs, files.')}
          ${step('Open the result', 'Scan PINs → View (or paste the PIN in "View a result by PIN"). Check the tabs: Detections, Warnings, Execution, Startup &amp; tasks, Drivers, Network, Files…')}
          ${step('Add your own strings', 'Signatures → add cheat file names, C2 domains, SHA-256 hashes. The next scan uses them live.')}
          ${step('Review the verdict', 'The scanner says <b style="color:var(--red)">cheating</b>, <b style="color:var(--orange)">suspicious</b> or <b style="color:var(--green)">clean</b>. Always review the evidence yourself before a ban.')}
        </ol>
      </div>
      <div class="card panel">
        <h3>Giving access to your staff</h3>
        <ol style="display:flex;flex-direction:column;gap:16px;padding-left:22px;margin:0">
          ${step('The staff member logs in once', 'They open this dashboard and log in with Discord. They see "no access" and their Discord ID — that is normal.')}
          ${step('Option A — Render (fixed list)', 'Render → Environment: <span class="mono">HEROCHECK_IDS</span> = Discord IDs for screenshare, <span class="mono">HEROSHIELD_IDS</span> = Discord IDs for anticheat, <span class="mono">ADMIN_DISCORD_IDS</span> = you. Separate IDs with a comma. Save → Render restarts.')}
          ${step('Option B — Access page (no restart)', 'Open Access (owner only). It lists everyone who logged in; you can also add someone by Discord ID before they log in.')}
          ${step('Tick what they can open', '<b>HeRo Check</b> = screenshare (scanner, PINs, Discord check, Scanner GUI, signatures). <b>HeRo Shield</b> = in-game anticheat (overview, detections, bans, players, logs, live, configuration). Tick both for full access.')}
          ${step('Done', 'They refresh the page and see only their tabs. Untick to remove access at any time — it applies immediately.')}
        </ol>
      </div>`;
  }

  function renderChangelogs(view) {
    const log = [
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

  async function renderSignatures(view) {
    const { signatures } = await api('/api/signatures');
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Add a cheat signature</h3>
        <p style="color:var(--muted);font-size:14px;margin-bottom:12px">The scanner pulls this list live — add a cheat and every check catches it.</p>
        <div class="set-grid" style="display:grid;gap:10px">
          <input id="sig-name" class="input" placeholder="Cheat name (e.g. Eulen)">
          <input id="sig-files" class="input" placeholder="File names: eulen.exe, eulen.dll">
          <input id="sig-feats" class="input" placeholder="Features: Aimbot, No recoil, ESP">
          <div style="display:flex;gap:10px">
            <select id="sig-sev" class="input" style="flex:1"><option value="high">High (cheating)</option><option value="medium">Medium</option><option value="low">Low</option></select>
            <button class="btn btn-primary" data-addsig>Add</button>
          </div>
        </div>
      </div>
      <div class="card panel"><h3>Signatures (${signatures.length})</h3>
        ${signatures.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Files</th><th>Features</th><th>Severity</th><th></th></tr></thead>
          <tbody>${signatures.map((s) => `<tr><td><b>${esc(s.name)}</b></td>
            <td class="mono">${esc((s.file_names || []).join(', '))}</td>
            <td>${(s.features || []).map((f) => `<span class="cat">${esc(f)}</span>`).join(' ')}</td>
            <td><span class="badge ${s.severity === 'high' ? 'ban' : s.severity === 'medium' ? 'kick' : 'off'}">${esc(s.severity)}</span></td>
            <td><button class="btn btn-danger btn-sm" data-delsig="${esc(s.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">No signatures yet.</div>'}
      </div>`;
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

  // Role Manager: server-enforced Admin vs HeRoCheck separation.
  async function renderRoleManager(view) {
    view.innerHTML = loading();
    const { users } = await api('/api/access');
    const owner = (users || []).some(u => String(u.discord_id) === String(state.user.id) && u.owner);
    view.innerHTML = `<div class="workspace-hero"><div><h2>Permission Manager</h2><p>Admin workspace · Assign dashboard access using Discord user IDs</p></div></div>
      <div class="card panel perm-card" style="margin-bottom:18px">
        <h3>Give a permission</h3>
        <label class="perm-field"><span>Discord User ID</span><input class="input" id="role-id" placeholder="Enter Discord user ID" inputmode="numeric"></label>
        <div class="perm-field"><span>Dashboard Permission</span>
          <label class="perm-radio"><input type="radio" name="role-type" value="herocheck" checked> HeRoCheck — Scanner Dashboard</label>
          <label class="perm-radio"><input type="radio" name="role-type" value="viewer"> 👁️ Admin (test) — sees every tab, cannot change anything</label>
          ${owner ? '<label class="perm-radio"><input type="radio" name="role-type" value="admin"> Admin — Management Dashboard + scanner (unlimited PINs)</label>' : ''}
        </div>
        ${durationPicker('roledur', [1, 'day'])}
        <button class="btn btn-primary perm-save" id="role-save">Save permission</button>
        <p class="workspace-note" style="margin-top:10px">Only the environment owner can grant Admin. Admin (test) can open every tab but every change is refused by the server. Every change is written to Activity logs.</p>
      </div>
      <div class="card panel"><h3>Accounts (${users.length})</h3><div class="table-wrap"><table><thead><tr><th>Discord user</th><th>ID</th><th>Dashboard</th><th>Time left</th><th>Action</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.name||'Not logged in')}</td><td class="mono">${esc(u.discord_id)}</td><td>${u.admin ? 'Admin' : u.viewer ? '👁️ Admin (test)' : u.herocheck || u.envHerocheck ? 'HeRoCheck' : 'No access'}</td><td>${u.owner || u.envHerocheck ? '<span class="badge on">Permanent (env)</span>' : (u.admin || u.viewer || u.herocheck || u.heroshield) ? timeLeft(u.expires_at) : '-'}</td><td>${u.owner ? 'Environment owner' : u.admin && !owner ? 'Owner-managed' : `<div class="actions-cell"><button class="btn btn-ghost btn-sm" data-role-id="${esc(u.discord_id)}">Edit</button>${(u.admin || u.viewer || u.herocheck) && !u.envHerocheck ? `<button class="btn btn-danger btn-sm" data-role-revoke="${esc(u.discord_id)}">Revoke</button>` : ''}</div>`}</td></tr>`).join('')}</tbody></table></div></div>`;
    const roleOf = () => view.querySelector('input[name="role-type"]:checked')?.value || 'herocheck';
    const roleShow = wireDuration(view, 'roledur', () => (roleOf() === 'admin' ? 'Admin' : roleOf() === 'viewer' ? 'Admin (test)' : 'HeRoCheck'));
    view.querySelectorAll('input[name="role-type"]').forEach((r) => r.addEventListener('change', roleShow));
    view.querySelectorAll('[data-role-id]').forEach(b => b.addEventListener('click', () => { view.querySelector('#role-id').value = b.dataset.roleId; view.querySelector('#role-id').focus(); }));
    view.querySelectorAll('[data-role-revoke]').forEach(b => b.addEventListener('click', async () => {
      if (!(await modal({ title: 'Revoke access', text: `Remove dashboard access for ${b.dataset.roleRevoke}?`, ok: 'Revoke', danger: true }))) return;
      const payload = { discordId: b.dataset.roleRevoke, herocheck: false, heroshield: false, viewer: false };
      if (owner) payload.admin = false;
      try { await api('/api/access', { method: 'POST', body: payload }); toast('Access revoked'); await renderRoleManager(view); } catch (e) { toast(e.message, true); }
    }));
    view.querySelector('#role-save').addEventListener('click', async () => {
      const discordId = view.querySelector('#role-id').value.trim();
      const role = roleOf();
      if (!/^\d{15,22}$/.test(discordId)) return toast('Enter a valid Discord user ID', true);
      const payload = {discordId, herocheck:role==='herocheck', heroshield:false, viewer:role==='viewer'};
      payload.duration = readDuration(view, 'roledur');
      if (owner) payload.admin = role==='admin';
      try { await api('/api/access', {method:'POST',body:payload}); toast('Permissions updated'); await renderRoleManager(view); }
      catch(e) { toast(e.message,true); }
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
          <b>HeRo Check</b> = screenshare tabs (scanner, scan PINs, Discord check, Scanner GUI, signatures). People appear below after their first login — or add them now by Discord ID.
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
      } else if (t.dataset.createlicense !== undefined) {
        const label=$('#license-label')?.value.trim()||'My Scanner License';
        await api('/api/scanner-licenses',{method:'POST',body:{label}});
        toast('Scanner license created'); await renderSubscription($('#view'));
      } else if (t.dataset.revokelicense !== undefined) {
        if(!confirm('Revoke this license? Its unused scan PINs will stop working.')) return;
        await api('/api/scanner-licenses',{method:'DELETE',body:{id:t.dataset.revokelicense}});
        toast('License revoked'); await renderSubscription($('#view'));
      } else if (t.dataset.useLicense !== undefined) {
        state.selectedLicense=t.dataset.useLicense; go('pins');
      } else if (t.dataset.saveprofile !== undefined) {
        await api('/api/leaderboard-optin',{method:'POST',body:{opted_in:!!$('#profile-optin')?.checked}});
        toast('Profile settings saved');
      } else if (t.dataset.newpin !== undefined) {
        t.disabled = true;
        const player = $('#pin-player').value.trim();
        let pin;
        try { ({ pin } = await api('/api/pins', { method: 'POST', body: { license_id: $('#pin-license')?.value, player } })); }
        catch (err) { t.disabled = false; throw err; }
        t.disabled = false;
        await renderPins($('#view'));   // the new PIN appears in "Recent PINs" right away
        const out = $('#pin-out');
        out.hidden = false;
        const dl = `${location.origin}/dl/${pin.pin}`;
        out.innerHTML = `
          <div style="color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.06em;margin-bottom:6px">DOWNLOAD LINK — SEND THIS TO THE PLAYER</div>
          <div class="license-box"><code class="show" style="font-size:15px;color:var(--cyan)">${esc(dl)}</code>
            <button class="btn btn-primary btn-sm" data-copypin="${esc(dl)}">Copy link</button></div>
          <p style="color:var(--muted);font-size:13px;margin-top:8px">The player opens the link, the scanner downloads with the PIN already inside — he just runs it and clicks Accept. Discord check opens by itself.</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:var(--dim);font-size:12.5px;align-items:center">
            <span>PIN <b class="mono" style="color:var(--text);letter-spacing:2px">${esc(pin.pin)}</b></span>
            <button class="btn btn-ghost btn-sm" data-copypin="${esc(pin.pin)}">Copy PIN</button>
            <button class="btn btn-ghost btn-sm" data-copypin="${esc(location.origin)}/verify?pin=${esc(pin.pin)}">Copy Discord link</button>
          </div>`;
      } else if (t.dataset.addsig !== undefined) {
        const name = $('#sig-name').value.trim();
        const fileNames = $('#sig-files').value.trim();
        if (!name || !fileNames) { toast('Name and file names required', true); return; }
        await api('/api/signatures', { method: 'POST', body: { name, fileNames, features: $('#sig-feats').value.trim(), severity: $('#sig-sev').value } });
        toast('Signature added');
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
