import { icon } from './icons.js';

// ---------- Data ----------

export const stackCards = [
  {
    title: 'Driver Discovery',
    theme: 'light',
    items: [['gauge', 'Connector matching'], ['plug', 'Reachable-range filter'], ['sun', 'Pune map and list'], ['bell', 'Freshness labels']],
    text: 'Every result must pass connector compatibility and the range calculation with its safety margin, so ineligible chargers stay hidden.',
  },
  {
    title: 'Community Booking',
    theme: 'blue',
    items: [['car', 'Start and end time'], ['clock', 'Host reply window'], ['receipt', 'Checkout window'], ['sun', 'Cancellation policy']],
    text: 'The host has two minutes to accept a request, then a five-minute checkout opens before the driver is told to travel.',
  },
  {
    title: 'Transparent Pricing',
    theme: 'dark',
    items: [['wallet', 'Indicative cost'], ['chart', 'Itemised receipt'], ['calendar', 'Basic or Standard'], ['leaf', 'No surge pricing']],
    text: 'The full price is disclosed before the driver commits, with parking and overtime terms shown separately.',
  },
  {
    title: 'Host Controls',
    theme: 'soft',
    items: [['shield', 'Weekly schedule'], ['spark', 'Accept or decline'], ['bell', 'Blackout periods'], ['receipt', 'Earnings records']],
    text: 'Hosts share charging on their own schedule, control who books, and keep visible records with transparent deductions.',
  },
  {
    title: 'Admin Verification',
    theme: 'blue',
    items: [['user', 'Identity reviewed'], ['receipt', 'Property reviewed'], ['calendar', 'Equipment evidence'], ['shield', 'Paid-operation check']],
    text: 'Each check is recorded separately instead of one generic Verified badge, and only approved sites take real bookings.',
  },
];

export const smarterCards = [
  { icon: 'gauge', title: 'Connector\nChecks', text: 'Mode, inlet, cable and effective power matter, not only the connector name.', primary: true },
  { icon: 'clock', title: 'Conservative\nEstimates', text: 'Range uses usable capacity, your battery level and a safety margin.' },
  { icon: 'chart', title: 'Status\nFreshness', text: 'Labels separate host updates, partner data, stale, unknown and demo.' },
  { icon: 'shield', title: 'Access\nInstructions', text: 'Private entrance and contact details unlock once you are confirmed.' },
  { icon: 'wrench', title: 'Confirmed Before\nYou Leave', text: 'Community slots need host acceptance before the driver sets off.' },
];

export const steps = [
  { title: 'Discover and compare', text: 'Only chargers that fit your car appear.' },
  { title: 'Request a community slot', text: 'The host has two minutes to confirm it.' },
  { title: 'Arrive and charge', text: 'An arrival code confirms the booking.' },
  { title: 'Get your receipt', text: 'An itemised receipt closes the session.' },
];

export const stories = [
  {
    img: '/img/story-1.jpg',
    quote: 'Beyond finding a pin, drivers must know if the connector fits and the equipment works. They need entry to the property. They need a free slot and the full cost.',
    name: 'Car Owners',
    role: 'Planned charging',
  },
  {
    img: '/img/story-2.jpg',
    quote: 'Ampere must not promise rescue at 4%. It filters carefully and shows an honest empty state when no credible option exists.',
    name: 'Low Battery',
    role: '4% demo driver, Pune',
  },
  {
    img: '/img/story-3.jpg',
    quote: 'Sharing brings parking conflicts, load limits and strangers at the property. Hosts need control over who books and when.',
    name: 'Home Owners',
    role: 'With permitted parking',
  },
  {
    img: '/img/story-4.jpg',
    quote: 'Cafés and offices can offer suitable chargers and spare visitor capacity. They keep control of who books and when the charger is offered.',
    name: 'Venue Hosts',
    role: 'Cafés or offices',
  },
  {
    img: '/img/story-5.jpg',
    quote: 'Administrators review verification evidence. They also handle suspensions, disputes, event history and payment exceptions.',
    name: 'Site Admins',
    role: 'Verification queue',
  },
];

