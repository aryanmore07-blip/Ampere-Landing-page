import { ChevronRight, List, LocateFixed, Map as MapIcon, MapPin, Navigation, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMediaQuery, useNow, useQuery, useSession } from '../app/hooks'
import { SITE_TYPE_LABEL, StationArt, StatusLine, siteIcon } from '../components/booking'
import { MapView, type MapSite } from '../components/MapView'
import { Button, Card, Chip, EmptyState, Field, IconButton, inputClass, Notice, Range, Segmented, Sheet, Skeleton } from '../components/ui'
import { CONNECTOR_LABEL, modelById } from '../domain/catalogue'
import { DEMO_ORIGIN, PRESET_AREAS } from '../domain/policy'
import type { ConnectorStandard, SiteType } from '../domain/types'
import { cn } from '../lib/cn'
import { istDayLabel, istTime, km, rupees } from '../lib/format'
import { api } from '../server/api'
import { readDb } from '../server/db'
import type { SearchResult } from '../server/discovery'
import { useMyVehicle } from './DriverHome'

export interface SiteGroup {
  siteId: string
  results: SearchResult[]
}

export function groupBySite(results: SearchResult[]) {
  const map = new Map<string, SearchResult[]>()
  for (const r of results) map.set(r.site.id, [...(map.get(r.site.id) ?? []), r])
  return [...map.values()]
}

