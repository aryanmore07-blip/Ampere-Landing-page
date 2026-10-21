import type { CheckOutcome, CheckType, ConnectorStandard, ResourceStatus, SiteType } from '../domain/types'
import { uuid } from '../lib/ids'
import { stateOf, withinSchedule } from './availability'
import { mutateDb, readDb, serverNow } from './db'
import { ApiFail, requireActor, type Ctx } from './http'

/* ---------------- Host ---------------- */

function ownSite(ctx: Ctx, siteId: string) {
  const actor = requireActor(ctx, 'HOST')
  const site = readDb().sites.find((s) => s.id === siteId)
  if (!site || site.host_account_id !== actor.host_account_id) throw new ApiFail('NOT_FOUND', 'Listing not found.', 404)
  return { actor, site }
}

export function hostSites(ctx: Ctx) {
  const actor = requireActor(ctx, 'HOST')
  const db = readDb()
  return db.sites
    .filter((s) => s.host_account_id === actor.host_account_id)
    .map((s) => ({
      site: s,
      resources: db.resources.filter((r) => r.site_id === s.id).map((r) => ({ ...r, connectors: db.connectors.filter((c) => c.resource_id === r.id), rules: db.rules.filter((x) => x.resource_id === r.id), exceptions: db.exceptions.filter((x) => x.resource_id === r.id) })),
      checks: db.checks.filter((c) => c.site_id === s.id),
      priv: db.site_private.find((p) => p.site_id === s.id) ?? null,
    }))
}

export interface NewListingInput {
  name: string
  site_type: Exclude<SiteType, 'PUBLIC_NETWORK'>
  public_area: string
  lat: number
  lng: number
  full_address: string
  entrance_instructions: string
  access_summary: string
  connector: ConnectorStandard
  power_kw: number
  start_min: number
  end_min: number
}

export async function createDraft(ctx: Ctx, input: NewListingInput) {
  const actor = requireActor(ctx, 'HOST')
  const fields: Record<string, string> = {}
  if (input.name.trim().length < 3) fields.name = 'Give the listing a name.'
  if (!input.public_area.trim()) fields.public_area = 'Describe the public area.'
  if (!input.full_address.trim()) fields.full_address = 'Private address is required for review.'
  if (!(input.power_kw > 0 && input.power_kw <= 60)) fields.power_kw = 'Power must be between 0 and 60 kW.'
  if (!(input.end_min > input.start_min)) fields.schedule = 'End must be after start.'
  if (!['TYPE2', 'CCS2'].includes(input.connector)) fields.connector = 'Only reviewed Type 2 and CCS2 equipment can be listed.'
  if (Object.keys(fields).length) throw new ApiFail('VALIDATION', 'Check the highlighted fields.', 400, fields)
  const siteId = 'site-' + uuid().slice(0, 8)
  const resId = 'res-' + uuid().slice(0, 8)
  const now = new Date(serverNow()).toISOString()
  const residential = input.site_type === 'RESIDENTIAL'
  await mutateDb((d) => {
    d.sites.push({
      id: siteId,
      host_account_id: actor.host_account_id!,
      name: input.name.trim(),
      site_type: input.site_type,
      listing_state: 'DRAFT',
      public_area: input.public_area.trim() + (residential ? ' (approximate)' : ''),
      approx_lat: residential ? Math.round(input.lat * 200) / 200 : input.lat,
      approx_lng: residential ? Math.round(input.lng * 200) / 200 : input.lng,
      location_precision: residential ? 'APPROXIMATE' : 'EXACT',
      access_summary: input.access_summary.trim() || 'Access details shared after confirmation.',
      amenities: [],
      accessibility_notes: '',
      source_kind: 'COMMUNITY',
      source_updated_at: now,
      route_fixture_m: null,
      is_demo: true,
    })
    d.site_private.push({ site_id: siteId, exact_lat: input.lat, exact_lng: input.lng, full_address: input.full_address.trim(), entrance_instructions: input.entrance_instructions.trim(), contact_reference: 'Host via in-app notices (demo)' })
    d.resources.push({ id: resId, site_id: siteId, label: 'Charger 1', rated_power_kw: input.power_kw, site_power_limit_kw: input.power_kw, current_status: 'AVAILABLE', status_source: 'HOST_UPDATE', status_observed_at: now, reservable: true, is_demo: true })
    d.connectors.push({ id: 'con-' + uuid().slice(0, 8), resource_id: resId, standard: input.connector, mode: input.connector === 'CCS2' ? 'DC' : 'AC', rated_power_kw: input.power_kw, cable: 'HOST_TETHERED', active: true })
    d.rules.push({ id: 'rule-' + resId, resource_id: resId, weekdays: [0, 1, 2, 3, 4, 5, 6], start_min: input.start_min, end_min: input.end_min })
    ;(['IDENTITY', 'PROPERTY_ACCESS', 'EQUIPMENT', 'PAID_OPERATION'] as CheckType[]).forEach((t, i) =>
      d.checks.push({ id: `chk-${siteId}-${i}`, site_id: siteId, check_type: t, outcome: 'PENDING', reviewer_id: null, reviewed_at: null, notes: '' }),
    )
  })
  return { site_id: siteId }
}

