import { guard, LIFECYCLE_LABEL, type BookingEvent, type BookingState, type EventSource, type QuoteSnapshot, type VehicleSnapshot } from '../domain/booking'
import { achievableGridWh, compatibility, fromGridWh, fromTargetSoc, illustrativeHostProceeds, price, rangeBudget, routeConfidence, type EnergyEstimate } from '../domain/calc'
import { modelById, userById } from '../domain/catalogue'
import { POLICY } from '../domain/policy'
import type { LatLng, Plan, User } from '../domain/types'
import { arrivalCode, bookingRef, sha256, uuid } from '../lib/ids'
import { expireIfDue, expireResource, slotProblem, stateOf } from './availability'
import { mutateDb, readDb, serverNow, type BookingHeader, type Quote } from './db'
import { appendEvent, readStream, readStreamAfter } from './eventStore'
import { ApiFail, requireActor, type Ctx } from './http'
import { routesFrom } from './routing'
import { withLocks } from './storage'

/* ---------------- Quotes ---------------- */

export interface QuoteInput {
  connector_id: string
  model_id: string
  soc: number
  origin: LatLng
  start_at: string
  end_at: string
  plan: Plan
  energy: { kind: 'GRID'; grid_wh: number } | { kind: 'TARGET'; target_soc: number }
}

const SLOT_MESSAGES: Record<string, [string, number]> = {
  INVALID_DURATION: ['Bookings last 30 to 120 minutes in 15-minute steps.', 400],
  IN_PAST: ['That start time has passed.', 422],
  OUTSIDE_SCHEDULE: ['The host does not offer this charger at that time.', 422],
  BLACKOUT: ['The host has blocked that time.', 409],
  SLOT_UNAVAILABLE: ['That slot was just taken or is held for another driver.', 409],
}

function slotFail(code: string): never {
  const [msg, status] = SLOT_MESSAGES[code] ?? ['Slot unavailable.', 409]
  throw new ApiFail(code, msg, status)
}

