import { gsap } from 'gsap';

/*
 * Links into the Ampere web app (frontend/, served at /app/). On click the page fades into the
 * app's canvas colour and then navigates, so the dashboard appears to open in place.
 */

const APP_LINK = 'a[href^="/app/"]';
const APP_CANVAS = '#efefec';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let veil = null;
let leaving = false;

// Prefetch the app document on first hover or focus so the navigation itself is quick.
const warmed = new Set();
function warm(e) {
  const a = e.target.closest?.(APP_LINK);
  if (!a || warmed.has(a.href)) return;
  warmed.add(a.href);
  document.head.append(Object.assign(document.createElement('link'), { rel: 'prefetch', href: a.href }));
}
document.addEventListener('pointerover', warm, { passive: true });
document.addEventListener('focusin', warm);

document.addEventListener('click', (e) => {
  const a = e.target.closest(APP_LINK);
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
  e.preventDefault();
  if (leaving) return;
  leaving = true;

  const go = () => window.location.assign(a.href);
  if (reduced) return go();

  veil = document.createElement('div');
  veil.setAttribute('aria-hidden', 'true');
  veil.style.cssText = `position:fixed;inset:0;z-index:10000;background:${APP_CANVAS};opacity:0;`;
  document.body.append(veil);
  gsap.to(veil, { opacity: 1, duration: 0.55, ease: 'power2.inOut', onComplete: go });
});

// Back from the app via the back/forward cache: lift the veil again.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  leaving = false;
  if (!veil) return;
  const v = veil;
  veil = null;
  gsap.to(v, { opacity: 0, duration: 0.4, ease: 'power2.out', onComplete: () => v.remove() });
});
