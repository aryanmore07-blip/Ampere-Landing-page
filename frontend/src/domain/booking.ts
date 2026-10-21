import type { ConnectorStandard, ChargingMode, LatLng, Plan } from './types'

/* ---------------- Events ---------------- */

export const LIFECYCLE = ['requested', 'host_confirmed', 'on_the_way', 'charging', 'done'] as const
export type Lifecycle = (typeof LIFECYCLE)[number]
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  requested: 'requested',
  host_confirmed: 'host confirmed',
  on_the_way: 'on the way',
  charging: 'charging',
  done: 'done',
}

export type Outcome = 'HOST_DECLINED' | 'HOLD_EXPIRED' | 'CHECKOUT_EXPIRED' | 'CANCELLED_BY_DRIVER' | 'CANCELLED_BY_HOST' | 'NO_SHOW'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  HOST_DECLINED: 'Host declined this request',
  HOLD_EXPIRED: 'Host did not respond in time — the hold expired',
  CHECKOUT_EXPIRED: 'Checkout window closed before payment — the hold was released',
  CANCELLED_BY_DRIVER: 'Cancelled by the driver',
  CANCELLED_BY_HOST: 'Cancelled by the host',
  NO_SHOW: 'Recorded as a no-show',
}

export type EventSource = 'UI' | 'JURY_CONSOLE' | 'WORKER' | 'PROVIDER'
export type ActorRole = 'DRIVER' | 'HOST' | 'ADMIN' | 'JURY' | 'WORKER'

export interface QuoteSnapshot {
  quote_id: string
  plan: Plan
  connector_standard: ConnectorStandard
  charging_mode: ChargingMode
  effective_power_kw: number
  grid_wh: number
  battery_wh: number
  duration_s: number
  energy_paise_per_kwh: number
  energy_subtotal_paise: number
  booking_fee_paise: number
  total_paise: number
  tariff_version: number
  is_demo: true
}

export interface VehicleSnapshot {
  model_id: string
  model_label: string
  soc: number
  origin: LatLng
  range_budget_m: number
  route_m: number
  route_provider: string
}

export interface RequestedPayload {
  booking_ref: string
  site_id: string
  site_name: string
  resource_id: string
  connector_id: string
  host_account_id: string
  driver_id: string
  start_at: string
  end_at: string
  blocked_until: string
  host_response_deadline: string
  policy_version: string
  quote: QuoteSnapshot
  vehicle: VehicleSnapshot
  command_request_id?: string
}

export type EventPayloads = {
  BookingRequested: RequestedPayload
  HostConfirmed: { checkout_deadline: string; delegated_host_account_id?: string; jury_simulation?: boolean }
  HostDeclined: { reason: string }
  HoldExpired: { phase: 'HOST_RESPONSE' | 'CHECKOUT' }
  PaymentFailed: { payment_attempt_id: string }
  PaymentCaptured: { payment_attempt_id: string; amount_paise: number; provider: 'DEMO' }
  DriverDeparted: { range_budget_m: number; route_m: number; route_provider: string }
  ArrivalVerified: Record<string, never>
  ChargingStarted: { session_id: string; estimated_duration_s: number; demo_seconds: number }
  ChargingCompleted: { session_id: string; grid_wh: number; battery_gain_wh: number; metering_source: 'DEMO' }
  BookingCancelled: { by: 'DRIVER' | 'HOST' | 'ADMIN'; reason: string; refund_paise: number; refund_state: 'NONE' | 'SIMULATED_REFUND' }
}

export type EventType = keyof EventPayloads

export interface BookingEvent<T extends EventType = EventType> {
  event_id: string
  booking_id: string
  sequence: number
  event_type: T
  schema_version: 1
  actor_id: string | null
  actor_role: ActorRole
  source: EventSource
  recorded_at: string
  reported_at: string | null
  correlation_id: string
  idempotency_key: string | null
  payload: EventPayloads[T]
}

/* ---------------- Reducer ---------------- */

export interface BookingState {
  booking_id: string
  booking_ref: string
  lifecycle: Lifecycle
  outcome: Outcome | null
  ended: boolean
  occupancy_active: boolean
  request: RequestedPayload
  host_confirmed_at: string | null
  checkout_deadline: string | null
  payment: 'NONE' | 'FAILED' | 'CAPTURED' | 'REFUNDED'
  paid_paise: number
  departed_at: string | null
  arrival_verified_at: string | null
  session: { id: string; started_at: string; estimated_duration_s: number; demo_seconds: number } | null
  completed: EventPayloads['ChargingCompleted'] | null
  completed_at: string | null
  cancellation: EventPayloads['BookingCancelled'] | null
  source: EventSource
  last_sequence: number
}

export class UnsupportedStreamError extends Error {}

/**
 * Deterministic replay. No clock reads, no network calls. Events are applied in
 * ascending per-booking sequence; transitions are derived from event type only.
 */
export function replay(events: BookingEvent[]): BookingState | null {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence)
  let s: BookingState | null = null
  for (const e of sorted) {
    if (e.schema_version !== 1) throw new UnsupportedStreamError(`Unsupported event schema ${e.schema_version}`)
    s = apply(s, e)
  }
  return s
}

