import { CalendarClock, Check, ChevronRight, Inbox, PlugZap, Wallet, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNow, useQuery, useSession } from '../app/hooks'
import { Countdown, LifecycleChip, LifecycleTracker, StatusLine } from '../components/booking'
import { Page, PageHeader } from '../components/Shell'
import { Button, Card, Chip, EmptyState, SectionTitle, StatTile, useAction } from '../components/ui'
import { userById } from '../domain/catalogue'
import { POLICY } from '../domain/policy'
import type { ResourceStatus } from '../domain/types'
import { istDayLabel, istTime, kwh, rupees } from '../lib/format'
import { api } from '../server/api'
import { sessionProgress } from '../server/bookings'

function greeting(now: number) {
  const h = new Date(now + 330 * 60_000).getUTCHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function HostDashboard() {
  const user = useSession()!
  const now = useNow(1000)
  const { run, busy } = useAction()
  const bookings = useQuery(() => api.listBookings('host'))
  const sites = useQuery(() => api.hostSites())
  const earnings = useQuery(() => api.hostEarnings())
  const rows = bookings.data ?? []
  const requests = rows.filter((r) => !r.state.ended && r.state.lifecycle === 'requested')
  const upcoming = rows.filter((r) => !r.state.ended && r.state.lifecycle !== 'requested')

  return (
    <>
      <PageHeader user={user} title={`${greeting(now)}, ${user.display_name}`} subtitle="Host dashboard" />
      <Page>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Inbox className="size-4" />} label="Requests" value={requests.length} aside="2 min to respond" />
          <StatTile icon={<CalendarClock className="size-4" />} label="Confirmed" value={upcoming.filter((r) => r.state.lifecycle !== 'charging').length} />
          <StatTile icon={<Zap className="size-4" />} label="Charging" value={upcoming.filter((r) => r.state.lifecycle === 'charging').length} />
          <StatTile icon={<Wallet className="size-4" />} label="Pending proceeds" value={rupees(earnings.data?.pending_paise ?? 0)} aside="illustrative" />
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div>
            <SectionTitle>Requests</SectionTitle>
            {requests.length ? (
              <div className="space-y-3">
                {requests.map(({ header, state }) => (
                  <Card key={header.id} className="animate-fade-up">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {userById(header.driver_id)?.display_name} · {state.request.vehicle.model_label.split(' (')[0]}
                        </div>
                        <div className="text-sm text-muted">
                          {state.request.site_name} · {istDayLabel(state.request.start_at, now)} {istTime(state.request.start_at)}–{istTime(state.request.end_at)}
                        </div>
                        <div className="mt-1 text-sm text-muted">
                          {kwh(state.request.quote.grid_wh)} · {rupees(state.request.quote.total_paise)} · arriving at {state.request.vehicle.soc}%
                        </div>
                      </div>
                      {state.source === 'JURY_CONSOLE' ? <Chip tone="outline">console</Chip> : null}
                    </div>
                    <Countdown className="mt-3" deadline={state.request.host_response_deadline} now={now} label="Respond within" totalS={POLICY.host_response_s} />
                    <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Button variant="secondary" loading={busy === `d${header.id}`} onClick={() => run(`d${header.id}`, () => api.decline(header.id, 'Host unavailable', state.last_sequence), 'Declined — the slot is released')}>
                        Decline
                      </Button>
                      <Button variant="volt" loading={busy === `a${header.id}`} onClick={() => run(`a${header.id}`, () => api.accept(header.id, state.last_sequence), `Confirmed ${header.booking_ref}`)}>
                        <Check className="size-4" /> Confirm
                      </Button>
                      <Link to={`/booking/${header.id}`} aria-label="Open booking" className="grid size-11 place-items-center rounded-full bg-surface-2">
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-sm text-muted">No pending requests. New requests appear here instantly — keep this tab open.</Card>
            )}

            <SectionTitle>Upcoming & active</SectionTitle>
            {upcoming.length ? (
              <div className="space-y-3">
                {upcoming.map(({ header, state }) => {
                  const note =
                    state.lifecycle === 'host_confirmed'
                      ? state.payment === 'CAPTURED'
                        ? 'Paid · waiting for the driver to depart'
                        : 'Waiting for driver checkout'
                      : state.lifecycle === 'on_the_way'
                        ? state.arrival_verified_at
                          ? 'Arrival verified · start the session'
                          : 'Driver on the way · check them in with their code'
                        : `Charging · ${Math.round(sessionProgress(state, now) * 100)}% of the demo session`
                  return (
                    <Link key={header.id} to={`/booking/${header.id}`} className="block">
                      <Card className="transition hover:shadow-float">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">
                              {header.booking_ref} · {userById(header.driver_id)?.display_name}
                            </div>
                            <div className="text-sm text-muted">
                              {state.request.site_name} · {istDayLabel(state.request.start_at, now)} {istTime(state.request.start_at)}
                            </div>
                          </div>
                          <LifecycleChip state={state} />
                        </div>
                        <div className="mt-3">
                          <LifecycleTracker state={state} compact />
                        </div>
                        <div className="mt-2 text-xs font-semibold text-ink-2">{note}</div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <Card className="text-sm text-muted">Nothing confirmed yet.</Card>
            )}
          </div>

          <div>
            <SectionTitle action={<Link to="/host/listings" className="text-sm font-semibold">Manage</Link>}>Charger status</SectionTitle>
            <div className="space-y-3">
              {(sites.data ?? [])
                .filter((s) => s.site.listing_state === 'ACTIVE' || s.site.listing_state === 'PAUSED')
                .flatMap((s) =>
                  s.resources.map((r) => (
                    <Card key={r.id}>
                      <div className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-2xl bg-surface-2">
                          <PlugZap className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">
                            {s.site.name} · {r.label}
                          </div>
                          <StatusLine value={r.current_status} source={r.status_source} observedAt={r.status_observed_at} freshness={now - Date.parse(r.status_observed_at) <= POLICY.host_status_fresh_s * 1000 ? 'FRESH' : 'STALE'} now={now} />
                        </div>
                        {s.site.listing_state === 'PAUSED' ? <Chip tone="amber">paused</Chip> : null}
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        {(['AVAILABLE', 'BUSY', 'OFFLINE'] as ResourceStatus[]).map((st) => (
                          <button
                            key={st}
                            onClick={() => run(`s${r.id}${st}`, () => api.setResourceStatus(r.id, st), 'Status updated')}
                            className={`h-9 flex-1 rounded-full text-xs font-semibold ${r.current_status === st ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'}`}
                          >
                            {st === 'AVAILABLE' ? 'Available' : st === 'BUSY' ? 'In use' : 'Offline'}
                          </button>
                        ))}
                      </div>
                    </Card>
                  )),
                )}
              {sites.data && !sites.data.length ? <EmptyState title="No listings yet" action={<Link to="/host/listings/new"><Button>Create a listing</Button></Link>} /> : null}
            </div>
            <p className="mt-3 text-xs text-muted">Host updates are observations, not hardware telemetry. They go stale after 15 minutes.</p>
          </div>
        </div>
      </Page>
    </>
  )
}
