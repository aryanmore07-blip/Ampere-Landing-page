import { beforeEach, describe, expect, it } from 'vitest'
import { resetDemo, readDb, mutateDb } from '../src/server/db'
import { searchChargers } from '../src/server/discovery'
import * as B from '../src/server/bookings'
import { runConsoleCommand } from '../src/server/jury'
import { readStream } from '../src/server/eventStore'
import { replay } from '../src/domain/booking'
import { userById } from '../src/domain/catalogue'
import { DEMO_ORIGIN, POLICY } from '../src/domain/policy'

const as = (id: string) => ({ actor: userById(id)! })
const driver = as('u-driver')
const cafeHost = as('u-host-cafe')
const homeHost = as('u-host-home')
const jury = as('u-jury')

beforeEach(async () => {
  await resetDemo()
})

async function slot(resourceId: string, mins = 90) {
  const { nextSlots } = await import('../src/server/availability')
  const now = Date.now() + readDb().clock_offset_ms
  const s = nextSlots(resourceId, mins, now + 15 * 60_000, now, 1)[0]
  return { start_at: new Date(s).toISOString(), end_at: new Date(s + mins * 60_000).toISOString() }
}

describe('AT17/AT18 strict discovery', () => {
  it('at 4% hides the out-of-range office, the wrong connector and the faulted charger', async () => {
    const r = await searchChargers({ origin: DEMO_ORIGIN, model_id: 'vm-nexon-ev-demo', soc: 4 })
    const ids = r.results.map((x) => x.site.id)
    expect(ids).toContain('site-cafe')
    expect(ids).toContain('site-home')
    expect(ids).not.toContain('site-aundh')
    expect(ids).not.toContain('site-lane7')
    expect(ids).not.toContain('site-studio')
    expect(ids).not.toContain('site-cowork')
    expect(r.budget.range_budget_m).toBe(4000)
  })
  it('raising battery reveals the distant charger', async () => {
    const r = await searchChargers({ origin: DEMO_ORIGIN, model_id: 'vm-nexon-ev-demo', soc: 10 })
    expect(r.results.map((x) => x.site.id)).toContain('site-aundh')
  })
  it('a forged quote for the wrong connector is rejected', async () => {
    const s = await slot('res-lane7-1', 60)
    await expect(B.createQuote(driver, { connector_id: 'con-lane7-ac001', model_id: 'vm-nexon-ev-demo', soc: 4, origin: DEMO_ORIGIN, ...s, plan: 'BASIC', energy: { kind: 'GRID', grid_wh: 2000 } })).rejects.toMatchObject({ code: 'INCOMPATIBLE' })
  })
  it('a directory record cannot be quoted', async () => {
    const now = Date.now()
    await expect(B.createQuote(driver, { connector_id: 'con-dir-ccs', model_id: 'vm-nexon-ev-demo', soc: 4, origin: DEMO_ORIGIN, start_at: new Date(now + 3600_000).toISOString(), end_at: new Date(now + 7200_000).toISOString(), plan: 'BASIC', energy: { kind: 'GRID', grid_wh: 2000 } })).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY' })
  })
})

