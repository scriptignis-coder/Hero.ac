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

  function title(x, o, c, y, size) {
    const name = (o.name || '').trim();
    if (!name) return;
    x.save();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
    x.shadowColor = mix(c, 0.55); x.shadowBlur = 26;
    x.fillStyle = '#ffffff';
    x.fillText(name, W / 2, y);
    x.restore();
  }

  function sub(x, text, c, y) {
    if (!text) return;
    x.save();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '600 12px "Segoe UI", system-ui, sans-serif';
    x.fillStyle = mix(c, 0.85);
    x.letterSpacing = '2px';
    x.fillText(text, W / 2, y);
    x.restore();
  }

  const designs = [
    { id: 'tide',  name: 'Tide',    note: 'Water line under the name' },
    { id: 'scan',  name: 'Scan',    note: 'Sweeping scan line on a grid' },
    { id: 'pulse', name: 'Pulse',   note: 'Rings opening behind the name' },
    { id: 'storm', name: 'Storm',   note: 'Drifting particles' },
    { id: 'bars',  name: 'Spectrum',note: 'Rising bars along the bottom' },
  ];

  const painters = {
    // A wave band that travels sideways; two waves at different speeds so it never looks
    // like one sliding shape.
    tide(x, o, c, t) {
      ground(x, c);
      title(x, o, c, 126, 46);
      sub(x, o.sub, c, 162);
      for (let k = 0; k < 2; k++) {
        const amp = 12 - k * 4, base = 214 + k * 16, sp = k ? -1 : 1;
        x.beginPath();
        x.moveTo(0, H);
        for (let px = 0; px <= W; px += 5) {
          const a = (px / W) * TAU * (1.5 + k) + sp * t * TAU;
          x.lineTo(px, base + Math.sin(a) * amp);
        }
        x.lineTo(W, H); x.closePath();
        x.fillStyle = mix(c, k ? 0.10 : 0.18); x.fill();
        x.strokeStyle = mix(c, k ? 0.35 : 0.8); x.lineWidth = k ? 1 : 2; x.stroke();
      }
    },

    // A line that crosses the frame once per loop, with a grid behind it. The grid is still:
    // a moving grid plus a moving line reads as noise.
    scan(x, o, c, t) {
      ground(x, c);
      x.strokeStyle = mix(c, 0.10); x.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 25) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, H); x.stroke(); }
      for (let gy = 0; gy <= H; gy += 25) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(W, gy + 0.5); x.stroke(); }
      const lx = t * (W + 120) - 60;
      const g = x.createLinearGradient(lx - 60, 0, lx + 10, 0);
      g.addColorStop(0, mix(c, 0)); g.addColorStop(1, mix(c, 0.28));
      x.fillStyle = g; x.fillRect(lx - 60, 0, 70, H);
      x.strokeStyle = mix(c, 0.95); x.lineWidth = 2;
      x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx, H); x.stroke();
      title(x, o, c, 142, 46);
      sub(x, o.sub, c, 178);
    },

    // Rings opening out from behind the name, each one starting where the last is halfway.
    pulse(x, o, c, t) {
      ground(x, c);
      const N = 3;
      for (let i = 0; i < N; i++) {
        const p = (t + i / N) % 1;
        x.beginPath();
        x.arc(W / 2, H / 2, 30 + p * 210, 0, TAU);
        x.strokeStyle = mix(c, 0.5 * (1 - p)); x.lineWidth = 2; x.stroke();
      }
      title(x, o, c, 140, 48);
      sub(x, o.sub, c, 178);
    },

    // Particles drifting up. Positions come from a fixed seed so every frame agrees on which
    // dot is which, and each one wraps exactly once per loop.
    storm(x, o, c, t) {
      ground(x, c);
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 97) % 500);
        const speed = 0.6 + ((i * 37) % 100) / 100;
        const sy = (((i * 53) % 300) / 300 - t * speed) % 1;
        const py = (sy < 0 ? sy + 1 : sy) * H;
        const r = 1 + ((i * 29) % 3) * 0.7;
        x.beginPath(); x.arc(sx, py, r, 0, TAU);
        x.fillStyle = mix(c, 0.18 + ((i * 17) % 50) / 160); x.fill();
      }
      title(x, o, c, 138, 48);
      sub(x, o.sub, c, 176);
    },

    // Bars along the bottom, each on its own phase, so the row never pumps as one block.
    bars(x, o, c, t) {
      ground(x, c);
      const n = 34, bw = W / n;
      for (let i = 0; i < n; i++) {
        const ph = (i * 0.37) % 1;
        const h = 18 + (Math.sin((t + ph) * TAU) * 0.5 + 0.5) * 70;
        x.fillStyle = mix(c, 0.22 + (h / 90) * 0.55);
        x.fillRect(i * bw + 1.5, H - h, bw - 3, h);
      }
      title(x, o, c, 120, 46);
      sub(x, o.sub, c, 156);
    },
  };

  function draw(x, o, t) {
    const c = rgb(o.color);
    (painters[o.design] || painters.tide)(x, o, c, ((t % 1) + 1) % 1);
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