export async function createQuote(ctx: Ctx, input: QuoteInput): Promise<Quote> {
  const actor = requireActor(ctx, 'DRIVER')
  const db = readDb()
  const now = serverNow()
  const connector = db.connectors.find((c) => c.id === input.connector_id)
  const resource = connector && db.resources.find((r) => r.id === connector.resource_id)
  const site = resource && db.sites.find((s) => s.id === resource.site_id)
  if (!connector || !resource || !site) throw new ApiFail('NOT_FOUND', 'Charger not found.', 404)
  if (site.source_kind === 'DIRECTORY' || !resource.reservable) throw new ApiFail('UNSUPPORTED_CAPABILITY', 'This is a directory listing. Ampere cannot reserve it — use the operator’s own flow.', 422)
  if (site.listing_state !== 'ACTIVE') throw new ApiFail('SITE_NOT_APPROVED', 'This site is not accepting requests.', 422)
  const model = modelById(input.model_id)
  if (!model) throw new ApiFail('VEHICLE_REQUIRED', 'Choose a reviewed car profile.', 400)
  const compat = compatibility(model, connector, resource, site)
  if (compat.result !== 'COMPATIBLE') throw new ApiFail('INCOMPATIBLE', `This connector is not compatible with your car (${compat.reasons.join(', ')}).`, 422)

  const budget = rangeBudget(model, input.soc, POLICY)
  const route = (await routesFrom(input.origin, [site])).get(site.id) ?? null
  const conf = routeConfidence(route, budget)
  if (conf !== 'PLAUSIBLY_REACHABLE' || !route) throw new ApiFail(conf, conf === 'UNVERIFIED_DISTANCE' ? 'Route evidence is unavailable for this charger.' : 'This charger is outside your estimated range budget.', 422)

  const start = Date.parse(input.start_at)
  const end = Date.parse(input.end_at)
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new ApiFail('INVALID_SLOT', 'Choose a valid start and end.', 400)
  const problem = slotProblem(resource.id, start, end, now)
  if (problem) slotFail(problem)

  const slotSeconds = (end - start) / 1000
  let est: EnergyEstimate
  if (input.energy.kind === 'GRID') est = fromGridWh(input.energy.grid_wh, compat.effective_power_kw, POLICY)
  else est = fromTargetSoc(model, input.soc, input.energy.target_soc, compat.effective_power_kw, POLICY)
  if (est.duration_s > slotSeconds) {
    const achievable = achievableGridWh(slotSeconds, compat.effective_power_kw)
    throw new ApiFail('TARGET_EXCEEDS_SLOT', `That needs about ${Math.ceil(est.duration_s / 60)} min. This slot can deliver about ${(achievable / 1000).toFixed(1)} kWh — lower the amount or pick a longer slot.`, 422, {
      achievable_grid_wh: String(achievable),
    })
  }

  const tariff = db.tariffs.find((t) => t.site_id === site.id)
  if (!tariff) throw new ApiFail('NO_TARIFF', 'No published demo tariff for this site.', 422)
  const fee = input.plan === 'STANDARD' ? tariff.standard_fee_paise : 0
  const lines = price(est.grid_wh, tariff.energy_paise_per_kwh, fee)

  const snapshot: QuoteSnapshot = {
    quote_id: uuid(),
    plan: input.plan,
    connector_standard: connector.standard,
    charging_mode: connector.mode,
    effective_power_kw: compat.effective_power_kw,
    grid_wh: est.grid_wh,
    battery_wh: est.battery_wh,
    duration_s: est.duration_s,
    energy_paise_per_kwh: tariff.energy_paise_per_kwh,
    energy_subtotal_paise: lines.energy_subtotal_paise,
    booking_fee_paise: lines.booking_fee_paise,
    total_paise: lines.total_paise,
    tariff_version: tariff.version,
    is_demo: true,
  }
  const vehicle: VehicleSnapshot = {
    model_id: model.id,
    model_label: `${model.make} ${model.model} (${model.variant})`,
    soc: input.soc,
    origin: { lat: Math.round(input.origin.lat * 1000) / 1000, lng: Math.round(input.origin.lng * 1000) / 1000 },
    range_budget_m: budget.range_budget_m,
    route_m: route.distance_m,
    route_provider: route.label,
  }
  const quote: Quote = {
    id: snapshot.quote_id,
    driver_id: actor.id,
    site_id: site.id,
    resource_id: resource.id,
    connector_id: connector.id,
    start_at: new Date(start).toISOString(),
    end_at: new Date(end).toISOString(),
    snapshot,
    vehicle,
    policy_version: POLICY.version,
    valid_until: new Date(now + POLICY.quote_validity_s * 1000).toISOString(),
    consumed_by: null,
    created_at: new Date(now).toISOString(),
    plan: input.plan,
    is_demo: true,
  }
  await mutateDb((d) => {
    d.quotes = d.quotes.filter((q) => q.consumed_by || Date.parse(q.valid_until) > now - 3600_000)
    d.quotes.push(quote)
  })
  return quote
}

/* ---------------- Atomic hold ---------------- */

export interface CreateBookingInput {
  quote_id: string
  idempotency_key: string
  policy_acceptance_version: string
  source?: EventSource
  command_request_id?: string
}

export interface CreateBookingResponse {
  booking_id: string
  booking_ref: string
  lifecycle: 'requested'
  event: BookingEvent
  host_response_deadline: string
}

