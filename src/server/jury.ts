import { LIFECYCLE_LABEL, type BookingEvent } from '../domain/booking'
import { achievableGridWh } from '../domain/calc'
import { CONNECTOR_LABEL } from '../domain/catalogue'
import { parseCommand } from '../domain/console'
import { CONSOLE_DEFAULTS, POLICY } from '../domain/policy'
import { isoIst, km, rupees } from '../lib/format'
import { requestId, uuid } from '../lib/ids'
import { ceilToStep } from '../lib/time'
import { nextSlots, stateOf, expireIfDue } from './availability'
import { acceptBooking, createBooking, createQuote, headerByRef, isHost, isJury } from './bookings'
import { readDb, serverNow } from './db'
import { searchChargers } from './discovery'
import { ApiFail, requireActor, type Ctx } from './http'
import { withLocks } from './storage'
import { readStream } from './eventStore'

export interface ConsoleLine {
  text: string
  tone?: 'ok' | 'err' | 'dim' | 'accent'
}

export interface ConsoleResult {
  ok: boolean
  lines: ConsoleLine[]
  booking_id?: string
  booking_ref?: string
  event?: BookingEvent
  next_command?: string
  error_code?: string
  request_id: string
  map_link?: string
}

export const HELP_LINES: ConsoleLine[] = [
  { text: 'AMPERE JURY CONSOLE — one command per line, pipe-separated.', tone: 'accent' },
  { text: 'TICKET|<car model>|<battery percent>|<lat>|<lon>|<connector>' },
  { text: '  e.g. TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2', tone: 'dim' },
  { text: 'READY|<booking ref>|<ISO time>' },
  { text: '  e.g. READY|AMP-XXXXXX|2026-10-22T10:30:00+05:30  (no offset → Asia/Kolkata)', tone: 'dim' },
  { text: 'HELP, CLEAR. Origin 18.5362,73.8939 uses seeded demo road distances; other origins use a labelled demo road estimate.', tone: 'dim' },
  { text: 'All bookings, payments and energy here are simulated demo records.', tone: 'dim' },
]

function fail(code: string, message: string, rid: string, extra: ConsoleLine[] = []): ConsoleResult {
  return { ok: false, lines: [...extra, { text: `ERROR ${code} — ${message}`, tone: 'err' }, { text: `request_id=${rid}`, tone: 'dim' }], error_code: code, request_id: rid }
}

