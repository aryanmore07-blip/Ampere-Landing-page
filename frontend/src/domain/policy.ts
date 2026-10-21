import type { Policy } from './types'

/** Versioned policy record. Snapshotted onto every quote and booking. */
export const POLICY: Policy = {
  version: 'policy-2026-10-21.1',
  host_response_s: 120,
  checkout_s: 300,
  quote_validity_s: 300,
  min_booking_min: 30,
  max_booking_min: 120,
  increment_min: 15,
  buffer_min: 15,
  arrival_before_min: 10,
  arrival_after_min: 15,
  reserve_pct: 2,
  uncertainty: 1.25,
  efficiency: 0.9,
  timezone: 'Asia/Kolkata',
  host_status_fresh_s: 15 * 60,
  telemetry_fresh_s: 2 * 60,
  commission_bps: 1500,
  max_radius_km: 25,
  arrival_token_ttl_s: 15 * 60,
  arrival_token_max_attempts: 5,
  demo_session_seconds: 60,
}

/** Jury console defaults (section 22). */
export const CONSOLE_DEFAULTS = {
  plan: 'BASIC' as const,
  slot_minutes: 90,
  max_grid_wh: 8000,
  search_horizon_h: 24,
}

export const DEMO_ORIGIN = { lat: 18.5362, lng: 73.8939, label: 'Koregaon Park, Pune (demo origin)' }

export const PRESET_AREAS = [
  DEMO_ORIGIN,
  { lat: 18.5480, lng: 73.9030, label: 'Kalyani Nagar, Pune' },
  { lat: 18.5308, lng: 73.8475, label: 'Shivajinagar, Pune' },
  { lat: 18.5913, lng: 73.7389, label: 'Hinjewadi, Pune (no-match area)' },
]
