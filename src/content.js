import { icon } from './icons.js';

// ---------- Data ----------

export const stackCards = [
  {
    title: 'Live Energy Map',
    theme: 'light',
    items: [['gauge', 'Whole-home metering'], ['plug', 'Circuit-level detail'], ['sun', 'Solar & battery sync'], ['bell', 'Real-time alerts']],
    text: 'Watch power flow through your home second by second, from the grid, the roof and the battery, down to the socket that is drawing it.',
  },
  {
    title: 'Smart Scheduling',
    theme: 'blue',
    items: [['car', 'Off-peak EV charging'], ['clock', 'Appliance timers'], ['receipt', 'Tariff-aware runs'], ['sun', 'Weather forecasting']],
    text: 'Heavy loads wait for the cheapest, cleanest hours automatically, without you lifting a finger or changing a single habit.',
  },
  {
    title: 'Bill Intelligence',
    theme: 'dark',
    items: [['wallet', 'Cost forecasting'], ['chart', 'Tariff comparison'], ['calendar', 'Monthly reports'], ['leaf', 'Carbon tracking']],
    text: 'Know what this month will cost before the bill arrives, and see exactly which switch would have saved the most.',
  },
  {
    title: 'Device Health',
    theme: 'soft',
    items: [['shield', 'Fault detection'], ['spark', 'Efficiency scores'], ['bell', 'Service reminders'], ['receipt', 'Warranty vault']],
    text: 'Subtle changes in how an appliance draws power reveal wear early, so you fix things on your schedule, not theirs.',
  },
  {
    title: 'Certified Installers',
    theme: 'blue',
    items: [['user', 'Vetted electricians'], ['receipt', 'Fixed, clear quotes'], ['calendar', 'Same-week visits'], ['shield', 'Workmanship guarantee']],
    text: 'When an upgrade makes sense, book a certified pro in the app with your home data already shared and the job scoped.',
  },
];

export const smarterCards = [
  { icon: 'gauge', title: 'Track Every\nWatt', text: 'See live usage for every room and appliance, refreshed every few seconds.', primary: true },
  { icon: 'clock', title: 'Automate\nthe Routine', text: 'Let heavy loads run themselves when power is cheapest and cleanest.' },
  { icon: 'chart', title: 'Dodge Peak\nPrices', text: 'Ampere watches your tariff and shifts demand before the rates spike.' },
  { icon: 'shield', title: 'Catch Faults\nEarly', text: 'Unusual draw patterns flag failing appliances before they break down.' },
  { icon: 'wrench', title: 'Book a Certified\nInstaller', text: 'From heat pumps to EV chargers, get vetted pros with fixed quotes.' },
];

export const steps = [
  { title: 'Fit the smart sensor', text: 'A clip-on reader suits almost any meter.' },
  { title: 'Let Ampere learn your home', text: 'One week of data builds your energy profile.' },
  { title: 'Review your plan', text: 'Ranked actions, each with savings attached.' },
  { title: 'Watch bills shrink', text: 'Automations run while you get on with life.' },
];

export const stories = [
  {
    img: '/img/story-1.jpg',
    quote: 'I always assumed the dryer was our big expense. Ampere showed me it was an ancient chest freezer in the garage running flat out. Replacing it paid for itself in eight months.',
    name: 'Elena Novak',
    role: 'Homeowner, Lisbon',
  },
  {
    img: '/img/story-2.jpg',
    quote: 'Our panels finally make sense. The app moves the washing and the car charging into sunny hours, and we export far less for far less money.',
    name: 'Tom Brennan',
    role: 'Solar owner, Dublin',
  },
  {
    img: '/img/story-3.jpg',
    quote: 'With five of us at home the bills were chaos. Now the kids compete over the weekly energy score, which I never expected to write.',
    name: 'Aisha Rahman',
    role: 'Family of five, Leeds',
  },
  {
    img: '/img/story-4.jpg',
    quote: 'Off-peak charging used to mean setting alarms. Ampere just handles it, and my cost per kilometre has nearly halved since spring.',
    name: 'Lukas Meier',
    role: 'EV driver, Zürich',
  },
  {
    img: '/img/story-5.jpg',
    quote: 'I manage six flats. Fault alerts flagged a failing immersion heater before a tenant ever noticed, which saved a very awkward weekend call-out.',
    name: 'Grace Okafor',
    role: 'Landlord, Manchester',
  },
];

export const articles = [
  { img: '/img/article-1.jpg', tag: 'Guide', time: '5 min read', title: 'How to read your smart meter in five minutes', text: 'The three numbers that matter, and the ones you can safely ignore.' },
  { img: '/img/article-2.jpg', tag: 'Solar', time: '8 min read', title: 'Is a home battery worth it this year?', text: 'A plain-numbers look at payback, tariffs and self-consumption.' },
  { img: '/img/article-3.jpg', tag: 'Heating', time: '7 min read', title: 'Heat pumps: what nobody tells you about winter', text: 'Flow temperatures, defrost cycles and keeping running costs low.' },
  { img: '/img/article-4.jpg', tag: 'Savings', time: '4 min read', title: 'The quiet cost of standby power', text: 'Why devices that look off can still add up across a year.' },
  { img: '/img/article-5.jpg', tag: 'EV', time: '6 min read', title: 'Off-peak tariffs explained for EV owners', text: 'Choosing a tariff that fits how and when you actually drive.' },
];

export const faqs = [
  { q: 'Does Ampere work with my meter?', a: 'The clip-on sensor works with most single and three-phase meters. If you already have a compatible smart meter, Ampere can read it directly with no hardware at all.' },
  { q: 'Do I need solar panels or a battery?', a: 'No. Most savings come from understanding and shifting everyday usage. If you do have solar, a battery or an EV, Ampere coordinates them automatically.' },
  { q: 'How long does setup take?', a: 'Around ten minutes. Fit the sensor, pair it in the app and you will see live data straight away. Personalised recommendations arrive after the first week.' },
  { q: 'What happens to my data?', a: 'Your data is encrypted, stored in the EU and never sold. You can export or delete everything from the app settings whenever you like.' },
  { q: 'Can I control appliances from the app?', a: 'Yes, through supported smart plugs, chargers, thermostats and inverters. Ampere can also simply remind you when a manual switch would save money.' },
  { q: 'Is there a subscription?', a: 'The core app is free. Ampere Plus adds automations, multi-property support and installer booking for a small monthly fee, with a free first month.' },
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
      <button type="button" class="story-thumb" data-story-thumb="${i}" aria-label="Show story from ${s.name}">
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
          <a href="#" class="article-link text-20" data-panel-item>Read guide ${arrowSwap}</a>
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
