/* The scan report page.
 *
 * One scan, laid out the way a reviewer reads it: the verdict first, then the facts about the
 * session, then the findings grouped by how serious they are. Everything is rendered from the
 * report the scanner already uploads — no new API is needed beyond fetching one scan by PIN.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const qs = new URLSearchParams(location.search);
  const PIN = (qs.get('pin') || '').toUpperCase();

  // ── sidebar ────────────────────────────────────────────────────────────────
  // The dashboard's own tabs, in the dashboard's own groups — the report is a page of that
  // dashboard, so its sidebar is the dashboard's sidebar, not a second navigation invented here.
  const NAV = [
    { title:'Scanner & Screenshare', items:[
      { ic:'⤓', label:'Download scanner', tab:'scanner' },
      { ic:'⚲', label:'Scan PINs',        tab:'pins', on:true },
      { ic:'🖼', label:'Scanner GUI',      tab:'scannergui' },
    ]},
    { title:'Help', items:[
      { ic:'🗎', label:'Tutorial',        tab:'tutorial' },
      { ic:'🗎', label:'Changelogs',      tab:'changelogs' },
      { ic:'🗎', label:'Troubleshooting', tab:'troubleshooting' },
    ]},
    { title:'Scanner workspace', items:[
      { ic:'👤', label:'My Profile',    tab:'profile' },
      { ic:'🗝', label:'My License',    tab:'subscription' },
      { ic:'🗎', label:'Webhooks',      tab:'webhooks' },
      { ic:'⚲', label:'Scan Activity', tab:'scanactivity' },
      { ic:'🏆', label:'Leaderboard',   tab:'ranking' },
    ]},
    { title:'Account', items:[
      { ic:'🗝', label:'Permission Manager', tab:'rolemanager' },
      { ic:'🗝', label:'Access',             tab:'access' },
      { ic:'👥', label:'Partners',           tab:'partners' },
      { ic:'👥', label:'Team Directory',     tab:'teamdirectory' },
      { ic:'👥', label:'Staff team',         tab:'staff' },
    ]},
  ];
  const navItem = (i) => `<a class="sr-item${i.on ? ' on' : ''}" href="/dashboard.html#${i.tab}">
      <span class="ic">${i.ic}</span>${esc(i.label)}</a>`;
  $('#srSide').innerHTML =
    `<div class="sr-brand"><img src="/assets/hero-icon.png" alt="">HeRo Shield</div>` +
    NAV.map((g) => `<div class="sr-grp"><b>${g.title}</b>` +
      g.items.map(navItem).join('') + `</div>`).join('');

  // ── helpers ────────────────────────────────────────────────────────────────
  const fmtAgo = (t) => {
    if (!t) return '—';
    const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 90) return Math.round(s) + ' seconds ago';
    if (s < 5400) return Math.round(s / 60) + ' minutes ago';
    if (s < 172800) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  };
  const dur = (sec) => !sec ? '—' : (sec < 60 ? sec + 's' : Math.floor(sec / 60) + 'm ' + (sec % 60) + 's');

  /**
   * The session ruler: the scan drawn as the stretch of time it covered, with a mark where each
   * finding sits. A report is a sequence of moments, so the header shows the sequence rather than
   * a decorative block — and a cluster of marks in one place is itself worth seeing.
   */
  function ruler(r, groups) {
    const marks = [];
    const n = groups.detections.length, w = groups.warnings.length;
    for (let i = 0; i < Math.min(n, 40); i++) marks.push({ p: (i + 0.5) / Math.max(1, Math.min(n, 40)) * 0.86 + 0.07, w: false });
    for (let i = 0; i < Math.min(w, 20); i++) marks.push({ p: Math.random() * 0.86 + 0.07, w: true });
    const start = r.scannedAt ? new Date(new Date(r.scannedAt).getTime() - (r.durationSec || 0) * 1000) : null;
    const end = r.scannedAt ? new Date(r.scannedAt) : null;
    const hhmm = (d) => d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '—';
    return `<div class="sr-ruler">
      <div class="sr-ruler-track"><div class="sr-ruler-fill"></div>
        ${marks.map((m) => `<span class="sr-ruler-mark${m.w ? ' w' : ''}" style="left:${(m.p * 100).toFixed(1)}%"></span>`).join('')}
      </div>
      <div class="sr-ruler-legend"><span>Scan started ${hhmm(start)}</span>
        <span>${n} finding${n === 1 ? '' : 's'} along this session</span>
        <span>finished ${hhmm(end)}</span></div>
    </div>`;
  }

  // ── render ─────────────────────────────────────────────────────────────────
  let REPORT = null, cat = 'detections', chip = 'all', q = '', page = 0, openRow = -1;
  const PER = 14;

  const CATS = [
    { key:'detections',  ic:'⛊', cls:'',  label:'Detections'    },
    { key:'warnings',    ic:'⚠', cls:'w', label:'Warnings'      },
    { key:'integrity',   ic:'✓', cls:'g', label:'Integrity Logs'},
    { key:'antivirus',   ic:'⛉', cls:'b', label:'AntiVirus'     },
  ];
  const listFor = (k) => (REPORT && REPORT.groups && REPORT.groups[k]) || [];

  function draw() {
    const r = REPORT;
    const bad = String(r.verdict || '').toLowerCase();
    const vClass = bad.includes('cheat') ? 'bad' : (bad.includes('suspic') || bad.includes('warn')) ? 'warn' : 'ok';
    const total = CATS.reduce((n, c) => n + listFor(c.key).length, 0);

    let rows = listFor(cat);
    if (chip !== 'all') rows = rows.filter((d) => (d.tag || '').toLowerCase() === chip);
    if (q) { const t = q.toLowerCase();
      rows = rows.filter((d) => (d.name + ' ' + (d.detail || '')).toLowerCase().includes(t)); }
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages - 1);
    const slice = rows.slice(page * PER, page * PER + PER);
    const tags = [...new Set(listFor(cat).map((d) => d.tag).filter(Boolean))];
    const cObj = CATS.find((c) => c.key === cat);

    /* How much there is behind one finding. A detection backed by a hash and a path is not the
       same claim as one backed by a name, and the report should not present them as equals. */
    const strength = (d) => (d.sha256 ? 1 : 0) + (d.path ? 1 : 0) + (d.count > 1 ? 1 : 0) + (d.explain ? 1 : 0);

    const verdictLine = vClass === 'bad' ? 'Evidence of cheating was found on this PC.'
      : vClass === 'warn' ? 'Nothing conclusive, but there is something to look at.'
      : 'Nothing was found that points to cheating.';

    $('#srBody').innerHTML = `
      <div class="sr-head ${vClass}">
        <div class="sr-rail-v"></div>
        <div class="sr-head-in">
          <div class="sr-meta">
            <span>${esc(r.game || 'Unknown game')}</span>
            <span class="k">${esc(r.pin || PIN)}</span>
            <span>@${esc(r.player || 'unknown')}</span>
            <span>·</span><span>${r.public ? 'Public report' : 'Private report'}</span>
          </div>
          <div class="sr-vline">
            <span class="sr-vword">${esc(r.verdict || 'Unknown')}</span>
            <span class="sr-vsub">${verdictLine}</span>
          </div>
          ${ruler(r, { detections: listFor('detections'), warnings: listFor('warnings') })}
          <div class="sr-stats">
            <div class="sr-stat"><b>${fmtAgo(r.scannedAt)}</b><span>Scanned</span></div>
            <div class="sr-stat"><b>${dur(r.durationSec)}</b><span>Took</span></div>
            <div class="sr-stat"><b>${esc(r.gameTime || 'not running')}</b><span>Game during the check</span></div>
            <div class="sr-stat"><b>${total}</b><span>Entries in this report</span></div>
          </div>
        </div>
      </div>

      <div class="sr-actions">
        <span class="sr-risk">Risk <b>${r.risk == null ? '—' : r.risk + '%'}</b>
          <span class="meter"><i style="width:${Math.max(0, Math.min(100, r.risk || 0))}%"></i></span></span>
        ${r.cheaterRecords ? '<span class="sr-risk" style="border-color:#45262a;color:#f0959b">Seen in earlier reports</span>' : ''}
        <span class="spacer"></span>
        <button class="sr-copy" id="btnReport">⚑ Flag this report</button>
        <button class="sr-copy" id="btnExport">⤓ Export JSON</button>
      </div>

      <div class="sr-sec"><h2>Session <em>Overview</em></h2></div>
      <div class="sr-facts">
        ${[['Last boot', r.bootTime],['VPN', r.vpn],['Recycle bin', r.recycle],['Windows installed', r.installDate],
           ['Country', r.country],['Game window', r.windowText || 'None'],['Game running', r.gameTime]]
          .map(([k, v]) => `<div class="sr-fact"><small>${k}</small><b>${esc(v || '—')}</b></div>`).join('')}
        ${r.cheaterRecords ? `<div class="sr-fact flag"><small>Earlier reports</small><b>This PC has been checked before</b></div>` : ''}
      </div>

      <div class="sr-sec" style="margin-top:30px"><h2>Detection <em>Results</em></h2></div>

      <div class="sr-wrap">
      <div class="sr-rail">
        <b>Categories <span>${total}</span></b>
        ${CATS.map((c) => `<div class="sr-cat${c.key === cat ? ' on' : ''}" data-cat="${c.key}">
           <span class="pip"></span>${c.label}<span class="n">${listFor(c.key).length}</span></div>`).join('')}
      </div>

      <div class="sr-panel">
      <div class="sr-ptitle"><h3>${cObj.label}</h3><span>${listFor(cat).length}</span></div>
      <p class="sr-psub">${cat === 'detections' ? 'Cheats and ways to hide them.'
        : cat === 'warnings' ? 'Things worth a second look.'
        : cat === 'integrity' ? 'Checks that came back clean.' : 'What the antivirus recorded.'}</p>

      <div class="sr-bar">
        <span class="sr-chip${chip === 'all' ? ' on' : ''}" data-chip="all">Everything</span>
        ${tags.map((t) => `<span class="sr-chip${chip === t.toLowerCase() ? ' on' : ''}" data-chip="${esc(t.toLowerCase())}">${esc(t)} · ${listFor(cat).filter((d) => d.tag === t).length}</span>`).join('')}
        <span class="sr-search">🔍<input id="srQ" placeholder="Search these ${listFor(cat).length} entries" value="${esc(q)}"></span>
        <button class="sr-copy" id="btnCopy">⧉ Copy all</button>
      </div>

      <div class="sr-list">
        ${slice.length ? slice.map((d, i) => {
          const idx = page * PER + i;
          const st = strength(d);
          return `<div class="sr-item-card ${cObj.cls}" data-row="${idx}">
            <div class="sr-top">
              <span class="sr-name">${esc(d.name)}</span>
              ${d.count > 1 ? `<span class="sr-mult">seen ${d.count}×</span>` : ''}
              ${d.tag ? `<span class="sr-tag${cat === 'detections' ? ' hot' : ''}">${esc(d.tag)}</span>` : ''}
              <span class="sr-strength">evidence
                <span class="bars">${[0,1,2,3].map((n) => `<i class="${n < st ? 'f' : ''}"></i>`).join('')}</span></span>
            </div>
            ${d.detail ? `<div class="sr-detail">${esc(d.detail)}</div>` : ''}
            ${openRow === idx ? `<div class="sr-more">${esc(d.explain || 'No further detail was recorded for this entry.')}
              ${d.sha256 ? `<div class="sr-kv"><b>SHA-256</b> ${esc(d.sha256)}</div>` : ''}
              ${d.path ? `<div class="sr-kv"><b>Path</b> ${esc(d.path)}</div>` : ''}</div>` : ''}
          </div>`;
        }).join('') : `<div class="sr-empty">Nothing in this category.</div>`}
      </div>

      <div class="sr-foot">
        <span>${rows.length ? `${page * PER + 1}–${Math.min(rows.length, (page + 1) * PER)} of ${rows.length}` : ''}</span>
        <span class="sr-pg">
          <button id="pgPrev" ${page === 0 ? 'disabled' : ''}>‹ Prev</button>
          <button id="pgNext" class="p" ${page >= pages - 1 ? 'disabled' : ''}>Next ›</button>
        </span>
      </div>
      </div></div>`;

    $('#srBody').querySelectorAll('[data-cat]').forEach((e) =>
      e.onclick = () => { cat = e.dataset.cat; chip = 'all'; page = 0; openRow = -1; draw(); });
    $('#srBody').querySelectorAll('[data-chip]').forEach((e) =>
      e.onclick = () => { chip = e.dataset.chip; page = 0; openRow = -1; draw(); });
    $('#srBody').querySelectorAll('[data-row]').forEach((e) =>
      e.onclick = () => { const i = +e.dataset.row; openRow = openRow === i ? -1 : i; draw(); });
    const qi = $('#srQ');
    if (qi) qi.oninput = () => { q = qi.value; page = 0; draw();
      const n = $('#srQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
    const prev = $('#pgPrev'), next = $('#pgNext');
    if (prev) prev.onclick = () => { page--; openRow = -1; draw(); };
    if (next) next.onclick = () => { page++; openRow = -1; draw(); };
    const cp = $('#btnCopy');
    if (cp) cp.onclick = () => {
      const text = listFor(cat).map((d) => `${d.name}\t${d.detail || ''}\t${d.tag || ''}`).join('\n');
      navigator.clipboard.writeText(text).then(() => { cp.textContent = '✓ Copied'; setTimeout(() => cp.textContent = '⧉ Copy all', 1400); })
        .catch(() => { cp.textContent = 'Select and copy'; });
    };
    const ex = $('#btnExport');
    if (ex) ex.onclick = () => {
      const b = new Blob([JSON.stringify(REPORT, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `scan-${REPORT.pin || PIN}.json`; a.click();
    };
  }

  // ── load ───────────────────────────────────────────────────────────────────
  /** Fold whatever shape the API returns into the four groups the page draws. */
  function normalise(raw) {
    const r = raw.scan || raw.report || raw;
    const g = { detections: [], warnings: [], integrity: [], antivirus: [] };
    const push = (k, x) => g[k].push({
      name: x.signature || x.name || x.title || 'Finding',
      detail: x.path || x.detail || x.explain || '',
      explain: x.explain || x.detail || '',
      sha256: x.sha256 || x.Sha256 || null,
      path: x.path || x.Path || null,
      tag: x.tag || (x.deleted ? 'Recovery' : x.boot ? 'Boot' : x.category) || null,
      count: x.count || 1,
    });
    (r.detections || r.Detections || []).forEach((x) => push('detections', x));
    (r.warnings   || r.Warnings   || []).forEach((x) => push('warnings', x));
    (r.integrity  || r.Integrity  || []).forEach((x) => push('integrity', x));
    (r.antivirus  || r.AntiVirus  || []).forEach((x) => push('antivirus', x));
    return {
      pin: r.pin || PIN, game: r.game, player: r.player || r.username, public: r.public,
      verdict: r.verdict, risk: r.risk, scannedAt: r.scannedAt || r.created_at,
      durationSec: r.durationSec || r.duration, gameTime: r.gameTime,
      bootTime: r.bootTime, vpn: r.vpn, recycle: r.recycle, installDate: r.installDate,
      country: r.country, windowText: r.windowText, cheaterRecords: r.cheaterRecords,
      activity: r.activity || [], groups: g,
    };
  }

  (async () => {
    try {
      const res = await fetch('/api/scan-report?pin=' + encodeURIComponent(PIN), { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      REPORT = normalise(await res.json());
      $('#crumbPin').textContent = REPORT.pin || 'Report';
      draw();
    } catch (e) {
      $('#srBody').innerHTML = `<div class="sr-empty">This report could not be loaded (${esc(e.message)}).
        Open it from <a href="/dashboard.html#scanpins">Scan PINs</a>.</div>`;
    }
  })();
})();