export default function Discover() {
  const user = useSession()!
  const vehicle = useMyVehicle()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const now = useNow(15000)

  // Inputs: query params (console deep link) override the saved car and origin.
  const saved = readDb().last_origin[user.id]
  const origin = params.get('lat') && params.get('lng') ? { lat: Number(params.get('lat')), lng: Number(params.get('lng')), label: `${Number(params.get('lat')).toFixed(4)}, ${Number(params.get('lng')).toFixed(4)}` } : saved ?? DEMO_ORIGIN
  const modelId = params.get('model') ?? vehicle?.model_id ?? null
  const soc = params.get('soc') !== null ? Number(params.get('soc')) : vehicle?.soc ?? null
  const connector = (params.get('connector') as ConnectorStandard | null) ?? undefined
  const siteType = (params.get('type') as SiteType | null) ?? undefined
  const view = params.get('view') === 'list' ? 'list' : 'map'
  const model = modelId ? modelById(modelId) : undefined
  const fromConsole = params.has('lat') && params.has('model')

  const [selected, setSelected] = useState<string | null>(null)
  const [locOpen, setLocOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params)
    if (v === null) p.delete(k)
    else p.set(k, v)
    setParams(p, { replace: true })
  }

  const search = useQuery(
    () => (model && soc !== null ? api.searchChargers({ origin, model_id: model.id, soc, connector, site_type: siteType }) : Promise.resolve({ ok: false as const, error: { code: 'INPUT_REQUIRED', message: 'Car, battery and origin are required.' }, request_id: '' })),
    [origin.lat, origin.lng, model?.id, soc, connector, siteType],
  )
  const groups = useMemo(() => groupBySite(search.data?.results ?? []), [search.data])
  const mapSites: MapSite[] = groups.map((g) => ({ site: g[0].site, reservable: g.some((r) => r.reservable), label: g[0].site.name }))
  const selectedGroup = groups.find((g) => g[0].site.id === selected)
  const d = search.data?.diagnostics
  const hidden = d ? d.excluded_range + d.excluded_connector + d.excluded_status + d.excluded_unapproved + d.excluded_route_unknown + d.excluded_radius : 0

  if (!model || soc === null)
    return (
      <div className="px-4 pt-10">
        <EmptyState title="Tell us about your car" icon={<Search className="size-6" />} action={<Link to="/vehicle"><Button>Choose a car profile</Button></Link>}>
          Charger results need your car, its battery level and a starting point — Ampere never shows an unfiltered map.
        </EmptyState>
      </div>
    )

  const summary = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip tone="night">
        {model.model} · {soc}%
      </Chip>
      <Chip tone={search.data && search.data.budget.range_budget_m < 5000 ? 'amber' : 'volt'}>{search.data ? `${km(search.data.budget.range_budget_m)} road budget` : '…'}</Chip>
      <Chip tone="neutral">{connector ? CONNECTOR_LABEL[connector] : model.connectors.map((c) => CONNECTOR_LABEL[c.standard]).join(' / ')}</Chip>
      {siteType ? <Chip tone="neutral">{SITE_TYPE_LABEL[siteType]}</Chip> : null}
    </div>
  )

  const list = (
    <div className="space-y-3">
      {fromConsole ? (
        <Notice tone="neutral" title="Synced from the jury console" action={<Button size="sm" variant="secondary" onClick={() => nav('/discover', { replace: true })}>Use my car instead</Button>}>
          Same inputs and the same strict filter as the TICKET command.
        </Notice>
      ) : null}
      {search.loading && !search.data ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)
      ) : search.error ? (
        <Notice tone="danger" title={search.error.message}>{search.error.code}</Notice>
      ) : groups.length === 0 ? (
        <EmptyState icon={<MapPin className="size-6" />} title="No reachable, compatible charger">
          Nothing within your {km(search.data!.budget.range_budget_m)} road budget supports your connector. Ampere won’t suggest a charger it can’t verify — if you’re low, contact your roadside assistance.
        </EmptyState>
      ) : (
        groups.map((g) => <ResultCard key={g[0].site.id} group={g} now={now} selected={selected === g[0].site.id} onSelect={() => setSelected(g[0].site.id)} />)
      )}
      {d && hidden > 0 ? (
        <p className="px-1 text-xs text-muted">
          {hidden} hidden by the strict filter: {d.excluded_range} outside range · {d.excluded_connector} wrong connector · {d.excluded_status} faulted/offline · {d.excluded_unapproved} not approved
          {d.excluded_route_unknown ? ` · ${d.excluded_route_unknown} without route evidence` : ''}. Hidden chargers are never pinned.
        </p>
      ) : null}
      {search.data?.route_providers.length ? <p className="px-1 text-xs text-muted">Route evidence: {search.data.route_providers.join('; ')}.</p> : null}
    </div>
  )

  const topBar = (
    <div className="flex items-center gap-2">
      <button onClick={() => setLocOpen(true)} className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface px-4 text-left text-sm shadow-float">
        <Search className="size-4 shrink-0 text-muted" />
        <span className="truncate text-ink-2">{origin.label}</span>
      </button>
      <IconButton label="Filters" onClick={() => setFilterOpen(true)} className="size-12 shadow-float">
        <SlidersHorizontal className="size-[18px]" />
      </IconButton>
    </div>
  )

  const sheets = (
    <>
      <LocationSheet
        open={locOpen}
        onClose={() => setLocOpen(false)}
        onPick={async (o) => {
          await api.setOrigin(o)
          const p = new URLSearchParams(params)
          p.delete('lat')
          p.delete('lng')
          setParams(p, { replace: true })
          setSelected(null)
          setLocOpen(false)
        }}
      />
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Search inputs">
        <div className="space-y-5">
          <Field label={`Battery now: ${soc}%`} hint="Entered by you — not live vehicle telemetry.">
            <Range
              label="Battery"
              value={soc}
              min={0}
              max={100}
              onChange={(v) => (fromConsole || !vehicle ? setParam('soc', String(v)) : void api.updateVehicle(vehicle.id, { soc: v }))}
            />
          </Field>
          <Field label="Connector">
            <Segmented
              value={connector ?? 'ANY'}
              onChange={(v) => setParam('connector', v === 'ANY' ? null : v)}
              options={[{ value: 'ANY', label: 'All mine' }, ...model.connectors.map((c) => ({ value: c.standard, label: CONNECTOR_LABEL[c.standard] }))]}
            />
          </Field>
          <Field label="Host type">
            <div className="flex flex-wrap gap-2">
              {([undefined, 'CAFE', 'OFFICE', 'RESIDENTIAL', 'PUBLIC_NETWORK'] as (SiteType | undefined)[]).map((t) => (
                <button key={t ?? 'all'} onClick={() => setParam('type', t ?? null)} className={cn('h-9 rounded-full px-3.5 text-sm font-semibold', siteType === t ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2')}>
                  {t ? SITE_TYPE_LABEL[t] : 'All'}
                </button>
              ))}
            </div>
          </Field>
          <Notice>Reachability and connector matching are always on. They can’t be switched off.</Notice>
          <Button className="w-full" onClick={() => setFilterOpen(false)}>
            Show results
          </Button>
        </div>
      </Sheet>
    </>
  )

  const map = (
    <MapView
      origin={origin}
      budgetM={search.data?.budget.range_budget_m ?? 0}
      sites={mapSites}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id)
      }}
      className="relative h-full w-full"
    />
  )

  if (desktop)
    return (
      <div className="grid h-dvh grid-cols-[440px_1fr]">
        <div className="flex min-h-0 flex-col border-r border-line">
          <div className="space-y-3 p-5 pb-3">
            <h1 className="text-2xl font-semibold tracking-tight">Stations</h1>
            {topBar}
            {summary}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-2">{list}</div>
        </div>
        <div className="relative">
          {map}
          {selectedGroup ? (
            <div className="absolute bottom-6 right-6 z-[600] w-[380px]">
              <SelectedCard group={selectedGroup} now={now} onClose={() => setSelected(null)} />
            </div>
          ) : null}
        </div>
        {sheets}
      </div>
    )

  if (view === 'list')
    return (
      <div className="pt-safe px-4 pb-36 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Stations</h1>
          <Button size="sm" variant="secondary" onClick={() => setParam('view', null)}>
            <MapIcon className="size-4" /> Map
          </Button>
        </div>
        <div className="mt-3 space-y-3">
          {topBar}
          {summary}
        </div>
        <div className="mt-4">{list}</div>
        {sheets}
      </div>
    )

  return (
    <div className="fixed inset-0 bg-night">
      {map}
      <div className="pt-safe absolute inset-x-0 top-0 z-[600] space-y-2 px-4 pt-4">
        {topBar}
        {summary}
      </div>
      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-[600] px-4">
        {selectedGroup ? (
          <SelectedCard group={selectedGroup} now={now} onClose={() => setSelected(null)} />
        ) : (
          <button onClick={() => setParam('view', 'list')} className="flex w-full items-center gap-3 rounded-[24px] bg-surface/95 p-4 text-left shadow-float backdrop-blur">
            <span className="grid size-11 place-items-center rounded-full bg-ink text-white">
              <List className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{search.loading && !search.data ? 'Searching…' : `${groups.length} eligible ${groups.length === 1 ? 'charger' : 'chargers'}`}</span>
              <span className="block text-xs text-muted">{hidden ? `${hidden} hidden: out of range, wrong connector or unavailable` : 'Reachable and compatible only'}</span>
            </span>
            <ChevronRight className="size-5 text-muted" />
          </button>
        )}
      </div>
      {sheets}
    </div>
  )
}

