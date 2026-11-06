// HeRo Shield dashboard
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const state = { user: null, servers: [], server: null, tab: 'overview', q: '', cat: '' };
  try { state.server = localStorage.getItem('hs_server'); } catch {}

  const TITLES = {
    overview: 'Overview', detections: 'Detections', bans: 'Bans', players: 'Players', logs: 'Logs',
    settings: 'Configuration', stream: 'Multi Stream', servers: 'My servers',
    scanner: 'Download scanner', pins: 'Scan PINs', signatures: 'Signatures', staff: 'Staff team', access: 'Access',
    discord: 'Discord check', scannergui: 'Scanner GUI', tutorial: 'Tutorial', changelogs: 'Changelogs',
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
    const acc = state.user.access || { heroshield: true, herocheck: true };
    if (!acc.heroshield && !acc.herocheck) {
      $('#login').hidden = false; $('#app').hidden = true;
      $('#login-error').textContent = `Your account has no access yet. Send your Discord ID ${state.user.id} to the owner so he can give you HeRo Shield or HeRo Check.`;
      $('#login-error').hidden = false;
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
    // Permission-based tab visibility
    state.access = acc;
    document.querySelectorAll('[data-perm]').forEach(el => {
      const p = el.dataset.perm;
      el.hidden = !acc[p];
    });
    await loadServers();
    const hash = location.hash.slice(1);
    const defaultTab = acc.heroshield ? (state.servers.length ? 'overview' : 'servers')
                     : acc.herocheck  ? 'pins'
                     : 'servers';
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
    access:'admin'
  };
  function canAccess(tab) {
    if (!TITLES[tab]) return false;
    const p = PERM_MAP[tab];
    if (!p) return true;
    const acc = state.access || {};
    return !!acc[p];
  }
  function go(tab) {
    if (!canAccess(tab)) return;
    if (tab !== 'stream' && window.HSConfig) window.HSConfig.stopStreams();
    state.tab = tab;
    state.q = '';
    $('#search').value = '';
    state.cat = '';
    $('#search').hidden = !['detections', 'bans', 'players', 'logs'].includes(tab);
    $('#server-select').style.display = ['servers', 'scanner', 'signatures', 'staff', 'access', 'tutorial', 'changelogs'].includes(tab) ? 'none' : '';
    $('#page-title').textContent = TITLES[tab];
    $$('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    history.replaceState(null, '', `#${tab}`);
    render();
  }

  async function render() {
    const view = $('#view');
    if (state.tab === 'servers') return renderServers(view);
    if (state.tab === 'scanner') return renderScanner(view);
    if (state.tab === 'signatures') return renderSignatures(view);
    if (state.tab === 'staff') return renderStaff(view);
    if (state.tab === 'tutorial') return renderTutorial(view);
    if (state.tab === 'changelogs') return renderChangelogs(view);
    if (state.tab === 'access') return renderAccess(view).catch((e) => { view.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
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
    const { pins } = await api(`/api/pins?server=${state.server}`);
    state.pins = pins;
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Generate a scan PIN</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="pin-player" class="input" style="flex:1;min-width:180px" placeholder="Player name (optional)">
          <button class="btn btn-primary" data-newpin>Generate PIN</button>
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
    'Startup', 'Scheduled task', 'Event log', 'Recent file', 'Network', 'Kernel driver', 'AmCache', 'ShimCache', 'Hidden stream'];
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

    const dets = L('Detections').slice().sort((a, b) => (F(b, 'Severity') || 0) - (F(a, 'Severity') || 0));
    const warns = L('Warnings'), mods = L('Mods'), suspAll = L('Suspicious');
    const entropy = suspAll.filter((x) => /entropy/i.test(F(x, 'Kind') || ''));
    const susp = suspAll.filter((x) => !/entropy/i.test(F(x, 'Kind') || ''));
    const executed = L('ExecutedPrograms'), cmds = L('Commands'), deleted = L('DeletedFiles');
    const startup = L('StartupEntries'), tasks = L('ScheduledTasks'), drivers = L('LoadedDrivers');
    const recent = L('RecentFiles'), conns = L('NetworkConnections'), fw = L('FirewallRules');
    const events = L('EventLogEntries').filter((e) => !(F(e, 'Category') === 'ServiceInstall' && /microsoft|system32\\drivers|\\windows\\/i.test(F(e, 'Message') || '')));
    const verdict = R('Verdict') || (row && row.result) || 'clean';
    const shot = R('ScreenshotJpegBase64');
    const dc = row && row.discord_check;
    const guilds = (dc && dc.guilds) || [];
    const cheatGuilds = guilds.filter((g) => cheatIds.has(String(g.id)));
    const localDiscord = R('DiscordId');
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
      ['integrity', 'Integrity', `${passed}/${integrity.length}`, 'green'],
      ['warnings', 'Warnings', warns.length, 'orange'],
      ['suspicious', 'Suspicious', susp.length, 'yellow'],
      ['entropy', 'Entropy', entropy.length, 'purple'],
      ['fivem', 'FiveM', fivemBad ? fivemBad + ' cheat' : fivem.filter((x) => F(x, 'Kind') !== 'Folder').length, fivemBad ? 'red' : fivemLook ? 'orange' : 'green'],
      ['discord', 'Discord', dc ? (cheatGuilds.length ? cheatGuilds.length + ' cheat' : guilds.length) : '–', cheatGuilds.length ? 'red' : dc ? 'blue' : 'orange'],
      'sep',
      ['exec', 'Execution', flaggedRuns.length || executed.length, flaggedRuns.length ? 'red' : 'blue'],
      ['persist', 'Startup & tasks', startup.filter((x) => F(x, 'Suspicious')).length + tasks.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['drivers', 'Drivers', drivers.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['network', 'Network', conns.filter((x) => F(x, 'Suspicious')).length + fw.length, 'orange'],
      ['files', 'Files & mods', deleted.length + recent.filter((x) => F(x, 'Flagged')).length + mods.length, 'blue'],
      ['cmds', 'Commands', cmds.filter((x) => F(x, 'Suspicious')).length, 'orange'],
      ['events', 'Event log', events.length, 'blue'],
      ['pc', 'PC & accounts', '', 'blue'],
    ];
    tab = tab || (dets.length ? 'detects' : 'overview');
    const total = dets.length + warns.length + susp.length + entropy.length;

    const panes = {
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
        if (!dc) return head('Discord', '') + `<div class="rp-card orange"><div class="rp-top"><div class="rp-ic">${IC.disc}</div>
            <div class="rp-title">The player did not connect Discord</div><span class="rp-tag">Not verified</span></div>
            <div class="rp-txt">The scanner opens the page automatically. You can also send this link to the player:</div>
            <div class="rp-code">${esc(location.origin)}/verify?pin=${esc(pin)}</div>
            ${localDiscord ? `<div class="rp-txt">Discord ID read from the PC: <b class="mono">${esc(localDiscord)}</b></div>` : ''}</div>`;
        const u = dc.user || {};
        const mismatch = localDiscord && u.id && String(localDiscord) !== String(u.id);
        const gcard = (g) => {
          const c = cheatIds.get(String(g.id));
          return `<div class="rp-card ${c ? 'red' : 'grey'}"><div class="rp-guild">${discordIcon(g) ? `<img src="${esc(discordIcon(g))}" alt="">` : `<div class="gi">${esc((g.name || '?')[0])}</div>`}
            <div style="flex:1;min-width:0"><div class="rp-title" style="padding:0">${esc(g.name)}</div><div class="mono" style="color:var(--dim);font-size:11px">${esc(g.id)}${g.owner ? ' · owner' : ''}</div></div>
            ${c ? '<span class="rp-tag">CHEAT SERVER</span>' : ''}</div></div>`;
        };
        return `<div class="rp-card ${cheatGuilds.length ? 'red' : 'green'}" style="margin-bottom:16px"><div class="rp-guild">
            ${u.avatar ? `<img src="${esc(u.avatar)}" alt="" style="border-radius:50%">` : `<div class="gi">${IC.disc}</div>`}
            <div style="flex:1"><div class="rp-title" style="padding:0">${esc(u.name)} <span style="color:var(--dim);font-weight:400">@${esc(u.username)}</span></div>
              <div class="mono" style="color:var(--dim);font-size:11.5px">${esc(u.id)} · account created ${esc((u.created || '').slice(0, 10))} · connected ${fmtDate(dc.at)}</div></div>
            <span class="rp-tag">${cheatGuilds.length ? cheatGuilds.length + ' cheat server' + (cheatGuilds.length > 1 ? 's' : '') : 'No cheat servers'}</span></div>
            ${mismatch ? `<div class="rp-txt" style="color:#fbbf24">⚠ The Discord logged in on the PC (${esc(localDiscord)}) is NOT the one connected here — the player may be hiding his main account.</div>` : ''}
          </div>
          ${head(`${guilds.length} servers found`, '', state.cheatServers.length ? `Red = in your cheat-server list (${state.cheatServers.length}). Add more on the Discord check page.` : 'Add cheat-server invite links on the Discord check page to flag them here.')}
          ${grid([...cheatGuilds, ...guilds.filter((g) => !cheatIds.has(String(g.id)))].filter((g) => match(g.name, g.id)).map(gcard), 'The player is in no servers.')}`;
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

      files: () => head('Recycle bin', deleted.length) + rows(fl(deleted, 'File').map((x) => rowL(F(x, 'Executable') ? 'orange' : '', esc(F(x, 'File')), esc(F(x, 'When')))), 'Empty.')
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
    const qi = view.querySelector('[data-rpq]');
    if (qi) {
      qi.addEventListener('input', () => { clearTimeout(qi._t); qi._t = setTimeout(() => { renderPinReport(view, pin, tab, qi.value).then(() => { const n = view.querySelector('[data-rpq]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }, 250); });
    }
  }

  async function renderScannerGui(view) {
    const { bg } = await api(`/api/scanner-bg?server=${state.server}`);
    state.scanbg = bg || '';
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Scanner background</h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:14px">
          Upload an image shown behind your scanner window while a PIN scan runs. PNG / JPG / GIF, best 500×300.
          It shows automatically on <b>every</b> PIN of this server — as soon as the player types the PIN.</p>
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
      ['4.1.0', 'New FiveM tab in the scan report: every mod in the FiveM folders is opened and read, including .rpf archives (and archives inside archives). No-recoil / no-spread / damage-boosted weapons.meta and no-bush / no-grass / no-water visibility mods are shown as red lines, in the FiveM tab and in Detects. Graphics mods (visualsettings, timecycle) are orange, ReShade / ENB green. Plugins and scripts are judged by their code, not their name. Filter box on every report tab.'],
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

  async function renderStaff(view) {
    const { staff } = await api('/api/staff');
    view.innerHTML = `
      <div class="card panel" style="margin-bottom:18px">
        <h3>Add a staff member</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="staff-name" class="input" style="flex:1;min-width:150px" placeholder="Name">
          <input id="staff-did" class="input" style="flex:1;min-width:150px" placeholder="Discord ID (optional)">
          <select id="staff-role" class="input"><option value="staff">Staff</option><option value="admin">Admin</option></select>
          <button class="btn btn-primary" data-addstaff>Add</button>
        </div>
      </div>
      <div class="card panel"><h3>Team (${staff.length})</h3>
        ${staff.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Discord ID</th><th>Role</th><th>Added</th><th></th></tr></thead>
          <tbody>${staff.map((m) => `<tr><td><b>${esc(m.name)}</b></td><td class="mono">${esc(m.discord_id) || '-'}</td>
            <td><span class="badge ${m.role === 'admin' ? 'log' : 'off'}">${esc(m.role)}</span></td>
            <td class="mono">${fmtDate(m.created_at)}</td>
            <td><button class="btn btn-danger btn-sm" data-delstaff="${esc(m.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">No staff yet.</div>'}
      </div>`;
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
      </div>
      <div class="card panel"><h3>Accounts (${users.length})</h3>
        ${users.length ? `<div class="table-wrap"><table><thead><tr><th>User</th><th>Discord ID</th><th>Access</th><th>Last login</th><th></th></tr></thead>
          <tbody>${users.map((u) => `<tr>
            <td><div style="display:flex;gap:10px;align-items:center">${u.avatar ? `<img src="${esc(u.avatar)}" alt="" style="width:28px;height:28px;border-radius:50%">` : ''}<b>${esc(u.name) || '<span style="color:var(--dim)">not logged in yet</span>'}</b></div></td>
            <td class="mono">${esc(u.discord_id)}</td>
            <td>${u.admin ? '<span class="badge log">Owner — full access</span>' : `<div style="display:flex;gap:14px;flex-wrap:wrap">${box(u, 'heroshield')}${box(u, 'herocheck')}</div>`}</td>
            <td class="mono">${u.last_login ? fmtDate(u.last_login) : 'never'}</td>
            <td>${u.admin ? '' : `<button class="btn btn-danger btn-sm" data-delacc="${esc(u.discord_id)}">Remove</button>`}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">Nobody yet. Ask your staff to log in once, or add them by Discord ID.</div>'}
      </div>`;

    const save = async (body, msg) => {
      try { await api('/api/access', { method: 'POST', body }); toast(msg); } catch (e) { toast(e.message, true); }
    };
    view.querySelectorAll('[data-acc]').forEach((cb) => cb.addEventListener('change', () =>
      save({ discordId: cb.dataset.uid, [cb.dataset.acc]: cb.checked }, 'Access updated')));
    view.querySelector('[data-addacc]').addEventListener('click', async () => {
      const id = $('#acc-id').value.trim();
      if (!/^\d{5,25}$/.test(id)) return toast('Enter a Discord user ID (numbers only)', true);
      await save({ discordId: id, heroshield: $('#acc-hs').checked, herocheck: $('#acc-hc').checked }, 'Saved');
      renderAccess(view);
    });
    view.querySelectorAll('[data-delacc]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await modal({ title: 'Remove access', text: `Remove all access for ${b.dataset.delacc}?`, ok: 'Remove', danger: true }))) return;
      try { await api(`/api/access?id=${encodeURIComponent(b.dataset.delacc)}`, { method: 'DELETE' }); toast('Removed'); renderAccess(view); }
      catch (e) { toast(e.message, true); }
    }));
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
      try { await api('/api/scanner-bg', { method: 'POST', body: { server: state.server, image: state.scannewbg } });
        toast('Background saved — it shows on every PIN'); state.scannewbg = null; renderScannerGui($('#view')); }
      catch (e) { toast(e.message, true); t.disabled = false; t.textContent = 'Save background'; }
      return;
    }
    if (t.dataset.sgremove !== undefined) {
      try { await api(`/api/scanner-bg?server=${state.server}`, { method: 'DELETE' }); toast('Background removed'); renderScannerGui($('#view')); }
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
        await loadServers();
        toast('Server created');
        render();
      } else if (t.dataset.regen) {
        const ok = await modal({ title: 'Create a new key?', text: 'The old key will stop working. Put the new one in config.lua.', ok: 'New key', danger: true });
        if (!ok) return;
        await api('/api/servers', { method: 'PATCH', body: { id: t.dataset.regen } });
        await loadServers();
        toast('New key created');
        render();
      } else if (t.dataset.del) {
        const ok = await modal({ title: 'Delete this server?', text: 'All its detections, bans and players will be deleted.', ok: 'Delete', danger: true });
        if (!ok) return;
        await api(`/api/servers?id=${t.dataset.del}`, { method: 'DELETE' });
        await loadServers();
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
      } else if (t.dataset.newpin !== undefined) {
        t.disabled = true;
        const player = $('#pin-player').value.trim();
        const { pin } = await api('/api/pins', { method: 'POST', body: { server: state.server, player } });
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
        await loadServers();
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
