import { compatibility, rangeBudget, routeConfidence, type RangeBudget, type RouteEvidence } from '../domain/calc'
import { modelById } from '../domain/catalogue'
import { POLICY } from '../domain/policy'
import type { ChargingMode, ConnectorStandard, LatLng, ResourceStatus, Site, SiteType, StatusSource, VehicleModel } from '../domain/types'
import { readDb, serverNow } from './db'
import { nextSlots } from './availability'
import { ApiFail } from './http'
import { routesFrom } from './routing'

export interface SearchInput {
  origin: LatLng
  model_id: string
  soc: number
  connector?: ConnectorStandard
  radius_km?: number
  site_type?: SiteType
}

export interface ResultConnector {
  id: string
  standard: ConnectorStandard
  mode: ChargingMode
  rated_power_kw: number
  effective_power_kw: number
  cable: 'HOST_TETHERED' | 'DRIVER_REQUIRED'
}

export interface SearchResult {
  site: PublicSite
  resource_id: string
  resource_label: string
  connectors: ResultConnector[]
  route: RouteEvidence & { confidence: 'PLAUSIBLY_REACHABLE' }
  status: { value: ResourceStatus; source: StatusSource; observed_at: string; freshness: 'FRESH' | 'STALE' | 'UNKNOWN' }
  price_paise_per_kwh: number | null
  standard_fee_paise: number | null
  reservable: boolean
  next_slot: string | null
  explanation: string[]
}

export interface PublicSite {
  id: string
  name: string
  site_type: SiteType
  public_area: string
  lat: number
  lng: number
  location_precision: 'EXACT' | 'APPROXIMATE'
  access_summary: string
  amenities: string[]
  accessibility_notes: string
  source_kind: Site['source_kind']
  operator_note?: string
  host_account_id: string | null
  is_demo: true
}

export interface SearchResponse {
  budget: RangeBudget
  model: VehicleModel
  results: SearchResult[]
  diagnostics: { considered: number; excluded_range: number; excluded_connector: number; excluded_status: number; excluded_unapproved: number; excluded_route_unknown: number; excluded_radius: number }
  route_providers: string[]
}

/** Public projection: never contains private access data. */
export function publicSite(s: Site): PublicSite {
  return {
    id: s.id,
    name: s.name,
    site_type: s.site_type,
    public_area: s.public_area,
    lat: s.approx_lat,
    lng: s.approx_lng,
    location_precision: s.location_precision,
    access_summary: s.access_summary,
    amenities: s.amenities,
    accessibility_notes: s.accessibility_notes,
    source_kind: s.source_kind,
    operator_note: s.operator_note,
    host_account_id: s.host_account_id,
    is_demo: true,
  }
}

function freshness(source: StatusSource, observedAt: string, now: number): 'FRESH' | 'STALE' | 'UNKNOWN' {
  if (source === 'DIRECTORY') return 'UNKNOWN'
  const window = source === 'SEEDED_TELEMETRY' ? POLICY.telemetry_fresh_s : POLICY.host_status_fresh_s
  return now - Date.parse(observedAt) <= window * 1000 ? 'FRESH' : 'STALE'
}

/**
 * Strict driver discovery. Every returned record has passed connector compatibility AND
 * the unchanged range budget on road-route evidence. Excluded records are only counted.
 */
