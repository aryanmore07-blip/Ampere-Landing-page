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
        <div><p class="ph-muted">Good evening</p><p class="ph-title">Maya's Home</p></div>
        <span class="ph-avatar">M</span>
      </div>
      <div class="ph-card ph-today">
        <div class="ph-ring-wrap">${ring(0.68)}<div class="ph-ring-label"><b>14.2</b><span>kWh today</span></div></div>
        <div class="ph-today-stats">
          <p><span class="ph-good">↓ 18%</span><small>vs last week</small></p>
          <p><span>€2.86</span><small>spent so far</small></p>
          <p><span>63%</span><small>from solar</small></p>
        </div>
      </div>
      <div class="ph-duo">
        <div class="ph-card ph-mini">${icon('sun', 'ph-mini-ic')}<small>Solar</small><b>+6.1 kWh</b></div>
        <div class="ph-card ph-mini">${icon('battery', 'ph-mini-ic')}<small>Battery</small><b>82%</b><span class="ph-bar"><i style="width:82%"></i></span></div>
      </div>
      <p class="ph-section">Active now</p>
      <div class="ph-card ph-list">
        <div class="ph-row"><span class="ph-ic">${icon('flame')}</span><span class="ph-row-txt"><b>Oven</b><small>Kitchen</small></span><span class="ph-row-val">2.1 kW</span></div>
        <div class="ph-row"><span class="ph-ic">${icon('car')}</span><span class="ph-row-txt"><b>EV Charger</b><small>Scheduled 01:00</small></span><span class="ph-chip">Off-peak</span></div>
        <div class="ph-row"><span class="ph-ic">${icon('snow')}</span><span class="ph-row-txt"><b>Heat pump</b><small>Living room</small></span><span class="ph-row-val">0.9 kW</span></div>
      </div>
    </div>
    ${tabBar(0)}`,

  rooms: () => `
    ${statusBar()}
    <div class="ph-body">
      <div class="ph-hello"><div><p class="ph-muted">12 devices online</p><p class="ph-title">Rooms</p></div><span class="ph-icon-btn">${icon('search')}</span></div>
      <div class="ph-chips"><span class="is-on">All</span><span>Upstairs</span><span>Downstairs</span><span>Outside</span></div>
      <div class="ph-rooms">
        ${[
          ['Kitchen', 'flame', '2.4 kW', true],
          ['Living', 'tv', '0.6 kW', true],
          ['Bedroom', 'bulb', '0.1 kW', false],
          ['Laundry', 'washer', '1.2 kW', true],
          ['Garage', 'car', 'Idle', false],
          ['Office', 'plug', '0.3 kW', false],
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
        <span class="ph-orb-tag t1">${icon('sun')}Solar</span>
        <span class="ph-orb-tag t2">${icon('battery')}Battery</span>
        <span class="ph-orb-tag t3">${icon('car')}EV</span>
      </div>
      <p class="ph-welcome-title">Your whole home, in one app</p>
      <p class="ph-welcome-sub">See it. Schedule it. Save on it.</p>
      <span class="ph-welcome-btn">Get started</span>
      <span class="ph-welcome-link">I already have an account</span>
    </div>`,

  devices: () => `
    ${statusBar()}
    <div class="ph-body">
      <div class="ph-hello"><div><p class="ph-muted">Find anything</p><p class="ph-title">Devices</p></div><span class="ph-icon-btn">${icon('bell')}</span></div>
      <div class="ph-search">${icon('search')}<span>Search devices</span></div>
      <div class="ph-chips"><span class="is-on">Using most</span><span>Always on</span><span>Faults</span></div>
      <div class="ph-card ph-list">
        ${[
          ['Heat pump', 'snow', 'Living room', '1.8 kW', 92],
          ['Washer', 'washer', 'Laundry', '1.1 kW', 61],
          ['Fridge', 'fridge', 'Kitchen', '0.2 kW', 34],
          ['Television', 'tv', 'Living room', '0.1 kW', 18],
          ['Router', 'spark', 'Hallway', '12 W', 9],
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
