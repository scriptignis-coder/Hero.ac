/* The two effects that need to know something the stylesheet cannot: where the cursor is
 * inside a card, and whether a section has been reached yet. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  // the border-light follows the cursor across a card
  const CARDS = '.card,.feature,.tier,.plan,.faq-item,.pricing-card';
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest(CARDS);
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
  }, { passive: true });

  // sections rise into place the first time they are reached
  const io = new IntersectionObserver((rows) => {
    for (const r of rows) if (r.isIntersecting) { r.target.classList.add('hs-seen'); io.unobserve(r.target); }
  }, { rootMargin: '0px 0px -12% 0px', threshold: .06 });

  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('section:not(.hero) > .wrap > *').forEach((el, i) => {
      el.classList.add('hs-in');
      el.style.transitionDelay = Math.min(i, 6) * 55 + 'ms';
      io.observe(el);
    });
  });

  // the nav takes its line once the page has moved
  const onScroll = () => document.body.classList.toggle('hs-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
