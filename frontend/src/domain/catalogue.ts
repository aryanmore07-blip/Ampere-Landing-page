import type {
  AvailabilityRule,
  ChargingResource,
  Connector,
  ConnectorStandard,
  Site,
  SitePrivateAccess,
  Tariff,
  User,
  Vehicle,
  VehicleModel,
  VerificationCheck,
} from './types'

/*
 * Synthetic demonstration catalogue around Pune. Every record is labelled is_demo.
 * Names, addresses and people are fictional. Seeded road distances are demo route
 * evidence from DEMO_ORIGIN only, not externally validated route facts.
 */

export const USERS: User[] = [
  {
    id: 'u-driver',
    display_name: 'Aarav',
    email: 'aarav.driver@demo.ampere',
    initials: 'AK',
    capabilities: ['DRIVER'],
    blurb: 'Demo driver · Nexon EV at 4%',
  },
  {
    id: 'u-driver2',
    display_name: 'Kabir',
    email: 'kabir.driver@demo.ampere',
    initials: 'KS',
    capabilities: ['DRIVER'],
    blurb: 'Second driver · for isolation tests',
  },
  {
    id: 'u-host-cafe',
    display_name: 'Rohan',
    email: 'rohan.host@demo.ampere',
    initials: 'RD',
    capabilities: ['DRIVER', 'HOST'],
    host_account_id: 'ha-cafe',
    blurb: 'Host · Ember & Ohm Café and offices',
  },
  {
    id: 'u-host-home',
    display_name: 'Meera',
    email: 'meera.host@demo.ampere',
    initials: 'MJ',
    capabilities: ['DRIVER', 'HOST'],
    host_account_id: 'ha-home',
    blurb: 'Host · Kalyani Nagar residence',
  },
  {
    id: 'u-admin',
    display_name: 'Ops admin',
    email: 'ops.admin@demo.ampere',
    initials: 'OA',
    capabilities: ['ADMIN'],
    blurb: 'Administrator · verification queue',
  },
  {
    id: 'u-jury',
    display_name: 'Jury panel',
    email: 'jury@demo.ampere',
    initials: 'JP',
    capabilities: ['DRIVER', 'JURY'],
    blurb: 'Jury console · TICKET and READY',
  },
]

const TYPE2_AC = { standard: 'TYPE2' as const, mode: 'AC' as const, adapter_required: false }
const CCS2_DC = { standard: 'CCS2' as const, mode: 'DC' as const, adapter_required: false }

const DEMO_NOTE = 'Labelled demonstration profile. Values are planning assumptions, not manufacturer-verified specifications.'