describe('full journey', () => {
  it('requested → host confirmed → on the way → charging → done, with receipt values', async () => {
    const s = await slot('res-cafe-1')
    const q = await B.createQuote(driver, { connector_id: 'con-cafe-t2', model_id: 'vm-nexon-ev-demo', soc: 4, origin: DEMO_ORIGIN, ...s, plan: 'STANDARD', energy: { kind: 'GRID', grid_wh: 8000 } })
    expect(q.snapshot.total_paise).toBe(13200)
    const b = await B.createBooking(driver, { quote_id: q.id, idempotency_key: 'k1', policy_acceptance_version: POLICY.version })
    // Idempotent retry
    const again = await B.createBooking(driver, { quote_id: q.id, idempotency_key: 'k1', policy_acceptance_version: POLICY.version })
    expect(again.booking_id).toBe(b.booking_id)
    await expect(B.depart(driver, b.booking_id)).rejects.toMatchObject({ code: 'HOST_CONFIRMATION_REQUIRED' })
    await expect(B.acceptBooking(homeHost, b.booking_id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await B.acceptBooking(cafeHost, b.booking_id)
    await B.payDemo(driver, b.booking_id, 'SUCCESS', 'p1')
    await B.payDemo(driver, b.booking_id, 'SUCCESS', 'p1')
    await B.depart(driver, b.booking_id)
    const { code } = await B.issueArrivalCode(driver, b.booking_id)
    await mutateDb((d) => { d.clock_offset_ms = Date.parse(s.start_at) - Date.now() })
    await expect(B.checkIn(cafeHost, b.booking_id, '000000' === code ? '111111' : '000000')).rejects.toMatchObject({ code: 'INVALID_ARRIVAL_TOKEN' })
    await B.checkIn(cafeHost, b.booking_id, code)
    await B.startSession(cafeHost, b.booking_id)
    await expect(B.completeSession(cafeHost, b.booking_id)).rejects.toMatchObject({ code: 'SESSION_IN_PROGRESS' })
    await mutateDb((d) => { d.clock_offset_ms += 61_000 })
    await B.completeSession(cafeHost, b.booking_id)
    const st = replay(readStream(b.booking_id))!
    expect(st.lifecycle).toBe('done')
    expect(st.completed).toMatchObject({ grid_wh: 8000, battery_gain_wh: 7200 })
    expect(readStream(b.booking_id).filter((e) => e.event_type === 'PaymentCaptured')).toHaveLength(1)
    await expect(B.cancelBooking(driver, b.booking_id, 'x')).rejects.toMatchObject({ code: 'BOOKING_COMPLETED' })
  })
})

describe('AT06/AT07 concurrency and expiry', () => {
  it('two simultaneous requests for alternative connectors on one resource yield exactly one hold', async () => {
    const s = await slot('res-cafe-1')
    const qa = await B.createQuote(driver, { connector_id: 'con-cafe-t2', model_id: 'vm-nexon-ev-demo', soc: 4, origin: DEMO_ORIGIN, ...s, plan: 'BASIC', energy: { kind: 'GRID', grid_wh: 4000 } })
    const qb = await B.createQuote(jury, { connector_id: 'con-cafe-ccs', model_id: 'vm-nexon-ev-demo', soc: 4, origin: DEMO_ORIGIN, ...s, plan: 'BASIC', energy: { kind: 'GRID', grid_wh: 4000 } })
    const results = await Promise.allSettled([
      B.createBooking(driver, { quote_id: qa.id, idempotency_key: 'a', policy_acceptance_version: POLICY.version }),
      B.createBooking(jury, { quote_id: qb.id, idempotency_key: 'b', policy_acceptance_version: POLICY.version }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'SLOT_UNAVAILABLE' } })
  })
  it('late host acceptance fails and releases the slot', async () => {
    const s = await slot('res-cafe-2')
    const q = await B.createQuote(driver, { connector_id: 'con-cafe2-t2', model_id: 'vm-nexon-ev-demo', soc: 4, origin: DEMO_ORIGIN, ...s, plan: 'BASIC', energy: { kind: 'GRID', grid_wh: 4000 } })
    const b = await B.createBooking(driver, { quote_id: q.id, idempotency_key: 'x', policy_acceptance_version: POLICY.version })
    await mutateDb((d) => { d.clock_offset_ms = 121_000 })
    await expect(B.acceptBooking(cafeHost, b.booking_id)).rejects.toMatchObject({ code: 'HOLD_EXPIRED' })
    expect(replay(readStream(b.booking_id))!.occupancy_active).toBe(false)
  })
})

describe('AT16/AT19/AT22 jury console', () => {
  it('TICKET persists a stream, READY appends HostConfirmed, replay restores host confirmed', async () => {
    const t = await runConsoleCommand(jury, 'TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2', 'cmd-1')
    expect(t.ok).toBe(true)
    expect(t.lines.map((l) => l.text).join('\n')).not.toContain('Aundh')
    const ref = t.booking_ref!
    const time = '2026-10-22T10:30:00+05:30'
    const r = await runConsoleCommand(jury, `READY|${ref}|${time}`, 'cmd-2')
    expect(r.ok).toBe(true)
    const again = await runConsoleCommand(jury, `READY|${ref}|${time}`, 'cmd-3')
    expect(again.ok).toBe(true)
    const diff = await runConsoleCommand(jury, `READY|${ref}|2026-10-22T10:31:00+05:30`, 'cmd-4')
    expect(diff.error_code).toBe('ALREADY_HOST_CONFIRMED')
    const events = readStream(t.booking_id!)
    expect(events.map((e) => e.event_type)).toEqual(['BookingRequested', 'HostConfirmed'])
    expect(events[0].source).toBe('JURY_CONSOLE')
    expect(replay(events)!.lifecycle).toBe('host_confirmed')
  })
  it('a driver cannot READY; unknown refs and no-match areas fail cleanly', async () => {
    const t = await runConsoleCommand(jury, 'TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2', 'c1')
    const d = await runConsoleCommand(driver, `READY|${t.booking_ref}|2026-10-22T10:30:00+05:30`, 'c2')
    expect(d.error_code).toBe('BOOKING_NOT_FOUND')
    expect((await runConsoleCommand(jury, 'READY|AMP-NOPE00|2026-10-22T10:30:00+05:30', 'c3')).error_code).toBe('BOOKING_NOT_FOUND')
    const n = await runConsoleCommand(jury, 'TICKET|Tata Nexon EV|4|18.5913|73.7389|CCS2', 'c4')
    expect(n.error_code).toBe('NO_MATCH')
  })
  it('a normal booking can be confirmed by READY and a console booking by the host button', async () => {
    const s = await slot('res-cafe-2')
    const q = await B.createQuote(driver, { connector_id: 'con-cafe2-t2', model_id: 'vm-nexon-ev-demo', soc: 4, origin: DEMO_ORIGIN, ...s, plan: 'BASIC', energy: { kind: 'GRID', grid_wh: 4000 } })
    const b = await B.createBooking(driver, { quote_id: q.id, idempotency_key: 'n', policy_acceptance_version: POLICY.version })
    expect((await runConsoleCommand(jury, `READY|${b.booking_ref}|2026-10-22T10:30:00`, 'r')).ok).toBe(true)
    const t = await runConsoleCommand(jury, 'TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2', 't')
    await B.acceptBooking(cafeHost, t.booking_id!)
    expect(replay(readStream(t.booking_id!))!.lifecycle).toBe('host_confirmed')
  })
})
