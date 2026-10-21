import { buildCatalogue, type CatalogueSeed } from '../domain/catalogue'
import type { QuoteSnapshot, VehicleSnapshot } from '../domain/booking'
import type { AvailabilityException, LatLng, Plan } from '../domain/types'
import { kvGet, kvKeys, kvRemove, kvSet, publish, subscribe, withLocks } from './storage'

export const DB_KEY = 'ampere.v1.db'
export const EVENTS_PREFIX = 'ampere.v1.events.'

export interface Quote {
  id: string
  driver_id: string
  site_id: string
  resource_id: string
  connector_id: string
  start_at: string
  end_at: string
  snapshot: QuoteSnapshot
  vehicle: VehicleSnapshot
  policy_version: string
  valid_until: string
  consumed_by: string | null
  created_at: string
  plan: Plan
  is_demo: true
}

export interface BookingHeader {
  id: string
  booking_ref: string
  created_at: string
  driver_id: string
  host_account_id: string
  resource_id: string
  site_id: string
  is_demo: true
}

export interface PaymentAttempt {
  id: string
  booking_id: string
  provider: 'DEMO'
  amount_paise: number
  state: 'CREATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED'
  idempotency_key: string
  created_at: string
  captured_at: string | null
  note?: string
  is_demo: true
}

export interface ChargingSessionRecord {
  id: string
  booking_id: string
  state: 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED'
  started_at: string
  stopped_at: string | null
  grid_energy_wh: number | null
  battery_gain_estimate_wh: number | null
  metering_source: 'DEMO'
  reconciliation_state: 'PENDING' | 'APPROVED' | 'DISPUTED'
  is_demo: true
}

export interface ArrivalToken {
  booking_id: string
  token_hash: string
  expires_at: string
  attempt_count: number
  consumed_at: string | null
}

export interface IdempotencyRecord {
  request_hash: string
  response: unknown
  created_at: string
}

export interface AuditEntry {
  id: string
  at: string
  actor_id: string
  action: string
  detail: string
}

export interface Db extends CatalogueSeed {
  version: 1
  mode: 'DEMO'
  seeded_at: string
  clock_offset_ms: number
  exceptions: AvailabilityException[]
  quotes: Quote[]
  bookings: BookingHeader[]
  payments: PaymentAttempt[]
  sessions: ChargingSessionRecord[]
  arrival_tokens: ArrivalToken[]
  idempotency: Record<string, IdempotencyRecord>
  audit: AuditEntry[]
  notif_read: Record<string, string[]>
  settings: { route_provider: 'DEMO' | 'OSRM'; realtime_paused: Record<string, boolean> }
  last_origin: Record<string, LatLng & { label: string }>
}

let cacheRaw: string | null = null
let cacheDb: Db | null = null

function rawDb(): string | null {
  try {
    return localStorage.getItem(DB_KEY)
  } catch {
    return cacheRaw
  }
}

export function freshDb(now = Date.now()): Db {
  return {
    version: 1,
    mode: 'DEMO',
    seeded_at: new Date(now).toISOString(),
    clock_offset_ms: 0,
    ...buildCatalogue(now),
    exceptions: [],
    quotes: [],
    bookings: [],
    payments: [],
    sessions: [],
    arrival_tokens: [],
    idempotency: {},
    audit: [],
    notif_read: {},
    settings: { route_provider: 'DEMO', realtime_paused: {} },
    last_origin: {},
  }
}

/** Synchronous snapshot read. Callers must not mutate the result. */
export function readDb(): Db {
  const raw = rawDb()
  if (raw && raw === cacheRaw && cacheDb) return cacheDb
  if (!raw) {
    if (cacheDb) return cacheDb
    const db = freshDb()
    writeDb(db)
    return db
  }
  cacheRaw = raw
  cacheDb = JSON.parse(raw) as Db
  return cacheDb
}

function writeDb(db: Db) {
  kvSet(DB_KEY, db)
  cacheRaw = JSON.stringify(db)
  cacheDb = db
}

/** Read-modify-write under the cross-tab db lock. */
export async function mutateDb<T>(fn: (db: Db) => T): Promise<T> {
  return withLocks(['db'], async () => {
    cacheRaw = null
    const db = structuredClone(readDb())
    const out = fn(db)
    writeDb(db)
    publish({ kind: 'db_changed' })
    return out
  })
}

/** Injected server clock. Demo-only offset lets testers fast-forward deadlines across all tabs. */
export function serverNow(): number {
  return Date.now() + (readDb().clock_offset_ms || 0)
}

export async function resetDemo() {
  await withLocks(['db'], async () => {
    for (const k of kvKeys(EVENTS_PREFIX)) kvRemove(k)
    const db = freshDb()
    writeDb(db)
  })
  const { seedDemoBookings } = await import('./seed')
  await seedDemoBookings()
  publish({ kind: 'reset' })
}

export async function ensureSeeded() {
  const fresh = !rawDb()
  readDb()
  if (fresh) {
    const { seedDemoBookings } = await import('./seed')
    await seedDemoBookings()
  }
}

// Invalidate the parsed cache when another tab changes the db.
subscribe((m) => {
  if (m.kind === 'db_changed' || m.kind === 'reset') cacheRaw = null
})

export { kvGet }