export async function submitForReview(ctx: Ctx, siteId: string) {
  const { site } = ownSite(ctx, siteId)
  if (site.listing_state !== 'DRAFT' && site.listing_state !== 'REJECTED') throw new ApiFail('INVALID_STATE', 'Only drafts or rejected listings can be submitted.', 409)
  await mutateDb((d) => {
    const s = d.sites.find((x) => x.id === siteId)!
    s.listing_state = 'PENDING_REVIEW'
    s.rejection_reasons = undefined
  })
}

function affectedBookings(resourceIds: string[]) {
  return readDb()
    .bookings.filter((b) => resourceIds.includes(b.resource_id))
    .map((b) => stateOf(b.id)!)
    .filter((s) => s && s.occupancy_active)
}

export async function setPaused(ctx: Ctx, siteId: string, paused: boolean) {
  const { site } = ownSite(ctx, siteId)
  if (paused && site.listing_state !== 'ACTIVE') throw new ApiFail('INVALID_STATE', 'Only active listings can be paused.', 409)
  if (!paused && site.listing_state !== 'PAUSED') throw new ApiFail('INVALID_STATE', 'Listing is not paused.', 409)
  await mutateDb((d) => {
    d.sites.find((x) => x.id === siteId)!.listing_state = paused ? 'PAUSED' : 'ACTIVE'
  })
  const res = readDb().resources.filter((r) => r.site_id === siteId).map((r) => r.id)
  return { affected: affectedBookings(res).map((s) => s.booking_ref) }
}

export async function setResourceStatus(ctx: Ctx, resourceId: string, status: ResourceStatus) {
  const r = readDb().resources.find((x) => x.id === resourceId)
  if (!r) throw new ApiFail('NOT_FOUND', 'Charger not found.', 404)
  ownSite(ctx, r.site_id)
  await mutateDb((d) => {
    const x = d.resources.find((y) => y.id === resourceId)!
    x.current_status = status
    x.status_source = 'HOST_UPDATE'
    x.status_observed_at = new Date(serverNow()).toISOString()
  })
}

/** Saves the weekly window and reports commitments that fall outside it. Never cancels them. */
export async function updateSchedule(ctx: Ctx, resourceId: string, startMin: number, endMin: number) {
  const r = readDb().resources.find((x) => x.id === resourceId)
  if (!r) throw new ApiFail('NOT_FOUND', 'Charger not found.', 404)
  ownSite(ctx, r.site_id)
  if (!(endMin > startMin) || startMin < 0 || endMin > 1440 || startMin % 15 || endMin % 15) throw new ApiFail('VALIDATION', 'Use a valid window in 15-minute steps.', 400)
  await mutateDb((d) => {
    d.rules = d.rules.filter((x) => x.resource_id !== resourceId)
    d.rules.push({ id: 'rule-' + resourceId, resource_id: resourceId, weekdays: [0, 1, 2, 3, 4, 5, 6], start_min: startMin, end_min: endMin })
  })
  const conflicts = affectedBookings([resourceId]).filter((s) => !withinSchedule(resourceId, Date.parse(s.request.start_at), Date.parse(s.request.end_at)))
  return { conflicts: conflicts.map((s) => s.booking_ref) }
}

export async function addBlackout(ctx: Ctx, resourceId: string, startAt: string, endAt: string, kind: 'BLACKOUT' | 'HOST_USE', reason: string) {
  const r = readDb().resources.find((x) => x.id === resourceId)
  if (!r) throw new ApiFail('NOT_FOUND', 'Charger not found.', 404)
  ownSite(ctx, r.site_id)
  const s = Date.parse(startAt)
  const e = Date.parse(endAt)
  if (!(e > s)) throw new ApiFail('VALIDATION', 'End must be after start.', 400)
  await mutateDb((d) => d.exceptions.push({ id: uuid(), resource_id: resourceId, start_at: new Date(s).toISOString(), end_at: new Date(e).toISOString(), kind, reason }))
  const conflicts = affectedBookings([resourceId]).filter((x) => Date.parse(x.request.start_at) < e && Date.parse(x.request.blocked_until) > s)
  return { conflicts: conflicts.map((x) => x.booking_ref) }
}

export async function removeBlackout(ctx: Ctx, exceptionId: string) {
  const x = readDb().exceptions.find((e) => e.id === exceptionId)
  if (!x) throw new ApiFail('NOT_FOUND', 'Not found.', 404)
  const r = readDb().resources.find((y) => y.id === x.resource_id)!
  ownSite(ctx, r.site_id)
  await mutateDb((d) => {
    d.exceptions = d.exceptions.filter((e) => e.id !== exceptionId)
  })
}