export const VEHICLE_MODELS: VehicleModel[] = [
  {
    id: 'vm-nexon-ev-demo',
    make: 'Tata',
    model: 'Nexon EV',
    variant: 'Demo profile · 40 kWh usable',
    aliases: ['tata nexon ev', 'nexon ev', 'tata nexon', 'nexon', 'nexon ev demo'],
    usable_battery_wh: 40000,
    ac_limit_kw: 7.2,
    dc_limit_kw: 50,
    consumption_kwh_per_km: 0.16,
    connectors: [TYPE2_AC, CCS2_DC],
    evidence: 'DEMO_PROFILE',
    evidence_note: DEMO_NOTE,
    is_demo: true,
  },
  {
    id: 'vm-tiago-ev-demo',
    make: 'Tata',
    model: 'Tiago EV',
    variant: 'Demo profile · 24 kWh usable',
    aliases: ['tata tiago ev', 'tiago ev', 'tiago'],
    usable_battery_wh: 24000,
    ac_limit_kw: 7.2,
    dc_limit_kw: 25,
    consumption_kwh_per_km: 0.13,
    connectors: [TYPE2_AC, CCS2_DC],
    evidence: 'DEMO_PROFILE',
    evidence_note: DEMO_NOTE,
    is_demo: true,
  },
  {
    id: 'vm-zs-ev-demo',
    make: 'MG',
    model: 'ZS EV',
    variant: 'Demo profile · 48 kWh usable',
    aliases: ['mg zs ev', 'zs ev', 'mg zs'],
    usable_battery_wh: 48000,
    ac_limit_kw: 7.4,
    dc_limit_kw: 50,
    consumption_kwh_per_km: 0.17,
    connectors: [TYPE2_AC, CCS2_DC],
    evidence: 'DEMO_PROFILE',
    evidence_note: DEMO_NOTE,
    is_demo: true,
  },
  {
    id: 'vm-xuv400-demo',
    make: 'Mahindra',
    model: 'XUV400',
    variant: 'Demo profile · 39 kWh usable',
    aliases: ['mahindra xuv400', 'xuv400', 'xuv 400', 'mahindra xuv 400'],
    usable_battery_wh: 39000,
    ac_limit_kw: 7.2,
    dc_limit_kw: 50,
    consumption_kwh_per_km: 0.17,
    connectors: [TYPE2_AC, CCS2_DC],
    evidence: 'DEMO_PROFILE',
    evidence_note: DEMO_NOTE,
    is_demo: true,
  },
  {
    id: 'vm-ioniq5-demo',
    make: 'Hyundai',
    model: 'Ioniq 5',
    variant: 'Demo profile · 70 kWh usable',
    aliases: ['hyundai ioniq 5', 'ioniq 5', 'ioniq5'],
    usable_battery_wh: 70000,
    ac_limit_kw: 11,
    dc_limit_kw: 150,
    consumption_kwh_per_km: 0.19,
    connectors: [TYPE2_AC, CCS2_DC],
    evidence: 'DEMO_PROFILE',
    evidence_note: DEMO_NOTE,
    is_demo: true,
  },
]

export const CONNECTOR_LABEL: Record<ConnectorStandard, string> = {
  TYPE2: 'Type 2',
  CCS2: 'CCS2',
  BHARAT_AC001: 'Bharat AC-001',
  CHADEMO: 'CHAdeMO',
}

export const CONNECTOR_ALIASES: Record<string, ConnectorStandard> = {
  CCS2: 'CCS2',
  CCS: 'CCS2',
  'CCS 2': 'CCS2',
  COMBO2: 'CCS2',
  'COMBO 2': 'CCS2',
  TYPE2: 'TYPE2',
  'TYPE 2': 'TYPE2',
  T2: 'TYPE2',
  MENNEKES: 'TYPE2',
  'AC TYPE 2': 'TYPE2',
  AC001: 'BHARAT_AC001',
  'AC-001': 'BHARAT_AC001',
  'BHARAT AC001': 'BHARAT_AC001',
  'BHARAT AC-001': 'BHARAT_AC001',
  BHARAT_AC001: 'BHARAT_AC001',
  CHADEMO: 'CHADEMO',
}

const ago = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString()