export async function createBooking(ctx: Ctx, input: CreateBookingInput): Promise<CreateBookingResponse> {
  const actor = requireActor(ctx, 'DRIVER')
  if (!input.idempotency_key) throw new ApiFail('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.', 400)
  if (input.policy_acceptance_version !== POLICY.version) throw new ApiFail('POLICY_NOT_ACCEPTED', 'Accept the current booking policy first.', 400)
  const idemKey = `${actor.id}:POST /api/bookings:${input.idempotency_key}`
  const quote0 = readDb().quotes.find((q) => q.id === input.quote_id && q.driver_id === actor.id)
  if (!quote0) throw new ApiFail('QUOTE_NOT_FOUND', 'Quote not found. Get a fresh quote.', 404)

  return withLocks([`resource:${quote0.resource_id}`], async () => {
    const db = readDb()
    const prior = db.idempotency[idemKey]
    if (prior) {
      if (prior.request_hash !== input.quote_id) throw new ApiFail('IDEMPOTENCY_CONFLICT', 'This idempotency key was used with a different request.', 409)
      return prior.response as CreateBookingResponse
    }
    const now = serverNow()
    const quote = db.quotes.find((q) => q.id === input.quote_id)!
    if (quote.consumed_by) throw new ApiFail('QUOTE_CONSUMED', 'This quote was already used.', 409)
    if (Date.parse(quote.valid_until) < now) throw new ApiFail('QUOTE_EXPIRED', 'This quote expired. Get a fresh quote.', 409)
    const site = db.sites.find((s) => s.id === quote.site_id)
    const resource = db.resources.find((r) => r.id === quote.resource_id)
    if (!site || site.listing_state !== 'ACTIVE' || !site.host_account_id) throw new ApiFail('SITE_NOT_APPROVED', 'This site is not accepting requests.', 422)
    if (!resource || resource.current_status === 'FAULTED' || resource.current_status === 'OFFLINE') throw new ApiFail('RESOURCE_UNAVAILABLE', 'This charger is not operational.', 422)

    expireResource(resource.id, now)
    const problem = slotProblem(resource.id, Date.parse(quote.start_at), Date.parse(quote.end_at), now)
    if (problem) slotFail(problem)

    const bookingId = uuid()
    const ref = bookingRef()
    const end = Date.parse(quote.end_at)
    const deadline = new Date(now + POLICY.host_response_s * 1000).toISOString()
    const event = await withLocks([`booking:${bookingId}`], async () =>
      appendEvent(
        bookingId,
        'BookingRequested',
        {
          booking_ref: ref,
          site_id: site.id,
          site_name: site.name,
          resource_id: resource.id,
          connector_id: quote.connector_id,
          host_account_id: site.host_account_id!,
          driver_id: actor.id,
          start_at: quote.start_at,
          end_at: quote.end_at,
          blocked_until: new Date(end + POLICY.buffer_min * 60_000).toISOString(),
          host_response_deadline: deadline,
          policy_version: quote.policy_version,
          quote: quote.snapshot,
          vehicle: quote.vehicle,
          command_request_id: input.command_request_id,
        },
        { actor_id: actor.id, actor_role: 'DRIVER', source: input.source ?? 'UI', idempotency_key: idemKey, expected_sequence: 0 },
      ),
    )
    const response: CreateBookingResponse = { booking_id: bookingId, booking_ref: ref, lifecycle: 'requested', event, host_response_deadline: deadline }
    const header: BookingHeader = { id: bookingId, booking_ref: ref, created_at: event.recorded_at, driver_id: actor.id, host_account_id: site.host_account_id!, resource_id: resource.id, site_id: site.id, is_demo: true }
    await mutateDb((d) => {
      d.bookings.push(header)
      const q = d.quotes.find((x) => x.id === quote.id)
      if (q) q.consumed_by = bookingId
      d.idempotency[idemKey] = { request_hash: input.quote_id, response, created_at: event.recorded_at }
    })
    return response
  })
}

/* ---------------- Command plumbing ---------------- */

export function headerById(id: string) {
  return readDb().bookings.find((b) => b.id === id)
}

export function headerByRef(ref: string) {
  return readDb().bookings.find((b) => b.booking_ref.toUpperCase() === ref.toUpperCase())
}

export const isDriver = (a: User, h: BookingHeader) => a.id === h.driver_id
export const isHost = (a: User, h: BookingHeader) => !!a.host_account_id && a.host_account_id === h.host_account_id
export const isAdmin = (a: User) => a.capabilities.includes('ADMIN')
export const isJury = (a: User) => a.capabilities.includes('JURY')

export function canRead(a: User, h: BookingHeader) {
  return isDriver(a, h) || isHost(a, h) || isAdmin(a) || (isJury(a) && h.is_demo)
}