export async function runConsoleCommand(ctx: Ctx, line: string, commandId: string): Promise<ConsoleResult> {
  const rid = requestId()
  let actor
  try {
    actor = requireActor(ctx)
  } catch {
    return fail('UNAUTHENTICATED', 'Sign in with the jury account to use the console.', rid)
  }
  const parsed = parseCommand(line)
  if ('code' in parsed) return fail(parsed.code, parsed.message, rid)
  if (parsed.kind === 'HELP') return { ok: true, lines: HELP_LINES, request_id: rid }
  if (parsed.kind === 'CLEAR') return { ok: true, lines: [], request_id: rid }

  if (parsed.kind === 'TICKET') {
    if (!actor.capabilities.includes('DRIVER')) return fail('FORBIDDEN', 'TICKET creates a driver request; this account has no driver capability.', rid)
    const { model, soc, lat, lng, connector } = parsed
    const out: ConsoleLine[] = []
    out.push({ text: `MODEL ${model.make} ${model.model} → ${model.variant} [${model.evidence === 'DEMO_PROFILE' ? 'labelled demo profile' : 'unverified'}] · ${model.connectors.map((c) => `${CONNECTOR_LABEL[c.standard]} ${c.mode}`).join(', ')}` })
    const supports = model.connectors.some((c) => c.standard === connector && !c.adapter_required)
    let search
    try {
      search = await searchChargers({ origin: { lat, lng }, model_id: model.id, soc, connector })
    } catch (e) {
      return fail(e instanceof ApiFail ? e.code : 'INTERNAL', e instanceof Error ? e.message : 'Search failed', rid, out)
    }
    const b = search.budget
    out.push({ text: `RANGE ${km(b.range_budget_m)} road budget = ${(model.usable_battery_wh / 1000).toFixed(1)} kWh × (${soc}% − ${b.reserve_pct}% reserve) ÷ (${b.consumption_kwh_per_km} kWh/km × ${b.uncertainty} uncertainty)` })
    out.push({ text: `ORIGIN ${lat.toFixed(4)}, ${lng.toFixed(4)} · route evidence: ${search.route_providers.join('; ') || 'none'}`, tone: 'dim' })
    const d = search.diagnostics
    if (!supports) out.push({ text: `NOTE ${model.model} does not list ${CONNECTOR_LABEL[connector]} support — every charger is excluded.`, tone: 'dim' })
    out.push({ text: `MATCHES ${search.results.length} eligible (reachable + ${CONNECTOR_LABEL[connector]})` })
    search.results.forEach((r, i) => {
      const c = r.connectors[0]
      out.push({ text: `  ${i + 1}. ${r.site.name} · ${r.resource_label} · ${CONNECTOR_LABEL[c.standard]} ${c.effective_power_kw} kW · ${km(r.route.distance_m)} road${r.reservable ? '' : ' · directory only, not reservable'}`, tone: 'ok' })
    })
    out.push({ text: `EXCLUDED ${d.excluded_range} outside range · ${d.excluded_connector} connector mismatch · ${d.excluded_status} faulted · ${d.excluded_unapproved} unapproved · ${d.excluded_route_unknown} no route evidence (records not shown)`, tone: 'dim' })
    const mapLink = `/discover?lat=${lat}&lng=${lng}&soc=${soc}&model=${model.id}&connector=${connector}`
    if (!search.results.length) return { ...fail('NO_MATCH', `No reachable ${CONNECTOR_LABEL[connector]} charger within the ${km(b.range_budget_m)} budget. No booking was created.`, rid, out), map_link: mapLink }

    const now = serverNow()
    const candidates = search.results.filter((r) => r.reservable)
    if (!candidates.length) return { ...fail('NO_RESERVABLE_MATCH', 'Only directory listings are reachable; Ampere cannot reserve them. No booking was created.', rid, out), map_link: mapLink }

    for (const r of candidates) {
      const c = r.connectors[0]
      const lead = r.route.duration_s * 1000 + (POLICY.host_response_s + POLICY.checkout_s) * 1000
      const slots = nextSlots(r.resource_id, CONSOLE_DEFAULTS.slot_minutes, ceilToStep(now + lead, POLICY.increment_min), now, 3, CONSOLE_DEFAULTS.search_horizon_h)
      for (const start of slots) {
        const end = start + CONSOLE_DEFAULTS.slot_minutes * 60_000
        const headroom = Math.floor((model.usable_battery_wh * (100 - soc)) / 100 / POLICY.efficiency)
        const gridWh = Math.min(CONSOLE_DEFAULTS.max_grid_wh, achievableGridWh(CONSOLE_DEFAULTS.slot_minutes * 60, c.effective_power_kw), headroom)
        if (gridWh <= 0) continue
        try {
          const quote = await createQuote(ctx, { connector_id: c.id, model_id: model.id, soc, origin: { lat, lng }, start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString(), plan: CONSOLE_DEFAULTS.plan, energy: { kind: 'GRID', grid_wh: gridWh } })
          const booking = await createBooking(ctx, { quote_id: quote.id, idempotency_key: `console:${commandId}`, policy_acceptance_version: POLICY.version, source: 'JURY_CONSOLE', command_request_id: rid })
          const q = quote.snapshot
          out.push({ text: `SELECTED ${r.site.name} · ${r.resource_label} · ${CONNECTOR_LABEL[c.standard]} (rank ${search.results.indexOf(r) + 1}, stable id tie-break)` })
          out.push({ text: `SLOT ${isoIst(start)} ${isoIst(end)} (${CONSOLE_DEFAULTS.slot_minutes} min, Basic plan)` })
          out.push({ text: `QUOTE ${(q.grid_wh / 1000).toFixed(1)} kWh grid energy → ~${(q.battery_wh / 1000).toFixed(1)} kWh to battery · ${rupees(q.total_paise)} at ${rupees(q.energy_paise_per_kwh)}/kWh · demo, not a tax invoice` })
          out.push({ text: `BOOKING ${booking.booking_ref}`, tone: 'accent' })
          out.push({ text: `EVENT BookingRequested ${booking.event.sequence} · recorded ${isoIst(Date.parse(booking.event.recorded_at))}`, tone: 'dim' })
          out.push({ text: `STATE ${LIFECYCLE_LABEL.requested}`, tone: 'ok' })
          out.push({ text: `HOST RESPONSE DEADLINE ${isoIst(Date.parse(booking.host_response_deadline))} (2 min)`, tone: 'dim' })
          const next = `READY|${booking.booking_ref}|${isoIst(serverNow())}`
          out.push({ text: `NEXT ${next}`, tone: 'accent' })
          return { ok: true, lines: out, booking_id: booking.booking_id, booking_ref: booking.booking_ref, event: booking.event, next_command: next, request_id: rid, map_link: mapLink }
        } catch (e) {
          if (e instanceof ApiFail && ['SLOT_UNAVAILABLE', 'BLACKOUT', 'OUTSIDE_SCHEDULE', 'TARGET_EXCEEDS_SLOT'].includes(e.code)) continue
          return { ...fail(e instanceof ApiFail ? e.code : 'INTERNAL', e instanceof Error ? e.message : 'Booking failed', rid, out), map_link: mapLink }
        }
      }
    }
    return { ...fail('NO_AVAILABLE_SLOT', `No free ${CONSOLE_DEFAULTS.slot_minutes}-minute slot in the next ${CONSOLE_DEFAULTS.search_horizon_h} h on any eligible charger. No booking was created.`, rid, out), map_link: mapLink }
  }

  // READY
  const h = headerByRef(parsed.ref)
  if (!h) return fail('BOOKING_NOT_FOUND', `No booking ${parsed.ref}.`, rid)
  const asHost = isHost(actor, h)
  const asJury = isJury(actor) && h.is_demo && readDb().mode === 'DEMO'
  if (!asHost && !asJury) return fail('BOOKING_NOT_FOUND', `No booking ${parsed.ref} that this account may confirm. READY needs the owning host or the demo jury capability.`, rid)

  const pre: ConsoleLine[] = []
  if (parsed.assumedTimezone) pre.push({ text: `TIME no offset given → interpreted as Asia/Kolkata: ${isoIst(Date.parse(parsed.reportedAt))}`, tone: 'dim' })

  // Idempotent replay: same reference + same reported time returns the first confirmation.
  await withLocks([`resource:${h.resource_id}`, `booking:${h.id}`], async () => expireIfDue(h.id, serverNow()))
  const s = stateOf(h.id)!
  const prior = readStream(h.id).find((e) => e.event_type === 'HostConfirmed')
  if (prior) {
    if (prior.reported_at === parsed.reportedAt && s.lifecycle === 'host_confirmed')
      return {
        ok: true,
        lines: [...pre, { text: `BOOKING ${h.booking_ref}`, tone: 'accent' }, { text: `EVENT HostConfirmed ${prior.sequence} (already recorded — no duplicate appended)`, tone: 'dim' }, { text: `STATE ${LIFECYCLE_LABEL[s.lifecycle]}`, tone: 'ok' }],
        booking_id: h.id,
        booking_ref: h.booking_ref,
        event: prior,
        request_id: rid,
      }
    if (s.lifecycle === 'host_confirmed') return fail('ALREADY_HOST_CONFIRMED', `${h.booking_ref} was confirmed at sequence ${prior.sequence}; a different reported time does not rewrite it.`, rid, pre)
    return fail('ALREADY_ADVANCED', `${h.booking_ref} is already “${LIFECYCLE_LABEL[s.lifecycle]}”. No backward transition.`, rid, pre)
  }
  if (s.outcome === 'HOLD_EXPIRED' || s.outcome === 'CHECKOUT_EXPIRED') return fail('HOLD_EXPIRED', `${h.booking_ref} expired before confirmation. Its expiry history is kept.`, rid, pre)
  if (s.ended) return fail('BOOKING_ENDED', `${h.booking_ref} has ended (${s.outcome}).`, rid, pre)

  try {
    const r = await acceptBooking(ctx, h.id, { source: 'JURY_CONSOLE', reported_at: parsed.reportedAt, idempotency_key: `${actor.id}:READY:${commandId}` })
    return {
      ok: true,
      lines: [
        ...pre,
        ...(asJury && !asHost ? [{ text: `AUTH jury simulation of host action · delegated host ${h.host_account_id} · demo only`, tone: 'dim' as const }] : []),
        { text: `BOOKING ${h.booking_ref}`, tone: 'accent' },
        { text: `EVENT HostConfirmed ${r.event.sequence}` },
        { text: `REPORTED ${isoIst(Date.parse(parsed.reportedAt))} · RECORDED ${isoIst(Date.parse(r.event.recorded_at))} (server)`, tone: 'dim' },
        { text: `STATE ${LIFECYCLE_LABEL.host_confirmed}`, tone: 'ok' },
        { text: `CHECKOUT closes ${isoIst(Date.parse(r.checkout_deadline))} — the driver still pays and departs in the normal app.`, tone: 'dim' },
      ],
      booking_id: h.id,
      booking_ref: h.booking_ref,
      event: r.event,
      request_id: rid,
    }
  } catch (e) {
    if (e instanceof ApiFail) return fail(e.code, e.message, rid, pre)
    return fail('INTERNAL', 'Confirmation failed. Nothing was committed.', rid, pre)
  }
}

export function newCommandId() {
  return uuid()
}
