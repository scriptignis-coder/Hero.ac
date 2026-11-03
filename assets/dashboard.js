// HeRo Shield dashboard
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const state = { user: null, servers: [], server: null, tab: 'overview', q: '', cat: '' };
  try { state.server = localStorage.getItem('hs_server'); } catch {}

  const TITLES = {
    overview: 'Overview', detections: 'Detections', bans: 'Bans', players: 'Players', logs: 'Logs',
    settings: 'Configuration', stream: 'Multi Stream', servers: 'My servers',
    scanner: 'Download scanner', pins: 'Scan PINs', signatures: 'Signatures', staff: 'Staff team',
  };
  const SCANNER_URL = 'https://github.com/midouff030-blip/HeRo-Shield/releases/latest/download/HeRoShieldScanner.exe';
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
    if (location.search) history.replaceState(null, '', '/dashboard');
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#u-name').textContent = state.user.name;
    if (state.user.avatar) {
      $('#u-avatar').src = state.user.avatar;
      $('#u-avatar').hidden = false;
      $('#u-fallback').hidden = true;
    }
    await loadServers();
    const hash = location.hash.slice(1);
    go(TITLES[hash] ? hash : (state.servers.length ? 'overview' : 'servers'));
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
  function go(tab) {
    if (tab !== 'stream' && window.HSConfig) window.HSConfig.stopStreams();
    state.tab = tab;
    state.q = '';
    $('#search').value = '';
    state.cat = '';
    $('#search').hidden = !['detections', 'bans', 'players', 'logs'].includes(tab);
    $('#server-select').style.display = ['servers', 'scanner', 'signatures', 'staff'].includes(tab) ? 'none' : '';
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
        <p style="color:var(--muted);font-size:14px;margin-bottom:18px">A read-only Windows tool players run during a screenshare. It checks running programs, Windows execution traces (even deleted cheats), the FiveM folder and the recycle bin, then sends the result here.</p>
        <a class="btn btn-primary" href="${SCANNER_URL}"><svg style="width:18px;height:18px" aria-hidden="true"><use href="#i-download"/></svg>Download scanner (.exe)</a>
        <p class="mono" style="margin-top:12px;color:var(--dim)">Upload your built HeRoShieldScanner.exe to the repo's Releases so this link works.</p>
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
            <td>${esc(p.player) || '-'}</td>
            <td><span class="badge ${p.used ? 'on' : 'off'}">${p.used ? 'Yes' : 'Pending'}</span></td>
            <td>${p.result ? `<span class="badge ${p.result === 'cheating' ? 'ban' : p.result === 'clean' ? 'on' : 'kick'}">${esc(p.result)}</span>` : '-'}</td>
            <td class="mono">${fmtDate(p.created_at)}</td>
            <td><div class="actions-cell">
              ${p.used && p.report ? `<button class="btn btn-ghost btn-sm" data-viewpin="${esc(p.pin)}">View</button>` : ''}
              <button class="btn btn-ghost btn-sm" data-copypin="${esc(p.pin)}">Copy</button></div></td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="empty">No PINs yet.</div>'}
      </div>`;
  }

  function renderPinReport(view, pin, sub) {
    const row = (state.pins || []).find((p) => p.pin === pin);
    const r = row && row.report ? row.report : {};
    const s = r.System || r.system || {};
    const dets = r.Detections || r.detections || [];
    const warns = r.Warnings || r.warnings || [];
    const susp = r.Suspicious || r.suspicious || [];
    const mods = r.Mods || r.mods || [];
    const steam = r.SteamAccounts || r.steamAccounts || [];
    const exe = r.ExecutedPrograms || r.executedPrograms || [];
    const did = r.DiscordId || r.discordId;
    const verdict = r.Verdict || r.verdict || (row && row.result) || 'clean';
    const g = (a, b) => s[a] || s[b] || '-';
    const shot = r.ScreenshotJpegBase64 || r.screenshotJpegBase64;
    state.pinView = pin;
    const tab = sub || 'detects';
    const vcol = verdict === 'cheating' ? '#f43f5e' : verdict === 'suspicious' ? '#f59e0b' : '#2dd4bf';
    const vtxt = verdict === 'cheating' ? 'is cheating' : verdict === 'suspicious' ? 'is suspicious' : 'is clean';

    // one-time scoped style so the result page matches the Ocean look exactly
    if (!document.getElementById('ss-report-css')) {
      const st = document.createElement('style');
      st.id = 'ss-report-css';
      st.textContent = `
      .ss{--bg:#0b0f17;--card:#111725;--card2:#0e131f;--bd:#1d2636;--tx:#e8edf6;--dim:#7b899e;--red:#f43f5e;--teal:#2dd4bf;color:var(--tx)}
      .ss .ss-verdict{display:flex;align-items:center;justify-content:center;gap:10px;padding:16px;border:1px solid var(--bd);border-radius:14px;background:var(--card);font-size:18px;font-weight:700;margin-bottom:16px}
      .ss .ss-dot{width:10px;height:10px;border-radius:50%}
      .ss .ss-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:16px}
      .ss .ss-grid3{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:16px;margin-top:16px}
      @media(max-width:900px){.ss .ss-grid,.ss .ss-grid3{grid-template-columns:1fr}}
      .ss .ss-c{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:16px}
      .ss .ss-c>h4{margin:0 0 14px;font-size:15px;display:flex;align-items:center;gap:8px}
      .ss .ss-ico{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}
      .ss .ss-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
      .ss .ss-tabs{display:flex;gap:6px;background:var(--card2);padding:4px;border-radius:10px}
      .ss .ss-tab{border:0;background:transparent;color:var(--dim);padding:6px 12px;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer;display:flex;gap:6px;align-items:center}
      .ss .ss-tab.on{background:var(--red);color:#fff}
      .ss .ss-tab b{background:rgba(255,255,255,.18);border-radius:20px;padding:0 7px;font-size:11px}
      .ss .ss-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--bd);border-radius:10px;margin-bottom:8px;background:var(--card2)}
      .ss .ss-row .nm{font-family:ui-monospace,Menlo,monospace;font-size:13px;font-weight:600;word-break:break-all}
      .ss .ss-chip{display:inline-block;background:rgba(45,212,191,.12);color:var(--teal);border:1px solid rgba(45,212,191,.3);border-radius:20px;padding:2px 9px;font-size:11px;margin:2px 4px 2px 0}
      .ss .ss-bang{min-width:24px;height:24px;border-radius:50%;background:var(--red);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
      .ss .ss-warn{min-width:24px;height:24px;border-radius:50%;background:#f59e0b;color:#111;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
      .ss .ss-info{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--bd);font-size:13px}
      .ss .ss-info:last-child{border-bottom:0}
      .ss .ss-info span{color:var(--dim)}
      .ss .ss-info b{font-family:ui-monospace,Menlo,monospace;font-weight:600;text-align:right;word-break:break-all}
      .ss .ss-steam{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bd)}
      .ss .ss-steam:last-child{border-bottom:0}
      .ss .ss-av{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#1b2a4a,#0e1626);display:inline-flex;align-items:center;justify-content:center;font-size:13px}
      .ss .ss-empty{color:var(--dim);font-size:13px;padding:14px;text-align:center}
      .ss .ss-tools{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-size:12.5px;color:var(--dim)}
      .ss .ss-tools input,.ss .ss-tools select{background:var(--card2);border:1px solid var(--bd);color:var(--tx);border-radius:8px;padding:6px 10px;font-size:12.5px}
      .ss .ss-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
      .ss .ss-tbl th{text-align:left;color:var(--dim);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--bd);position:sticky;top:0;background:var(--card)}
      .ss .ss-tbl td{padding:9px 10px;border-bottom:1px solid var(--bd);font-family:ui-monospace,Menlo,monospace;word-break:break-all}
      .ss .ss-tbl tr:hover td{background:var(--card2)}
      .ss .ss-scroll{max-height:380px;overflow:auto;border:1px solid var(--bd);border-radius:10px}
      .ss .ss-back{background:transparent;border:1px solid var(--bd);color:var(--tx);border-radius:9px;padding:8px 14px;font-size:13px;cursor:pointer;margin-bottom:16px}`;
      document.head.appendChild(st);
    }

    const detsHtml = dets.length ? dets.map((d) => `
      <div class="ss-row"><span><span class="nm">${esc(d.File || d.file)}</span><br>
        ${((d.Features || d.features) || []).map((f) => `<span class="ss-chip">${esc(f)}</span>`).join('')}
        <span class="ss-chip" style="background:rgba(244,63,94,.12);color:var(--red);border-color:rgba(244,63,94,.3)">${esc(d.Signature || d.signature)}</span></span>
        <span class="ss-bang">!</span></div>`).join('') : '<div class="ss-empty">No cheat files found.</div>';
    const warnHtml = warns.length ? warns.map((w) => `<div class="ss-row"><span><span class="nm">${esc(w.Title || w.title)}</span>
        ${(w.Detail||w.detail)?`<br><span style="color:var(--dim);font-size:12px;font-family:inherit">${esc(w.Detail||w.detail)}</span>`:''}</span>
        <span class="ss-warn">!</span></div>`).join('') : '<div class="ss-empty">No warnings.</div>';
    const suspHtml = susp.length ? susp.map((x) => `<div class="ss-row"><span class="nm">${esc(x.Path || x.path)}</span>
        <span class="ss-chip">${esc(x.Kind || x.kind)}</span></div>`).join('') : '<div class="ss-empty">Nothing suspicious.</div>';
    const body = tab === 'warnings' ? warnHtml : tab === 'suspicious' ? suspHtml : detsHtml;
    const title = tab === 'warnings' ? 'Warnings Logs' : tab === 'suspicious' ? 'Suspicious File Logs' : 'Detects Logs';
    const icoCol = tab === 'warnings' ? '#f59e0b' : tab === 'suspicious' ? '#64748b' : 'var(--red)';
    const tbtn = (id, label, n) => `<button class="ss-tab ${tab === id ? 'on' : ''}" data-ptab="${id}">${label}${n ? ` <b>${n}</b>` : ''}</button>`;

    const info = [
      ['System', g('Os','os') + ' ' + (s.WinBuild||s.winBuild||'')],
      ['CPU', g('Cpu','cpu')], ['GPU', g('Gpu','gpu')], ['RAM', g('RamGb','ramGb')],
      ['Boot time', g('BootTime','bootTime')],
      ['Windows install', g('WindowsInstall','windowsInstall')],
      ['FiveM', g('FiveMLastLaunch','fiveMLastLaunch')],
      ['Recycle bin', g('RecycleModified','recycleModified')],
      ['HWID', g('Hwid','hwid')],
      ['Motherboard', g('Motherboard','motherboard')],
      ['BIOS serial', g('BiosSerial','biosSerial')],
      ['Disk serials', g('DiskSerials','diskSerials')],
      ['MAC address', g('MacAddresses','macAddresses')],
      ['Machine GUID', g('MachineGuid','machineGuid')],
      ['SMBIOS UUID', g('Uuid','uuid')],
      ['Files scanned', fmtNum(r.FilesScanned||r.filesScanned||0)],
    ];

    view.innerHTML = `
      <div class="ss">
      <button class="ss-back" data-go="pins">← Back to PINs</button>
      <div class="ss-verdict" style="border-color:${vcol}">
        <span class="ss-dot" style="background:${vcol}"></span>
        This user <span style="color:${vcol}">${vtxt}</span>
        <span style="color:var(--dim);font-weight:500;font-size:13px">· PIN ${esc(pin)}${row && row.player ? ' · ' + esc(row.player) : ''}</span>
      </div>

      <div class="ss-grid">
        <div class="ss-c">
          <div class="ss-head">
            <h4><span class="ss-ico" style="background:${icoCol};color:#fff">!</span>${title}</h4>
            <div class="ss-tabs">
              ${tbtn('detects','Detects',dets.length)}${tbtn('warnings','Warnings',warns.length)}${tbtn('suspicious','Suspicious',susp.length)}
            </div>
          </div>
          ${body}
        </div>
        <div class="ss-c">
          <h4><span class="ss-ico" style="background:#1e3a5f;color:#7dd3fc">i</span>PC Information</h4>
          ${info.map(([k,v]) => `<div class="ss-info"><span>${k}</span><b>${esc(String(v))}</b></div>`).join('')}
        </div>
      </div>

      <div class="ss-grid3">
        <div class="ss-c">
          <h4><span class="ss-ico" style="background:#16324f;color:#7dd3fc">◆</span>Steam accounts</h4>
          ${steam.length ? steam.map((a) => `<div class="ss-steam"><span class="ss-av">👤</span><span class="nm">${esc(a)}</span></div>`).join('') : '<div class="ss-empty">None found.</div>'}
          ${did ? `<div class="ss-info" style="margin-top:6px"><span>Discord ID</span><b>${esc(did)}</b></div>` : ''}
        </div>
        <div class="ss-c">
          <h4><span class="ss-ico" style="background:#2a2140;color:#c4b5fd">▦</span>Mods logs</h4>
          <div class="ss-tools">
            <span>Show <select><option>10</option><option>25</option><option selected>All</option></select> entries</span>
            <span>Search: <input type="text" placeholder="filter mods…" oninput="(function(q){document.querySelectorAll('#ss-modrows tr').forEach(function(tr){tr.style.display=tr.textContent.toLowerCase().indexOf(q.toLowerCase())>-1?'':'none'})})(this.value)"></span>
          </div>
          <div class="ss-scroll"><table class="ss-tbl"><thead><tr><th>File</th><th>Size</th><th>Download</th></tr></thead>
          <tbody id="ss-modrows">${mods.length ? mods.map((m) => `<tr><td>${esc(m.File||m.file)}</td><td>${(m.SizeMb||m.sizeMb||0)} MB</td><td style="color:var(--dim)">None</td></tr>`).join('') : '<tr><td colspan="3" class="ss-empty">No mods found.</td></tr>'}</tbody></table></div>
          <p style="color:var(--dim);font-size:11px;margin:8px 2px 0">${mods.length} file(s) from FiveM / mods / resources paths across all drives.</p>
        </div>
        <div class="ss-c">
          <h4><span class="ss-ico" style="background:#3f1d2b;color:#fda4af">●</span>Active recording</h4>
          ${shot ? `<img src="${esc(shot)}" style="width:100%;border-radius:10px;border:1px solid var(--bd)">` : '<div class="ss-empty">No recordings found.</div>'}
        </div>
      </div>

      ${exe.length ? `<div class="ss-c" style="margin-top:16px">
        <h4><span class="ss-ico" style="background:#1f2937;color:#9ca3af">⏱</span>Programs that ran on this PC <span style="color:var(--dim);font-weight:500">(${exe.length})</span></h4>
        <div class="ss-scroll" style="max-height:320px"><table class="ss-tbl"><thead><tr><th>Program</th><th>Last run</th><th>Source</th></tr></thead>
        <tbody>${exe.map((e) => `<tr>
          <td style="${(e.Flagged||e.flagged)?'color:var(--red);font-weight:700':''}">${esc(e.Name||e.name)}</td>
          <td>${esc(e.LastRun||e.lastRun)}</td><td><span class="ss-chip">${esc(e.Source||e.source)}</span></td></tr>`).join('')}</tbody></table></div>
      </div>` : ''}
      </div>`;
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
    if (t.dataset.ptab) return renderPinReport($('#view'), state.pinView, t.dataset.ptab);
    if (t.dataset.copypin) {
      try { await navigator.clipboard.writeText(t.dataset.copypin); toast('PIN copied'); } catch { toast('Copy failed', true); }
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
        const out = $('#pin-out');
        out.hidden = false;
        out.innerHTML = `<div class="license-box"><code class="show" style="font-size:18px;letter-spacing:3px">${esc(pin.pin)}</code>
          <button class="btn btn-ghost btn-sm" data-copypin="${esc(pin.pin)}">Copy</button></div>
          <p style="color:var(--muted);font-size:13px;margin-top:8px">Give this PIN to the player. They type it in the scanner.</p>`;
        $('#pin-player').value = '';
        renderPins($('#view'));
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
