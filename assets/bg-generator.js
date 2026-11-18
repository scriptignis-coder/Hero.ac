/* HeRo Shield — scanner background generator.
 *
 * Makes the animated background that sits behind the scanner window, from the operator's own
 * name and colour, in the browser. No upload, no server round trip, no library: the GIF is
 * encoded here and handed to the same save path as a chosen file.
 *
 * Why a GIF and not a video: the scanner draws its background with a WPF ImageBrush, which
 * plays GIF and shows a still for everything else. Whatever comes out of here has to be a GIF
 * or it stops moving the moment it reaches the exe.
 *
 * Exported:
 *   HSBG.designs                     -> [{ id, name, note }]
 *   HSBG.draw(ctx, opts, t)          -> draws one frame, t in [0,1)
 *   HSBG.gif(opts, onProgress)       -> Promise<string>  (a data:image/gif;base64 URL)
 */
(function (w) {
  'use strict';

  // ── the picture ────────────────────────────────────────────────────────────────────────
  // Every design draws into a 500×300 context and takes t in [0,1), where t wraps: frame 0 and
  // frame 1 must line up, or the loop visibly jumps.

  const W = 500, H = 300;
  const TAU = Math.PI * 2;

  /** '#3b82f6' -> {r,g,b} */
  function rgb(hex) {
    const h = String(hex || '#3b82f6').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const mix = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`;
  /** Darker version of the accent, for grounds that must stay behind the text. */
  const deep = (c, k) => `rgb(${Math.round(c.r * k)},${Math.round(c.g * k)},${Math.round(c.b * k)})`;

  function ground(x, c) {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05070c');
    g.addColorStop(0.55, deep(c, 0.09));
    g.addColorStop(1, '#04060a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }

  /**
   * The name, set once and used by every design.
   *
   * Fitted rather than fixed: a six-letter name and a twenty-four-letter one have to end up
   * looking like the same design, so the size comes down until the word fits the width it was
   * given. Letterspacing is part of the look, so it is measured with the spacing applied.
   */
  function title(x, o, c, cx, y, opt) {
    const name = (o.name || '').trim();
    if (!name) return 0;
    const maxW = (opt && opt.maxW) || W - 80;
    const weight = (opt && opt.weight) || 800;
    const track = (opt && opt.track) || '0px';
    const align = (opt && opt.align) || 'center';
    let size = (opt && opt.size) || 46;
    x.save();
    x.textAlign = align; x.textBaseline = 'middle';
    x.letterSpacing = track;
    do {
      x.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
      if (x.measureText(name).width <= maxW || size <= 14) break;
      size -= 2;
    } while (true);
    if (opt && opt.glow !== false) { x.shadowColor = mix(c, 0.45); x.shadowBlur = 22; }
    x.fillStyle = (opt && opt.fill) || '#ffffff';
    x.fillText(name, cx, y);
    const wide = x.measureText(name).width;
    x.restore();
    return wide;
  }

  function sub(x, text, c, cx, y, align) {
    if (!text) return;
    x.save();
    x.textAlign = align || 'center'; x.textBaseline = 'middle';
    x.font = '600 11px "Segoe UI", system-ui, sans-serif';
    x.letterSpacing = '3px';
    x.fillStyle = mix(c, 0.8);
    x.fillText(String(text).toUpperCase(), cx, y);
    x.restore();
  }

  /** A soft round light. Used for every glow, so they all look like the same light source. */
  function blob(x, cx, cy, r, c, a) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, mix(c, a));
    g.addColorStop(0.55, mix(c, a * 0.35));
    g.addColorStop(1, mix(c, 0));
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const designs = [
    { id: 'aurora',  name: 'Aurora',  note: 'Two slow lights drifting' },
    { id: 'reveal',  name: 'Reveal',  note: 'A scan line lights the letters as it passes' },
    { id: 'horizon', name: 'Horizon', note: 'A grid running to the horizon' },
    { id: 'orbit',   name: 'Orbit',   note: 'Thin arcs turning around the name' },
    { id: 'console', name: 'Console', note: 'Scan output scrolling behind the name' },
  ];

  const painters = {
    // Two large soft lights drifting on their own ellipses, added together. Everything else is
    // flat, so the only movement is light - which is what makes it read as calm, not busy.
    aurora(x, o, c, t) {
      ground(x, c);
      x.save();
      x.globalCompositeOperation = 'lighter';
      blob(x, W * 0.28 + Math.cos(t * TAU) * 60, H * 0.35 + Math.sin(t * TAU) * 40, 210, c, 0.30);
      blob(x, W * 0.74 + Math.cos(t * TAU + 2.1) * 70, H * 0.68 + Math.sin(t * TAU + 2.1) * 34, 180, c, 0.20);
      x.restore();
      x.fillStyle = mix(c, 0.5); x.fillRect(0, H - 1, W, 1);
      title(x, o, c, 44, H - 76, { align: 'left', maxW: W - 88, size: 44, track: '-0.5px' });
      sub(x, o.sub, c, 46, H - 42, 'left');
    },

    // The name is drawn twice: dim, then bright inside a narrow band that crosses the frame.
    // The light does not pass over the letters, it passes through them.
    reveal(x, o, c, t) {
      ground(x, c);
      x.save();
      x.globalCompositeOperation = 'lighter';
      blob(x, W / 2, H / 2, 240, c, 0.10);
      x.restore();

      const yName = H / 2 - 6;
      const opt = { size: 50, track: '-1px' };
      title(x, o, c, W / 2, yName, Object.assign({ fill: 'rgba(255,255,255,0.20)', glow: false }, opt));

      const lx = t * (W + 200) - 100;
      x.save();
      x.beginPath(); x.rect(lx - 55, 0, 110, H); x.clip();
      title(x, o, c, W / 2, yName, Object.assign({ fill: '#ffffff' }, opt));
      x.restore();

      x.save();
      x.globalCompositeOperation = 'lighter';
      const g = x.createLinearGradient(lx - 70, 0, lx + 70, 0);
      g.addColorStop(0, mix(c, 0)); g.addColorStop(0.5, mix(c, 0.22)); g.addColorStop(1, mix(c, 0));
      x.fillStyle = g; x.fillRect(lx - 70, 0, 140, H);
      x.restore();
      x.fillStyle = mix(c, 0.9); x.fillRect(lx, 0, 1.5, H);

      sub(x, o.sub, c, W / 2, yName + 46);
    },

    // A grid running away to a horizon, rows travelling towards the viewer. The spacing is
    // squared so the rows bunch up near the horizon the way perspective makes them.
    horizon(x, o, c, t) {
      ground(x, c);
      const hz = H * 0.60;
      x.save();
      x.globalCompositeOperation = 'lighter';
      blob(x, W / 2, hz, 230, c, 0.26);
      x.restore();

      x.strokeStyle = mix(c, 0.30); x.lineWidth = 1;
      for (let i = -9; i <= 9; i++) {
        x.beginPath(); x.moveTo(W / 2 + i * 14, hz); x.lineTo(W / 2 + i * 150, H); x.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const p = ((i + t) % 12) / 12;
        const y = hz + (H - hz) * p * p;
        x.globalAlpha = 0.15 + p * 0.55;
        x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
      }
      x.globalAlpha = 1;
      x.fillStyle = mix(c, 0.85); x.fillRect(0, hz, W, 1);

      title(x, o, c, W / 2, hz - 58, { size: 46, track: '-0.5px' });
      sub(x, o.sub, c, W / 2, hz - 24);
    },

    // Thin arcs turning at different speeds. Arcs, not full rings: a broken circle turning is
    // legible, a complete one looks like it is standing still.
    orbit(x, o, c, t) {
      ground(x, c);
      x.save();
      x.globalCompositeOperation = 'lighter';
      blob(x, W / 2, H / 2, 200, c, 0.16);
      x.restore();
      const rings = [[150, 1.0, 1.6], [116, -0.7, 2.6], [186, 0.45, 1.0]];
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i][0], speed = rings[i][1], span = rings[i][2];
        const a0 = t * TAU * speed;
        x.beginPath();
        x.ellipse(W / 2, H / 2, r, r * 0.62, 0, a0, a0 + span);
        x.strokeStyle = mix(c, 0.55); x.lineWidth = 1.4; x.stroke();
        const px = W / 2 + Math.cos(a0 + span) * r, py = H / 2 + Math.sin(a0 + span) * r * 0.62;
        x.beginPath(); x.arc(px, py, 2.6, 0, TAU); x.fillStyle = mix(c, 0.95); x.fill();
      }
      title(x, o, c, W / 2, H / 2 - 4, { size: 44, track: '-0.5px' });
      sub(x, o.sub, c, W / 2, H / 2 + 40);
    },

    // Lines of scan output scrolling up behind the name. The text is fixed and invented - it is
    // wallpaper, not a log, and says nothing about the PC it runs on.
    console(x, o, c, t) {
      ground(x, c);
      const LINES = [
        'reading prefetch', 'usn journal   ok', 'signatures   4812', 'shadow copy  scan',
        'recycle bin   ok', 'service memory', 'drivers       ok', 'usb history',
        'process list  ok', 'macro check', 'event log     ok', 'strings      1340',
      ];
      x.save();
      x.font = '12px Consolas, "Courier New", monospace';
      x.textAlign = 'left'; x.textBaseline = 'middle';
      const n = LINES.length, step = H / 8;
      for (let i = 0; i < n; i++) {
        const p = ((i / n) - t) % 1;
        const y = (p < 0 ? p + 1 : p) * (H + step) - step / 2;
        x.fillStyle = mix(c, 0.16 + (i % 3) * 0.05);
        x.fillText(LINES[i], 26 + (i % 4) * 58, y);
      }
      x.restore();
      // A tall, very soft plate: a short one shows its own edges and reads as a grey box
      // sitting on the text rather than as the text being lit from behind.
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(4,6,10,0)'); g.addColorStop(0.32, 'rgba(4,6,10,0.72)');
      g.addColorStop(0.5, 'rgba(4,6,10,0.92)'); g.addColorStop(0.68, 'rgba(4,6,10,0.72)');
      g.addColorStop(1, 'rgba(4,6,10,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      title(x, o, c, W / 2, H / 2 - 6, { size: 46, track: '-0.5px' });
      sub(x, o.sub, c, W / 2, H / 2 + 38);
    },
  };

  function draw(x, o, t) {
    const c = rgb(o.color);
    (painters[o.design] || painters.aurora)(x, o, c, ((t % 1) + 1) % 1);
  }

  // ── the GIF ────────────────────────────────────────────────────────────────────────────
  // A GIF89a writer. Browsers give us RGBA; a GIF needs palette indices, so the frames are
  // quantised to one shared 256-colour palette built from the frames themselves (a median-cut
  // would be nicer, but these pictures are a ground plus one accent, and an even cut over the
  // colours that actually occur is indistinguishable at this size and far quicker).

  function Bytes() { this.b = []; }
  Bytes.prototype.u8 = function (v) { this.b.push(v & 255); return this; };
  Bytes.prototype.u16 = function (v) { this.b.push(v & 255, (v >> 8) & 255); return this; };
  Bytes.prototype.str = function (s) { for (let i = 0; i < s.length; i++) this.b.push(s.charCodeAt(i) & 255); return this; };
  Bytes.prototype.raw = function (a) { for (let i = 0; i < a.length; i++) this.b.push(a[i] & 255); return this; };

  /** One palette for every frame: the 5-bit cube of the colours that actually occur, by count. */
  function palette(frames) {
    const counts = new Map();
    for (const f of frames) {
      for (let i = 0; i < f.length; i += 4) {
        // 5 bits per channel: 32768 buckets, far more than the 256 we keep, so the top 256 are
        // real colours of the picture rather than an average of unrelated ones.
        const key = ((f[i] >> 3) << 10) | ((f[i + 1] >> 3) << 5) | (f[i + 2] >> 3);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map((e) => e[0]);
    while (top.length < 2) top.push(0);
    return top.map((k) => [((k >> 10) & 31) << 3, ((k >> 5) & 31) << 3, (k & 31) << 3]);
  }

  /** Nearest palette entry, cached by 5-bit key — each frame asks for the same colours. */
  function indexer(pal) {
    const cache = new Map();
    return function (r, g, b) {
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      let best = 0, bd = Infinity;
      for (let i = 0; i < pal.length; i++) {
        const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = i; }
      }
      cache.set(key, best);
      return best;
    };
  }

  /** GIF's variable-width LZW, written out into 255-byte sub-blocks. */
  function lzw(indices, minCode) {
    const clear = 1 << minCode, end = clear + 1;
    let size = minCode + 1, next = end + 1;
    let dict = new Map(), cur = -1;
    const out = [];
    let acc = 0, accBits = 0;
    const emit = (code) => {
      acc |= code << accBits; accBits += size;
      while (accBits >= 8) { out.push(acc & 255); acc >>= 8; accBits -= 8; }
    };
    const reset = () => { dict = new Map(); size = minCode + 1; next = end + 1; };

    emit(clear);
    for (let i = 0; i < indices.length; i++) {
      const k = indices[i];
      if (cur === -1) { cur = k; continue; }
      const key = cur * 4096 + k;
      const found = dict.get(key);
      if (found !== undefined) { cur = found; continue; }
      emit(cur);
      if (next < 4096) {
        dict.set(key, next++);
        // The code width grows one bit at a time, and only after the code that needed it.
        if (next - 1 === (1 << size) && size < 12) size++;
      } else { emit(clear); reset(); }
      cur = k;
    }
    if (cur !== -1) emit(cur);
    emit(end);
    if (accBits > 0) out.push(acc & 255);

    const blocks = new Bytes();
    for (let i = 0; i < out.length; i += 255) {
      const chunk = out.slice(i, i + 255);
      blocks.u8(chunk.length).raw(chunk);
    }
    blocks.u8(0);
    return blocks.b;
  }

  // 8×8 Bayer matrix, centred on zero and scaled to about half a palette step.
  const BAYER = (function () {
    const m = [
      [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
      [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
      [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
      [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
    ];
    return m.map((row) => row.map((v) => Math.round((v / 63 - 0.5) * 6)));
  })();
  const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  function encode(frames, pal, delayCs) {
    const g = new Bytes();
    // header + logical screen, global palette, 256 entries
    g.str('GIF89a').u16(W).u16(H).u8(0xF7).u8(0).u8(0);
    for (let i = 0; i < 256; i++) {
      const c = pal[i] || [0, 0, 0];
      g.u8(c[0]).u8(c[1]).u8(c[2]);
    }
    // NETSCAPE2.0 — loop forever
    g.u8(0x21).u8(0xFF).u8(11).str('NETSCAPE2.0').u8(3).u8(1).u16(0).u8(0);

    const toIndex = indexer(pal);
    for (const f of frames) {
      g.u8(0x21).u8(0xF9).u8(4).u8(0).u16(delayCs).u8(0).u8(0);   // graphic control
      g.u8(0x2C).u16(0).u16(0).u16(W).u16(H).u8(0);               // image descriptor
      const idx = new Uint8Array(W * H);
      // Ordered dithering before the lookup. These pictures are mostly soft gradients and a
      // glow around the name; with a flat 256-colour palette and no dither those turn into
      // visible steps and a dark patch behind the text. An 8×8 Bayer offset breaks the step
      // into a texture that is invisible at this size, and costs one add per channel.
      for (let p = 0, i = 0; p < W * H; p++, i += 4) {
        const d = BAYER[(p % W) & 7][((p / W) | 0) & 7];
        idx[p] = toIndex(clamp8(f[i] + d), clamp8(f[i + 1] + d), clamp8(f[i + 2] + d));
      }
      g.u8(8).raw(lzw(idx, 8));
    }
    g.u8(0x3B);
    return g.b;
  }

  function toDataUrl(bytes) {
    let s = '';
    const CH = 8192;                                     // chunked: one spread of 1 MB throws
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.slice(i, i + CH));
    return 'data:image/gif;base64,' + btoa(s);
  }

  /**
   * @param {{name,sub,color,design,frames,fps}} o
   * @param {(p:number)=>void} [onProgress] 0..1
   */
  function gif(o, onProgress) {
    return new Promise((resolve) => {
      const n = Math.max(2, Math.min(40, o.frames || 16));
      const fps = Math.max(5, Math.min(25, o.fps || 12));
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const x = cv.getContext('2d', { willReadFrequently: true });
      const frames = [];
      let i = 0;
      // One frame per task, so a 16-frame encode never blocks the page long enough to freeze
      // the button it was started from.
      const step = () => {
        if (i < n) {
          draw(x, o, i / n);
          frames.push(x.getImageData(0, 0, W, H).data);
          i++;
          if (onProgress) onProgress((i / n) * 0.6);
          return setTimeout(step, 0);
        }
        const pal = palette(frames);
        if (onProgress) onProgress(0.75);
        setTimeout(() => {
          const bytes = encode(frames, pal, Math.round(100 / fps));
          if (onProgress) onProgress(1);
          resolve(toDataUrl(bytes));
        }, 0);
      };
      step();
    });
  }

  w.HSBG = { designs, draw, gif, W, H };
})(window);
