import type { QuoteSnapshot, VehicleSnapshot } from '../domain/booking'
import { POLICY } from '../domain/policy'
import { price } from '../domain/calc'
import { bookingRef, uuid } from '../lib/ids'
import { ceilToStep, istParts } from '../lib/time'
import { mutateDb, serverNow, type BookingHeader } from './db'
import { appendEvent, type AppendMeta } from './eventStore'

/*
 * Seeds two synthetic streams so the demo has history:
 *  - Kabir's confirmed, paid booking on the residential wallbox (an existing overlapping booking);
 *  - Kabir's completed café session yesterday (receipt and illustrative host proceeds).
 * Streams are built with the same append routine as live commands.
 */
export async function seedDemoBookings() {
  const now = serverNow()
  const iso = (t: number) => new Date(t).toISOString()
  const headers: BookingHeader[] = []

  const vehicle: VehicleSnapshot = { model_id: 'vm-zs-ev-demo', model_label: 'MG ZS EV (Demo profile · 48 kWh usable)', soc: 30, origin: { lat: 18.536, lng: 73.894 }, range_budget_m: 63247, route_m: 2600, route_provider: 'Seeded demo road distance' }
  const quote = (gridWh: number, powerKw: number, plan: 'BASIC' | 'STANDARD', std: 'TYPE2'): QuoteSnapshot => {
    const fee = plan === 'STANDARD' ? 2000 : 0
    const p = price(gridWh, 1400, fee)
    return { quote_id: uuid(), plan, connector_standard: std, charging_mode: 'AC', effective_power_kw: powerKw, grid_wh: gridWh, battery_wh: Math.floor(gridWh * POLICY.efficiency), duration_s: Math.round((gridWh / 1000 / powerKw) * 3600), energy_paise_per_kwh: 1400, energy_subtotal_paise: p.energy_subtotal_paise, booking_fee_paise: fee, total_paise: p.total_paise, tariff_version: 1, is_demo: true }
  }

  // 1. Upcoming confirmed booking on the home wallbox.
  {
    let start = ceilToStep(now + 60 * 60_000, 15)
    const { minuteOfDay, dayStart } = istParts(start)
    if (minuteOfDay < 7 * 60 || minuteOfDay > 20 * 60) start = (minuteOfDay > 20 * 60 ? dayStart + 86_400_000 : dayStart) + 10 * 3600_000
    const end = start + 60 * 60_000
    const id = uuid()
    const ref = bookingRef()
    const q = quote(6000, 7.2, 'STANDARD', 'TYPE2')
    const t0 = now - 20 * 60_000
    const meta = (role: AppendMeta['actor_role'], actor: string, at: number): AppendMeta => ({ actor_id: actor, actor_role: role, source: 'UI', seed_recorded_at: iso(at) })
    appendEvent(id, 'BookingRequested', { booking_ref: ref, site_id: 'site-home', site_name: 'Kalyani Nagar residence', resource_id: 'res-home-1', connector_id: 'con-home-t2', host_account_id: 'ha-home', driver_id: 'u-driver2', start_at: iso(start), end_at: iso(end), blocked_until: iso(end + POLICY.buffer_min * 60_000), host_response_deadline: iso(t0 + 120_000), policy_version: POLICY.version, quote: q, vehicle }, meta('DRIVER', 'u-driver2', t0))
    appendEvent(id, 'HostConfirmed', { checkout_deadline: iso(t0 + 60_000 + 300_000) }, meta('HOST', 'u-host-home', t0 + 60_000))
    appendEvent(id, 'PaymentCaptured', { payment_attempt_id: uuid(), amount_paise: q.total_paise, provider: 'DEMO' }, { ...meta('DRIVER', 'u-driver2', t0 + 120_000), source: 'PROVIDER' })
    headers.push({ id, booking_ref: ref, created_at: iso(t0), driver_id: 'u-driver2', host_account_id: 'ha-home', resource_id: 'res-home-1', site_id: 'site-home', is_demo: true })
  }

  // 2. Completed café session yesterday.
  {
    const { dayStart } = istParts(now)
    const start = dayStart - 86_400_000 + 18 * 3600_000
    const end = start + 90 * 60_000
    const id = uuid()
    const ref = bookingRef()
    const q = quote(8000, 7.4, 'STANDARD', 'TYPE2')
    const t0 = start - 25 * 60_000
    const meta = (role: AppendMeta['actor_role'], actor: string, at: number): AppendMeta => ({ actor_id: actor, actor_role: role, source: 'UI', seed_recorded_at: iso(at) })
    appendEvent(id, 'BookingRequested', { booking_ref: ref, site_id: 'site-cafe', site_name: 'Ember & Ohm Café', resource_id: 'res-cafe-2', connector_id: 'con-cafe2-t2', host_account_id: 'ha-cafe', driver_id: 'u-driver2', start_at: iso(start), end_at: iso(end), blocked_until: iso(end + POLICY.buffer_min * 60_000), host_response_deadline: iso(t0 + 120_000), policy_version: POLICY.version, quote: q, vehicle: { ...vehicle, route_m: 1800 } }, meta('DRIVER', 'u-driver2', t0))
    appendEvent(id, 'HostConfirmed', { checkout_deadline: iso(t0 + 50_000 + 300_000) }, meta('HOST', 'u-host-cafe', t0 + 50_000))
    appendEvent(id, 'PaymentCaptured', { payment_attempt_id: uuid(), amount_paise: q.total_paise, provider: 'DEMO' }, { ...meta('DRIVER', 'u-driver2', t0 + 100_000), source: 'PROVIDER' })
    appendEvent(id, 'DriverDeparted', { range_budget_m: 63247, route_m: 1800, route_provider: 'Seeded demo road distance' }, meta('DRIVER', 'u-driver2', t0 + 150_000))
    appendEvent(id, 'ArrivalVerified', {}, meta('HOST', 'u-host-cafe', start - 4 * 60_000))
    const sid = uuid()
    appendEvent(id, 'ChargingStarted', { session_id: sid, estimated_duration_s: q.duration_s, demo_seconds: POLICY.demo_session_seconds }, meta('HOST', 'u-host-cafe', start))
    appendEvent(id, 'ChargingCompleted', { session_id: sid, grid_wh: 8000, battery_gain_wh: 7200, metering_source: 'DEMO' }, meta('HOST', 'u-host-cafe', start + q.duration_s * 1000))
    headers.push({ id, booking_ref: ref, created_at: iso(t0), driver_id: 'u-driver2', host_account_id: 'ha-cafe', resource_id: 'res-cafe-2', site_id: 'site-cafe', is_demo: true })
  }

  await mutateDb((d) => {
    d.bookings.push(...headers)
  })
}
