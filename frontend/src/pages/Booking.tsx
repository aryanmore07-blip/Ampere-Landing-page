import { Ban, CarFront, Check, Copy, CreditCard, FastForward, History, KeyRound, MapPin, Navigation, Play, Receipt, RefreshCw, Square, Wifi, WifiOff } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useBookingStream, useNow, useSession, type StreamStatus } from '../app/hooks'
import { CarExoskeleton } from '../components/CarExoskeleton'
import { Countdown, EventLog, LifecycleChip, LifecycleTracker, OutcomeNotice, StationArt } from '../components/booking'
import { Page, PageHeader } from '../components/Shell'
import { Button, Card, Chip, Dot, EmptyState, Field, inputClass, Notice, SectionTitle, Sheet, Skeleton, useAction, useToast } from '../components/ui'
import { LIFECYCLE_LABEL, type BookingState } from '../domain/booking'
import { CONNECTOR_LABEL, modelById, userById } from '../domain/catalogue'
import { POLICY } from '../domain/policy'
import type { SitePrivateAccess } from '../domain/types'
import { cn } from '../lib/cn'
import { istDayLabel, istTime, kwh, km, minutes, rupees } from '../lib/format'
import { uuid } from '../lib/ids'
import { api } from '../server/api'
import { allowedActions, arrivalWindow, sessionProgress } from '../server/bookings'
import { readDb } from '../server/db'
import { QuoteBreakdown } from './Station'

