import { Coffee, Building2, House, Radio } from 'lucide-react'
import { LIFECYCLE, LIFECYCLE_LABEL, OUTCOME_LABEL, lifecycleIndex, type BookingEvent, type BookingState } from '../domain/booking'
import type { ResourceStatus, SiteType, StatusSource } from '../domain/types'
import { countdown, istDateTime, istTime, relativeAge, rupees } from '../lib/format'
import { cn } from '../lib/cn'
import { Chip, Dot, Notice } from './ui'
import { POLICY } from '../domain/policy'

/** The only five booking lifecycle labels. Ended bookings keep their last stage with a separate outcome notice. */
export function LifecycleTracker({ state, compact }: { state: BookingState; compact?: boolean }) {
  const idx = lifecycleIndex(state.lifecycle)
  const ended = state.ended && state.lifecycle !== 'done'
  return (
    <ol className={cn('flex items-start', compact ? 'gap-1' : 'gap-1.5')} aria-label={`Booking lifecycle: ${LIFECYCLE_LABEL[state.lifecycle]}`}>
      {LIFECYCLE.map((l, i) => {
        const done = i < idx || (i === idx && state.lifecycle === 'done')
        const current = i === idx && state.lifecycle !== 'done'
        return (
          <li key={l} className="flex min-w-0 flex-1 flex-col gap-2" aria-current={current ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full transition-colors duration-500', done ? 'bg-volt' : current ? (ended ? 'bg-muted' : 'bg-ink') : 'bg-line')}>
              {current && !ended ? <div className="h-full w-1/2 animate-pulse rounded-full bg-volt" /> : null}
            </div>
            {!compact ? (
              <span className={cn('break-words pr-1 text-[11px] font-semibold leading-tight sm:text-xs', done ? 'text-volt-strong' : current ? 'text-ink' : 'text-muted')}>{LIFECYCLE_LABEL[l]}</span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function LifecycleChip({ state }: { state: BookingState }) {
  if (state.ended && state.lifecycle !== 'done') return <Chip tone="neutral">{LIFECYCLE_LABEL[state.lifecycle]} · ended</Chip>
  const tone = state.lifecycle === 'done' ? 'volt' : state.lifecycle === 'requested' ? 'amber' : 'night'
  return <Chip tone={tone}>{LIFECYCLE_LABEL[state.lifecycle]}</Chip>
}

export function OutcomeNotice({ state }: { state: BookingState }) {
  if (!state.outcome) return null
  const refund = state.cancellation?.refund_paise
  return (
    <Notice tone={state.outcome.startsWith('CANCELLED') || state.outcome === 'NO_SHOW' ? 'danger' : 'amber'} title={OUTCOME_LABEL[state.outcome]}>
      Stopped at “{LIFECYCLE_LABEL[state.lifecycle]}”. Journey actions are closed and the slot was released — charging did not happen.
      {refund ? ` Simulated refund of ${rupees(refund)} to the original method.` : state.payment === 'NONE' || state.payment === 'FAILED' ? ' No charge was taken.' : ''}
    </Notice>
  )
}

export function Countdown({ deadline, now, label, totalS = POLICY.host_response_s, className }: { deadline: string; now: number; label: string; totalS?: number; className?: string }) {
  const ms = Date.parse(deadline) - now
  const total = totalS * 1000
  const pct = Math.max(0, Math.min(1, ms / total))
  const urgent = ms < 30_000
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg viewBox="0 0 36 36" className="size-11 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-line)" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={urgent ? 'var(--color-amber)' : 'var(--color-volt)'} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${pct * 94.2} 94.2`} className="transition-all duration-1000" />
      </svg>
      <div>
        <div className={cn('text-xl font-semibold tabular-nums', urgent && 'text-[#8a5a12]')}>{ms > 0 ? countdown(ms) : '0:00'}</div>
        <div className="text-xs text-muted">
          {label} · server time {istTime(deadline)}
        </div>
      </div>
    </div>
  )
}

const EVENT_COPY: Record<string, string> = {
  BookingRequested: 'Request created, resource held',
  HostConfirmed: 'Host confirmed',
  HostDeclined: 'Host declined',
  HoldExpired: 'Hold expired',
  PaymentCaptured: 'Demo payment captured',
  PaymentFailed: 'Demo payment failed',
  DriverDeparted: 'Driver departed',
  ArrivalVerified: 'Arrival code verified',
  ChargingStarted: 'Simulated session started',
  ChargingCompleted: 'Simulated session completed',
  BookingCancelled: 'Booking cancelled',
}

export function EventLog({ events, className }: { events: BookingEvent[]; className?: string }) {
  return (
    <ol className={cn('relative space-y-0', className)}>
      {events.map((e, i) => (
        <li key={e.event_id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 ? <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-line" aria-hidden /> : null}
          <span className="z-10 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-[11px] font-bold text-ink-2 ring-4 ring-surface">{e.sequence}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[13px] font-semibold">{e.event_type}</span>
              <Chip tone={e.source === 'JURY_CONSOLE' ? 'night' : e.source === 'WORKER' ? 'amber' : 'neutral'} className="!py-0.5 text-[10px]">
                {e.source} · {e.actor_role}
              </Chip>
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {EVENT_COPY[e.event_type]} · recorded {istDateTime(e.recorded_at)}
              {e.reported_at ? ` · reported ${istDateTime(e.reported_at)}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function siteIcon(t: SiteType, className = 'size-4') {
  return t === 'CAFE' ? <Coffee className={className} /> : t === 'OFFICE' ? <Building2 className={className} /> : t === 'RESIDENTIAL' ? <House className={className} /> : <Radio className={className} />
}

export const SITE_TYPE_LABEL: Record<SiteType, string> = { CAFE: 'Café', OFFICE: 'Office', RESIDENTIAL: 'Residential host', PUBLIC_NETWORK: 'Public directory' }

export function StatusLine({ value, source, observedAt, freshness, now }: { value: ResourceStatus; source: StatusSource; observedAt: string; freshness: 'FRESH' | 'STALE' | 'UNKNOWN'; now: number }) {
  const src = source === 'HOST_UPDATE' ? 'Host update' : source === 'SEEDED_TELEMETRY' ? 'Demo telemetry' : 'Directory'
  if (freshness === 'UNKNOWN') return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"><Dot tone="muted" />Live status unknown · {src} {relativeAge(observedAt, now)}</span>
  if (freshness === 'STALE') return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a5a12]"><Dot tone="amber" />Status stale · {src} {relativeAge(observedAt, now)} · request a future slot</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-volt-strong">
      <Dot tone={value === 'AVAILABLE' ? 'volt' : 'amber'} />
      {value === 'AVAILABLE' ? 'Available' : value === 'BUSY' ? 'In use' : value.toLowerCase()} · {src} {relativeAge(observedAt, now)}
    </span>
  )
}

/** Stylised station artwork in place of photos (no copied competitor imagery). */
export function StationArt({ type, className, charging }: { type: SiteType; className?: string; charging?: boolean }) {
  const palette = { CAFE: ['#e9e2d4', '#cfc3a9'], OFFICE: ['#dfe4e6', '#b9c3c7'], RESIDENTIAL: ['#e3e8dc', '#bfcab2'], PUBLIC_NETWORK: ['#e6e3df', '#c9c2b8'] }[type]
  return (
    <div className={cn('relative overflow-hidden rounded-3xl', className)} style={{ background: `linear-gradient(160deg, ${palette[0]}, ${palette[1]})` }}>
      <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <g fill="none" stroke="#0e0f0e" strokeOpacity="0.18" strokeWidth="1.5">
          {type === 'CAFE' ? <path d="M20 80h170v120M30 80l15-30h120l15 30M40 110h50v50H40zM110 110h60v90" /> : null}
          {type === 'OFFICE' ? <path d="M20 40h150v160M40 60h30v25H40zM90 60h30v25H90zM40 105h30v25H40zM90 105h30v25H90zM40 150h30v25H40zM90 150h30v25H90z" /> : null}
          {type === 'RESIDENTIAL' ? <path d="M20 110l80-60 80 60v90M40 200v-70h40v70M110 140h40v30h-40z" /> : null}
          {type === 'PUBLIC_NETWORK' ? <path d="M10 70h220v12H10zM30 82v118M210 82v118" /> : null}
        </g>
        <rect x="0" y="198" width="400" height="22" fill="#0e0f0e" fillOpacity="0.07" />
        {/* charger post */}
        <g transform="translate(232 70)">
          <rect x="0" y="0" width="36" height="130" rx="8" fill="#f6f6f3" stroke="#0e0f0e" strokeOpacity="0.35" strokeWidth="1.5" />
          <rect x="7" y="12" width="22" height="30" rx="4" fill="#161716" />
          <rect x="11" y="18" width="14" height="4" rx="2" fill="#6fa35c" />
          <rect x="15" y="0" width="6" height="130" fill="#6fa35c" fillOpacity="0.85" />
          <path d="M36 70c30 0 30 40 60 40" stroke="#161716" strokeWidth="3" fill="none" />
        </g>
        {/* parked car outline */}
        <g transform="translate(300 150)" fill="none" stroke="#0e0f0e" strokeOpacity="0.45" strokeWidth="2">
          <path d="M0 45h110l-6-20-22-6-16-15H25L8 22 0 30z" fill="#ffffff" fillOpacity="0.55" />
          <circle cx="26" cy="46" r="10" fill="#f6f6f3" />
          <circle cx="88" cy="46" r="10" fill="#f6f6f3" />
        </g>
        {charging ? (
          <circle cx="250" cy="96" r="6" fill="#6fa35c">
            <animate attributeName="r" values="6;14;6" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        ) : null}
      </svg>
    </div>
  )
}
