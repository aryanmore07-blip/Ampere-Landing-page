import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

import './style.css';
import { renderPhones } from './phones.js';
import { renderContent } from './content.js';
import { initHeroShader } from './shader.js';
import './app-link.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DESKTOP = '(min-width: 1026px)';
const MOBILE = '(max-width: 1025px)';
const isDesktop = () => window.matchMedia(DESKTOP).matches;
const canHover = window.matchMedia('(hover: hover)').matches;

// Build injected markup first so every animation below sees the final DOM.
renderContent();
renderPhones();

/* ------------------------------------------------------------------ */
/* Scroll reset + smooth scrolling                                     */
/* ------------------------------------------------------------------ */

let lenis = null;
if (!reduced) {
  lenis = new Lenis({
    autoRaf: false,
    duration: 1.35,
    lerp: 0.075,
    smoothWheel: true,
    wheelMultiplier: 0.8,
    touchMultiplier: 0.8,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

if (!location.hash) {
  const toTop = () => {
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  };
  toTop();
  requestAnimationFrame(toTop);
  window.addEventListener('load', toTop, { once: true });
}

function scrollToTarget(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { duration: 2 });
  else target.scrollIntoView({ behavior: 'smooth' });
}

/* ------------------------------------------------------------------ */
/* Intro overlay                                                       */
/* ------------------------------------------------------------------ */

const overlay = document.querySelector('[data-intro-overlay]');
if (overlay) {
  if (reduced) overlay.style.display = 'none';
  else
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.6,
      delay: 0.35,
      ease: 'power2.out',
      onComplete: () => gsap.set(overlay, { display: 'none' }),
    });
}
document.documentElement.classList.add('is-loaded');

/* ------------------------------------------------------------------ */
/* Header: delayed entrance, hide on scroll down, blur after 150px     */
/* ------------------------------------------------------------------ */

const header = document.querySelector('[data-header]');
setTimeout(() => header.classList.add('is-ready'), 1000);
let lastY = 0;
window.addEventListener(
  'scroll',
  () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 150);
    if (y > lastY && y > 100) header.classList.add('is-hidden');
    else if (y < lastY) header.classList.remove('is-hidden');
    lastY = y;
  },
  { passive: true }
);

/* ------------------------------------------------------------------ */
/* Mobile menu (clip-path wipe + staggered rows)                       */
/* ------------------------------------------------------------------ */

const burger = document.querySelector('[data-burger]');
const menu = document.querySelector('[data-mobile-menu]');
const CLOSED = 'inset(0% 0% 100% 0%)';
const OPEN = 'inset(0% 0% 0% 0%)';
let menuOpen = false;
let menuTl = null;
gsap.set(menu, { autoAlpha: 0, clipPath: CLOSED });

function setMenu(open) {
  if (open === menuOpen) return;
  menuOpen = open;
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  header.classList.toggle('menu-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  open ? lenis?.stop() : lenis?.start();

  const rows = menu.querySelectorAll('[data-menu-row]');
  menuTl?.kill();
  gsap.killTweensOf([menu, ...rows]);
  const tl = gsap.timeline();
  menuTl = tl;

  if (open) {
    gsap.set(menu, { autoAlpha: 1 });
    if (reduced) {
      tl.set(menu, { clipPath: OPEN }).fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.2 }).set(rows, { opacity: 1, y: 0 });
    } else {
      tl.fromTo(menu, { clipPath: CLOSED }, { clipPath: OPEN, duration: 0.5, ease: 'power3.inOut' }, 0).fromTo(
        rows,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05, clearProps: 'opacity,transform' },
        0.18
      );
    }
  } else if (reduced) {
    tl.to(menu, { autoAlpha: 0, duration: 0.15 });
  } else {
    tl.to(rows, { opacity: 0, y: 12, duration: 0.2, ease: 'power2.in', stagger: { each: 0.02, from: 'end' } }, 0)
      .to(menu, { clipPath: CLOSED, duration: 0.38, ease: 'power3.inOut' }, 0.06)
      .set(menu, { autoAlpha: 0 });
  }
}
burger.addEventListener('click', () => setMenu(!menuOpen));
window.matchMedia(DESKTOP).addEventListener('change', (e) => e.matches && setMenu(false));

// In-page anchors: smooth scroll via Lenis.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute('href');
  e.preventDefault();
  if (href.length < 2) return;
  setMenu(false);
  scrollToTarget(href);
});