function connectorsLine(g: SearchResult[]) {
  const seen = new Map<string, number>()
  for (const r of g) for (const c of r.connectors) seen.set(CONNECTOR_LABEL[c.standard], Math.max(seen.get(CONNECTOR_LABEL[c.standard]) ?? 0, c.effective_power_kw))
  return [...seen.entries()].map(([k, v]) => `${k} ${v} kW`)
}

function ResultCard({ group, now, selected, onSelect }: { group: SearchResult[]; now: number; selected: boolean; onSelect: () => void }) {
  const r = group[0]
  const reservable = group.some((x) => x.reservable)
  const next = group.map((x) => x.next_slot).filter(Boolean).sort()[0]
  return (
    <Card className={cn('cursor-pointer transition hover:shadow-float', selected && 'ring-2 ring-ink')} onClick={onSelect}>
      <div className="flex gap-3">
        <StationArt type={r.site.site_type} className="h-24 w-24 shrink-0 !rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{r.site.name}</div>
              <div className="flex items-center gap-1 truncate text-xs text-muted">
                {siteIcon(r.site.site_type, 'size-3')} {SITE_TYPE_LABEL[r.site.site_type]} · {r.site.public_area}
              </div>
            </div>
            {!reservable ? <Chip tone="amber">Directory</Chip> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip icon={<Navigation className="size-3" />}>{km(r.route.distance_m)} road</Chip>
            {connectorsLine(group).map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
            {r.price_paise_per_kwh ? <Chip>{rupees(r.price_paise_per_kwh)}/kWh</Chip> : null}
          </div>
          <div className="mt-2">
            <StatusLine value={r.status.value} source={r.status.source} observedAt={r.status.observed_at} freshness={r.status.freshness} now={now} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">{reservable ? (next ? `Next free slot ${istDayLabel(next, now)} ${istTime(next)}` : 'No free slot soon') : 'Operator handles access and payment'}</span>
        <Link to={`/station/${r.site.id}${window.location.search}`} onClick={(e) => e.stopPropagation()} className="inline-flex h-9 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-white">
          {reservable ? 'Request slot' : 'Details'} <ChevronRight className="size-4" />
        </Link>
      </div>
    </Card>
  )
}

function SelectedCard({ group, now, onClose }: { group: SearchResult[]; now: number; onClose: () => void }) {
  const r = group[0]
  const reservable = group.some((x) => x.reservable)
  return (
    <div className="animate-fade-up rounded-[28px] bg-surface p-3 shadow-float">
      <div className="relative">
        <StationArt type={r.site.site_type} className="h-36 w-full" />
        <button onClick={onClose} aria-label="Close" className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-surface/90 shadow-soft">
          <X className="size-4" />
        </button>
        <span className="absolute left-2 top-2">
          <Chip tone="outline" className="bg-surface/90">
            Demo listing
          </Chip>
        </span>
      </div>
      <div className="px-2 pb-1 pt-3">
        <h2 className="text-2xl font-medium tracking-tight">{r.site.name}</h2>
        <div className="mt-0.5 text-sm text-muted">
          {r.site.public_area}
          {r.site.location_precision === 'APPROXIMATE' ? ' · exact address after confirmation' : ''}
        </div>
        <div className="mt-2">
          <StatusLine value={r.status.value} source={r.status.source} observedAt={r.status.observed_at} freshness={r.status.freshness} now={now} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.price_paise_per_kwh ? <Chip>{rupees(r.price_paise_per_kwh)}/kWh</Chip> : null}
          <Chip>{Math.round(r.route.duration_s / 60)} min</Chip>
          <Chip>{km(r.route.distance_m)}</Chip>
          {connectorsLine(group).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        <Link to={`/station/${r.site.id}${window.location.search}`} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-white">
          {reservable ? 'Request a slot' : 'See operator details'} <Navigation className="size-4" />
        </Link>
      </div>
    </div>
  )
}

function LocationSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (o: { lat: number; lng: number; label: string }) => void }) {
  const [geoError, setGeoError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const locate = () => {
    if (!('geolocation' in navigator)) return setGeoError('Location is not available in this browser. Pick an area below.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false)
        onPick({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'My location' })
      },
      () => {
        setBusy(false)
        setGeoError('Location permission was denied or timed out. Pick an area below or enter coordinates.')
      },
      { timeout: 8000, maximumAge: 60000 },
    )
  }
  const valid = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== '' && lng !== '' && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180
  return (
    <Sheet open={open} onClose={onClose} title="Starting point">
      <Button variant="secondary" className="w-full" onClick={locate} loading={busy}>
        <LocateFixed className="size-4" /> Use my location
      </Button>
      {geoError ? <Notice tone="amber" className="mt-3">{geoError}</Notice> : null}
      <div className="mt-4 space-y-2">
        {PRESET_AREAS.map((a) => (
          <button key={a.label} onClick={() => onPick(a)} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left hover:bg-line">
            <MapPin className="size-4 text-muted" />
            <span className="flex-1 text-sm font-semibold">{a.label}</span>
            <span className="font-mono text-xs text-muted">
              {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <input className={inputClass} inputMode="decimal" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude" />
        <input className={inputClass} inputMode="decimal" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} aria-label="Longitude" />
      </div>
      <Button className="mt-3 w-full" disabled={!valid} onClick={() => onPick({ lat: Number(lat), lng: Number(lng), label: `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` })}>
        Use coordinates
      </Button>
      <p className="mt-3 text-xs text-muted">The demo origin uses seeded road distances. Other points use a labelled demo road estimate (or live OSRM routing if enabled in Settings).</p>
    </Sheet>
  )
}