const GUARD_MESSAGES: Record<string, string> = {
  BOOKING_COMPLETED: 'This booking is done and cannot change.',
  BOOKING_ENDED: 'This booking has ended.',
  ALREADY_HOST_CONFIRMED: 'The host already confirmed this booking.',
  ALREADY_ADVANCED: 'This booking has already moved past that step.',
  HOST_CONFIRMATION_REQUIRED: 'Wait for the host to confirm before continuing.',
  ALREADY_CAPTURED: 'Payment is already recorded.',
  CHECKOUT_REQUIRED: 'Complete checkout before departing.',
  DEPARTURE_REQUIRED: 'The driver has not started the journey yet.',
  ALREADY_CHECKED_IN: 'Arrival is already verified.',
  ARRIVAL_NOT_VERIFIED: 'Verify the arrival code first.',
  INVALID_TRANSITION: 'That action is not valid right now.',
  SESSION_ACTIVE: 'A session is active. Stop charging before cancelling.',
}

export function guardOrFail(s: BookingState, type: Parameters<typeof guard>[1]) {
  const code = guard(s, type)
  if (code) throw new ApiFail(code, GUARD_MESSAGES[code] ?? code, 409)
}

/** Locks resource then booking, appends any due expiry, checks the expected sequence, then runs fn. */
async function command<T>(ctx: Ctx, bookingId: string, expectedSequence: number | undefined, fn: (s: BookingState, h: BookingHeader, actor: User, now: number) => Promise<T> | T): Promise<T> {
  const actor = requireActor(ctx)
  const h = headerById(bookingId)
  if (!h || !canRead(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
  return withLocks([`resource:${h.resource_id}`, `booking:${bookingId}`], async () => {
    const now = serverNow()
    const before = stateOf(bookingId)!
    const s = expireIfDue(bookingId, now)!
    if (s.ended && !before.ended && (s.outcome === 'HOLD_EXPIRED' || s.outcome === 'CHECKOUT_EXPIRED'))
      throw new ApiFail('HOLD_EXPIRED', s.outcome === 'HOLD_EXPIRED' ? 'The host response window closed and the hold expired.' : 'The checkout window closed and the hold was released.', 409)
    if (expectedSequence !== undefined && expectedSequence !== s.last_sequence)
      throw new ApiFail('SEQUENCE_CONFLICT', 'This booking changed since you loaded it. It has been refreshed — check and try again.', 409)
    return fn(s, h, actor, now)
  })
}

function failIfExpired(s: BookingState) {
  if (s.outcome === 'HOLD_EXPIRED' || s.outcome === 'CHECKOUT_EXPIRED') throw new ApiFail('HOLD_EXPIRED', 'This hold has expired.', 409)
}

/* ---------------- Host decision ---------------- */

export interface ConfirmOptions {
  expected_sequence?: number
  source?: EventSource
  reported_at?: string | null
  idempotency_key?: string
}

export async function acceptBooking(ctx: Ctx, bookingId: string, opts: ConfirmOptions = {}) {
  return command(ctx, bookingId, opts.expected_sequence, (s, h, actor, now) => {
    const asHost = isHost(actor, h)
    const asJury = !asHost && isJury(actor) && h.is_demo && readDb().mode === 'DEMO'
    if (!asHost && !asJury) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    failIfExpired(s)
    guardOrFail(s, 'HostConfirmed')
    const event = appendEvent(
      bookingId,
      'HostConfirmed',
      { checkout_deadline: new Date(now + POLICY.checkout_s * 1000).toISOString(), ...(asJury ? { delegated_host_account_id: h.host_account_id, jury_simulation: true } : {}) },
      { actor_id: actor.id, actor_role: asJury ? 'JURY' : 'HOST', source: opts.source ?? 'UI', reported_at: opts.reported_at ?? null, idempotency_key: opts.idempotency_key },
    )
    return { booking_ref: h.booking_ref, lifecycle: 'host_confirmed' as const, event, checkout_deadline: event.payload.checkout_deadline }
  })
}

export async function declineBooking(ctx: Ctx, bookingId: string, reason: string, expected_sequence?: number) {
  return command(ctx, bookingId, expected_sequence, (s, h, actor) => {
    if (!isHost(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    failIfExpired(s)
    if (s.lifecycle !== 'requested') throw new ApiFail('ALREADY_ADVANCED', 'Only pending requests can be declined. Use cancel for confirmed bookings.', 409)
    guardOrFail(s, 'HostDeclined')
    return appendEvent(bookingId, 'HostDeclined', { reason: reason || 'Host unavailable' }, { actor_id: actor.id, actor_role: 'HOST', source: 'UI' })
  })
}

/* ---------------- Demo checkout ---------------- */

export async function payDemo(ctx: Ctx, bookingId: string, scenario: 'SUCCESS' | 'FAILURE', idempotencyKey: string) {
  if (readDb().mode !== 'DEMO') throw new ApiFail('DEMO_ONLY', 'Demo payments are disabled in live mode.', 403)
  if (!idempotencyKey) throw new ApiFail('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.', 400)
  return command(ctx, bookingId, undefined, async (s, h, actor, now) => {
    if (!isDriver(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    const key = `${actor.id}:payments/demo:${bookingId}:${idempotencyKey}`
    const prior = readDb().idempotency[key]
    if (prior) return prior.response as { state: 'CAPTURED' | 'FAILED'; amount_paise: number }
    failIfExpired(s)
    guardOrFail(s, scenario === 'SUCCESS' ? 'PaymentCaptured' : 'PaymentFailed')
    const attemptId = uuid()
    const amount = s.request.quote.total_paise
    if (scenario === 'SUCCESS') appendEvent(bookingId, 'PaymentCaptured', { payment_attempt_id: attemptId, amount_paise: amount, provider: 'DEMO' }, { actor_id: actor.id, actor_role: 'DRIVER', source: 'PROVIDER' })
    else appendEvent(bookingId, 'PaymentFailed', { payment_attempt_id: attemptId }, { actor_id: actor.id, actor_role: 'DRIVER', source: 'PROVIDER' })
    const response = { state: scenario === 'SUCCESS' ? ('CAPTURED' as const) : ('FAILED' as const), amount_paise: amount }
    await mutateDb((d) => {
      d.payments.push({ id: attemptId, booking_id: bookingId, provider: 'DEMO', amount_paise: amount, state: response.state, idempotency_key: key, created_at: new Date(now).toISOString(), captured_at: scenario === 'SUCCESS' ? new Date(now).toISOString() : null, is_demo: true })
      d.idempotency[key] = { request_hash: scenario, response, created_at: new Date(now).toISOString() }
    })
    return response
  })
}

/* ---------------- Journey ---------------- */

export async function depart(ctx: Ctx, bookingId: string, expected_sequence?: number) {
  return command(ctx, bookingId, expected_sequence, async (s, h, actor) => {
    if (!isDriver(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    failIfExpired(s)
    guardOrFail(s, 'DriverDeparted')
    const v = s.request.vehicle
    const model = modelById(v.model_id)!
    const current = readDb().vehicles.find((x) => x.owner_id === actor.id && x.model_id === v.model_id)
    const soc = current ? current.soc : v.soc
    const budget = rangeBudget(model, soc, POLICY)
    const site = readDb().sites.find((x) => x.id === h.site_id)!
    const route = (await routesFrom(v.origin, [site])).get(site.id) ?? null
    if (routeConfidence(route, budget) !== 'PLAUSIBLY_REACHABLE' || !route)
      throw new ApiFail('RANGE_RECHECK_FAILED', `At ${soc}% the range budget is ${(budget.range_budget_m / 1000).toFixed(1)} km — not enough to reach this charger. You can cancel with the standard refund.`, 422)
    return appendEvent(bookingId, 'DriverDeparted', { range_budget_m: budget.range_budget_m, route_m: route.distance_m, route_provider: route.label }, { actor_id: actor.id, actor_role: 'DRIVER', source: 'UI' })
  })
}

export async function issueArrivalCode(ctx: Ctx, bookingId: string) {
  return command(ctx, bookingId, undefined, async (s, h, actor, now) => {
    if (!isDriver(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    if (s.ended || s.payment !== 'CAPTURED' || (s.lifecycle !== 'host_confirmed' && s.lifecycle !== 'on_the_way'))
      throw new ApiFail('ARRIVAL_CODE_UNAVAILABLE', 'The arrival code is available after host confirmation and checkout.', 409)
    const code = arrivalCode()
    const hash = await sha256(`${bookingId}:${code}`)
    const expires = new Date(Math.max(now + POLICY.arrival_token_ttl_s * 1000, Date.parse(s.request.start_at) + POLICY.arrival_after_min * 60_000)).toISOString()
    await mutateDb((d) => {
      d.arrival_tokens = d.arrival_tokens.filter((t) => t.booking_id !== bookingId)
      d.arrival_tokens.push({ booking_id: bookingId, token_hash: hash, expires_at: expires, attempt_count: 0, consumed_at: null })
    })
    return { code, expires_at: expires }
  })
}

export function arrivalWindow(s: BookingState) {
  const start = Date.parse(s.request.start_at)
  return { opens: start - POLICY.arrival_before_min * 60_000, closes: start + POLICY.arrival_after_min * 60_000 }
}

export async function checkIn(ctx: Ctx, bookingId: string, code: string) {
  return command(ctx, bookingId, undefined, async (s, h, actor, now) => {
    if (!isHost(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    guardOrFail(s, 'ArrivalVerified')
    const w = arrivalWindow(s)
    if (now < w.opens) throw new ApiFail('ARRIVAL_WINDOW_NOT_OPEN', `Check-in opens 10 minutes before the start.`, 409)
    if (now > w.closes) throw new ApiFail('ARRIVAL_WINDOW_CLOSED', 'The arrival window has closed.', 409)
    const token = readDb().arrival_tokens.find((t) => t.booking_id === bookingId)
    const hash = await sha256(`${bookingId}:${(code || '').trim()}`)
    const ok = token && !token.consumed_at && Date.parse(token.expires_at) > now && token.attempt_count < POLICY.arrival_token_max_attempts && token.token_hash === hash
    if (!ok) {
      if (token) await mutateDb((d) => {
        const t = d.arrival_tokens.find((x) => x.booking_id === bookingId)
        if (t) t.attempt_count++
      })
      throw new ApiFail('INVALID_ARRIVAL_TOKEN', 'That arrival code is not valid.', 422)
    }
    await mutateDb((d) => {
      const t = d.arrival_tokens.find((x) => x.booking_id === bookingId)
      if (t) t.consumed_at = new Date(now).toISOString()
    })
    return appendEvent(bookingId, 'ArrivalVerified', {}, { actor_id: actor.id, actor_role: 'HOST', source: 'UI' })
  })
}

export async function startSession(ctx: Ctx, bookingId: string) {
  return command(ctx, bookingId, undefined, async (s, h, actor, now) => {
    if (!isHost(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    guardOrFail(s, 'ChargingStarted')
    if (readDb().sessions.some((x) => x.booking_id === bookingId)) throw new ApiFail('SESSION_EXISTS', 'A session already exists for this booking.', 409)
    const sessionId = uuid()
    await mutateDb((d) => {
      d.sessions.push({ id: sessionId, booking_id: bookingId, state: 'ACTIVE', started_at: new Date(now).toISOString(), stopped_at: null, grid_energy_wh: null, battery_gain_estimate_wh: null, metering_source: 'DEMO', reconciliation_state: 'PENDING', is_demo: true })
    })
    return appendEvent(bookingId, 'ChargingStarted', { session_id: sessionId, estimated_duration_s: s.request.quote.duration_s, demo_seconds: POLICY.demo_session_seconds }, { actor_id: actor.id, actor_role: 'HOST', source: 'UI' })
  })
}

export function sessionProgress(s: BookingState, now: number) {
  if (s.completed) return 1
  if (!s.session) return 0
  return Math.min(1, Math.max(0, (now - Date.parse(s.session.started_at)) / (s.session.demo_seconds * 1000)))
}

export async function completeSession(ctx: Ctx, bookingId: string) {
  return command(ctx, bookingId, undefined, async (s, h, actor, now) => {
    if (!isHost(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    guardOrFail(s, 'ChargingCompleted')
    if (sessionProgress(s, now) < 1) throw new ApiFail('SESSION_IN_PROGRESS', 'The demo session has not reached its fixture end yet.', 409)
    const grid = s.request.quote.grid_wh
    const gain = Math.floor(grid * POLICY.efficiency)
    await mutateDb((d) => {
      const x = d.sessions.find((y) => y.booking_id === bookingId)
      if (x) Object.assign(x, { state: 'COMPLETED', stopped_at: new Date(now).toISOString(), grid_energy_wh: grid, battery_gain_estimate_wh: gain })
    })
    return appendEvent(bookingId, 'ChargingCompleted', { session_id: s.session!.id, grid_wh: grid, battery_gain_wh: gain, metering_source: 'DEMO' }, { actor_id: actor.id, actor_role: 'HOST', source: 'UI' })
  })
}

export async function cancelBooking(ctx: Ctx, bookingId: string, reason: string, expected_sequence?: number) {
  return command(ctx, bookingId, expected_sequence, async (s, h, actor, now) => {
    const by = isDriver(actor, h) ? 'DRIVER' : isHost(actor, h) ? 'HOST' : isAdmin(actor) ? 'ADMIN' : null
    if (!by) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
    failIfExpired(s)
    guardOrFail(s, 'BookingCancelled')
    // Pilot default until a deduction policy is approved: full refund of unused service (fee included).
    const refund = s.payment === 'CAPTURED' ? s.paid_paise : 0
    const event = appendEvent(bookingId, 'BookingCancelled', { by, reason: reason || 'No reason given', refund_paise: refund, refund_state: refund ? 'SIMULATED_REFUND' : 'NONE' }, { actor_id: actor.id, actor_role: by === 'ADMIN' ? 'ADMIN' : by, source: 'UI' })
    if (refund) await mutateDb((d) => d.payments.filter((p) => p.booking_id === bookingId && p.state === 'CAPTURED').forEach((p) => ((p.state = 'REFUNDED'), (p.note = `Simulated refund ${new Date(now).toISOString()}`))))
    return event
  })
}

/* ---------------- Reads ---------------- */

export function getAccess(ctx: Ctx, bookingId: string) {
  const actor = requireActor(ctx)
  const h = headerById(bookingId)
  if (!h || !canRead(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
  const s = stateOf(bookingId)!
  const now = serverNow()
  if (isDriver(actor, h)) {
    const open = !s.ended && s.payment === 'CAPTURED' && s.host_confirmed_at && now <= Date.parse(s.request.end_at) + POLICY.arrival_after_min * 60_000
    if (!open) throw new ApiFail('ACCESS_NOT_AVAILABLE', 'Arrival details unlock after host confirmation and checkout, and close after the booking.', 403)
  } else if (!isHost(actor, h) && !isAdmin(actor)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
  if (isAdmin(actor) && !isHost(actor, h)) void mutateDb((d) => d.audit.push({ id: uuid(), at: new Date(now).toISOString(), actor_id: actor.id, action: 'READ_PRIVATE_ACCESS', detail: h.booking_ref }))
  const priv = readDb().site_private.find((p) => p.site_id === h.site_id)
  if (!priv) throw new ApiFail('NOT_FOUND', 'No access details recorded.', 404)
  return priv
}

export type Action = 'ACCEPT' | 'DECLINE' | 'PAY' | 'DEPART' | 'ARRIVAL_CODE' | 'CHECK_IN' | 'START' | 'COMPLETE' | 'CANCEL' | 'ACCESS' | 'RECEIPT'

export function allowedActions(s: BookingState, h: BookingHeader, actor: User): Action[] {
  const a: Action[] = []
  const driver = isDriver(actor, h)
  const host = isHost(actor, h)
  if (s.lifecycle === 'done') return driver || host ? ['RECEIPT'] : []
  if (s.ended) return []
  if (host && s.lifecycle === 'requested') a.push('ACCEPT', 'DECLINE')
  if (driver && s.lifecycle === 'host_confirmed' && s.payment !== 'CAPTURED') a.push('PAY')
  if (driver && s.lifecycle === 'host_confirmed' && s.payment === 'CAPTURED') a.push('DEPART')
  if (driver && s.payment === 'CAPTURED' && (s.lifecycle === 'host_confirmed' || s.lifecycle === 'on_the_way')) a.push('ARRIVAL_CODE', 'ACCESS')
  if (host && s.lifecycle === 'on_the_way' && !s.arrival_verified_at) a.push('CHECK_IN')
  if (host && s.lifecycle === 'on_the_way' && s.arrival_verified_at) a.push('START')
  if (host && s.lifecycle === 'charging') a.push('COMPLETE')
  if ((driver || host) && s.lifecycle !== 'charging') a.push('CANCEL')
  if (host && s.lifecycle !== 'requested') a.push('ACCESS')
  return a
}

export function getBooking(ctx: Ctx, bookingId: string) {
  const actor = requireActor(ctx)
  const h = headerById(bookingId)
  if (!h || !canRead(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
  const s = stateOf(bookingId)!
  return { header: h, state: s, label: LIFECYCLE_LABEL[s.lifecycle], allowed_actions: allowedActions(s, h, actor), latest_sequence: s.last_sequence }
}

export function getEvents(ctx: Ctx, bookingId: string, afterSequence?: number) {
  const actor = requireActor(ctx)
  const h = headerById(bookingId)
  if (!h || !canRead(actor, h)) throw new ApiFail('NOT_FOUND', 'Booking not found.', 404)
  return readStreamAfter(bookingId, afterSequence ?? 0)
}

export function listBookings(ctx: Ctx, scope: 'driver' | 'host' | 'all') {
  const actor = requireActor(ctx)
  const db = readDb()
  const rows = db.bookings.filter((h) =>
    scope === 'driver' ? isDriver(actor, h) : scope === 'host' ? isHost(actor, h) : isAdmin(actor) || (isJury(actor) && h.is_demo),
  )
  return rows
    .map((h) => ({ header: h, state: stateOf(h.id)! }))
    .filter((r) => r.state)
    .sort((a, b) => Date.parse(b.header.created_at) - Date.parse(a.header.created_at))
}

export function hostEarnings(ctx: Ctx) {
  const actor = requireActor(ctx, 'HOST')
  const done = listBookings(ctx, 'host').filter((r) => r.state.lifecycle === 'done')
  const rows = done.map((r) => {
    const energy = r.state.request.quote.energy_subtotal_paise
    const p = illustrativeHostProceeds(energy, POLICY.commission_bps)
    return { ...r, energy_paise: energy, ...p }
  })
  return { host_account_id: actor.host_account_id, rows, pending_paise: rows.reduce((t, r) => t + r.host_paise, 0) }
}

export function driverName(id: string) {
  return userById(id)?.display_name ?? 'Driver'
}

/* ---------------- Worker ---------------- */

/** Expiry worker: appends due HoldExpired events. Safe to run from every tab; each append rechecks under lock. */
export async function runExpiryWorker() {
  const now = serverNow()
  for (const h of readDb().bookings) {
    const s = stateOf(h.id)
    if (!s || s.ended) continue
    const due =
      (s.lifecycle === 'requested' && now > Date.parse(s.request.host_response_deadline)) ||
      (s.lifecycle === 'host_confirmed' && s.payment !== 'CAPTURED' && s.checkout_deadline && now > Date.parse(s.checkout_deadline))
    if (due) await withLocks([`resource:${h.resource_id}`, `booking:${h.id}`], async () => expireIfDue(h.id, serverNow()))
  }
}

export { readStream }
