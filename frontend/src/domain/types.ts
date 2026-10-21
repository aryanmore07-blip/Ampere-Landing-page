// Shared domain types. Money is integer paise, energy is integer Wh, power is kW.

export type ConnectorStandard = 'TYPE2' | 'CCS2' | 'BHARAT_AC001' | 'CHADEMO'
export type ChargingMode = 'AC' | 'DC'
export type Capability = 'DRIVER' | 'HOST' | 'ADMIN' | 'JURY'
export type SiteType = 'RESIDENTIAL' | 'CAFE' | 'OFFICE' | 'PUBLIC_NETWORK'
export type ListingState = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'SUSPENDED'
export type ResourceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'FAULTED' | 'UNKNOWN'
export type StatusSource = 'HOST_UPDATE' | 'SEEDED_TELEMETRY' | 'DIRECTORY'
export type CheckType = 'IDENTITY' | 'PROPERTY_ACCESS' | 'EQUIPMENT' | 'PAID_OPERATION'
export type CheckOutcome = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
export type Plan = 'BASIC' | 'STANDARD'

export interface User {
  id: string
  display_name: string
  email: string
  initials: string
  capabilities: Capability[]
  host_account_id?: string
  blurb: string
}

export interface VehicleConnectorSupport {
  standard: ConnectorStandard
  mode: ChargingMode
  adapter_required: boolean
}

export interface VehicleModel {
  id: string
  make: string
  model: string
  variant: string
  aliases: string[]
  usable_battery_wh: number
  ac_limit_kw: number
  dc_limit_kw: number
  consumption_kwh_per_km: number
  connectors: VehicleConnectorSupport[]
  evidence: 'DEMO_PROFILE' | 'UNVERIFIED_MANUAL'
  evidence_note: string
  is_demo: true
}

export interface Vehicle {
  id: string
  owner_id: string
  model_id: string
  nickname: string
  soc: number
  target_soc: number
  created_at: string
}

export interface Site {
  id: string
  host_account_id: string | null
  name: string
  site_type: SiteType
  listing_state: ListingState
  public_area: string
  approx_lat: number
  approx_lng: number
  /** Residential sites only expose an approximate area. */
  location_precision: 'EXACT' | 'APPROXIMATE'
  access_summary: string
  amenities: string[]
  accessibility_notes: string
  source_kind: 'DEMO_CATALOGUE' | 'COMMUNITY' | 'DIRECTORY'
  source_updated_at: string
  operator_note?: string
  /** Seeded road distance from the demo origin. Demo route evidence only. */
  route_fixture_m: number | null
  rejection_reasons?: string[]
  suspension_reason?: string
  is_demo: true
}

export interface SitePrivateAccess {
  site_id: string
  exact_lat: number
  exact_lng: number
  full_address: string
  entrance_instructions: string
  contact_reference: string
}

export interface ChargingResource {
  id: string
  site_id: string
  label: string
  rated_power_kw: number
  site_power_limit_kw: number
  current_status: ResourceStatus
  status_source: StatusSource
  status_observed_at: string
  reservable: boolean
  is_demo: true
}

export interface Connector {
  id: string
  resource_id: string
  standard: ConnectorStandard
  mode: ChargingMode
  rated_power_kw: number
  cable: 'HOST_TETHERED' | 'DRIVER_REQUIRED'
  active: boolean
}

export interface AvailabilityRule {
  id: string
  resource_id: string
  /** 0 = Sunday … 6 = Saturday, Asia/Kolkata. */
  weekdays: number[]
  start_min: number
  end_min: number
}

export interface AvailabilityException {
  id: string
  resource_id: string
  start_at: string
  end_at: string
  kind: 'BLACKOUT' | 'HOST_USE'
  reason: string
}

export interface VerificationCheck {
  id: string
  site_id: string
  check_type: CheckType
  outcome: CheckOutcome
  reviewer_id: string | null
  reviewed_at: string | null
  notes: string
}

export interface Tariff {
  site_id: string
  version: number
  energy_paise_per_kwh: number
  standard_fee_paise: number
  is_demo: true
}

export interface Policy {
  version: string
  host_response_s: number
  checkout_s: number
  quote_validity_s: number
  min_booking_min: number
  max_booking_min: number
  increment_min: number
  buffer_min: number
  arrival_before_min: number
  arrival_after_min: number
  reserve_pct: number
  uncertainty: number
  efficiency: number
  timezone: 'Asia/Kolkata'
  host_status_fresh_s: number
  telemetry_fresh_s: number
  commission_bps: number
  max_radius_km: number
  arrival_token_ttl_s: number
  arrival_token_max_attempts: number
  demo_session_seconds: number
}

export interface LatLng {
  lat: number
  lng: number
}

export interface ApiError {
  code: string
  message: string
  fields?: Record<string, string>
}

export type Result<T> = { ok: true; data: T; request_id: string } | { ok: false; error: ApiError; request_id: string }
