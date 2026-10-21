import type { ActorRole, BookingEvent, EventPayloads, EventSource, EventType } from '../domain/booking'
import { uuid } from '../lib/ids'
import { EVENTS_PREFIX, serverNow } from './db'
import { kvGet, kvSet, publish } from './storage'

/*
 * Append-only booking event store. There is deliberately no update or delete API:
 * corrections are new events. Callers must hold the booking lock.
 */

export class AppendConflict extends Error {
  constructor(public code: 'SEQUENCE_CONFLICT' | 'DUPLICATE_EVENT', message: string) {
    super(message)
  }
}

export function readStream(bookingId: string): BookingEvent[] {
  return kvGet<BookingEvent[]>(EVENTS_PREFIX + bookingId) ?? []
}

export function readStreamAfter(bookingId: string, afterSequence: number) {
  const all = readStream(bookingId)
  const events = all.filter((e) => e.sequence > afterSequence)
  return { events, latest_sequence: all.length ? all[all.length - 1].sequence : 0, has_more: false }
}

export interface AppendMeta {
  actor_id: string | null
  actor_role: ActorRole
  source: EventSource
  correlation_id?: string
  idempotency_key?: string | null
  reported_at?: string | null
  expected_sequence?: number
  /** Fixture seeding only: historical recorded time for seeded demo streams. */
  seed_recorded_at?: string
}

export function appendEvent<T extends EventType>(bookingId: string, type: T, payload: EventPayloads[T], meta: AppendMeta): BookingEvent<T> {
  const stream = readStream(bookingId)
  const last = stream.length ? stream[stream.length - 1].sequence : 0
  if (meta.expected_sequence !== undefined && meta.expected_sequence !== last)
    throw new AppendConflict('SEQUENCE_CONFLICT', `Expected sequence ${meta.expected_sequence} but stream is at ${last}. Refresh and retry.`)
  if (meta.idempotency_key && stream.some((e) => e.idempotency_key === meta.idempotency_key))
    throw new AppendConflict('DUPLICATE_EVENT', 'This command was already applied.')
  const event: BookingEvent<T> = Object.freeze({
    event_id: uuid(),
    booking_id: bookingId,
    sequence: last + 1,
    event_type: type,
    schema_version: 1 as const,
    actor_id: meta.actor_id,
    actor_role: meta.actor_role,
    source: meta.source,
    recorded_at: meta.seed_recorded_at ?? new Date(serverNow()).toISOString(),
    reported_at: meta.reported_at ?? null,
    correlation_id: meta.correlation_id ?? uuid(),
    idempotency_key: meta.idempotency_key ?? null,
    payload: Object.freeze(payload) as EventPayloads[T],
  }) as BookingEvent<T>
  kvSet(EVENTS_PREFIX + bookingId, [...stream, event])
  publish({ kind: 'booking_event', booking_id: bookingId, event })
  return event
}
