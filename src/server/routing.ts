import type { RouteEvidence } from '../domain/calc'
import { DEMO_ORIGIN } from '../domain/policy'
import type { LatLng, Site } from '../domain/types'
import { haversineM } from '../lib/geo'
import { readDb, serverNow } from './db'

/*
 * Routing adapter. Demo fixtures are seeded road distances from the demo origin.
 * Other origins use a labelled demo road estimate (Demo mode only) or, if enabled,
 * the public OSRM demo router. Unknown routes return null and the record is excluded.
 */

const DEMO_DETOUR = 1.35
const DEMO_SPEED_MPS = 25_000 / 3600

/** Server-side destination: residential sites use protected exact coordinates. Never returned to clients. */
function destination(site: Site): LatLng {
  const priv = readDb().site_private.find((p) => p.site_id === site.id)
  return priv ? { lat: priv.exact_lat, lng: priv.exact_lng } : { lat: site.approx_lat, lng: site.approx_lng }
}

export async function routesFrom(origin: LatLng, sites: Site[]): Promise<Map<string, RouteEvidence | null>> {
  const out = new Map<string, RouteEvidence | null>()
  const observed = new Date(serverNow()).toISOString()
  const atDemoOrigin = haversineM(origin, DEMO_ORIGIN) <= 250

  if (atDemoOrigin) {
    for (const s of sites) {
      out.set(
        s.id,
        s.route_fixture_m == null
          ? null
          : { distance_m: s.route_fixture_m, duration_s: Math.round(s.route_fixture_m / DEMO_SPEED_MPS), provider: 'DEMO_FIXTURE', observed_at: observed, label: 'Seeded demo road distance' },
      )
    }
    return out
  }

  if (readDb().settings.route_provider === 'OSRM' && sites.length) {
    try {
      const coords = [origin, ...sites.map(destination)].map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance,duration`, { signal: ctrl.signal })
      clearTimeout(timer)
      const json = (await res.json()) as { code: string; distances?: (number | null)[][]; durations?: (number | null)[][] }
      if (json.code === 'Ok' && json.distances) {
        sites.forEach((s, i) => {
          const d = json.distances![0][i + 1]
          const t = json.durations?.[0][i + 1]
          out.set(s.id, d == null ? null : { distance_m: Math.round(d), duration_s: Math.round(t ?? d / DEMO_SPEED_MPS), provider: 'OSRM_LIVE', observed_at: observed, label: 'Live road route (OSRM demo server)' })
        })
        return out
      }
    } catch {
      /* fall through to labelled demo estimate */
    }
  }

  for (const s of sites) {
    const d = Math.round(haversineM(origin, destination(s)) * DEMO_DETOUR)
    out.set(s.id, { distance_m: d, duration_s: Math.round(d / DEMO_SPEED_MPS), provider: 'DEMO_ESTIMATE', observed_at: observed, label: 'Demo road estimate (labelled, not live routing)' })
  }
  return out
}
