import { ArrowRight, BatteryCharging, Gauge, Route, Search, Target } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../app/notifications'
import { useNow, useQuery, useSession } from '../app/hooks'
import { CarExoskeleton } from '../components/CarExoskeleton'
import { LifecycleChip, LifecycleTracker, siteIcon } from '../components/booking'
import { Page, PageHeader } from '../components/Shell'
import { BarGauge, Button, Card, Chip, Dot, EmptyState, Range, SectionTitle, StatTile } from '../components/ui'
import { rangeBudget } from '../domain/calc'
import { CONNECTOR_LABEL, modelById } from '../domain/catalogue'
import { POLICY } from '../domain/policy'
import { istDayLabel, istTime, km, relativeAge } from '../lib/format'
import { api } from '../server/api'
import { readDb } from '../server/db'

export function useMyVehicle() {
  const user = useSession()
  const q = useQuery(async () => ({ ok: true as const, data: readDb().vehicles.find((v) => v.owner_id === user?.id) ?? null, request_id: '' }), [user?.id])
  return q.data
}

export default function DriverHome() {
  const user = useSession()!
  const vehicle = useMyVehicle()
  const model = vehicle ? modelById(vehicle.model_id) : undefined
  const now = useNow(1000)
  const bookings = useQuery(() => api.listBookings('driver'))
  const { items } = useNotifications(user)
  const [soc, setSoc] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (vehicle) setSoc(vehicle.soc)
  }, [vehicle?.soc]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitSoc = (v: number) => {
    setSoc(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => vehicle && api.updateVehicle(vehicle.id, { soc: v }), 350)
  }

  if (!vehicle || !model || soc === null)
    return (
      <>
        <PageHeader user={user} title={`Hi, ${user.display_name}`} />
        <Page>
          <EmptyState title="Add your car first" action={<Link to="/vehicle"><Button>Add a car profile</Button></Link>}>
            Ampere needs your car, connector support and battery level before it can show chargers.
          </EmptyState>
        </Page>
      </>
    )

  const budget = rangeBudget(model, soc, POLICY)
  const active = (bookings.data ?? []).filter((b) => !b.state.ended)
  const tone = soc <= 10 ? 'amber' : 'volt'

  return (
    <>
      <PageHeader user={user} />
      <Page>
        <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          <div>
            <div className="mt-1 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                    <ellipse cx="12" cy="12" rx="10" ry="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M7 10h10M12 10v6" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  {model.make}
                </div>
                <div className="ml-8 text-sm text-muted">
                  {model.model} · {model.variant}
                </div>
              </div>
              <Link to="/vehicle" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pt-1 text-sm font-medium text-ink-2">
                <Dot tone="volt" /> Demo profile
              </Link>
            </div>

            <div className="relative mx-auto mt-2 aspect-[520/240] w-full max-w-xl">
              <CarExoskeleton soc={soc} orientation="horizontal" inletLabel={model.connectors.map((c) => CONNECTOR_LABEL[c.standard]).join(' · ')} className="h-full w-full" />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <StatTile className="row-span-2" icon={<BatteryCharging className="size-4" />} label="Battery level" value={soc} unit="%" aside="you set this">
                <div className="mt-auto pt-5">
                  <div className="mb-2 flex justify-between text-xs text-muted">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                  <BarGauge value={soc} segments={11} tone={tone} height="h-16" />
                  <Range className="mt-4" label="Battery level" value={soc} min={0} max={100} onChange={commitSoc} />
                </div>
              </StatTile>
              <StatTile icon={<Gauge className="size-4" />} label="Range budget" value={(budget.range_budget_m / 1000).toFixed(1)} unit="km">
                <div className="mt-2 text-[11px] leading-snug text-muted">
                  after {POLICY.reserve_pct}% reserve · ×{POLICY.uncertainty} uncertainty
                </div>
              </StatTile>
              <StatTile icon={<Target className="size-4" />} label="Charge target" value={vehicle.target_soc} unit="%">
                <div className="mt-2 text-[11px] leading-snug text-muted">{(model.usable_battery_wh / 1000).toFixed(0)} kWh usable · AC {model.ac_limit_kw} kW</div>
              </StatTile>
            </div>
            {soc <= POLICY.reserve_pct ? (
              <Card className="mt-3 bg-amber-soft text-sm text-[#6d4710] shadow-none">
                At or below the {POLICY.reserve_pct}% reserve there is no discretionary range. Ampere won’t invent a reachable option — contact your roadside assistance.
              </Card>
            ) : null}

            <Link to="/discover" className="mt-4 flex items-center gap-4 rounded-[var(--radius-card)] bg-ink p-4 text-white shadow-float transition active:scale-[0.99]">
              <span className="grid size-12 place-items-center rounded-full bg-white/10">
                <Search className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Find a reachable charger</span>
                <span className="block text-sm text-white/60">Within {km(budget.range_budget_m)} on the road · your connectors only</span>
              </span>
              <ArrowRight className="size-5" />
            </Link>
          </div>

          <div>
            <SectionTitle action={<Link to="/bookings" className="text-sm font-semibold text-ink">View all</Link>}>Active bookings</SectionTitle>
            {active.length ? (
              <div className="space-y-3">
                {active.map(({ header, state }) => (
                  <Link key={header.id} to={`/booking/${header.id}`} className="block">
                    <Card className="transition hover:shadow-float">
                      <div className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-2xl bg-surface-2">{siteIcon(readDb().sites.find((s) => s.id === header.site_id)?.site_type ?? 'CAFE')}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{state.request.site_name}</div>
                          <div className="text-xs text-muted">
                            {header.booking_ref} · {istDayLabel(state.request.start_at, now)} {istTime(state.request.start_at)}–{istTime(state.request.end_at)}
                          </div>
                        </div>
                        <LifecycleChip state={state} />
                      </div>
                      <LifecycleTracker state={state} compact />
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="text-sm text-muted">No active bookings. Find a charger to request a slot.</Card>
            )}

            <SectionTitle action={<Link to="/inbox" className="text-sm font-semibold text-ink">View all</Link>}>Recent alerts</SectionTitle>
            <div className="space-y-2">
              {items.slice(0, 4).map((n) => (
                <Link key={n.event.event_id} to={`/booking/${n.booking_id}`}>
                  <Card className="mb-2 flex items-center gap-3 !p-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-2">
                      <Route className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{n.title}</span>
                        <span className="shrink-0 text-xs text-muted">{relativeAge(n.event.recorded_at, now)}</span>
                      </div>
                      <div className="truncate text-sm text-muted">{n.body}</div>
                    </div>
                    {n.unread ? <Dot tone="amber" /> : null}
                  </Card>
                </Link>
              ))}
              {!items.length ? <Card className="text-sm text-muted">Booking updates will appear here.</Card> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="outline">Simulated payments</Chip>
              <Chip tone="outline">Simulated charging</Chip>
              <Chip tone="outline">Synthetic Pune listings</Chip>
            </div>
          </div>
        </div>
      </Page>
    </>
  )
}
