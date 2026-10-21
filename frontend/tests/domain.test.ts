import { describe, expect, it } from 'vitest'
import { fromGridWh, fromTargetSoc, price, rangeBudget, routeConfidence, illustrativeHostProceeds } from '../src/domain/calc'
import { modelById } from '../src/domain/catalogue'
import { parseCommand, parseIsoTime } from '../src/domain/console'
import { POLICY } from '../src/domain/policy'
import { replay, guard, type BookingEvent } from '../src/domain/booking'

const nexon = modelById('vm-nexon-ev-demo')!

describe('AT04 range budget', () => {
  it('40 kWh, 4%, 2% reserve, 0.16 kWh/km, 1.25 → 4 km', () => {
    expect(rangeBudget(nexon, 4, POLICY).range_budget_m).toBe(4000)
    expect(rangeBudget(nexon, 4, POLICY).energy_budget_kwh).toBe(0.8)
  })
  it('1.8 km passes, 6 km fails, missing route is unverified', () => {
    const b = rangeBudget(nexon, 4, POLICY)
    const r = (d: number) => ({ distance_m: d, duration_s: 0, provider: 'DEMO_FIXTURE' as const, observed_at: '', label: '' })
    expect(routeConfidence(r(1800), b)).toBe('PLAUSIBLY_REACHABLE')
    expect(routeConfidence(r(6000), b)).toBe('OUTSIDE_ESTIMATED_BUDGET')
    expect(routeConfidence(null, b)).toBe('UNVERIFIED_DISTANCE')
  })
  it('SOC at or below reserve gives zero range', () => {
    expect(rangeBudget(nexon, 2, POLICY).range_budget_m).toBe(0)
    expect(rangeBudget(nexon, 1, POLICY).range_budget_m).toBe(0)
  })
  it('rejects impossible input', () => {
    expect(() => rangeBudget(nexon, 101, POLICY)).toThrow()
    expect(() => rangeBudget({ ...nexon, consumption_kwh_per_km: 0 }, 50, POLICY)).toThrow()
  })
})

describe('AT05 energy and price', () => {
  it('8 kWh grid energy costs ₹112 and adds ~7.2 kWh', () => {
    const e = fromGridWh(8000, 7, POLICY)
    expect(price(e.grid_wh, 1400, 0).energy_subtotal_paise).toBe(11200)
    expect(price(e.grid_wh, 1400, 2000).total_paise).toBe(13200)
    expect(e.battery_wh).toBe(7200)
    expect(Math.round(e.duration_s / 60)).toBe(69)
  })
  it('8 kWh battery gain needs ~8.889 kWh grid and ~76 min at 7 kW, ₹124.45', () => {
    const e = fromTargetSoc(nexon, 10, 30, 7, POLICY)
    expect(e.battery_wh).toBe(8000)
    expect(e.grid_wh).toBe(8889)
    expect(Math.round(e.duration_s / 60)).toBe(76)
    expect(price(e.grid_wh, 1400, 0).energy_subtotal_paise).toBe(12445)
  })
  it('15% illustrative commission on ₹112 is ₹16.80', () => {
    expect(illustrativeHostProceeds(11200, 1500)).toEqual({ commission_paise: 1680, host_paise: 9520 })
  })
})

describe('console grammar (AT23)', () => {
  it('parses the organiser example', () => {
    const p = parseCommand('TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2')
    expect('kind' in p && p.kind).toBe('TICKET')
  })
  it.each([
    ['TICKET|Tata Nexon EV|4|18.5|73.8', 'INVALID_FIELDS'],
    ['TICKET|Tata Nexon EV|4|18.5|73.8|CCS2|x', 'INVALID_FIELDS'],
    ['TICKET|Tata Nexon EV|101|18.5|73.8|CCS2', 'INVALID_BATTERY'],
    ['TICKET|Tata Nexon EV|abc|18.5|73.8|CCS2', 'INVALID_BATTERY'],
    ['TICKET|Tata Nexon EV|4|91|73.8|CCS2', 'INVALID_COORDINATES'],
    ['TICKET|Tata Nexon EV|4|18.5|181|CCS2', 'INVALID_COORDINATES'],
    ['TICKET|Tesla Roadster|4|18.5|73.8|CCS2', 'UNKNOWN_MODEL'],
    ['TICKET|Tata|4|18.5|73.8|CCS2', 'AMBIGUOUS_MODEL'],
    ['TICKET|Tata Nexon EV|4|18.5|73.8|GBT', 'UNKNOWN_CONNECTOR'],
    ['TICKET||4|18.5|73.8|CCS2', 'EMPTY_FIELD'],
    ['READY|AMP-1|2026-02-30T10:00:00+05:30', 'INVALID_TIME'],
    ['READY|AMP-1|yesterday', 'INVALID_TIME'],
    ['LAUNCH|x', 'UNKNOWN_COMMAND'],
  ])('%s → %s', (line, code) => {
    const p = parseCommand(line)
    expect('code' in p && p.code).toBe(code)
  })
  it('missing offset is Asia/Kolkata', () => {
    const t = parseIsoTime('2026-10-22T10:30:00')
    expect('iso' in t && t.iso).toBe('2026-10-22T05:00:00.000Z')
    expect('iso' in t && t.assumedTimezone).toBe(true)
  })
})

describe('reducer', () => {
  const base = { schema_version: 1 as const, actor_id: 'x', actor_role: 'DRIVER' as const, source: 'UI' as const, recorded_at: '2026-10-21T00:00:00Z', reported_at: null, correlation_id: 'c', idempotency_key: null, booking_id: 'b', event_id: 'e' }
  const req = { ...base, sequence: 1, event_type: 'BookingRequested', payload: { booking_ref: 'AMP-TEST', host_response_deadline: '', start_at: '', end_at: '' } } as unknown as BookingEvent
  it('only five lifecycle values and no reopening', () => {
    const evs = [req, { ...base, sequence: 2, event_type: 'HostConfirmed', payload: { checkout_deadline: 'x' } }, { ...base, sequence: 3, event_type: 'HostDeclined', payload: { reason: 'r' } }] as BookingEvent[]
    const s = replay(evs)!
    expect(s.lifecycle).toBe('host_confirmed')
    expect(s.outcome).toBe('HOST_DECLINED')
    expect(guard(s, 'HostConfirmed')).toBe('BOOKING_ENDED')
  })
  it('replay ignores arrival order and uses sequence', () => {
    const evs = [{ ...base, sequence: 2, event_type: 'HostConfirmed', payload: { checkout_deadline: 'x' } }, req] as BookingEvent[]
    expect(replay(evs)!.lifecycle).toBe('host_confirmed')
  })
  it('departure before host confirmation is rejected', () => {
    expect(guard(replay([req])!, 'DriverDeparted')).toBe('HOST_CONFIRMATION_REQUIRED')
  })
})