interface SiteSeed {
  site: Omit<Site, 'source_updated_at'>
  priv?: Omit<SitePrivateAccess, 'site_id'>
  resources: { res: Omit<ChargingResource, 'status_observed_at' | 'site_id' | 'is_demo'>; statusAgeMin: number; connectors: Omit<Connector, 'resource_id'>[]; rule?: Omit<AvailabilityRule, 'id' | 'resource_id'> }[]
  checks: VerificationCheck['outcome'][]
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

const SITE_SEEDS: SiteSeed[] = [
  {
    site: {
      id: 'site-cafe',
      host_account_id: 'ha-cafe',
      name: 'Ember & Ohm Café',
      site_type: 'CAFE',
      listing_state: 'ACTIVE',
      public_area: 'Koregaon Park Lane 6',
      approx_lat: 18.5442,
      approx_lng: 73.9034,
      location_precision: 'EXACT',
      access_summary: 'Two visitor bays at the side lane. Order optional. Staff hand over the tethered cable.',
      amenities: ['Café', 'Washroom', 'Wi-Fi'],
      accessibility_notes: 'Step-free entrance; bay 1 is 2.6 m wide.',
      source_kind: 'DEMO_CATALOGUE',
      route_fixture_m: 1800,
      is_demo: true,
    },
    priv: {
      exact_lat: 18.5442,
      exact_lng: 73.9034,
      full_address: 'Plot 14, Lane 6, Koregaon Park, Pune 411001 (synthetic)',
      entrance_instructions: 'Enter from the side lane, bays are marked “Ampere”. Ask the counter for the cable key.',
      contact_reference: 'Counter: +91 90000 00014 (demo)',
    },
    resources: [
      {
        res: { id: 'res-cafe-1', label: 'Bay 1 · combo unit', rated_power_kw: 25, site_power_limit_kw: 25, current_status: 'AVAILABLE', status_source: 'HOST_UPDATE', reservable: true },
        statusAgeMin: 4,
        connectors: [
          { id: 'con-cafe-t2', standard: 'TYPE2', mode: 'AC', rated_power_kw: 7.4, cable: 'HOST_TETHERED', active: true },
          { id: 'con-cafe-ccs', standard: 'CCS2', mode: 'DC', rated_power_kw: 25, cable: 'HOST_TETHERED', active: true },
        ],
        rule: { weekdays: ALL_DAYS, start_min: 0, end_min: 1440 },
      },
      {
        res: { id: 'res-cafe-2', label: 'Bay 2 · wallbox', rated_power_kw: 7.4, site_power_limit_kw: 7.4, current_status: 'AVAILABLE', status_source: 'HOST_UPDATE', reservable: true },
        statusAgeMin: 4,
        connectors: [{ id: 'con-cafe2-t2', standard: 'TYPE2', mode: 'AC', rated_power_kw: 7.4, cable: 'HOST_TETHERED', active: true }],
        rule: { weekdays: ALL_DAYS, start_min: 0, end_min: 1440 },
      },
    ],
    checks: ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED'],
  },
  {
    site: {
      id: 'site-home',
      host_account_id: 'ha-home',
      name: 'Kalyani Nagar residence',
      site_type: 'RESIDENTIAL',
      listing_state: 'ACTIVE',
      public_area: 'Kalyani Nagar (approximate)',
      approx_lat: 18.546,
      approx_lng: 73.904,
      location_precision: 'APPROXIMATE',
      access_summary: 'Gated society, visitor bay. Gate details shared after confirmation.',
      amenities: ['Covered bay', 'Security desk'],
      accessibility_notes: 'Ramp access to the visitor bay.',
      source_kind: 'COMMUNITY',
      route_fixture_m: 2600,
      is_demo: true,
    },
    priv: {
      exact_lat: 18.5478,
      exact_lng: 73.9052,
      full_address: 'Flat B-1102, Riverstone Society, Kalyani Nagar, Pune 411006 (synthetic)',
      entrance_instructions: 'Tell the gate you are visiting B-1102 for Ampere. Visitor bay V3 has the wallbox.',
      contact_reference: 'Host via in-app notices (demo)',
    },
    resources: [
      {
        res: { id: 'res-home-1', label: 'Driveway wallbox', rated_power_kw: 7.2, site_power_limit_kw: 7.2, current_status: 'AVAILABLE', status_source: 'HOST_UPDATE', reservable: true },
        statusAgeMin: 9,
        connectors: [{ id: 'con-home-t2', standard: 'TYPE2', mode: 'AC', rated_power_kw: 7.2, cable: 'HOST_TETHERED', active: true }],
        rule: { weekdays: ALL_DAYS, start_min: 7 * 60, end_min: 22 * 60 },
      },
    ],
    checks: ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED'],
  },
  {
    site: {
      id: 'site-lane7',
      host_account_id: 'ha-cafe',
      name: 'Lane 7 Cowork',
      site_type: 'OFFICE',
      listing_state: 'ACTIVE',
      public_area: 'Koregaon Park Lane 7',
      approx_lat: 18.5395,
      approx_lng: 73.899,
      location_precision: 'EXACT',
      access_summary: 'Basement bay B2. Bharat AC-001 only.',
      amenities: ['Basement parking'],
      accessibility_notes: 'Lift to basement.',
      source_kind: 'DEMO_CATALOGUE',
      route_fixture_m: 1100,
      is_demo: true,
    },
    priv: {
      exact_lat: 18.5395,
      exact_lng: 73.899,
      full_address: 'Lane 7, Koregaon Park, Pune 411001 (synthetic)',
      entrance_instructions: 'Show the booking code to the basement guard.',
      contact_reference: 'Reception (demo)',
    },
    resources: [
      {
        res: { id: 'res-lane7-1', label: 'B2 bay', rated_power_kw: 3.3, site_power_limit_kw: 3.3, current_status: 'AVAILABLE', status_source: 'HOST_UPDATE', reservable: true },
        statusAgeMin: 6,
        connectors: [{ id: 'con-lane7-ac001', standard: 'BHARAT_AC001', mode: 'AC', rated_power_kw: 3.3, cable: 'DRIVER_REQUIRED', active: true }],
        rule: { weekdays: ALL_DAYS, start_min: 8 * 60, end_min: 20 * 60 },
      },
    ],
    checks: ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED'],
  },
  {
    site: {
      id: 'site-studio',
      host_account_id: 'ha-cafe',
      name: 'Riverside Studio',
      site_type: 'CAFE',
      listing_state: 'ACTIVE',
      public_area: 'Mundhwa Road',
      approx_lat: 18.53,
      approx_lng: 73.905,
      location_precision: 'EXACT',
      access_summary: 'Front courtyard bay.',
      amenities: ['Studio café'],
      accessibility_notes: 'Gravel surface.',
      source_kind: 'DEMO_CATALOGUE',
      route_fixture_m: 2200,
      is_demo: true,
    },
    priv: {
      exact_lat: 18.53,
      exact_lng: 73.905,
      full_address: 'Mundhwa Road, Pune 411036 (synthetic)',
      entrance_instructions: 'Courtyard gate.',
      contact_reference: 'Studio desk (demo)',
    },
    resources: [
      {
        res: { id: 'res-studio-1', label: 'Courtyard wallbox', rated_power_kw: 7.2, site_power_limit_kw: 7.2, current_status: 'FAULTED', status_source: 'HOST_UPDATE', reservable: true },
        statusAgeMin: 30,
        connectors: [{ id: 'con-studio-t2', standard: 'TYPE2', mode: 'AC', rated_power_kw: 7.2, cable: 'HOST_TETHERED', active: true }],
        rule: { weekdays: ALL_DAYS, start_min: 9 * 60, end_min: 21 * 60 },
      },
    ],
    checks: ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED'],
  },
  {
    site: {
      id: 'site-directory',
      host_account_id: null,
      name: 'Yerawada public point',
      site_type: 'PUBLIC_NETWORK',
      listing_state: 'ACTIVE',
      public_area: 'Yerawada',
      approx_lat: 18.553,
      approx_lng: 73.889,
      location_precision: 'EXACT',
      access_summary: 'Public directory listing. The operator handles access, charging and payment. Ampere has not reserved a connector.',
      amenities: [],
      accessibility_notes: 'Unknown.',
      source_kind: 'DIRECTORY',
      operator_note: 'Operator link unavailable in the demo directory record.',
      route_fixture_m: 3100,
      is_demo: true,
    },
    resources: [
      {
        res: { id: 'res-dir-1', label: 'DC point', rated_power_kw: 60, site_power_limit_kw: 60, current_status: 'UNKNOWN', status_source: 'DIRECTORY', reservable: false },
        statusAgeMin: 3 * 24 * 60,
        connectors: [{ id: 'con-dir-ccs', standard: 'CCS2', mode: 'DC', rated_power_kw: 60, cable: 'HOST_TETHERED', active: true }],
      },
    ],
    checks: [],
  },
  {
    site: {
      id: 'site-bund',
      host_account_id: 'ha-cafe',
      name: 'Bund Garden Offices',
      site_type: 'OFFICE',
      listing_state: 'ACTIVE',
      public_area: 'Bund Garden Road',
      approx_lat: 18.5385,
      approx_lng: 73.877,
      location_precision: 'EXACT',
      access_summary: 'Visitor parking P1. Security logs the vehicle number.',
      amenities: ['Security', 'Covered parking'],
      accessibility_notes: 'Level access.',
      source_kind: 'DEMO_CATALOGUE',
      route_fixture_m: 3600,
      is_demo: true,
    },
    priv: {
      exact_lat: 18.5385,
      exact_lng: 73.877,
      full_address: 'Bund Garden Road, Pune 411001 (synthetic)',
      entrance_instructions: 'Gate 2, visitor parking P1, bay 4.',
      contact_reference: 'Facility desk (demo)',
    },
    resources: [
      {
        res: { id: 'res-bund-1', label: 'P1 · DC unit', rated_power_kw: 30, site_power_limit_kw: 30, current_status: 'AVAILABLE', status_source: 'SEEDED_TELEMETRY', reservable: true },
        statusAgeMin: 1,
        connectors: [
          { id: 'con-bund-ccs', standard: 'CCS2', mode: 'DC', rated_power_kw: 30, cable: 'HOST_TETHERED', active: true },
          { id: 'con-bund-t2', standard: 'TYPE2', mode: 'AC', rated_power_kw: 11, cable: 'DRIVER_REQUIRED', active: true },
        ],
        rule: { weekdays: ALL_DAYS, start_min: 7 * 60, end_min: 23 * 60 },
      },
    ],
    checks: ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED'],
  },
  {
    site: {
      id: 'site-aundh',
      host_account_id: 'ha-cafe',
      name: 'Aundh Works Campus',
      site_type: 'OFFICE',
      listing_state: 'ACTIVE',
      public_area: 'Aundh',
      approx_lat: 18.558,
      approx_lng: 73.81,
      location_precision: 'EXACT',
      access_summary: 'Campus gate B, EV row.',
      amenities: ['Canteen', 'Security'],
      accessibility_notes: 'Level access.',
      source_kind: 'DEMO_CATALOGUE',
      route_fixture_m: 11200,
      is_demo: true,
    },
    priv: {
      exact_lat: 18.558,
      exact_lng: 73.81,
      full_address: 'ITI Road, Aundh, Pune 411007 (synthetic)',
      entrance_instructions: 'Gate B, EV row slot 2.',
      contact_reference: 'Campus security (demo)',
    },
    resources: [
      {
        res: { id: 'res-aundh-1', label: 'EV row · DC', rated_power_kw: 30, site_power_limit_kw: 30, current_status: 'AVAILABLE', status_source: 'HOST_UPDATE', reservable: true },
        statusAgeMin: 5,
        connectors: [{ id: 'con-aundh-ccs', standard: 'CCS2', mode: 'DC', rated_power_kw: 30, cable: 'HOST_TETHERED', active: true }],
        rule: { weekdays: ALL_DAYS, start_min: 6 * 60, end_min: 23 * 60 },
      },
    ],
    checks: ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED'],
  },
  {
    site: {
      id: 'site-cowork',
      host_account_id: 'ha-home',
      name: 'Viman Nagar Cowork',
      site_type: 'OFFICE',
      listing_state: 'PENDING_REVIEW',
      public_area: 'Viman Nagar',
      approx_lat: 18.5555,
      approx_lng: 73.91,
      location_precision: 'EXACT',
      access_summary: 'Front lot, two visitor bays.',
      amenities: ['Coworking lounge'],
      accessibility_notes: 'Level access.',
      source_kind: 'COMMUNITY',
      route_fixture_m: 3500,
      is_demo: true,
    },
    priv: {
      exact_lat: 18.5555,
      exact_lng: 73.91,
      full_address: 'Viman Nagar, Pune 411014 (synthetic)',
      entrance_instructions: 'Front lot, bay 1.',
      contact_reference: 'Front desk (demo)',
    },
    resources: [
      {
        res: { id: 'res-cowork-1', label: 'Front lot wallbox', rated_power_kw: 11, site_power_limit_kw: 11, current_status: 'AVAILABLE', status_source: 'HOST_UPDATE', reservable: true },
        statusAgeMin: 3,
        connectors: [{ id: 'con-cowork-t2', standard: 'TYPE2', mode: 'AC', rated_power_kw: 11, cable: 'HOST_TETHERED', active: true }],
        rule: { weekdays: ALL_DAYS, start_min: 8 * 60, end_min: 20 * 60 },
      },
    ],
    checks: ['APPROVED', 'PENDING', 'PENDING', 'PENDING'],
  },
]

const CHECK_TYPES = ['IDENTITY', 'PROPERTY_ACCESS', 'EQUIPMENT', 'PAID_OPERATION'] as const

export interface CatalogueSeed {
  sites: Site[]
  site_private: SitePrivateAccess[]
  resources: ChargingResource[]
  connectors: Connector[]
  rules: AvailabilityRule[]
  checks: VerificationCheck[]
  tariffs: Tariff[]
  vehicles: Vehicle[]
}

export function buildCatalogue(now: number): CatalogueSeed {
  const out: CatalogueSeed = { sites: [], site_private: [], resources: [], connectors: [], rules: [], checks: [], tariffs: [], vehicles: [] }
  for (const seed of SITE_SEEDS) {
    out.sites.push({ ...seed.site, source_updated_at: ago(now, seed.site.source_kind === 'DIRECTORY' ? 3 * 24 * 60 : 30) })
    if (seed.priv) out.site_private.push({ site_id: seed.site.id, ...seed.priv })
    for (const r of seed.resources) {
      out.resources.push({ ...r.res, site_id: seed.site.id, status_observed_at: ago(now, r.statusAgeMin), is_demo: true })
      for (const c of r.connectors) out.connectors.push({ ...c, resource_id: r.res.id })
      if (r.rule) out.rules.push({ id: `rule-${r.res.id}`, resource_id: r.res.id, ...r.rule })
    }
    seed.checks.forEach((outcome, i) => {
      out.checks.push({
        id: `chk-${seed.site.id}-${i}`,
        site_id: seed.site.id,
        check_type: CHECK_TYPES[i],
        outcome,
        reviewer_id: outcome === 'APPROVED' ? 'u-admin' : null,
        reviewed_at: outcome === 'APPROVED' ? ago(now, 60 * 24) : null,
        notes: outcome === 'APPROVED' ? 'Synthetic demo evidence reviewed.' : '',
      })
    })
    if (seed.site.source_kind !== 'DIRECTORY') {
      out.tariffs.push({ site_id: seed.site.id, version: 1, energy_paise_per_kwh: 1400, standard_fee_paise: 2000, is_demo: true })
    }
  }
  out.vehicles.push(
    { id: 'veh-aarav', owner_id: 'u-driver', model_id: 'vm-nexon-ev-demo', nickname: 'Nexon EV', soc: 4, target_soc: 80, created_at: new Date(now).toISOString() },
    { id: 'veh-kabir', owner_id: 'u-driver2', model_id: 'vm-zs-ev-demo', nickname: 'ZS EV', soc: 30, target_soc: 80, created_at: new Date(now).toISOString() },
    { id: 'veh-jury', owner_id: 'u-jury', model_id: 'vm-nexon-ev-demo', nickname: 'Jury Nexon EV', soc: 4, target_soc: 80, created_at: new Date(now).toISOString() },
    { id: 'veh-rohan', owner_id: 'u-host-cafe', model_id: 'vm-xuv400-demo', nickname: 'XUV400', soc: 55, target_soc: 80, created_at: new Date(now).toISOString() },
    { id: 'veh-meera', owner_id: 'u-host-home', model_id: 'vm-tiago-ev-demo', nickname: 'Tiago EV', soc: 40, target_soc: 80, created_at: new Date(now).toISOString() },
  )
  return out
}

export function modelById(id: string) {
  return VEHICLE_MODELS.find((m) => m.id === id)
}

export function userById(id: string) {
  return USERS.find((u) => u.id === id)
}

export function hostUser(hostAccountId: string | null) {
  return USERS.find((u) => u.host_account_id === hostAccountId)
}
