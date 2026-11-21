/* HeRo Shield — Appearance.
 *
 * Lets an operator make the dashboard theirs: the accent colour, how dark the page is, and
 * the name and picture shown beside the logo.
 *
 * Why it works the way it does:
 *
 * The whole interface is built on CSS custom properties — --accent, --s0, --s1 and so on. So
 * a theme is not a stylesheet to swap, it is a handful of values to overwrite on :root, and
 * applying one is a dozen assignments rather than a reflow. That also means a colour the
 * operator picks flows into every component that was built properly, including ones written
 * after this file.
 *
 * The choice is kept in localStorage, so it is applied before the first paint and never
 * arrives as a flash of the old colour. It is per browser on purpose: it changes nothing a
 * teammate sees, so it needs no server round trip and cannot fail.
 */
(function (w) {
  'use strict';

  const KEY = 'hs-appearance';

  // Presets. Each is just an accent and a ground; everything else is derived, so adding one
  // is two colours rather than a new palette.
  const PRESETS = [
    { id: 'blue',   name: 'HeRo Blue', accent: '#4a8cf7', ground: '#07090d' },
    { id: 'cyan',   name: 'Cyan',      accent: '#22d3ee', ground: '#06090c' },
    { id: 'violet', name: 'Violet',    accent: '#a855f7', ground: '#09070e' },
    { id: 'green',  name: 'Green',     accent: '#3ecf8e', ground: '#060b09' },
    { id: 'amber',  name: 'Amber',     accent: '#f0a92e', ground: '#0b0905' },
    { id: 'red',    name: 'Red',       accent: '#f0556c', ground: '#0c0708' },
    { id: 'mono',   name: 'Mono',      accent: '#c8ced8', ground: '#08090b' },
  ];

  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const parse = (hex) => {
    const h = String(hex || '').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return Number.isNaN(n) ? null : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const toHex = (c) => '#' + [c.r, c.g, c.b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('');
  const lift = (c, by) => ({ r: c.r + by, g: c.g + by, b: c.b + by });
  const mixc = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });

  /**
   * Turns two colours into the whole token set.
   *
   * The surfaces climb in even steps from the ground, each one tinted very slightly towards
   * the accent. That tint is what stops a custom colour from looking bolted onto a grey
   * interface: at 6% it is not visible as colour, only as the page belonging to the accent.
   */
  function tokens(accentHex, groundHex, depth) {
    const a = parse(accentHex) || parse('#4a8cf7');
    const g = parse(groundHex) || parse('#07090d');
    // depth 0 = nearly black, 1 = noticeably lighter. The steps keep their ratio either way,
    // so contrast between a panel and the page is the same at both ends.
    const base = lift(g, depth * 16);
    const step = (n) => toHex(mixc(lift(base, n), a, 0.06));
    return {
      '--s0': toHex(base),
      '--s1': step(5),
      '--s2': step(10),
      '--s3': step(16),
      '--line': step(20),
      '--line2': step(29),
      '--line-strong': step(44),
      '--accent': accentHex,
      '--accent-hover': toHex(mixc(a, { r: 0, g: 0, b: 0 }, 0.18)),
      '--accent-soft': toHex(mixc(base, a, 0.14)),
      '--accent-ring': `rgba(${a.r},${a.g},${a.b},.22)`,
      '--blue': accentHex,
      '--blue2': toHex(mixc(a, { r: 255, g: 255, b: 255 }, 0.3)),
      '--blueglow': `rgba(${a.r},${a.g},${a.b},.22)`,
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* private window, blocked storage: fall through to the default */ }
    return null;
  }

  function apply(pref) {
    const p = pref || read() || {};
    const preset = PRESETS.find((x) => x.id === p.preset) || PRESETS[0];
    const accent = p.accent || preset.accent;
    const ground = p.ground || preset.ground;
    const depth = typeof p.depth === 'number' ? p.depth : 0;
    const t = tokens(accent, ground, depth);
    const root = document.documentElement;
    for (const k in t) root.style.setProperty(k, t[k]);
  }

  function save(pref) {
    try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch { }
    apply(pref);
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch { }
    // Remove the overrides rather than writing the defaults back, so the stylesheet is in
    // charge again and a later change to it is picked up.
    const root = document.documentElement;
    for (const k in tokens('#4a8cf7', '#07090d', 0)) root.style.removeProperty(k);
  }

  // Applied immediately, before the dashboard draws anything, so a saved colour is never
  // preceded by a flash of the default one.
  apply();

  w.HSAppearance = { PRESETS, read, save, apply, reset, tokens };
})(window);
