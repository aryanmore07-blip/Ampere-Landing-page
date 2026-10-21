import { icon } from './icons.js';

// Phone mockups are built in HTML/CSS (sized with container query units),
// so they stay crisp at any width and need no image assets.

const statusBar = (dark = false) => `
  <div class="ph-status ${dark ? 'ph-status--light' : ''}">
    <span>9:41</span>
    <span class="ph-status-icons">
      <i class="ph-signal"><b></b><b></b><b></b><b></b></i>
      <i class="ph-batt"><b></b></i>
    </span>
  </div>`;

const tabBar = (active = 0) => `
  <div class="ph-tabs">
    ${['home', 'chart', 'grid', 'user']
      .map((n, i) => `<span class="ph-tab ${i === active ? 'is-active' : ''}">${icon(n)}</span>`)
      .join('')}
  </div>`;

function ring(pct) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return `
    <svg class="ph-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="${r}" class="ph-ring-track"/>
      <circle cx="50" cy="50" r="${r}" class="ph-ring-bar" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
    </svg>`;
}

const screens = {
  dashboard: () => `
    ${statusBar()}
    <div class="ph-body">
      <div class="ph-hello">
        <div><p class="ph-muted">Demo driver</p><p class="ph-title">Pune Search</p></div>
        <span class="ph-avatar">D</span>
      </div>
      <div class="ph-card ph-today">
        <div class="ph-ring-wrap">${ring(0.68)}<div class="ph-ring-label"><b>7.2</b><span>kWh to car</span></div></div>
        <div class="ph-today-stats">
          <p><span class="ph-good">7 kW</span><small>charger power</small></p>
          <p><span>₹132</span><small>demo total</small></p>
          <p><span>90%</span><small>efficiency</small></p>
        </div>
      </div>
      <div class="ph-duo">
        <div class="ph-card ph-mini">${icon('sun', 'ph-mini-ic')}<small>Range</small><b>4 km est.</b></div>
        <div class="ph-card ph-mini">${icon('battery', 'ph-mini-ic')}<small>Window</small><b>90 min</b><span class="ph-bar"><i style="width:82%"></i></span></div>
      </div>
      <p class="ph-section">In range</p>
      <div class="ph-card ph-list">
        <div class="ph-row"><span class="ph-ic">${icon('flame')}</span><span class="ph-row-txt"><b>Café charger</b><small>Community</small></span><span class="ph-row-val">7 kW</span></div>
        <div class="ph-row"><span class="ph-ic">${icon('car')}</span><span class="ph-row-txt"><b>Public listing</b><small>Status unknown</small></span><span class="ph-chip">Directory</span></div>
        <div class="ph-row"><span class="ph-ic">${icon('snow')}</span><span class="ph-row-txt"><b>Demo listing</b><small>Synthetic data</small></span><span class="ph-row-val">Demo</span></div>
      </div>
    </div>
    ${tabBar(0)}`,

  rooms: () => `
    ${statusBar()}
    <div class="ph-body">
      <div class="ph-hello"><div><p class="ph-muted">Demo host sites</p><p class="ph-title">Sites</p></div><span class="ph-icon-btn">${icon('search')}</span></div>
      <div class="ph-chips"><span class="is-on">All</span><span>Home</span><span>Café</span><span>Office</span></div>
      <div class="ph-rooms">
        ${[
          ['Café bay', 'flame', 'Accepting', true],
          ['Home bay', 'tv', 'Accepting', true],
          ['Office bay', 'bulb', 'Paused', false],
          ['Society bay', 'washer', 'Accepting', true],
          ['Own car', 'car', 'Blocked', false],
          ['New site', 'plug', 'In review', false],
        ]
          .map(
            ([n, ic, v, on]) => `
          <div class="ph-room ${on ? 'is-on' : ''}">
            <span class="ph-room-ic">${icon(ic)}</span>
            <span class="ph-toggle"><i></i></span>
            <b>${n}</b><small>${v}</small>
          </div>`
          )
          .join('')}
      </div>
    </div>
    ${tabBar(2)}`,

  welcome: () => `
    ${statusBar(true)}
    <div class="ph-welcome">
      <div class="ph-welcome-logo">${icon('bolt')}<span>ampere</span></div>
      <div class="ph-orb">
        <span class="ph-orb-ring r1"></span><span class="ph-orb-ring r2"></span><span class="ph-orb-ring r3"></span>
        <span class="ph-orb-core">${icon('bolt')}</span>
        <span class="ph-orb-tag t1">${icon('sun')}Public</span>
        <span class="ph-orb-tag t2">${icon('battery')}Private</span>
        <span class="ph-orb-tag t3">${icon('car')}Demo</span>
      </div>
      <p class="ph-welcome-title">Every charger, in one search</p>
      <p class="ph-welcome-sub">Find it. Request it. Charge it.</p>
      <span class="ph-welcome-btn">Get started</span>
      <span class="ph-welcome-link">I already have an account</span>
    </div>`,

  devices: () => `
    ${statusBar()}
    <div class="ph-body">
      <div class="ph-hello"><div><p class="ph-muted">Eligible only</p><p class="ph-title">Chargers</p></div><span class="ph-icon-btn">${icon('bell')}</span></div>
      <div class="ph-search">${icon('search')}<span>Search an area</span></div>
      <div class="ph-chips"><span class="is-on">Host type</span><span>Power</span><span>Freshness</span></div>
      <div class="ph-card ph-list">
        ${[
          ['Café charger', 'snow', 'Host-updated', '7 kW', 92],
          ['Office charger', 'washer', 'Partner telemetry', '7 kW', 61],
          ['Home charger', 'fridge', 'Stale info', '7 kW', 34],
          ['Public station', 'tv', 'Status unknown', 'Link', 18],
          ['Demo listing', 'spark', 'Demo data', 'Demo', 9],
        ]
          .map(
            ([n, ic, room, v, p]) => `
          <div class="ph-row ph-row--bar">
            <span class="ph-ic">${icon(ic)}</span>
            <span class="ph-row-txt"><b>${n}</b><small>${room}</small><span class="ph-bar"><i style="width:${p}%"></i></span></span>
            <span class="ph-row-val">${v}</span>
          </div>`
          )
          .join('')}
      </div>
    </div>
    ${tabBar(1)}`,
};

export function renderPhones(root = document) {
  root.querySelectorAll('[data-phone]').forEach((el) => {
    const make = screens[el.dataset.phone];
    if (!make) return;
    el.innerHTML = `
      <div class="phone-frame">
        <div class="phone-screen ${el.dataset.phone === 'welcome' ? 'phone-screen--blue' : ''}">
          <span class="phone-island"></span>
          ${make()}
          <span class="phone-home"></span>
        </div>
      </div>`;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `Ampere app – ${el.dataset.phone} screen`);
  });
}