/* ---------------- Admin ---------------- */

export function adminQueue(ctx: Ctx) {
  requireActor(ctx, 'ADMIN')
  const db = readDb()
  return db.sites
    .filter((s) => s.source_kind !== 'DIRECTORY')
    .map((s) => ({
      site: s,
      checks: db.checks.filter((c) => c.site_id === s.id),
      resources: db.resources.filter((r) => r.site_id === s.id).map((r) => ({ ...r, connectors: db.connectors.filter((c) => c.resource_id === r.id) })),
      has_schedule: db.rules.some((r) => db.resources.some((x) => x.id === r.resource_id && x.site_id === s.id)),
    }))
}

export async function recordCheck(ctx: Ctx, checkId: string, outcome: CheckOutcome, notes: string) {
  const actor = requireActor(ctx, 'ADMIN')
  const chk = readDb().checks.find((c) => c.id === checkId)
  if (!chk) throw new ApiFail('NOT_FOUND', 'Check not found.', 404)
  const site = readDb().sites.find((s) => s.id === chk.site_id)!
  if (site.host_account_id && site.host_account_id === actor.host_account_id) throw new ApiFail('FORBIDDEN', 'You cannot review your own listing.', 403)
  await mutateDb((d) => {
    const c = d.checks.find((x) => x.id === checkId)!
    c.outcome = outcome
    c.notes = notes
    c.reviewer_id = actor.id
    c.reviewed_at = new Date(serverNow()).toISOString()
    d.audit.push({ id: uuid(), at: c.reviewed_at, actor_id: actor.id, action: `CHECK_${outcome}`, detail: `${site.name} · ${c.check_type}` })
  })
}

export async function activateSite(ctx: Ctx, siteId: string) {
  const actor = requireActor(ctx, 'ADMIN')
  const db = readDb()
  const site = db.sites.find((s) => s.id === siteId)
  if (!site) throw new ApiFail('NOT_FOUND', 'Listing not found.', 404)
  if (!['PENDING_REVIEW', 'SUSPENDED', 'PAUSED'].includes(site.listing_state)) throw new ApiFail('INVALID_STATE', `A ${site.listing_state} listing cannot be activated.`, 409)
  const missing = db.checks.filter((c) => c.site_id === siteId && c.outcome !== 'APPROVED')
  if (missing.length) throw new ApiFail('CHECKS_INCOMPLETE', `Approve every check first: ${missing.map((m) => m.check_type).join(', ')}.`, 422)
  if (!db.rules.some((r) => db.resources.some((x) => x.id === r.resource_id && x.site_id === siteId))) throw new ApiFail('NO_SCHEDULE', 'The listing needs a valid schedule.', 422)
  await mutateDb((d) => {
    const s = d.sites.find((x) => x.id === siteId)!
    s.listing_state = 'ACTIVE'
    s.suspension_reason = undefined
    d.audit.push({ id: uuid(), at: new Date(serverNow()).toISOString(), actor_id: actor.id, action: 'ACTIVATE', detail: s.name })
  })
}

export async function rejectSite(ctx: Ctx, siteId: string, reasons: string[]) {
  const actor = requireActor(ctx, 'ADMIN')
  if (!reasons.length || !reasons[0].trim()) throw new ApiFail('VALIDATION', 'Give the host an actionable reason.', 400)
  await mutateDb((d) => {
    const s = d.sites.find((x) => x.id === siteId)
    if (!s) throw new ApiFail('NOT_FOUND', 'Listing not found.', 404)
    s.listing_state = 'REJECTED'
    s.rejection_reasons = reasons
    d.audit.push({ id: uuid(), at: new Date(serverNow()).toISOString(), actor_id: actor.id, action: 'REJECT', detail: `${s.name}: ${reasons.join('; ')}` })
  })
}

export async function suspendSite(ctx: Ctx, siteId: string, reason: string) {
  const actor = requireActor(ctx, 'ADMIN')
  if (!reason.trim()) throw new ApiFail('VALIDATION', 'A suspension needs a recorded reason.', 400)
  await mutateDb((d) => {
    const s = d.sites.find((x) => x.id === siteId)
    if (!s) throw new ApiFail('NOT_FOUND', 'Listing not found.', 404)
    s.listing_state = 'SUSPENDED'
    s.suspension_reason = reason
    d.audit.push({ id: uuid(), at: new Date(serverNow()).toISOString(), actor_id: actor.id, action: 'SUSPEND', detail: `${s.name}: ${reason}` })
  })
  const res = readDb().resources.filter((r) => r.site_id === siteId).map((r) => r.id)
  return { affected: affectedBookings(res).map((s) => s.booking_ref) }
}