export const articles = [
  { img: '/img/article-1.jpg', tag: 'Policy', time: 'Source S7', title: 'Ministry of Power charging guidelines, 2024', text: 'Clauses on home connections, authorised visitors and fees.' },
  { img: '/img/article-2.jpg', tag: 'Roaming', time: 'Source S5', title: 'How does OCPI connect charging platforms?', text: 'OCPI connects platforms; OCPP connects charging equipment.' },
  { img: '/img/article-3.jpg', tag: 'Maps', time: 'Source S8', title: 'OpenStreetMap tile usage policy and limits', text: 'Public tiles have a usage policy and no availability guarantee.' },
  { img: '/img/article-4.jpg', tag: 'Payments', time: 'Source S9', title: 'Razorpay payment integration steps', text: 'The server verifies signature and captured payment status.' },
  { img: '/img/article-5.jpg', tag: 'Security', time: 'Source S10', title: 'Supabase row level security and keys', text: 'Policies isolate each driver\'s bookings and each host\'s sites.' },
];

export const faqs = [
  { q: 'Which vehicles does Ampere support?', a: 'Cars are the first supported vehicle category. Scooters and other vehicles will need a separate compatibility and equipment review before Ampere supports them.' },
  { q: 'Can Ampere reserve public chargers?', a: 'Not directory listings. The operator handles access and payment there. Ampere reserves only through supported connected integrations.' },
  { q: 'When should I start driving?', a: 'Only after the host confirms and any checkout is complete. Your booking then shows host confirmed. Starting the journey appends a departure event and shows on the way.' },
  { q: 'Who sees the exact address?', a: 'Discovery shows only an approximate area. Exact entrance, address and host contact appear only to an authorised confirmed driver.' },
  { q: 'What if a host declines my request?', a: 'The hold is released and no charge is due. Ampere shows alternatives, and you choose one only after a fresh reachability check runs.' },
  { q: 'Is there a booking fee?', a: 'Basic has no recurring fee, and Standard has a proposed ₹20 booking fee. In the demo, 8 kWh at ₹14/kWh plus that fee shows a ₹132 total.' },
];

// ---------- Renderers ----------

const arrowSwap = `<span class="arrow-swap" aria-hidden="true"><span class="arrow-swap-inner">${icon('arrow')}${icon('arrow')}</span></span>`;

