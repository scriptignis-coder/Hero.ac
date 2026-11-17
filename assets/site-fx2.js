/* The second effects layer. Everything here is cheap: one rAF-throttled scroll handler,
 * one pointer handler, and an observer. Nothing runs when motion is reduced. */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ── cards lean toward the cursor, buttons follow it a little ────────────
  const TILT = '.card,.feature,.tier,.plan,.pricing-card,.faq-item';
  let held = null;
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest(TILT);
    if (c !== held && held) { held.classList.remove('hs-tilt'); held.style.removeProperty('--rx'); held.style.removeProperty('--ry'); }
    held = c;
    if (c) {
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      c.style.setProperty('--ry', (px * 5).toFixed(2) + 'deg');     // 5° is the most that still
      c.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');    // reads as lighting, not as a gimmick
      c.classList.add('hs-tilt');
    }
    const b = e.target.closest && e.target.closest('.btn');
    if (b) {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 5}px, ${((e.clientY - r.top) / r.height - .5) * 3 - 1}px)`;
    }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const b = e.target.closest && e.target.closest('.btn');
    if (b) b.style.transform = '';
  }, { passive: true });

  // ── headings wipe in; numbers count up ──────────────────────────────────
  const io = new IntersectionObserver((rows) => {
    for (const r of rows) {
      if (!r.isIntersecting) continue;
      r.target.classList.add('hs-seen');
      io.unobserve(r.target);
      const n = r.target.dataset.count;
      if (n) {
        const to = parseFloat(n), t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / 900);
          const e = 1 - Math.pow(1 - k, 3);                 // ease out, so it lands rather than stops
          r.target.textContent = Math.round(to * e) + (to % 1 ? '' : '+');
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }
  }, { threshold: .4 });

  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('section:not(.hero) h2').forEach((h) => { h.classList.add('hs-wipe'); io.observe(h); });
    document.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
  });
})();