/* ------------------------------------------------------------------ */
/* Text reveal: SplitText lines in masks, slide up from 150%           */
/* ------------------------------------------------------------------ */

function initReveals() {
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const delay = parseFloat(el.dataset.delay || '0');

    if (reduced) {
      gsap.to(el, { opacity: 1, duration: 0.3, delay, ease: 'none', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      return;
    }

    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    if (!split.lines.length) {
      gsap.set(el, { opacity: 1 });
      return;
    }
    gsap.set(el, { opacity: 1 });
    gsap.set(split.lines, { yPercent: 150 });

    const play = () =>
      gsap.to(split.lines, {
        yPercent: 0,
        duration: 0.85,
        stagger: 0.08,
        ease: 'power3.out',
        delay,
        onComplete: () => split.revert(),
      });

    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) play();
    else ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: play });
  });
}

/* Fade-up for buttons, cards and small blocks. */
function initFades() {
  document.querySelectorAll('[data-fade]').forEach((el) => {
    const delay = parseFloat(el.dataset.delay || '0');
    if (reduced) {
      gsap.to(el, { opacity: 1, duration: 0.3, delay, scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
      return;
    }
    gsap.fromTo(
      el,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        delay,
        ease: 'power3.out',
        clearProps: 'transform',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      }
    );
  });
}

/* Horizontal rules that draw in from the left. */
function initLineDraw() {
  document.querySelectorAll('[data-line-draw]').forEach((el) => {
    const trigger = el.parentElement ?? el;
    if (reduced) gsap.from(el, { opacity: 0, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger, start: 'top 65%' } });
    else
      gsap.fromTo(
        el,
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left', duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger, start: 'top 65%' } }
      );
  });
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function initHero() {
  const canvas = document.querySelector('[data-hero-canvas]');
  let stopShader = null;
  const syncShader = () => {
    if (isDesktop() && !reduced) {
      if (!stopShader) stopShader = initHeroShader(canvas);
    } else if (stopShader) {
      stopShader();
      stopShader = null;
    }
  };
  syncShader();
  window.matchMedia(DESKTOP).addEventListener('change', syncShader);

  const phone = document.querySelector('[data-hero-phone]');
  gsap.matchMedia().add(`${DESKTOP} and (prefers-reduced-motion: no-preference)`, () => {
    gsap.to(phone, {
      yPercent: 15,
      ease: 'none',
      scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: 0.2 },
    });
  });
}

/* ------------------------------------------------------------------ */
/* About: three phones drifting against each other                     */
/* ------------------------------------------------------------------ */

function initAbout() {
  const wrap = document.querySelector('[data-about-phones]');
  const left = wrap.querySelector('[data-about-left]');
  const center = wrap.querySelector('[data-about-center]');
  const right = wrap.querySelector('[data-about-right]');
  const line = wrap.querySelector('[data-about-line]');
  const phones = [center, right, left];

  if (reduced) {
    gsap.set([...phones, line], { opacity: 1 });
    return;
  }
  gsap.set(phones, { opacity: 1 });

  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    gsap.to(line, { opacity: 1, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: wrap, start: 'top 65%', once: true } });
    gsap
      .timeline({ scrollTrigger: { trigger: '#about', start: '30% bottom', end: 'bottom top', scrub: 0.5 } })
      .fromTo([left, right], { y: -72 }, { y: 72 }, 0)
      .fromTo(center, { y: 72 }, { y: -72 }, 0);
  });
  mm.add(MOBILE, () => {
    phones.forEach((p) =>
      gsap.from(p, { opacity: 0, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: p, start: 'top 85%', once: true } })
    );
  });
}

/* ------------------------------------------------------------------ */
/* Section break: characters tint dim → blue → ink while scrolling     */
/* ------------------------------------------------------------------ */

function initTextFill() {
  const section = document.querySelector('[data-text-fill-section]');
  const heading = section.querySelector('[data-text-fill]');
  const split = SplitText.create(heading, { type: 'words,chars', charsClass: 'tf-char', aria: false });
  heading.setAttribute('aria-label', heading.textContent.trim().replace(/\s+/g, ' '));
  gsap.set(heading, { opacity: 1 });
  const chars = split.chars;
  const DIM = '#dddddd';
  const INK = '#111111';
  const BLUE = '#1A4BDB';
  const st = { trigger: section, start: 'top 75%', end: 'bottom 85%', scrub: 0.6 };

  gsap.set(chars, { color: DIM, opacity: 0.55 });
  if (reduced) {
    gsap.to(chars, { color: INK, opacity: 1, ease: 'none', scrollTrigger: st });
    return;
  }
  gsap
    .timeline({ scrollTrigger: st })
    .to(chars, { color: BLUE, opacity: 1, duration: 4.2, ease: 'sine.inOut', stagger: 0.5 }, 0)
    .to(chars, { color: INK, duration: 5, ease: 'sine.inOut', stagger: 0.5 }, 4.8);
}

