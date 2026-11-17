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
  const NAV = [
    { title:'Services', items:[
      { ic:'▣', label:'Dashboard', href:'/dashboard.html' },
      { ic:'◉', label:'Scanner', open:true, sub:[
        { ic:'⚲', label:'Scan PINs', href:'/dashboard.html#scanpins', on:true },
        { ic:'⬡', label:'Detections', href:'/dashboard.html#detections' },
      ]},
      { ic:'▤', label:'Database', caret:true, href:'/dashboard.html#players' },
      { ic:'⛉', label:'Anti-cheat', caret:true, href:'/dashboard.html#bans' },
    ]},
    { title:'Support', items:[
      { ic:'✉', label:'Tickets', href:'/dashboard.html#tickets' },
      { ic:'💬', label:'Chat', href:'/dashboard.html#chat' },
    ]},
    { title:'Others', items:[
      { ic:'🗀', label:'Resources', open:true, sub:[
        { ic:'🏆', label:'Leaderboard', href:'/dashboard.html#leaderboard' },
        { ic:'📖', label:'Documentation', href:'/troubleshooting.html' },
        { ic:'🛒', label:'Pricing', href:'/#pricing' },
        { ic:'⤓',  label:'Download', href:'/dashboard.html#scanner' },
        { ic:'⚖', label:'Legal', href:'/#legal' },
        { ic:'🗎', label:'Changelogs', href:'/dashboard.html#changelogs' },
      ]},
    ]},
  ];
  const navItem = (i, sub) => `<a class="sr-item${i.on ? ' on' : ''}${sub ? ' sr-sub' : ''}" href="${i.href || '#'}">
      <span class="ic">${i.ic}</span>${esc(i.label)}${i.caret || i.sub ? '<span class="caret">▾</span>' : ''}</a>`;
  $('#srSide').innerHTML =
    `<div class="sr-brand"><img src="/assets/hero-icon.png" alt="">HeRo Shield</div>` +
    NAV.map((g) => `<div class="sr-grp"><b>${g.title}</b>` +
      g.items.map((i) => navItem(i) + (i.sub || []).map((s) => navItem(s, true)).join('')).join('') +
    `</div>`).join('');

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

  /** The small pixel block top-right: one square per finding, red where it is serious. */
  function pixelMap(el, n, bad) {
    const C = 7, cols = 9, rows = 5;
    const cv = document.createElement('canvas');
    cv.width = cols * C * 2; cv.height = rows * C * 2; cv.style.width = cols * C + 'px'; cv.style.height = rows * C + 'px';
    const x = cv.getContext('2d'); x.scale(2, 2);
    for (let i = 0; i < cols * rows; i++) {
      if (i >= n) continue;
      x.fillStyle = i < bad ? '#d8454f' : '#3a3a3e';
      x.fillRect((i % cols) * C, Math.floor(i / cols) * C, C - 2, C - 2);
    }
    el.appendChild(cv);
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
    const vClass = bad.includes('cheat') ? 'bad' : bad.includes('suspic') || bad.includes('warn') ? 'warn' : 'ok';
    const total = CATS.reduce((n, c) => n + listFor(c.key).length, 0);

    let rows = listFor(cat);
    if (chip !== 'all') rows = rows.filter((d) => (d.tag || '').toLowerCase() === chip);
    if (q) { const t = q.toLowerCase();
      rows = rows.filter((d) => (d.name + ' ' + (d.detail || '')).toLowerCase().includes(t)); }
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages - 1);
    const slice = rows.slice(page * PER, page * PER + PER);
    const tags = [...new Set(listFor(cat).map((d) => d.tag).filter(Boolean))];

    $('#srBody').innerHTML = `
      <div class="sr-head">
        <div class="sr-map" id="srMap"></div>
        <div class="sr-meta">
          <span>${esc(r.game || 'Unknown game')}</span><span class="dotsep">·</span>
          <span class="mono">${esc(r.pin || PIN)}</span><span class="dotsep">·</span>
          <span>@${esc(r.player || 'unknown')}</span><span class="dotsep">·</span>
          <span>${r.public ? 'Public' : 'Private'}</span>
        </div>
        <div class="sr-verdict ${vClass}">${esc(r.verdict || 'Unknown')}</div>
        <div class="sr-times">
          <div><b>${fmtAgo(r.scannedAt)}</b><span>Scanned</span></div>
          <div><b>${dur(r.durationSec)}</b><span>Duration</span></div>
          <div><b>${esc(r.gameTime || 'not running')}</b><span>Game time</span></div>
        </div>
      </div>

      <div class="sr-actions">
        <span class="sr-risk">Player risk ${r.risk == null ? '—' : r.risk + '%'}</span>
        ${r.risk >= 60 ? '<span class="sr-flag">⊘ High Risk</span>' : ''}
        <button class="sr-copy" id="btnReport">⚑ Report Scan</button>
        <button class="sr-copy" id="btnExport">⤓ Export</button>
      </div>

      <h2 class="sr-h">Session <em>Overview</em></h2>
      <div class="sr-tiles">
        ${[['⏻','Boot Time', r.bootTime],['⚿','VPN', r.vpn],['🗑','Recycle', r.recycle],
           ['🗓','Install Date', r.installDate],['⌖','Country', r.country],
           ['▷','Game', r.gameTime, 'Open during the scan'],['🗔','Window Text', r.windowText],
          ].map(([ic,k,v,note]) => `<div class="sr-tile"><small>${ic} ${k}</small><b>${esc(v || '—')}</b>${note ? `<i>${note}</i>` : ''}</div>`).join('')}
      </div>

      <h2 class="sr-h" style="margin-top:28px">Scan <em>details</em></h2>
      <div class="sr-tabs">
        ${[['logs','✉','All logs', total],['accounts','👤','Accounts'],['activity','📈','Activity', (r.activity||[]).length],['evidence','🗎','Evidence']]
          .map(([k,ic,label,n]) => `<div class="sr-tab${k === 'logs' ? ' on' : ''}">${ic} ${label}${n ? `<span class="n">${n}</span>` : ''}</div>`).join('')}
        ${r.cheaterRecords ? '<div class="sr-cheater">⚠ Cheater Records <b>Found</b></div>' : ''}
      </div>

      <h2 class="sr-h">Detection <em>Results</em></h2>
      <div class="sr-res">
        <div class="sr-rail">
          <b>Categories <span>${total}</span></b>
          ${CATS.map((c) => `<div class="sr-cat${c.key === cat ? ' on' : ''}" data-cat="${c.key}">
             <span class="sr-ic ${c.cls}" style="width:19px;height:19px;font-size:11px">${c.ic}</span>
             ${c.label}<span class="n">${listFor(c.key).length}</span></div>`).join('')}
        </div>

        <div class="sr-panel">
          <div class="sr-ptitle"><h3>${CATS.find((c) => c.key === cat).label}</h3><span>${listFor(cat).length}</span></div>
          <p class="sr-psub">${cat === 'detections' ? 'Cheats and ways to hide them.'
            : cat === 'warnings' ? 'Things worth a second look.'
            : cat === 'integrity' ? 'Checks that came back clean.' : 'What the antivirus recorded.'}</p>

          <div class="sr-bar">
            <span class="sr-chip${chip === 'all' ? ' on' : ''}" data-chip="all">All ${listFor(cat).length}</span>
            ${tags.map((t) => `<span class="sr-chip${chip === t.toLowerCase() ? ' on' : ''}" data-chip="${esc(t.toLowerCase())}">${esc(t)} ${listFor(cat).filter((d) => d.tag === t).length}</span>`).join('')}
            <span class="sr-search">🔍<input id="srQ" placeholder="Search the logs" value="${esc(q)}"></span>
            <button class="sr-copy" id="btnCopy">⧉ Copy all</button>
          </div>

          ${slice.length ? slice.map((d, i) => {
            const idx = page * PER + i;
            const c = CATS.find((x) => x.key === cat);
            return `<div class="sr-row" data-row="${idx}">
              <span class="sr-ic ${c.cls}">${c.ic}</span>
              <span class="sr-name">${esc(d.name)}</span>
              <span class="sr-detail">${esc(d.detail || '')}</span>
              ${d.count > 1 ? `<span class="sr-mult">×${d.count}</span>` : ''}
              ${d.tag ? `<span class="sr-tag${/boot|recovery/i.test(d.tag) && cat !== 'detections' ? ' grey' : (cat === 'detections' ? '' : ' grey')}">${esc(d.tag)}</span>` : ''}
              <span class="sr-exp">${openRow === idx ? '▴' : '▾'}</span>
            </div>${openRow === idx ? `<div class="sr-more">${esc(d.explain || 'No further detail was recorded for this entry.')}
              ${d.sha256 ? `<br><b>SHA-256</b> <span class="mono">${esc(d.sha256)}</span>` : ''}
              ${d.path ? `<br><b>Path</b> <span class="mono">${esc(d.path)}</span>` : ''}</div>` : ''}`;
          }).join('') : `<div class="sr-empty">Nothing in this category.</div>`}

          <div class="sr-foot">
            <span>${rows.length ? `Showing ${page * PER + 1}–${Math.min(rows.length, (page + 1) * PER)} of ${rows.length} results` : ''}</span>
            <span class="sr-pg">
              <button id="pgPrev" ${page === 0 ? 'disabled' : ''}>‹ Prev</button>
              <button id="pgNext" class="p" ${page >= pages - 1 ? 'disabled' : ''}>Next ›</button>
            </span>
          </div>
        </div>
      </div>`;

    pixelMap($('#srMap'), Math.min(45, total), Math.min(45, listFor('detections').length));

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
