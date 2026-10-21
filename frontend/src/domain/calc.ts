import type { ChargingResource, Connector, ConnectorStandard, Policy, Site, VehicleModel } from './types'

/* ---------------- Range budget (section 10) ---------------- */

export interface RangeBudget {
  energy_budget_kwh: number
  range_budget_m: number
  reserve_pct: number
  uncertainty: number
  consumption_kwh_per_km: number
}

export class DomainInputError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export function rangeBudget(model: VehicleModel, socPct: number, policy: Policy): RangeBudget {
  if (!Number.isFinite(socPct) || socPct < 0 || socPct > 100) throw new DomainInputError('INVALID_SOC', 'Battery must be between 0 and 100%.')
  const c = model.consumption_kwh_per_km
  if (!(c > 0)) throw new DomainInputError('INVALID_VEHICLE', 'Vehicle consumption must be positive.')
  const capKwh = model.usable_battery_wh / 1000
  const energy = (capKwh * Math.max(socPct - policy.reserve_pct, 0)) / 100
  const rangeKm = energy / (c * policy.uncertainty)
  return {
    energy_budget_kwh: round(energy, 4),
    range_budget_m: Math.round(rangeKm * 1000),
    reserve_pct: policy.reserve_pct,
    uncertainty: policy.uncertainty,
    consumption_kwh_per_km: c,
  }
}

export type RouteConfidence = 'PLAUSIBLY_REACHABLE' | 'OUTSIDE_ESTIMATED_BUDGET' | 'UNVERIFIED_DISTANCE'

export interface RouteEvidence {
  distance_m: number
  duration_s: number
  provider: 'DEMO_FIXTURE' | 'DEMO_ESTIMATE' | 'OSRM_LIVE'
  observed_at: string
  /** Fixtures and labelled demo estimates are allowed only in Demo mode. */
  label: string
}

export function routeConfidence(route: RouteEvidence | null, budget: RangeBudget): RouteConfidence {
  if (!route) return 'UNVERIFIED_DISTANCE'
  return route.distance_m <= budget.range_budget_m ? 'PLAUSIBLY_REACHABLE' : 'OUTSIDE_ESTIMATED_BUDGET'
}

/* ---------------- Compatibility ---------------- */

export type Compatibility = 'COMPATIBLE' | 'INCOMPATIBLE' | 'UNVERIFIED'

export interface CompatibilityResult {
  result: Compatibility
  reasons: string[]
  effective_power_kw: number
}

export function compatibility(
  model: VehicleModel,
  connector: Connector,
  resource: ChargingResource,
  site: Site,
  requested?: ConnectorStandard,
): CompatibilityResult {
  const reasons: string[] = []
  if (requested && connector.standard !== requested) reasons.push('CONNECTOR_NOT_REQUESTED')
  if (!connector.active) reasons.push('CONNECTOR_INACTIVE')
  if (resource.current_status === 'FAULTED' || resource.current_status === 'OFFLINE') reasons.push('RESOURCE_' + resource.current_status)
  if (site.listing_state !== 'ACTIVE') reasons.push('SITE_NOT_APPROVED')
  const support = model.connectors.find((s) => s.standard === connector.standard && s.mode === connector.mode)
  if (!support) reasons.push('VEHICLE_DOES_NOT_SUPPORT_' + connector.standard + '_' + connector.mode)
  else if (support.adapter_required) return { result: 'UNVERIFIED', reasons: ['ADAPTER_REQUIRED'], effective_power_kw: 0 }
  if (connector.cable === 'DRIVER_REQUIRED') reasons.push('DRIVER_CABLE_REQUIRED')
  const vehicleLimit = connector.mode === 'AC' ? model.ac_limit_kw : model.dc_limit_kw
  const effective = Math.min(connector.rated_power_kw, resource.rated_power_kw, resource.site_power_limit_kw, vehicleLimit)
  if (model.evidence === 'UNVERIFIED_MANUAL') return { result: 'UNVERIFIED', reasons: ['UNVERIFIED_VEHICLE_DATA', ...reasons], effective_power_kw: effective }
  return { result: reasons.length ? 'INCOMPATIBLE' : 'COMPATIBLE', reasons, effective_power_kw: effective }
}

/* ---------------- Energy, duration and price ---------------- */

export interface EnergyEstimate {
  grid_wh: number
  battery_wh: number
  duration_s: number
  effective_power_kw: number
}

/** Grid-energy request mode: the paid quantity. Battery gain is lower by the efficiency factor. */
export function fromGridWh(gridWh: number, powerKw: number, policy: Policy): EnergyEstimate {
  if (!(gridWh > 0) || !(powerKw > 0)) throw new DomainInputError('INVALID_ENERGY', 'Energy and power must be positive.')
  return {
    grid_wh: Math.ceil(gridWh),
    battery_wh: Math.floor(gridWh * policy.efficiency),
    duration_s: Math.round((gridWh / 1000 / powerKw) * 3600),
    effective_power_kw: powerKw,
  }
}

/** Battery-target mode: grid energy = battery gain / efficiency, rounded up to whole Wh. */
export function fromTargetSoc(model: VehicleModel, soc: number, target: number, powerKw: number, policy: Policy): EnergyEstimate {
  if (target <= soc) throw new DomainInputError('TARGET_NOT_ABOVE_SOC', 'Target battery must be above the current battery.')
  const batteryWh = (model.usable_battery_wh * Math.max(target - soc, 0)) / 100
  const gridWh = Math.ceil(batteryWh / policy.efficiency - 1e-9)
  return {
    grid_wh: gridWh,
    battery_wh: Math.round(batteryWh),
    duration_s: Math.round((gridWh / 1000 / powerKw) * 3600),
    effective_power_kw: powerKw,
  }
}

/** Largest grid energy deliverable in `seconds` at `powerKw`, floored to whole Wh. */
export function achievableGridWh(seconds: number, powerKw: number) {
  return Math.floor((powerKw * 1000 * seconds) / 3600)
}

export interface PriceLines {
  energy_subtotal_paise: number
  booking_fee_paise: number
  parking_paise: number
  total_paise: number
}

/** Rounds paise once at the line total. */
export function price(gridWh: number, paisePerKwh: number, feePaise: number): PriceLines {
  const energy = Math.round((gridWh * paisePerKwh) / 1000)
  return { energy_subtotal_paise: energy, booking_fee_paise: feePaise, parking_paise: 0, total_paise: energy + feePaise }
}

export function illustrativeHostProceeds(energyPaise: number, commissionBps: number) {
  const commission = Math.round((energyPaise * commissionBps) / 10000)
  return { commission_paise: commission, host_paise: energyPaise - commission }
}

function round(n: number, d: number) {
  const f = 10 ** d
  return Math.round(n * f) / f
}