/* ------------------------------------------------------------------ */
/* Feature scroll-stack                                                */
/* ------------------------------------------------------------------ */

function stackPeek() {
  const w = window.innerWidth;
  if (w <= 768) return (20 * w) / 100;
  if (w <= 1025) return (15 * w) / 100;
  return (3 * w) / 100 + 62;
}

function initStack() {
  const track = document.querySelector('[data-stack-track]');
  const sticky = document.querySelector('[data-stack-sticky]');
  const cards = gsap.utils.toArray('[data-stack-card]');
  if (!cards.length || reduced) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: track,
      start: 'top 5%',
      end: () => {
        const top = parseFloat(getComputedStyle(sticky).top) || 0;
        return `bottom ${sticky.offsetHeight + top}px`;
      },
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  gsap.set(cards[0], { y: 0 });
  cards.slice(1).forEach((card, i) => {
    tl.fromTo(card, { y: () => 0.9 * window.innerHeight - card.offsetTop }, { y: 0, ease: 'none', duration: 1 }, i);
    for (let j = 0; j <= i; j++) {
      const depth = i + 1 - j;
      tl.to(cards[j], { y: () => -depth * stackPeek(), ease: 'none', duration: 1 }, i);
    }
  });
}

/* ------------------------------------------------------------------ */
/* "Smarter" cards: horizontal scroll + cursor-following texture       */
/* ------------------------------------------------------------------ */

function initSmarter() {
  const trigger = document.querySelector('[data-smarter-trigger]');
  const row = document.querySelector('[data-smarter-cards]');

  if (reduced) gsap.set(row, { x: 0, xPercent: 0 });
  else
    gsap.fromTo(
      row,
      { xPercent: 70 },
      {
        xPercent: 0,
        x: () => -Math.max(0, row.scrollWidth - row.parentElement.clientWidth),
        ease: 'none',
        scrollTrigger: { trigger, start: 'top 60%', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true },
      }
    );

  if (!canHover) return;
  const ease = 'power3.out';
  row.querySelectorAll('[data-smarter-card]').forEach((card) => {
    const tex = card.querySelector('.smarter-texture');
    const qx = gsap.quickTo(tex, '--tx', { unit: 'px', duration: 0.35, ease });
    const qy = gsap.quickTo(tex, '--ty', { unit: 'px', duration: 0.35, ease });
    const local = (e) => {
      const r = card.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    card.addEventListener('mouseenter', (e) => {
      const { x, y } = local(e);
      gsap.set(tex, { '--tx': `${x}px`, '--ty': `${y}px` });
      gsap.to(tex, { opacity: 0.9, duration: 0.45, ease, overwrite: 'auto' });
    });
    card.addEventListener('mousemove', (e) => {
      const { x, y } = local(e);
      qx(x);
      qy(y);
    });
    card.addEventListener('mouseleave', () => gsap.to(tex, { opacity: 0, duration: 0.45, ease, overwrite: 'auto' }));
  });
}

/* ------------------------------------------------------------------ */
/* How it works: lines draw, dots travel, steps light up               */
/* ------------------------------------------------------------------ */

function initHow() {
  const section = document.querySelector('[data-how]');
  const lines = gsap.utils.toArray('[data-how-path]', section);
  const dots = gsap.utils.toArray('[data-how-dot]', section);
  const stepEls = gsap.utils.toArray('[data-how-step]', section);
  const BLUE = '#1A4BDB';

  if (reduced) {
    gsap.set(lines, { strokeDasharray: 'none', strokeDashoffset: 0 });
    gsap.set(dots, { fill: BLUE, attr: { cy: 150 } });
    stepEls.forEach((s) => {
      gsap.set(s, { opacity: 1 });
      gsap.set(s.querySelector('.step-title'), { color: BLUE });
    });
    return;
  }

  const tl = gsap.timeline({ scrollTrigger: { trigger: section.querySelector('[data-how-steps]'), start: '10% 55%', end: '90% 70%', scrub: 0.4 } });
  lines.forEach((line, i) => {
    const dot = dots[i];
    gsap.set(line, { strokeDasharray: 150, strokeDashoffset: 150 });
    if (i === 0) tl.to(dot, { fill: BLUE, duration: 0.1 });
    tl.to(line, { strokeDashoffset: 0, ease: 'none' });
    tl.fromTo(dot, { attr: { cy: 0 } }, { attr: { cy: 150 }, ease: 'none' }, '<');
    if (i > 0) tl.to(dot, { fill: BLUE, duration: 0.1 }, '<0.1');
  });

  stepEls.forEach((step) => {
    const title = step.querySelector('.step-title');
    const st = { trigger: step, start: 'top 65%', end: 'top 45%', scrub: 0.2 };
    gsap.fromTo(step, { opacity: 0.3 }, { opacity: 1, ease: 'power2.out', scrollTrigger: st });
    gsap.fromTo(title, { color: '#000000' }, { color: BLUE, ease: 'none', scrollTrigger: st });
  });
}

/* ------------------------------------------------------------------ */
/* Trust: parallax image + rolling odometer digits                     */
/* ------------------------------------------------------------------ */

function initParallax() {
  document.querySelectorAll('[data-parallax]').forEach((wrap) => {
    const img = wrap.querySelector('img');
    const amount = reduced ? 3 : 12;
    gsap.fromTo(
      img,
      { yPercent: -amount },
      { yPercent: amount, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: true } }
    );
  });
  if (!reduced)
    gsap.fromTo(
      '.trust-bg',
      { scale: 1.2 },
      { scale: 1.05, ease: 'none', scrollTrigger: { trigger: '[data-trust]', start: 'top bottom', end: 'bottom top', scrub: true } }
    );
}