export function renderContent() {
  // Scroll-stack cards
  const stackInner = document.querySelector('[data-stack] .stack-inner');
  const stackTrack = document.querySelector('[data-stack-track]');
  if (stackInner) {
    stackInner.innerHTML = stackCards
      .map(
        (c, i) => `
      <article class="stack-card stack-card--${c.theme}" data-stack-card style="z-index:${i + 1}">
        <h3 class="text-44 stack-title">${c.title}</h3>
        <div class="stack-rule"></div>
        <div class="stack-body">
          <div class="stack-grid">
            ${c.items
              .map(
                ([ic, label]) => `
              <div class="stack-item">
                <span class="stack-tile">${icon(ic)}</span>
                <span class="text-22">${label}</span>
              </div>`
              )
              .join('')}
          </div>
          <div class="stack-side">
            <p class="text-24">${c.text}</p>
            <span class="stack-index text-20">${String(i + 1).padStart(2, '0')} / ${String(stackCards.length).padStart(2, '0')}</span>
          </div>
        </div>
      </article>`
      )
      .join('');
    stackTrack.style.setProperty('--stack-h', `${90 * Math.max(stackCards.length - 1, 1) + 95}svh`);
  }

  // Smarter cards
  const smarter = document.querySelector('[data-smarter-cards]');
  if (smarter) {
    smarter.innerHTML = smarterCards
      .map(
        (c) => `
      <div class="smarter-card ${c.primary ? 'smarter-card--primary' : ''}" data-smarter-card>
        <span class="smarter-texture" aria-hidden="true"></span>
        <div class="smarter-card-top">${icon(c.icon, 'smarter-icon')}</div>
        <div class="smarter-card-body">
          <h3>${c.title}</h3>
          <p class="text-22">${c.text}</p>
        </div>
      </div>`
      )
      .join('');
  }

  // How it works steps
  const how = document.querySelector('[data-how-steps]');
  if (how) {
    how.innerHTML = steps
      .map(
        (s) => `
      <div class="how-step" data-how-step>
        <svg class="how-line" viewBox="0 0 20 150" aria-hidden="true">
          <line x1="10" y1="0" x2="10" y2="150" class="how-line-track"/>
          <line x1="10" y1="0" x2="10" y2="150" class="how-line-fill" data-how-path/>
          <circle cx="10" cy="0" r="7" class="how-dot" data-how-dot/>
        </svg>
        <div class="how-step-text">
          <h3 class="step-title">${s.title}</h3>
          <p class="text-22">${s.text}</p>
        </div>
      </div>`
      )
      .join('');
  }

  // Stories
  const media = document.querySelector('[data-story-media]');
  const slides = document.querySelector('[data-story-slides]');
  const strip = document.querySelector('[data-stories-strip]');
  if (media && slides && strip) {
    media.innerHTML = stories
      .map((s, i) => `<div class="story-media-item" data-story-img style="z-index:${i === 0 ? 2 : 1}"><img src="${s.img}" alt="" draggable="false"/></div>`)
      .join('');
    slides.innerHTML = stories
      .map(
        (s) => `
      <div class="story-slide" data-story-slide>
        <p class="story-quote text-24">“${s.quote}”</p>
        <p class="story-name">${s.name}</p>
        <p class="story-role text-22">${s.role}</p>
      </div>`
      )
      .join('');
    strip.innerHTML = stories
      .map(
        (s, i) => `
      <button type="button" class="story-thumb" data-story-thumb="${i}" aria-label="Show persona: ${s.name}">
        <img src="${s.img}" alt="" draggable="false"/>
        <span class="story-thumb-name">${s.name}</span>
      </button>`
      )
      .join('');
    document.querySelector('[data-stories-total]').textContent = String(stories.length).padStart(2, '0');
  }

  // Resources
  const res = document.querySelector('[data-res-track]');
  if (res) {
    res.innerHTML = articles
      .map(
        (a) => `
      <article class="article-card" data-article tabindex="0">
        <img src="${a.img}" alt="${a.title}" draggable="false"/>
        <span class="article-tag">${a.tag}</span>
        <div class="article-panel" data-article-panel>
          <div class="article-meta" data-panel-item><span>${a.tag}</span><span>${a.time}</span></div>
          <h3 class="text-30" data-panel-item>${a.title}</h3>
          <p class="text-20" data-panel-item>${a.text}</p>
          <a href="#" class="article-link text-20" data-panel-item>Read source ${arrowSwap}</a>
        </div>
      </article>`
      )
      .join('');
  }

  // FAQ
  const faq = document.querySelector('[data-faq]');
  if (faq) {
    faq.innerHTML = faqs
      .map(
        (f, i) => `
      <div class="faq-item" role="button" tabindex="0" aria-expanded="${i === 0}" aria-controls="faq-a-${i}" id="faq-q-${i}" data-faq-item>
        <div class="faq-fill" aria-hidden="true"></div>
        <div class="faq-line" data-line-draw></div>
        <div class="faq-q">
          <div class="faq-q-text" data-fade>${f.q}</div>
          <span class="faq-icon" data-fade><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path class="faq-icon-v" d="M12 5v14"/></svg></span>
        </div>
        <div class="faq-a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}" data-faq-answer style="height:${i === 0 ? 'auto' : '0px'}">
          <p class="text-22">${f.a}</p>
        </div>
      </div>`
      )
      .join('');
  }

  // Odometer counters
  document.querySelectorAll('[data-odo]').forEach((el) => {
    const value = el.dataset.odo;
    el.setAttribute('aria-label', value);
    el.innerHTML = [...value]
      .map((ch) =>
        /\d/.test(ch)
          ? `<span class="odo-digit" aria-hidden="true" data-digit="${ch}"><span class="odo-col">${'0123456789'
              .split('')
              .map((d) => `<span>${d}</span>`)
              .join('')}</span></span>`
          : `<span class="odo-char" aria-hidden="true">${ch}</span>`
      )
      .join('');
  });
}
