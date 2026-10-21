import { replay, type BookingState } from '../domain/booking'
import { POLICY } from '../domain/policy'
import { ceilToStep, istParts } from '../lib/time'
import { readDb } from './db'
import { appendEvent, readStream } from './eventStore'

export function stateOf(bookingId: string): BookingState | null {
  return replay(readStream(bookingId))
}

/** Which expiry, if any, is due under server time. */
export function dueExpiry(s: BookingState, now: number): 'HOST_RESPONSE' | 'CHECKOUT' | null {
  if (s.ended) return null
  if (s.lifecycle === 'requested' && now > Date.parse(s.request.host_response_deadline)) return 'HOST_RESPONSE'
  if (s.lifecycle === 'host_confirmed' && s.payment !== 'CAPTURED' && s.checkout_deadline && now > Date.parse(s.checkout_deadline)) return 'CHECKOUT'
  return null
}

/** Appends due expiry events. Caller must hold the resource and booking locks. */
export function expireIfDue(bookingId: string, now: number): BookingState | null {
  const s = stateOf(bookingId)
  if (!s) return null
  const phase = dueExpiry(s, now)
  if (!phase) return s
  appendEvent(bookingId, 'HoldExpired', { phase }, { actor_id: null, actor_role: 'WORKER', source: 'WORKER' })
  return stateOf(bookingId)
}

/** Lazily expires every stale hold on a resource. Caller must hold the resource lock. */
export function expireResource(resourceId: string, now: number) {
  for (const b of readDb().bookings) if (b.resource_id === resourceId) expireIfDue(b.id, now)
}

export function occupancy(resourceId: string, excludeBookingId?: string) {
  const ranges: { booking_id: string; start: number; end: number }[] = []
  for (const b of readDb().bookings) {
    if (b.resource_id !== resourceId || b.id === excludeBookingId) continue
    const s = stateOf(b.id)
    if (s?.occupancy_active) ranges.push({ booking_id: b.id, start: Date.parse(s.request.start_at), end: Date.parse(s.request.blocked_until) })
  }
  return ranges
}

/** Every 15-minute step of [start, end) must sit inside an availability rule for its IST weekday. */
export function withinSchedule(resourceId: string, start: number, end: number) {
  const rules = readDb().rules.filter((r) => r.resource_id === resourceId)
  if (!rules.length) return false
  for (let t = start; t < end; t += 15 * 60_000) {
    const { weekday, minuteOfDay } = istParts(t)
    if (!rules.some((r) => r.weekdays.includes(weekday) && minuteOfDay >= r.start_min && minuteOfDay + 15 <= r.end_min)) return false
  }
  return true
}

export type SlotProblem = 'OUTSIDE_SCHEDULE' | 'BLACKOUT' | 'SLOT_UNAVAILABLE' | 'IN_PAST' | 'INVALID_DURATION'

export function slotProblem(resourceId: string, start: number, end: number, now: number, excludeBookingId?: string): SlotProblem | null {
  const dur = (end - start) / 60_000
  if (!(end > start) || dur < POLICY.min_booking_min || dur > POLICY.max_booking_min || dur % POLICY.increment_min !== 0) return 'INVALID_DURATION'
  if (start < now - 60_000) return 'IN_PAST'
  if (!withinSchedule(resourceId, start, end)) return 'OUTSIDE_SCHEDULE'
  const blocked = end + POLICY.buffer_min * 60_000
  if (readDb().exceptions.some((x) => x.resource_id === resourceId && Date.parse(x.start_at) < blocked && Date.parse(x.end_at) > start)) return 'BLACKOUT'
  if (occupancy(resourceId, excludeBookingId).some((r) => r.start < blocked && r.end > start)) return 'SLOT_UNAVAILABLE'
  return null
}

/** Next schedule-aligned free starts. Read-only; expiries not yet appended may hide a slot until the next worker tick. */
export function nextSlots(resourceId: string, durationMin: number, from: number, now: number, count = 8, horizonH = 24) {
  const out: number[] = []
  const limit = from + horizonH * 3600_000
  for (let t = ceilToStep(Math.max(from, now), POLICY.increment_min); t <= limit && out.length < count; t += POLICY.increment_min * 60_000) {
    if (!slotProblem(resourceId, t, t + durationMin * 60_000, now)) out.push(t)
  }
  return out
}
