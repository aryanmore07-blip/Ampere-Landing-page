# Ampere — EV charging, shared (front-end PWA)

A pure front-end, installable PWA for Ampere: find **reachable, connector-compatible** EV chargers around Pune and book **community chargers** (cafés, offices, homes), with a functional **Jury Console** (TICKET / READY).

> Everything runs in the browser. There is no backend: the “server”, database and realtime channel are simulated in `src/server/` with `localStorage`, cross-tab Web Locks and a `BroadcastChannel`. Listings are synthetic; payments, refunds, metering, receipts and payouts are demo-only.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain + flow tests (vitest)
npm run build && npm run preview   # production build with service worker
```

Install it from the browser menu (“Install app” / “Add to Home Screen”) or the Install button on the sign-in and settings screens.

## Demo script

1. Sign in as **Aarav** (driver, Nexon EV at 4%). Home shows the 4.0 km road budget (40 kWh × (4% − 2%) ÷ (0.16 × 1.25)).
2. **Stations**: only reachable + compatible chargers are pinned. Aundh (11.2 km, CCS2) and Lane 7 (Bharat AC-001) are hidden; the hidden count is shown, never the records.
3. Open **Ember & Ohm Café** → 90 min, 8 kWh grid energy, Standard → ₹112 + ₹20 = **₹132** → request.
4. In a **second tab**, sign in as **Rohan** (café host) → Confirm. The driver tab updates live.
5. Driver: pay (demo) → Start journey → Show arrival code. Host: enter the code (use “jump to arrival window” if early) → Start session → Complete after the 60 s accelerated session → receipt + illustrative proceeds.
6. **Jury console** (sign in as *Jury panel*, `/jury`):
   ```
   TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2
   READY|<printed ref>|<ISO time>
   ```
   Then reload the page: the booking is restored from the persisted event stream by replay.

## Architecture

| Area | Where |
| --- | --- |
| Range, compatibility, energy, price | `src/domain/calc.ts` |
| Append-only events + deterministic reducer (5 lifecycle labels) | `src/domain/booking.ts`, `src/server/eventStore.ts` |
| Atomic holds, expiry, idempotency, lock order resource → booking → db | `src/server/bookings.ts`, `src/server/availability.ts` |
| Strict discovery (map, list, console share it) | `src/server/discovery.ts` |
| Console grammar and service | `src/domain/console.ts`, `src/server/jury.ts` |
| Live updates: dedupe by event id, contiguous sequences, gap refetch | `src/app/hooks.ts` (`useBookingStream`) |

Demo controls (Settings): injected server clock (+1/+5/+15/+60 min), simulated realtime disconnect/reconnect, route evidence provider, demo reset.

## Honest limits

- Synthetic listings only; the organiser’s *verified real-world* inside/outside-range records still need to be added to `src/domain/catalogue.ts`.
- Map tiles come from the public OpenStreetMap tile server (demo use only; production needs a contracted provider). Off the demo origin, route distances are a labelled demo estimate unless live OSRM is enabled.
- Data lives in this browser’s storage: tabs of one browser share it; different devices do not.