export default function Booking() {
  const { id } = useParams()
  const user = useSession()!
  const now = useNow(500)
  const stream = useBookingStream(id)
  const { state, events, status } = stream
  const header = readDb().bookings.find((b) => b.id === id)
  const toast = useToast()

  if (stream.error && !state)
    return (
      <>
        <PageHeader back title="Booking" />
        <EmptyState title={stream.error.code === 'NOT_FOUND' ? 'Booking not found' : 'Could not load booking'}>{stream.error.message}</EmptyState>
      </>
    )
  if (!state || !header)
    return (
      <>
        <PageHeader back title="Booking" />
        <Page>
          <Skeleton className="mt-4 h-40" />
          <Skeleton className="mt-4 h-24" />
        </Page>
      </>
    )

  const actions = allowedActions(state, header, user)
  const isDriverView = header.driver_id === user.id
  const isHostView = !!user.host_account_id && user.host_account_id === header.host_account_id
  const site = readDb().sites.find((s) => s.id === header.site_id)
  const model = modelById(state.request.vehicle.model_id)
  const progress = sessionProgress(state, now)
  const gainPct = model ? (state.request.quote.battery_wh / model.usable_battery_wh) * 100 : 0
  const liveSoc = Math.min(100, state.request.vehicle.soc + gainPct * (state.lifecycle === 'charging' || state.lifecycle === 'done' ? progress : 0))

  return (
    <>
      <PageHeader
        back
        title={header.booking_ref}
        subtitle={state.request.site_name}
        actions={
          <button
            className="hidden items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-xs font-semibold shadow-soft sm:inline-flex"
            onClick={() => {
              void navigator.clipboard?.writeText(header.booking_ref)
              toast({ tone: 'info', text: 'Reference copied' })
            }}
          >
            <Copy className="size-3.5" /> Copy ref
          </button>
        }
      />
      <Page>
        <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-8">
          <div>
            <Card className="overflow-hidden !p-0">
              <div className="flex items-center justify-between gap-3 p-4 pb-0">
                <div className="flex items-center gap-2">
                  <LifecycleChip state={state} />
                  {state.source === 'JURY_CONSOLE' ? <Chip tone="outline">via jury console</Chip> : null}
                </div>
                <StreamBadge status={status} />
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 p-4">
                <div className="min-w-0">
                  <div className="text-[40px] font-light leading-none tracking-tight">{state.lifecycle === 'charging' || state.lifecycle === 'done' ? `${Math.round(liveSoc)}%` : LIFECYCLE_LABEL[state.lifecycle]}</div>
                  <div className="mt-2 text-sm text-muted">
                    {istDayLabel(state.request.start_at, now)} · {istTime(state.request.start_at)}–{istTime(state.request.end_at)} IST
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {CONNECTOR_LABEL[state.request.quote.connector_standard]} {state.request.quote.charging_mode} · {state.request.quote.effective_power_kw} kW · {kwh(state.request.quote.grid_wh)}
                  </div>
                  {isHostView && !isDriverView ? (
                    <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
                      <CarFront className="size-4" /> {userById(header.driver_id)?.display_name ?? 'Driver'} · {state.request.vehicle.model_label.split(' (')[0]} at {state.request.vehicle.soc}%
                    </div>
                  ) : null}
                </div>
                <div className="h-44 w-20 sm:h-52 sm:w-24">
                  <CarExoskeleton soc={liveSoc} charging={state.lifecycle === 'charging'} className="h-full w-full" scan={state.lifecycle === 'charging'} />
                </div>
              </div>
              <div className="px-4 pb-4">
                <LifecycleTracker state={state} />
              </div>
            </Card>

            <div className="mt-4 space-y-3">
              <OutcomeNotice state={state} />
              <StagePanel state={state} actions={actions} isDriver={isDriverView} isHost={isHostView} now={now} progress={progress} />
            </div>

            <SectionTitle
              action={
                <Button size="sm" variant="secondary" onClick={() => void stream.fullReplay()}>
                  <RefreshCw className="size-3.5" /> Replay from database
                </Button>
              }
            >
              <span className="inline-flex items-center gap-2">
                <History className="size-4" /> Event history
              </span>
            </SectionTitle>
            <Card>
              <EventLog events={events} />
              <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-xs text-muted">
                State is derived by replaying {events.length} append-only events in sequence order (latest #{state.last_sequence}). Reloading this page fetches the stream from the database and replays it — nothing is read from browser memory or a status column. Live: {stream.stats.applied} applied · {stream.stats.duplicates} duplicates ignored · {stream.stats.gaps} gaps refetched · {stream.stats.replays} full replays.
              </div>
            </Card>
          </div>

          <div>
            <SectionTitle className="lg:mt-0">Details</SectionTitle>
            <Card>
              {site ? <StationArt type={site.site_type} className="mb-4 h-28 w-full" charging={state.lifecycle === 'charging'} /> : null}
              <QuoteBreakdown quote={{ snapshot: state.request.quote }} />
              <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
                <div>
                  Plan {state.request.quote.plan.toLowerCase()} · policy {state.request.policy_version} · tariff v{state.request.quote.tariff_version}
                </div>
                <div>
                  Range at request: {km(state.request.vehicle.range_budget_m)} budget vs {km(state.request.vehicle.route_m)} route ({state.request.vehicle.route_provider})
                </div>
                <div>Payment: {state.payment === 'CAPTURED' ? `demo captured ${rupees(state.paid_paise)}` : state.payment === 'REFUNDED' ? 'simulated refund' : state.payment === 'FAILED' ? 'last attempt failed' : 'not yet taken'}</div>
              </div>
            </Card>
            {actions.includes('RECEIPT') ? (
              <Link to={`/receipt/${header.id}`} className="mt-3 block">
                <Button variant="secondary" className="w-full">
                  <Receipt className="size-4" /> View demo receipt
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </Page>
    </>
  )
}

function StreamBadge({ status }: { status: StreamStatus }) {
  const map = {
    live: { t: 'Live', tone: 'volt' as const, icon: <Wifi className="size-3" /> },
    loading: { t: 'Loading', tone: 'neutral' as const, icon: <RefreshCw className="size-3 animate-spin" /> },
    recovering: { t: 'Catching up', tone: 'amber' as const, icon: <RefreshCw className="size-3 animate-spin" /> },
    paused: { t: 'Offline (simulated)', tone: 'amber' as const, icon: <WifiOff className="size-3" /> },
    error: { t: 'Error', tone: 'danger' as const, icon: <WifiOff className="size-3" /> },
  }[status]
  return (
    <Chip tone={map.tone} icon={map.icon}>
      {map.t}
    </Chip>
  )
}

function StagePanel({ state, actions, isDriver, isHost, now, progress }: { state: BookingState; actions: ReturnType<typeof allowedActions>; isDriver: boolean; isHost: boolean; now: number; progress: number }) {
  const { run, busy } = useAction()
  const id = state.booking_id
  const seq = state.last_sequence
  const payKey = useRef(uuid())
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [entered, setEntered] = useState('')
  const [access, setAccess] = useState<SitePrivateAccess | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('Plans changed')
  const [declineOpen, setDeclineOpen] = useState(false)

  if (state.ended && state.lifecycle !== 'done') {
    return isDriver ? (
      <Link to="/discover">
        <Button variant="secondary" className="w-full">
          Find an alternative (you choose — nothing is booked automatically)
        </Button>
      </Link>
    ) : null
  }

  const panels: React.ReactNode[] = []

  /* requested */
  if (state.lifecycle === 'requested') {
    panels.push(
      <Card key="req">
        <Countdown deadline={state.request.host_response_deadline} now={now} label="Host response window" />
        {isDriver ? <Notice className="mt-3" tone="amber" title="Don’t travel yet">The host must confirm first. The charger is held for you while they respond.</Notice> : null}
        {actions.includes('ACCEPT') ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setDeclineOpen(true)}>
              Decline
            </Button>
            <Button variant="volt" loading={busy === 'accept'} onClick={() => run('accept', () => api.accept(id, seq), 'Confirmed — HostConfirmed appended')}>
              <Check className="size-4" /> Confirm
            </Button>
          </div>
        ) : null}
      </Card>,
    )
  }

  /* host confirmed, checkout pending */
  if (state.lifecycle === 'host_confirmed' && state.payment !== 'CAPTURED' && state.checkout_deadline) {
    panels.push(
      <Card key="checkout">
        <div className="flex items-center justify-between gap-3">
          <Countdown deadline={state.checkout_deadline} now={now} label="Checkout window" totalS={POLICY.checkout_s} />
          <Chip tone="amber">checkout pending</Chip>
        </div>
        {isDriver ? (
          <>
            <p className="mt-3 text-sm text-ink-2">The host confirmed. Pay the quoted total to unlock arrival details and start your journey.</p>
            {state.payment === 'FAILED' ? <Notice tone="danger" className="mt-3">The last demo payment failed. You can retry while the window is open.</Notice> : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button
                size="lg"
                loading={busy === 'pay'}
                onClick={async () => {
                  const r = await run('pay', () => api.payDemo(id, 'SUCCESS', payKey.current), 'Demo payment captured')
                  if (r) payKey.current = uuid()
                }}
              >
                <CreditCard className="size-4" /> Pay {rupees(state.request.quote.total_paise, { decimals: true })} (demo)
              </Button>
              <Button
                size="lg"
                variant="secondary"
                loading={busy === 'payfail'}
                onClick={async () => {
                  await run('payfail', () => api.payDemo(id, 'FAILURE', uuid()))
                }}
              >
                Simulate failure
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Waiting for the driver’s checkout. The slot is released automatically if it isn’t completed in time.</p>
        )}
      </Card>,
    )
  }

  /* host confirmed + paid: depart */
  if (actions.includes('DEPART')) {
    panels.push(
      <Card key="depart">
        <div className="font-semibold">Ready when you are</div>
        <p className="mt-1 text-sm text-muted">Starting the journey re-checks your range to this charger with your current battery.</p>
        <Button size="lg" className="mt-4 w-full" loading={busy === 'depart'} onClick={() => run('depart', () => api.depart(id, seq), 'On the way — DriverDeparted appended')}>
          <Navigation className="size-4" /> Start journey
        </Button>
      </Card>,
    )
  }
  if (isHost && state.lifecycle === 'host_confirmed' && state.payment === 'CAPTURED') {
    panels.push(
      <Notice key="hostwait" tone="volt" title="Checkout complete">
        Waiting for the driver to start the journey.
      </Notice>,
    )
  }

  /* arrival code + access (driver) */
  if (actions.includes('ARRIVAL_CODE')) {
    panels.push(
      <Card key="code">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Arrival code</div>
          <KeyRound className="size-4 text-muted" />
        </div>
        {code ? (
          <>
            <div className="mt-3 text-center font-mono text-5xl font-semibold tracking-[0.3em]">{code.code}</div>
            <p className="mt-2 text-center text-xs text-muted">Show this to the host. Single use, expires {istTime(code.expires_at)}. Only a hash is stored — rotating issues a new code.</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">Generate it when you arrive. It confirms you and the host mean the same booking — not that the charger is ready.</p>
        )}
        <Button variant="secondary" className="mt-3 w-full" loading={busy === 'code'} onClick={async () => setCode(await run('code', () => api.arrivalCode(id)))}>
          {code ? 'Rotate code' : 'Show arrival code'}
        </Button>
      </Card>,
    )
  }
  if (actions.includes('ACCESS')) {
    panels.push(
      <Card key="access">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Arrival details</div>
          <MapPin className="size-4 text-muted" />
        </div>
        {access ? (
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="font-semibold">{access.full_address}</div>
            <div className="text-ink-2">{access.entrance_instructions}</div>
            <div className="text-muted">{access.contact_reference}</div>
            <a className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white" href={`https://www.google.com/maps/dir/?api=1&destination=${access.exact_lat},${access.exact_lng}`} target="_blank" rel="noreferrer">
              <Navigation className="size-4" /> Open navigation
            </a>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Exact address, entrance and contact — released only to the confirmed driver and the host.</p>
            <Button variant="secondary" className="mt-3 w-full" loading={busy === 'access'} onClick={async () => setAccess(await run('access', () => api.access(id)))}>
              Reveal arrival details
            </Button>
          </>
        )}
      </Card>,
    )
  }

  /* host check-in */
  if (actions.includes('CHECK_IN')) {
    const w = arrivalWindow(state)
    const early = now < w.opens
    panels.push(
      <Card key="checkin">
        <div className="font-semibold">Check in the driver</div>
        <p className="mt-1 text-sm text-muted">
          Enter the driver’s 6-digit arrival code. Window {istTime(w.opens)}–{istTime(w.closes)}.
        </p>
        {early ? (
          <Notice tone="amber" className="mt-3" title={`Check-in opens at ${istTime(w.opens)}`} action={
            <Button size="sm" variant="secondary" onClick={() => run('ff', () => api.advanceClock(w.opens - now + 1000), 'Demo clock moved to the arrival window')}>
              <FastForward className="size-3.5" /> Demo: jump to arrival window
            </Button>
          }>
            The demo clock is shared by every tab and only exists in the isolated demo.
          </Notice>
        ) : null}
        <div className="mt-3 flex gap-2">
          <input className={cn(inputClass, 'text-center font-mono text-lg tracking-[0.4em]')} inputMode="numeric" maxLength={6} placeholder="••••••" value={entered} onChange={(e) => setEntered(e.target.value.replace(/\D/g, ''))} aria-label="Arrival code" />
          <Button size="lg" disabled={entered.length !== 6} loading={busy === 'checkin'} onClick={async () => (await run('checkin', () => api.checkIn(id, entered), 'Arrival verified')) && setEntered('')}>
            Verify
          </Button>
        </div>
      </Card>,
    )
  }
  if (isDriver && state.lifecycle === 'on_the_way' && state.arrival_verified_at) {
    panels.push(
      <Notice key="verified" tone="volt" title="Arrival verified">
        The host will start the session once the bay and equipment are ready.
      </Notice>,
    )
  }
  if (actions.includes('START')) {
    panels.push(
      <Card key="start">
        <div className="font-semibold">Arrival verified</div>
        <p className="mt-1 text-sm text-muted">Check the bay and the equipment, connect the car, then start the simulated session.</p>
        <Button size="lg" variant="volt" className="mt-4 w-full" loading={busy === 'start'} onClick={() => run('start', () => api.startSession(id), 'Charging — ChargingStarted appended')}>
          <Play className="size-4" /> Start session
        </Button>
      </Card>,
    )
  }

  /* charging */
  if (state.lifecycle === 'charging' && state.session) {
    const q = state.request.quote
    panels.push(
      <Card key="charging">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Charging · simulated</div>
          <Chip tone="volt" icon={<Dot tone="volt" className="animate-pulse" />}>
            {Math.round(progress * 100)}%
          </Chip>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-volt transition-all duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="text-lg font-semibold">{kwh(q.grid_wh * progress, 2)}</div>
            <div className="text-[11px] text-muted">grid (sim.)</div>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="text-lg font-semibold">{kwh(q.battery_wh * progress, 2)}</div>
            <div className="text-[11px] text-muted">to battery (est.)</div>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="text-lg font-semibold">{minutes(q.duration_s * (1 - progress))}</div>
            <div className="text-[11px] text-muted">left (est.)</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Accelerated demo: {state.session.demo_seconds} s on screen stands for ~{minutes(state.session.estimated_duration_s)} of real charging. A timer is not metered energy.
        </p>
        {actions.includes('COMPLETE') ? (
          <Button size="lg" className="mt-4 w-full" disabled={progress < 1} loading={busy === 'complete'} onClick={() => run('complete', () => api.completeSession(id), 'Done — ChargingCompleted appended')}>
            <Square className="size-4" /> {progress < 1 ? 'Session running…' : 'Complete session'}
          </Button>
        ) : (
          <p className="mt-3 text-sm text-muted">Need to stop early? Ask the host — in the app, Stop is a request, not proof power was cut.</p>
        )}
      </Card>,
    )
  }

  /* done */
  if (state.lifecycle === 'done' && state.completed) {
    panels.push(
      <Notice key="done" tone="volt" title="Charging done (simulated)">
        {kwh(state.completed.grid_wh, 3)} grid energy · ~{kwh(state.completed.battery_gain_wh)} estimated to the battery. Receipt is illustrative, not a tax invoice.
      </Notice>,
    )
  }

  /* cancel */
  if (actions.includes('CANCEL')) {
    panels.push(
      <button key="cancel" onClick={() => setCancelOpen(true)} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-danger">
        <Ban className="size-4" /> Cancel booking
      </button>,
    )
  }

  return (
    <>
      {panels}
      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this booking?">
        <p className="text-sm text-ink-2">
          {state.payment === 'CAPTURED' ? `A simulated refund of ${rupees(state.paid_paise, { decimals: true })} (unused service plus fee) goes back to the original method.` : 'No payment has been taken, so nothing is charged.'} The slot is released and a BookingCancelled event is appended.
        </p>
        <Field label="Reason" className="mt-4">
          <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
            {(isHost ? ['Charger unavailable', 'Site access problem', 'Safety concern', 'Other'] : ['Plans changed', 'Found another charger', 'Running late', 'Other']).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>
            Keep booking
          </Button>
          <Button variant="danger" loading={busy === 'cancel'} onClick={async () => (await run('cancel', () => api.cancel(id, reason, seq), 'Booking cancelled')) && setCancelOpen(false)}>
            Cancel booking
          </Button>
        </div>
      </Sheet>
      <Sheet open={declineOpen} onClose={() => setDeclineOpen(false)} title="Decline request?">
        <Field label="Reason shown to the driver">
          <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
            {['Charger in use', 'Not home at that time', 'Bay blocked', 'Other'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setDeclineOpen(false)}>
            Back
          </Button>
          <Button variant="danger" loading={busy === 'decline'} onClick={async () => (await run('decline', () => api.decline(id, reason, seq), 'Declined — the slot is released')) && setDeclineOpen(false)}>
            Decline
          </Button>
        </div>
      </Sheet>
    </>
  )
}