function initOdometers() {
  document.querySelectorAll('[data-odo]').forEach((odo, statIndex) => {
    const digits = odo.querySelectorAll('[data-digit]');
    digits.forEach((d, i) => {
      const col = d.querySelector('.odo-col');
      const n = parseInt(d.dataset.digit, 10);
      if (reduced) {
        gsap.set(col, { yPercent: -10 * n });
        return;
      }
      gsap.to(col, {
        yPercent: -10 * n,
        duration: 1.8,
        delay: statIndex * 0.12 + i * 0.1,
        ease: 'power2.out',
        scrollTrigger: { trigger: odo, start: 'top 85%' },
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Stories: draggable strip + clip-path image wipe + line reveal       */
/* ------------------------------------------------------------------ */

function initStories() {
  const imgs = gsap.utils.toArray('[data-story-img]');
  const slides = gsap.utils.toArray('[data-story-slide]');
  const thumbs = gsap.utils.toArray('[data-story-thumb]');
  const strip = document.querySelector('[data-stories-strip]');
  const rail = document.querySelector('[data-stories-rail]');
  const indexEl = document.querySelector('[data-stories-index]');
  const count = slides.length;
  const HIDDEN = 'inset(100% 0% 0% 0%)';
  const SHOWN = 'inset(0% 0% 0% 0%)';
  let current = 0;
  let z = 2;
  let stripX = 0;
  let textTweens = [];

  const splits = slides.map((s) => (reduced ? null : SplitText.create(s.querySelectorAll('p'), { type: 'lines', mask: 'lines' })));
  const lines = splits.map((s) => (s ? s.lines : []));

  imgs.forEach((img, i) => gsap.set(img, { clipPath: i === 0 ? SHOWN : HIDDEN }));
  slides.forEach((s, i) => gsap.set(s, { autoAlpha: i === 0 ? 1 : 0 }));

  const step = () => {
    const a = thumbs[0].getBoundingClientRect();
    const b = thumbs[1]?.getBoundingClientRect();
    return b ? b.left - a.left : a.width;
  };
  const maxShift = () => Math.max(0, strip.scrollWidth - rail.clientWidth);
  const clampX = (x) => gsap.utils.clamp(-maxShift(), 0, x);

  function moveStrip(index, immediate = false) {
    stripX = clampX(-index * step());
    gsap.to(strip, { x: stripX, duration: immediate ? 0 : 0.9, ease: 'power3.inOut', overwrite: true });
  }

  function show(next, immediate = false) {
    next = ((next % count) + count) % count;
    if (next === current && !immediate) return;
    const prev = current;
    current = next;
    indexEl.textContent = String(next + 1).padStart(2, '0');
    thumbs.forEach((t, i) => t.classList.toggle('is-active', i === next));
    moveStrip(next, immediate);

    textTweens.forEach((t) => t.kill());
    textTweens = [];

    if (immediate || reduced) {
      imgs.forEach((img, i) => gsap.set(img, { clipPath: i === next ? SHOWN : HIDDEN, zIndex: i === next ? ++z : 1 }));
      slides.forEach((s, i) => gsap.set(s, { autoAlpha: i === next ? 1 : 0 }));
      return;
    }

    gsap.set(imgs[next], { zIndex: ++z, clipPath: HIDDEN });
    gsap.to(imgs[next], { clipPath: SHOWN, duration: 0.6, ease: 'power2.inOut', overwrite: 'auto' });

    slides.forEach((s, i) => {
      if (i === next) return;
      if (i === prev) textTweens.push(gsap.to(s, { autoAlpha: 0, duration: 0.24, ease: 'power2.in' }));
      else gsap.set(s, { autoAlpha: 0 });
    });
    gsap.set(slides[next], { autoAlpha: 0 });
    textTweens.push(gsap.to(slides[next], { autoAlpha: 1, duration: 0, delay: 0.24 }));
    if (lines[next].length) {
      gsap.set(lines[next], { yPercent: 100 });
      textTweens.push(gsap.to(lines[next], { yPercent: 0, duration: 0.72, ease: 'power3.out', stagger: 0.06, delay: 0.24 }));
    }
  }

  document.querySelector('[data-stories-prev]').addEventListener('click', () => show(current - 1));
  document.querySelector('[data-stories-next]').addEventListener('click', () => show(current + 1));
  thumbs.forEach((t, i) => t.addEventListener('click', () => !dragged && show(i)));

  // Drag the strip; release snaps to the nearest story.
  let dragging = false;
  let dragged = false;
  let startX = 0;
  let baseX = 0;
  rail.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragged = false;
    startX = e.clientX;
    baseX = stripX;
    gsap.killTweensOf(strip);
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) dragged = true;
    if (!dragged) return;
    stripX = baseX + dx;
    const lo = -maxShift();
    const resisted = stripX > 0 ? stripX * 0.35 : stripX < lo ? lo + (stripX - lo) * 0.35 : stripX;
    gsap.set(strip, { x: resisted });
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (!dragged) return;
    const target = Math.round(-clampX(stripX) / step());
    if (target !== current) show(target);
    else moveStrip(current);
    setTimeout(() => (dragged = false), 0);
  });

  window.addEventListener('resize', () => moveStrip(current, true));
  show(0, true);
}

/* ------------------------------------------------------------------ */
/* Resources: entrance slide, drag track, hover panels                 */
/* ------------------------------------------------------------------ */

function initResources() {
  const viewport = document.querySelector('[data-res-viewport]');
  const track = document.querySelector('[data-res-track]');
  const cards = gsap.utils.toArray('[data-article]', track);

  // Entrance
  const mm = gsap.matchMedia();
  const entrance = { trigger: track, start: 'top 85%', once: true };
  mm.add(`${DESKTOP} and (prefers-reduced-motion: no-preference)`, () => {
    gsap.set(track, { xPercent: 30, opacity: 0 });
    gsap.to(track, { xPercent: 0, opacity: 1, duration: 1.8, ease: 'power4.out', scrollTrigger: entrance, onComplete: () => gsap.set(track, { clearProps: 'opacity,transform' }) });
  });
  mm.add(`${DESKTOP} and (prefers-reduced-motion: reduce)`, () => {
    gsap.set(track, { opacity: 0 });
    gsap.to(track, { opacity: 1, duration: 1, scrollTrigger: entrance });
  });
  mm.add(MOBILE, () => {
    gsap.set(track, { opacity: 0 });
    gsap.to(track, { opacity: 1, duration: 1, ease: 'power2.out', scrollTrigger: entrance });
  });

  // Hover panels
  cards.forEach((card) => {
    const panel = card.querySelector('[data-article-panel]');
    const items = panel.querySelectorAll('[data-panel-item]');
    const img = card.querySelector('img');
    if (!canHover) return; // touch: panel stays visible via CSS
    gsap.set(panel, { yPercent: 100 });
    gsap.set(items, { autoAlpha: 0, y: 16 });
    const d = reduced ? 0 : 1;
    const tl = gsap
      .timeline({ paused: true, defaults: { ease: 'power2.out', overwrite: 'auto' } })
      .to(panel, { yPercent: 0, duration: 0.75 * d })
      .to(img, { scale: reduced ? 1 : 1.05, duration: 0.75 * d }, 0)
      .to(items, { autoAlpha: 1, y: 0, duration: 0.5 * d, stagger: 0.03 * d }, 0.25 * d);
    const open = () => tl.timeScale(1).play();
    const close = () => tl.timeScale(1.5).reverse();
    card.addEventListener('mouseenter', open);
    card.addEventListener('mouseleave', close);
    card.addEventListener('focusin', open);
    card.addEventListener('focusout', close);
  });

  // Drag + arrows (with smoothed position)
  let target = 0;
  let pos = 0;
  const max = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
  const clamp = (v) => gsap.utils.clamp(-max(), 0, v);
  const setX = gsap.quickSetter(track, 'x', 'px');
  gsap.ticker.add(() => {
    pos += (target - pos) * 0.12;
    if (Math.abs(target - pos) < 0.05) pos = target;
    setX(pos);
  });

  const cardStep = () => {
    const a = cards[0].getBoundingClientRect();
    const b = cards[1]?.getBoundingClientRect();
    return b ? b.left - a.left : a.width;
  };
  document.querySelector('[data-res-prev]').addEventListener('click', () => (target = clamp(target + cardStep())));
  document.querySelector('[data-res-next]').addEventListener('click', () => (target = clamp(target - cardStep())));

  let down = false;
  let moved = false;
  let sx = 0;
  let base = 0;
  viewport.addEventListener('pointerdown', (e) => {
    down = true;
    moved = false;
    sx = e.clientX;
    base = target;
    viewport.classList.add('is-grabbing');
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 5) moved = true;
    target = clamp(base + dx * 1.2);
  });
  window.addEventListener('pointerup', () => {
    down = false;
    viewport.classList.remove('is-grabbing');
  });
  viewport.addEventListener(
    'click',
    (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    },
    true
  );
  window.addEventListener('resize', () => (target = clamp(target)));
}

/* ------------------------------------------------------------------ */
/* FAQ accordion                                                       */
/* ------------------------------------------------------------------ */

function initFaq() {
  const items = gsap.utils.toArray('[data-faq-item]');
  const toggle = (item) => {
    const answer = item.querySelector('[data-faq-answer]');
    const open = item.getAttribute('aria-expanded') !== 'true';
    item.setAttribute('aria-expanded', String(open));
    gsap.killTweensOf(answer);
    if (open) {
      gsap.set(answer, { height: 'auto' });
      gsap.from(answer, { height: 0, duration: reduced ? 0 : 0.5, ease: 'power3.out', onComplete: () => ScrollTrigger.refresh() });
    } else {
      gsap.to(answer, { height: 0, duration: reduced ? 0 : 0.45, ease: 'power3.inOut', onComplete: () => ScrollTrigger.refresh() });
    }
  };
  items.forEach((item) => {
    item.addEventListener('click', () => toggle(item));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(item);
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* CTA hover flood + fixed footer reveal                               */
/* ------------------------------------------------------------------ */

function initCta() {
  const cta = document.querySelector('[data-cta]');
  const btn = document.querySelector('[data-cta-btn]');
  btn.addEventListener('mouseenter', () => cta.classList.add('is-hot'));
  btn.addEventListener('mouseleave', () => cta.classList.remove('is-hot'));
}

function initFooter() {
  const wrap = document.querySelector('[data-footer-reveal]');
  const footer = document.querySelector('[data-footer]');
  const art = document.querySelector('[data-footer-art]');

  const sync = () => {
    wrap.style.height = isDesktop() ? `${footer.offsetHeight}px` : '';
  };
  sync();
  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      sync();
      ScrollTrigger.refresh();
    });
  }).observe(footer);

  gsap.matchMedia().add(`${DESKTOP} and (prefers-reduced-motion: no-preference)`, () => {
    gsap.fromTo(
      art,
      { yPercent: 100 },
      { yPercent: 0, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom bottom', scrub: 0.2, invalidateOnRefresh: true } }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function boot() {
  initHero();
  initAbout();
  initTextFill();
  initStack();
  initSmarter();
  initHow();
  initParallax();
  initOdometers();
  initStories();
  initResources();
  initFaq();
  initCta();
  initFooter();
  initLineDraw();
  initFades();
  initReveals();
  ScrollTrigger.refresh();
}

// Split text only once the web fonts have loaded, so lines are measured correctly.
let booted = false;
const go = () => {
  if (booted) return;
  booted = true;
  boot();
};
if (document.fonts?.ready) {
  document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
} else go();

window.addEventListener('load', () => ScrollTrigger.refresh());
