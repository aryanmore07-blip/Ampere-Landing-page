/*
 * Client-facing API facade. Mirrors the proposed /api routes from the spec, but runs
 * in the browser against the simulated server. The actor always comes from the tab's
 * session, never from arguments. Every call returns { ok, data | error, request_id }.
 */
import type { CheckOutcome, ConnectorStandard, LatLng, ResourceStatus, SiteType } from '../domain/types'
import * as B from './bookings'
import { searchChargers, siteDetail, type SearchInput } from './discovery'
import { handle, ApiFail, requireActor } from './http'
import { runConsoleCommand } from './jury'
import * as L from './listings'
import { mutateDb, readDb, resetDemo, serverNow } from './db'
import { nextSlots } from './availability'
import { istParts } from '../lib/time'
import { currentUser } from './session'

const ctx = () => ({ actor: currentUser() })

export const api = {
  // Discovery
  searchChargers: (input: SearchInput) => handle(() => searchChargers(input)),
  siteDetail: (siteId: string) => handle(() => siteDetail(siteId)),

  // Vehicles
  updateVehicle: (vehicleId: string, patch: { soc?: number; target_soc?: number; model_id?: string; nickname?: string }) =>
    handle(async () => {
      const actor = requireActor(ctx())
      if (patch.soc !== undefined && !(patch.soc >= 0 && patch.soc <= 100)) throw new ApiFail('INVALID_SOC', 'Battery must be 0–100%.', 400)
      if (patch.target_soc !== undefined && !(patch.target_soc > 0 && patch.target_soc <= 100)) throw new ApiFail('INVALID_TARGET', 'Target must be 1–100%.', 400)
      await mutateDb((d) => {
        const v = d.vehicles.find((x) => x.id === vehicleId && x.owner_id === actor.id)
        if (!v) throw new ApiFail('NOT_FOUND', 'Vehicle not found.', 404)
        Object.assign(v, patch)
      })
    }),
  setOrigin: (origin: LatLng & { label: string }) =>
    handle(async () => {
      const actor = requireActor(ctx())
      await mutateDb((d) => {
        d.last_origin[actor.id] = origin
      })
    }),

  slots: (resourceId: string, durationMin: number, day: 0 | 1) =>
    handle(() => {
      requireActor(ctx())
      const now = serverNow()
      const { dayStart } = istParts(now)
      const from = day === 0 ? now : dayStart + 86_400_000
      const to = day === 0 ? dayStart + 86_400_000 : dayStart + 2 * 86_400_000
      return nextSlots(resourceId, durationMin, from, now, 96, Math.max(0, (to - from) / 3600_000)).map((t) => new Date(t).toISOString())
    }),

  // Quote and reserve
  createQuote: (input: B.QuoteInput) => handle(() => B.createQuote(ctx(), input)),
  createBooking: (input: B.CreateBookingInput) => handle(() => B.createBooking(ctx(), input)),
  getBooking: (id: string) => handle(() => B.getBooking(ctx(), id)),
  getEvents: (id: string, after?: number) => handle(() => B.getEvents(ctx(), id, after)),
  listBookings: (scope: 'driver' | 'host' | 'all') => handle(() => B.listBookings(ctx(), scope)),
  accept: (id: string, expected_sequence?: number) => handle(() => B.acceptBooking(ctx(), id, { expected_sequence })),
  decline: (id: string, reason: string, expected_sequence?: number) => handle(() => B.declineBooking(ctx(), id, reason, expected_sequence)),
  cancel: (id: string, reason: string, expected_sequence?: number) => handle(() => B.cancelBooking(ctx(), id, reason, expected_sequence)),

  // Payments and arrival
  payDemo: (id: string, scenario: 'SUCCESS' | 'FAILURE', idempotencyKey: string) => handle(() => B.payDemo(ctx(), id, scenario, idempotencyKey)),
  depart: (id: string, expected_sequence?: number) => handle(() => B.depart(ctx(), id, expected_sequence)),
  arrivalCode: (id: string) => handle(() => B.issueArrivalCode(ctx(), id)),
  checkIn: (id: string, code: string) => handle(() => B.checkIn(ctx(), id, code)),
  access: (id: string) => handle(() => B.getAccess(ctx(), id)),

  // Sessions
  startSession: (id: string) => handle(() => B.startSession(ctx(), id)),
  completeSession: (id: string) => handle(() => B.completeSession(ctx(), id)),
  hostEarnings: () => handle(() => B.hostEarnings(ctx())),

  // Host listings
  hostSites: () => handle(() => L.hostSites(ctx())),
  createDraft: (input: L.NewListingInput) => handle(() => L.createDraft(ctx(), input)),
  submitForReview: (siteId: string) => handle(() => L.submitForReview(ctx(), siteId)),
  setPaused: (siteId: string, paused: boolean) => handle(() => L.setPaused(ctx(), siteId, paused)),
  setResourceStatus: (resourceId: string, status: ResourceStatus) => handle(() => L.setResourceStatus(ctx(), resourceId, status)),
  updateSchedule: (resourceId: string, start: number, end: number) => handle(() => L.updateSchedule(ctx(), resourceId, start, end)),
  addBlackout: (resourceId: string, start: string, end: string, kind: 'BLACKOUT' | 'HOST_USE', reason: string) => handle(() => L.addBlackout(ctx(), resourceId, start, end, kind, reason)),
  removeBlackout: (id: string) => handle(() => L.removeBlackout(ctx(), id)),

  // Admin
  adminQueue: () => handle(() => L.adminQueue(ctx())),
  recordCheck: (checkId: string, outcome: CheckOutcome, notes: string) => handle(() => L.recordCheck(ctx(), checkId, outcome, notes)),
  activateSite: (siteId: string) => handle(() => L.activateSite(ctx(), siteId)),
  rejectSite: (siteId: string, reasons: string[]) => handle(() => L.rejectSite(ctx(), siteId, reasons)),
  suspendSite: (siteId: string, reason: string) => handle(() => L.suspendSite(ctx(), siteId, reason)),

  // Jury console
  juryCommand: (line: string, commandId: string) => runConsoleCommand(ctx(), line, commandId),

  // Demo controls (isolated demo environment only)
  advanceClock: (ms: number) =>
    handle(async () => {
      if (readDb().mode !== 'DEMO') throw new ApiFail('DEMO_ONLY', 'Clock control is demo-only.', 403)
      await mutateDb((d) => {
        d.clock_offset_ms = ms === 0 ? 0 : d.clock_offset_ms + ms
      })
    }),
  setRouteProvider: (p: 'DEMO' | 'OSRM') =>
    handle(async () => {
      await mutateDb((d) => {
        d.settings.route_provider = p
      })
    }),
  markNotificationsRead: (eventIds: string[]) =>
    handle(async () => {
      const actor = requireActor(ctx())
      await mutateDb((d) => {
        const set = new Set([...(d.notif_read[actor.id] ?? []), ...eventIds])
        d.notif_read[actor.id] = [...set].slice(-500)
      })
    }),
  resetDemo: () =>
    handle(async () => {
      if (readDb().mode !== 'DEMO') throw new ApiFail('DEMO_ONLY', 'Reset refuses a non-demo environment.', 403)
      await resetDemo()
    }),
}

export type { SearchInput, ConnectorStandard, SiteType }
