import { Accessibility, CalendarClock, Clock, Info, Minus, Plus, ShieldCheck, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useNow, useQuery, useSession } from '../app/hooks'
import { SITE_TYPE_LABEL, StationArt, StatusLine, siteIcon } from '../components/booking'
import { Page, PageHeader } from '../components/Shell'
import { Button, Card, Chip, EmptyState, Notice, Range, SectionTitle, Segmented, Skeleton, useAction } from '../components/ui'
import { CONNECTOR_LABEL, modelById } from '../domain/catalogue'
import { DEMO_ORIGIN, POLICY } from '../domain/policy'
import type { ConnectorStandard, Plan } from '../domain/types'
import { cn } from '../lib/cn'
import { countdown, istTime, km, kwh, minutes, rupees } from '../lib/format'
import { uuid } from '../lib/ids'
import { api } from '../server/api'
import type { Quote } from '../server/db'
import { readDb } from '../server/db'
import { useMyVehicle } from './DriverHome'

export default function Station() {
  const { siteId } = useParams()
  const user = useSession()!
  const vehicle = useMyVehicle()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const now = useNow(1000)
  const { run, busy } = useAction()

  const saved = readDb().last_origin[user.id]
  const origin = params.get('lat') && params.get('lng') ? { lat: Number(params.get('lat')), lng: Number(params.get('lng')) } : saved ?? DEMO_ORIGIN
  const modelId = params.get('model') ?? vehicle?.model_id
  const soc = params.get('soc') !== null ? Number(params.get('soc')) : vehicle?.soc
  const connectorFilter = (params.get('connector') as ConnectorStandard | null) ?? undefined
  const model = modelId ? modelById(modelId) : undefined

  const detail = useQuery(() => api.siteDetail(siteId!), [siteId])
  // Eligibility uses the exact discovery filter; a deep link cannot bypass it.
  const search = useQuery(() => (model && soc !== undefined ? api.searchChargers({ origin, model_id: model.id, soc, connector: connectorFilter }) : Promise.resolve({ ok: false as const, error: { code: 'INPUT_REQUIRED', message: 'Choose a car first.' }, request_id: '' })), [model?.id, soc, origin.lat, origin.lng, connectorFilter])
  const eligible = useMemo(() => (search.data?.results ?? []).filter((r) => r.site.id === siteId), [search.data, siteId])
  const options = useMemo(() => eligible.filter((r) => r.reservable).flatMap((r) => r.connectors.map((c) => ({ ...c, resource_id: r.resource_id, resource_label: r.resource_label }))), [eligible])

  const [connectorId, setConnectorId] = useState<string | null>(null)
  const [duration, setDuration] = useState(90)
  const [day, setDay] = useState<0 | 1>(0)
  const [start, setStart] = useState<string | null>(null)
  const [mode, setMode] = useState<'GRID' | 'TARGET'>('GRID')
  const [gridKwh, setGridKwh] = useState(8)
  const [target, setTarget] = useState<number>(vehicle?.target_soc ?? 80)
  const [plan, setPlan] = useState<Plan>('STANDARD')
  const [accepted, setAccepted] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<{ code: string; message: string; fields?: Record<string, string> } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const idemKey = useRef(uuid())

  const conn = options.find((o) => o.id === connectorId) ?? options[0]
  useEffect(() => {
    if (!connectorId && options[0]) setConnectorId(options[0].id)
  }, [options, connectorId])

  const slots = useQuery(() => (conn ? api.slots(conn.resource_id, duration, day) : Promise.resolve({ ok: true as const, data: [] as string[], request_id: '' })), [conn?.resource_id, duration, day])
  useEffect(() => {
    if (slots.data && (!start || !slots.data.includes(start))) setStart(slots.data[0] ?? null)
  }, [slots.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Server quote, refreshed as inputs change.
  useEffect(() => {
    if (!conn || !start || !model || soc === undefined) {
      setQuote(null)
      return
    }
    setQuoting(true)
    const t = setTimeout(async () => {
      const r = await api.createQuote({
        connector_id: conn.id,
        model_id: model.id,
        soc,
        origin,
        start_at: start,
        end_at: new Date(Date.parse(start) + duration * 60_000).toISOString(),
        plan,
        energy: mode === 'GRID' ? { kind: 'GRID', grid_wh: Math.round(gridKwh * 1000) } : { kind: 'TARGET', target_soc: target },
      })
      setQuoting(false)
      idemKey.current = uuid()
      if (r.ok) {
        setQuote(r.data)
        setQuoteError(null)
      } else {
        setQuote(null)
        setQuoteError(r.error)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [conn?.id, start, duration, plan, mode, gridKwh, target, soc, model?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const request = async () => {
    if (!quote) return
    const res = await run('book', () => api.createBooking({ quote_id: quote.id, idempotency_key: idemKey.current, policy_acceptance_version: POLICY.version }), (d) => `Request ${d.booking_ref} sent to the host`)
    if (res) nav(`/booking/${res.booking_id}`)
  }

  if (detail.loading && !detail.data) return <Page className="pt-6"><Skeleton className="h-64" /></Page>
  if (detail.error || !detail.data)
    return (
      <>
        <PageHeader back title="Charger" />
        <EmptyState title="Charger unavailable">{detail.error?.message}</EmptyState>
      </>
    )
  const { site, tariff, checks } = detail.data
  const res0 = eligible[0]
  const directory = site.source_kind === 'DIRECTORY'
  const quoteValid = quote ? Date.parse(quote.valid_until) - now : 0

  return (
    <>
      <PageHeader back title={site.name} subtitle={`${SITE_TYPE_LABEL[site.site_type]} · ${site.public_area}`} />
      <Page>
        <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-8">
          <div>
            <div className="relative">
              <StationArt type={site.site_type} className="h-48 w-full sm:h-64" />
              <div className="absolute left-3 top-3 flex gap-1.5">
                <Chip tone="outline" className="bg-surface/90">Demo listing</Chip>
                {site.location_precision === 'APPROXIMATE' ? <Chip tone="outline" className="bg-surface/90">Approximate area</Chip> : null}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted">
              {siteIcon(site.site_type)} {SITE_TYPE_LABEL[site.site_type]}
              {res0 ? <> · {km(res0.route.distance_m)} road · ~{Math.round(res0.route.duration_s / 60)} min</> : null}
            </div>
            {res0 ? (
              <div className="mt-1">
                <StatusLine value={res0.status.value} source={res0.status.source} observedAt={res0.status.observed_at} freshness={res0.status.freshness} now={now} />
              </div>
            ) : null}
            <p className="mt-3 text-ink-2">{site.access_summary}</p>
            {site.accessibility_notes ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Accessibility className="size-4" /> {site.accessibility_notes}
              </p>
            ) : null}
            {site.amenities.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {site.amenities.map((a) => (
                  <Chip key={a} tone="outline">{a}</Chip>
                ))}
              </div>
            ) : null}

            {search.loading && !search.data ? (
              <Skeleton className="mt-6 h-24" />
            ) : !eligible.length ? (
              <Notice tone="amber" className="mt-6" title="Not eligible for your car right now">
                This charger is outside your {search.data ? km(search.data.budget.range_budget_m) : ''} road budget, doesn’t match your connector, or isn’t operational. Ampere only lets you request reachable, compatible chargers.
                <div className="mt-2">
                  <Link to="/discover" className="font-semibold underline">Back to eligible chargers</Link>
                </div>
              </Notice>
            ) : directory ? (
              <Notice className="mt-6" title="Public directory listing — not reservable through Ampere">
                The operator handles access, charging and payment. Ampere has not reserved a connector. {site.operator_note}
              </Notice>
            ) : null}

            <SectionTitle>Connectors</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {detail.data.resources.flatMap((r) =>
                r.connectors.map((c) => {
                  const ok = options.find((o) => o.id === c.id)
                  return (
                    <button
                      key={c.id}
                      disabled={!ok}
                      onClick={() => setConnectorId(c.id)}
                      className={cn('flex items-center gap-3 rounded-2xl border p-3 text-left transition', conn?.id === c.id ? 'border-ink bg-surface' : 'border-line bg-surface', !ok && 'opacity-50')}
                    >
                      <span className={cn('grid size-10 place-items-center rounded-xl', ok ? 'bg-volt-soft text-volt-strong' : 'bg-surface-2 text-muted')}>
                        <Zap className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {CONNECTOR_LABEL[c.standard]} · {c.mode} · {c.rated_power_kw} kW
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {r.label} · {c.cable === 'HOST_TETHERED' ? 'cable provided' : 'bring your own cable'}
                          {ok ? ` · ${ok.effective_power_kw} kW for your car` : ' · not compatible'}
                        </span>
                      </span>
                    </button>
                  )
                }),
              )}
            </div>
            {detail.data.resources.length && detail.data.resources.some((r) => r.connectors.length > 1) ? (
              <p className="mt-2 text-xs text-muted">Connectors on one unit share it: booking either blocks the whole unit.</p>
            ) : null}

            <SectionTitle>Verification</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {checks.length ? (
                checks.map((c) => (
                  <Chip key={c.check_type} tone={c.outcome === 'APPROVED' ? 'volt' : 'amber'} icon={<ShieldCheck className="size-3" />}>
                    {c.check_type.replace('_', ' ').toLowerCase()} {c.outcome.toLowerCase()}
                  </Chip>
                ))
              ) : (
                <Chip tone="outline">No Ampere review — directory data</Chip>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">Approval means synthetic evidence was reviewed — not a guarantee against failure.</p>
          </div>

          {options.length ? (
            <div className="lg:sticky lg:top-8 lg:self-start">
              <SectionTitle className="lg:mt-0">Request a slot</SectionTitle>
              <Card className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-2">Duration</span>
                    <div className="flex items-center gap-2">
                      <button aria-label="Shorter" onClick={() => setDuration((d) => Math.max(POLICY.min_booking_min, d - 15))} className="grid size-9 place-items-center rounded-full bg-surface-2">
                        <Minus className="size-4" />
                      </button>
                      <span className="w-16 text-center font-semibold tabular-nums">{duration} min</span>
                      <button aria-label="Longer" onClick={() => setDuration((d) => Math.min(POLICY.max_booking_min, d + 15))} className="grid size-9 place-items-center rounded-full bg-surface-2">
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                  <Segmented size="sm" value={String(day) as '0' | '1'} onChange={(v) => setDay(Number(v) as 0 | 1)} options={[{ value: '0', label: 'Today' }, { value: '1', label: 'Tomorrow' }]} />
                  <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                    {(slots.data ?? []).map((t) => (
                      <button key={t} onClick={() => setStart(t)} className={cn('h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold tabular-nums', start === t ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2')}>
                        {istTime(t)}
                      </button>
                    ))}
                    {slots.data && !slots.data.length ? <span className="py-2 text-sm text-muted">No free {duration}-minute slot {day === 0 ? 'today' : 'tomorrow'}.</span> : null}
                  </div>
                  {start ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarClock className="size-3.5" /> {istTime(start)}–{istTime(Date.parse(start) + duration * 60_000)} IST + {POLICY.buffer_min} min turnaround · arrive from {istTime(Date.parse(start) - POLICY.arrival_before_min * 60_000)}
                    </div>
                  ) : null}
                </div>

                <div>
                  <span className="mb-2 block text-sm font-semibold text-ink-2">How much energy</span>
                  <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'GRID', label: 'Grid energy (paid)' }, { value: 'TARGET', label: 'Battery target' }]} />
                  {mode === 'GRID' ? (
                    <div className="mt-3">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-muted">Grid energy</span>
                        <span className="font-semibold">{gridKwh.toFixed(1)} kWh</span>
                      </div>
                      <Range label="Grid energy kWh" value={gridKwh} min={1} max={30} step={0.5} onChange={setGridKwh} />
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-muted">
                          From {soc}% to
                        </span>
                        <span className="font-semibold">{target}%</span>
                      </div>
                      <Range label="Battery target" value={target} min={Math.min(100, (soc ?? 0) + 1)} max={100} onChange={setTarget} />
                    </div>
                  )}
                </div>

                <div>
                  <span className="mb-2 block text-sm font-semibold text-ink-2">Plan</span>
                  <Segmented
                    size="sm"
                    value={plan}
                    onChange={setPlan}
                    options={[
                      { value: 'BASIC', label: 'Basic · no fee' },
                      { value: 'STANDARD', label: `Standard · ${rupees(tariff?.standard_fee_paise ?? 2000)}` },
                    ]}
                  />
                  <p className="mt-2 text-xs text-muted">Both plans need host confirmation. Standard adds assisted rebooking (demo concept).</p>
                </div>

                <div className="rounded-2xl bg-surface-2 p-4">
                  {quote ? (
                    <QuoteBreakdown quote={quote} />
                  ) : quoting ? (
                    <Skeleton className="h-28" />
                  ) : quoteError ? (
                    <div>
                      <div className="text-sm font-semibold text-danger">{quoteError.message}</div>
                      <div className="mt-1 font-mono text-xs text-muted">{quoteError.code}</div>
                      {quoteError.fields?.achievable_grid_wh ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-3"
                          onClick={() => {
                            setMode('GRID')
                            setGridKwh(Math.floor(Number(quoteError.fields!.achievable_grid_wh) / 500) / 2)
                          }}
                        >
                          Use {kwh(Math.floor(Number(quoteError.fields.achievable_grid_wh) / 500) * 500)} instead
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-muted">Pick a time to get a quote.</div>
                  )}
                  {quote ? (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                      <Clock className="size-3.5" /> Quote held for {countdown(quoteValid)} · computed by the server
                    </div>
                  ) : null}
                </div>

                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-ink)]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span className="text-ink-2">
                    I accept the booking policy ({POLICY.version}): host confirms within 2 min, checkout within 5 min, full refund of unused service if cancelled. Don’t travel until the host confirms.
                  </span>
                </label>
                <Button size="lg" className="w-full" disabled={!quote || !accepted || quoteValid <= 0} loading={busy === 'book'} onClick={request}>
                  Request booking {quote ? `· ${rupees(quote.snapshot.total_paise)}` : ''}
                </Button>
                <p className="flex items-start gap-2 text-xs text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" /> Demo: no real money moves. Prices are illustrative, not approved tariffs or tax invoices.
                </p>
              </Card>
            </div>
          ) : null}
        </div>
      </Page>
    </>
  )
}

export function QuoteBreakdown({ quote }: { quote: Pick<Quote, 'snapshot'> }) {
  const q = quote.snapshot
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted">Grid energy (paid)</dt>
        <dd className="font-semibold">{kwh(q.grid_wh, 3)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Est. added to battery (×{POLICY.efficiency})</dt>
        <dd>{kwh(q.battery_wh, 1)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Est. charging time at {q.effective_power_kw} kW</dt>
        <dd>{minutes(q.duration_s)}</dd>
      </div>
      <div className="my-2 h-px bg-line" />
      <div className="flex justify-between">
        <dt className="text-muted">Energy {kwh(q.grid_wh, 3)} × {rupees(q.energy_paise_per_kwh)}</dt>
        <dd>{rupees(q.energy_subtotal_paise, { decimals: true })}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">{q.plan === 'STANDARD' ? 'Standard booking fee' : 'Booking fee (Basic)'}</dt>
        <dd>{rupees(q.booking_fee_paise, { decimals: true })}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Tax</dt>
        <dd className="text-muted">Illustrative</dd>
      </div>
      <div className="flex justify-between pt-1 text-base">
        <dt className="font-semibold">Total (demo)</dt>
        <dd className="font-semibold">{rupees(q.total_paise, { decimals: true })}</dd>
      </div>
    </dl>
  )
}