export async function searchChargers(input: SearchInput): Promise<SearchResponse> {
  const model = modelById(input.model_id)
  if (!model) throw new ApiFail('VEHICLE_REQUIRED', 'Choose a reviewed car profile first.', 400)
  if (!Number.isFinite(input.soc) || input.soc < 0 || input.soc > 100) throw new ApiFail('INVALID_SOC', 'Battery must be between 0 and 100%.', 400)
  if (!input.origin || !Number.isFinite(input.origin.lat) || !Number.isFinite(input.origin.lng)) throw new ApiFail('ORIGIN_REQUIRED', 'Choose a starting location.', 400)

  const db = readDb()
  const now = serverNow()
  const budget = rangeBudget(model, input.soc, POLICY)
  const radiusM = Math.min(input.radius_km ?? POLICY.max_radius_km, POLICY.max_radius_km) * 1000
  const diagnostics = { considered: 0, excluded_range: 0, excluded_connector: 0, excluded_status: 0, excluded_unapproved: 0, excluded_route_unknown: 0, excluded_radius: 0 }

  const sites = db.sites.filter((s) => !input.site_type || s.site_type === input.site_type)
  const routes = await routesFrom(input.origin, sites.filter((s) => s.listing_state === 'ACTIVE'))
  const results: SearchResult[] = []

  for (const site of sites) {
    for (const res of db.resources.filter((r) => r.site_id === site.id)) {
      diagnostics.considered++
      if (site.listing_state !== 'ACTIVE') {
        diagnostics.excluded_unapproved++
        continue
      }
      if (res.current_status === 'FAULTED' || res.current_status === 'OFFLINE') {
        diagnostics.excluded_status++
        continue
      }
      const compatible = db.connectors
        .filter((c) => c.resource_id === res.id)
        .map((c) => ({ c, r: compatibility(model, c, res, site, input.connector) }))
        .filter((x) => x.r.result === 'COMPATIBLE')
      if (!compatible.length) {
        diagnostics.excluded_connector++
        continue
      }
      const route = routes.get(site.id) ?? null
      const confidence = routeConfidence(route, budget)
      if (!route || confidence === 'UNVERIFIED_DISTANCE') {
        diagnostics.excluded_route_unknown++
        continue
      }
      if (confidence !== 'PLAUSIBLY_REACHABLE') {
        diagnostics.excluded_range++
        continue
      }
      if (route.distance_m > radiusM) {
        diagnostics.excluded_radius++
        continue
      }
      const tariff = db.tariffs.find((t) => t.site_id === site.id)
      const reservable = res.reservable && site.source_kind !== 'DIRECTORY'
      const travel = route.duration_s * 1000
      const slot = reservable ? nextSlots(res.id, 60, now + travel + (POLICY.host_response_s + POLICY.checkout_s) * 1000, now, 1)[0] : undefined
      const fresh = freshness(res.status_source, res.status_observed_at, now)
      results.push({
        site: publicSite(site),
        resource_id: res.id,
        resource_label: res.label,
        connectors: compatible.map(({ c, r }) => ({ id: c.id, standard: c.standard, mode: c.mode, rated_power_kw: c.rated_power_kw, effective_power_kw: r.effective_power_kw, cable: c.cable })),
        route: { ...route, confidence: 'PLAUSIBLY_REACHABLE' },
        status: { value: res.current_status, source: res.status_source, observed_at: res.status_observed_at, freshness: fresh },
        price_paise_per_kwh: tariff?.energy_paise_per_kwh ?? null,
        standard_fee_paise: tariff?.standard_fee_paise ?? null,
        reservable,
        next_slot: slot ? new Date(slot).toISOString() : null,
        explanation: [
          'CONNECTOR_COMPATIBLE',
          'WITHIN_RANGE_BUDGET',
          route.provider === 'OSRM_LIVE' ? 'LIVE_ROUTE' : 'DEMO_ROUTE_EVIDENCE',
          fresh === 'FRESH' ? 'STATUS_FRESH' : fresh === 'STALE' ? 'STATUS_STALE' : 'STATUS_UNKNOWN',
          reservable ? (slot ? 'SLOT_AVAILABLE' : 'NO_SLOT_SOON') : 'DIRECTORY_ONLY',
        ],
      })
    }
  }

  results.sort(rankResults)
  return { budget, model, results, diagnostics, route_providers: [...new Set([...routes.values()].filter(Boolean).map((r) => r!.label))] }
}

/** Lexicographic ranking: window fit, freshness, road distance, indicative cost, stable id. Never by payout or urgency. */
export function rankResults(a: SearchResult, b: SearchResult) {
  const fit = (r: SearchResult) => (r.reservable ? (r.next_slot ? 0 : 1) : 2)
  const fr = (r: SearchResult) => (r.status.freshness === 'FRESH' ? 0 : r.status.freshness === 'STALE' ? 1 : 2)
  return (
    fit(a) - fit(b) ||
    fr(a) - fr(b) ||
    a.route.distance_m - b.route.distance_m ||
    (a.price_paise_per_kwh ?? 1e9) - (b.price_paise_per_kwh ?? 1e9) ||
    a.resource_id.localeCompare(b.resource_id)
  )
}

/** Approved public detail for a site. Never includes private access. */
export function siteDetail(siteId: string) {
  const db = readDb()
  const site = db.sites.find((s) => s.id === siteId)
  if (!site || (site.listing_state !== 'ACTIVE' && site.listing_state !== 'PAUSED')) throw new ApiFail('NOT_FOUND', 'This charger is not available.', 404)
  return {
    site: publicSite(site),
    listing_state: site.listing_state,
    resources: db.resources
      .filter((r) => r.site_id === siteId)
      .map((r) => ({ ...r, connectors: db.connectors.filter((c) => c.resource_id === r.id) })),
    tariff: db.tariffs.find((t) => t.site_id === siteId) ?? null,
    rules: db.rules.filter((r) => db.resources.some((x) => x.id === r.resource_id && x.site_id === siteId)),
    checks: db.checks.filter((c) => c.site_id === siteId).map((c) => ({ check_type: c.check_type, outcome: c.outcome })),
  }
}