export function apply(s: BookingState | null, e: BookingEvent): BookingState {
  if (!s) {
    if (e.event_type !== 'BookingRequested') throw new UnsupportedStreamError('Stream must begin with BookingRequested')
    const p = e.payload as RequestedPayload
    return {
      booking_id: e.booking_id,
      booking_ref: p.booking_ref,
      lifecycle: 'requested',
      outcome: null,
      ended: false,
      occupancy_active: true,
      request: p,
      host_confirmed_at: null,
      checkout_deadline: null,
      payment: 'NONE',
      paid_paise: 0,
      departed_at: null,
      arrival_verified_at: null,
      session: null,
      completed: null,
      completed_at: null,
      cancellation: null,
      source: e.source,
      last_sequence: e.sequence,
    }
  }
  const n: BookingState = { ...s, last_sequence: e.sequence }
  const end = (outcome: Outcome | null) => {
    n.outcome = outcome
    n.ended = true
    n.occupancy_active = false
  }
  switch (e.event_type) {
    case 'BookingRequested':
      throw new UnsupportedStreamError('Duplicate BookingRequested')
    case 'HostConfirmed': {
      const p = e.payload as EventPayloads['HostConfirmed']
      n.lifecycle = 'host_confirmed'
      n.host_confirmed_at = e.recorded_at
      n.checkout_deadline = p.checkout_deadline
      break
    }
    case 'HostDeclined':
      end('HOST_DECLINED')
      break
    case 'HoldExpired':
      end((e.payload as EventPayloads['HoldExpired']).phase === 'CHECKOUT' ? 'CHECKOUT_EXPIRED' : 'HOLD_EXPIRED')
      break
    case 'PaymentFailed':
      if (n.payment === 'NONE') n.payment = 'FAILED'
      break
    case 'PaymentCaptured':
      n.payment = 'CAPTURED'
      n.paid_paise = (e.payload as EventPayloads['PaymentCaptured']).amount_paise
      break
    case 'DriverDeparted':
      n.lifecycle = 'on_the_way'
      n.departed_at = e.recorded_at
      break
    case 'ArrivalVerified':
      n.arrival_verified_at = e.recorded_at
      break
    case 'ChargingStarted': {
      const p = e.payload as EventPayloads['ChargingStarted']
      n.lifecycle = 'charging'
      n.session = { id: p.session_id, started_at: e.recorded_at, estimated_duration_s: p.estimated_duration_s, demo_seconds: p.demo_seconds }
      break
    }
    case 'ChargingCompleted':
      n.lifecycle = 'done'
      n.completed = e.payload as EventPayloads['ChargingCompleted']
      n.completed_at = e.recorded_at
      end(null)
      break
    case 'BookingCancelled': {
      const p = e.payload as EventPayloads['BookingCancelled']
      n.cancellation = p
      if (p.refund_state === 'SIMULATED_REFUND' && n.payment === 'CAPTURED') n.payment = 'REFUNDED'
      end(p.by === 'HOST' ? 'CANCELLED_BY_HOST' : 'CANCELLED_BY_DRIVER')
      break
    }
    default:
      throw new UnsupportedStreamError(`Unknown event type ${(e as BookingEvent).event_type}`)
  }
  return n
}

/** Validates a proposed transition against replayed state. Returns an error code or null. */
export function guard(s: BookingState, type: EventType): string | null {
  if (s.ended) return s.lifecycle === 'done' ? 'BOOKING_COMPLETED' : 'BOOKING_ENDED'
  switch (type) {
    case 'HostConfirmed':
      if (s.lifecycle !== 'requested') return s.lifecycle === 'host_confirmed' ? 'ALREADY_HOST_CONFIRMED' : 'ALREADY_ADVANCED'
      return null
    case 'HostDeclined':
    case 'HoldExpired':
      return s.lifecycle === 'requested' || s.lifecycle === 'host_confirmed' ? null : 'ALREADY_ADVANCED'
    case 'PaymentFailed':
    case 'PaymentCaptured':
      if (s.lifecycle !== 'host_confirmed') return s.lifecycle === 'requested' ? 'HOST_CONFIRMATION_REQUIRED' : 'ALREADY_ADVANCED'
      if (s.payment === 'CAPTURED') return 'ALREADY_CAPTURED'
      return null
    case 'DriverDeparted':
      if (s.lifecycle === 'requested') return 'HOST_CONFIRMATION_REQUIRED'
      if (s.lifecycle !== 'host_confirmed') return 'ALREADY_ADVANCED'
      if (s.payment !== 'CAPTURED') return 'CHECKOUT_REQUIRED'
      return null
    case 'ArrivalVerified':
      if (s.lifecycle !== 'on_the_way') return 'DEPARTURE_REQUIRED'
      if (s.arrival_verified_at) return 'ALREADY_CHECKED_IN'
      return null
    case 'ChargingStarted':
      if (s.lifecycle !== 'on_the_way') return 'INVALID_TRANSITION'
      if (!s.arrival_verified_at) return 'ARRIVAL_NOT_VERIFIED'
      return null
    case 'ChargingCompleted':
      return s.lifecycle === 'charging' ? null : 'INVALID_TRANSITION'
    case 'BookingCancelled':
      return s.lifecycle === 'charging' ? 'SESSION_ACTIVE' : null
    default:
      return 'INVALID_TRANSITION'
  }
}

export function lifecycleIndex(l: Lifecycle) {
  return LIFECYCLE.indexOf(l)
}
