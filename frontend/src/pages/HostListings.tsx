import { CalendarX, Pause, Play, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useSession } from '../app/hooks'
import { SITE_TYPE_LABEL, siteIcon } from '../components/booking'
import { Page, PageHeader } from '../components/Shell'
import { Button, Card, Chip, EmptyState, Field, inputClass, Notice, Skeleton, useAction, useToast } from '../components/ui'
import { CONNECTOR_LABEL } from '../domain/catalogue'
import type { ListingState } from '../domain/types'
import { istDateTime } from '../lib/format'
import { api } from '../server/api'
import type { hostSites } from '../server/listings'

export const STATE_TONE: Record<ListingState, 'volt' | 'amber' | 'danger' | 'neutral' | 'night'> = {
  ACTIVE: 'volt',
  PENDING_REVIEW: 'amber',
  DRAFT: 'neutral',
  PAUSED: 'amber',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
}

const TIMES = Array.from({ length: 97 }, (_, i) => i * 15)
const hhmm = (m: number) => (m === 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)

export default function HostListings() {
  const user = useSession()!
  const q = useQuery(() => api.hostSites())
  const { run, busy } = useAction()
  return (
    <>
      <PageHeader
        user={user}
        title="Listings"
        subtitle="Schedules, availability and review status"
        actions={
          <Link to="/host/listings/new" className="hidden sm:block">
            <Button size="sm">
              <Plus className="size-4" /> New listing
            </Button>
          </Link>
        }
      />
      <Page>
        <Link to="/host/listings/new" className="mb-4 block sm:hidden">
          <Button className="w-full" variant="secondary">
            <Plus className="size-4" /> New listing
          </Button>
        </Link>
        {q.loading && !q.data ? (
          <Skeleton className="h-60" />
        ) : !q.data?.length ? (
          <EmptyState title="No listings" />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {q.data.map(({ site, resources, checks }) => (
              <Card key={site.id} className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2">{siteIcon(site.site_type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{site.name}</div>
                    <div className="text-xs text-muted">
                      {SITE_TYPE_LABEL[site.site_type]} · {site.public_area}
                    </div>
                  </div>
                  <Chip tone={STATE_TONE[site.listing_state]}>{site.listing_state.replace('_', ' ').toLowerCase()}</Chip>
                </div>
                {site.rejection_reasons?.length ? <Notice tone="danger" title="Changes requested">{site.rejection_reasons.join('; ')}</Notice> : null}
                {site.suspension_reason ? <Notice tone="danger" title="Suspended by an administrator">{site.suspension_reason}</Notice> : null}

                <div className="flex flex-wrap gap-1.5">
                  {checks.map((c) => (
                    <Chip key={c.id} tone={c.outcome === 'APPROVED' ? 'volt' : c.outcome === 'REJECTED' ? 'danger' : 'amber'} icon={<ShieldCheck className="size-3" />}>
                      {c.check_type.replace('_', ' ').toLowerCase()}: {c.outcome.toLowerCase()}
                    </Chip>
                  ))}
                </div>

                {resources.map((r) => (
                  <ResourceEditor key={r.id} resource={r} />
                ))}

                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                  {site.listing_state === 'DRAFT' || site.listing_state === 'REJECTED' ? (
                    <Button size="sm" loading={busy === `sub${site.id}`} onClick={() => run(`sub${site.id}`, () => api.submitForReview(site.id), 'Submitted for review')}>
                      <Send className="size-3.5" /> Submit for review
                    </Button>
                  ) : null}
                  {site.listing_state === 'ACTIVE' ? (
                    <Button size="sm" variant="secondary" loading={busy === `p${site.id}`} onClick={() => run(`p${site.id}`, () => api.setPaused(site.id, true), (d) => (d.affected.length ? `Paused. Existing bookings kept: ${d.affected.join(', ')}` : 'Paused — no new requests'))}>
                      <Pause className="size-3.5" /> Pause new requests
                    </Button>
                  ) : null}
                  {site.listing_state === 'PAUSED' ? (
                    <Button size="sm" variant="secondary" loading={busy === `r${site.id}`} onClick={() => run(`r${site.id}`, () => api.setPaused(site.id, false), 'Listing resumed')}>
                      <Play className="size-3.5" /> Resume
                    </Button>
                  ) : null}
                  {site.listing_state === 'PENDING_REVIEW' ? <span className="text-xs text-muted">An administrator reviews each check separately. You can’t approve your own listing.</span> : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Page>
    </>
  )
}

type Res = ReturnType<typeof hostSites>[number]['resources'][number]

function ResourceEditor({ resource }: { resource: Res }) {
  const rule = resource.rules[0]
  const [start, setStart] = useState(rule?.start_min ?? 480)
  const [end, setEnd] = useState(rule?.end_min ?? 1200)
  const [bStart, setBStart] = useState('')
  const [bEnd, setBEnd] = useState('')
  const [kind, setKind] = useState<'BLACKOUT' | 'HOST_USE'>('HOST_USE')
  const { run, busy } = useAction()
  const toast = useToast()
  const dirty = !rule || start !== rule.start_min || end !== rule.end_min
  const toIso = (v: string) => new Date(`${v}:00+05:30`).toISOString()
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{resource.label}</div>
        <div className="text-xs text-muted">{resource.connectors.map((c) => `${CONNECTOR_LABEL[c.standard]} ${c.rated_power_kw} kW`).join(' · ')}</div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <Field label="Daily from (IST)">
          <select className={inputClass} value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {TIMES.slice(0, -1).map((t) => (
              <option key={t} value={t}>{hhmm(t)}</option>
            ))}
          </select>
        </Field>
        <Field label="Until">
          <select className={inputClass} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
            {TIMES.slice(1).map((t) => (
              <option key={t} value={t}>{hhmm(t)}</option>
            ))}
          </select>
        </Field>
        <Button
          size="lg"
          disabled={!dirty}
          loading={busy === 'sched'}
          onClick={async () => {
            const r = await run('sched', () => api.updateSchedule(resource.id, start, end))
            if (r) toast({ tone: r.conflicts.length ? 'info' : 'ok', text: r.conflicts.length ? 'Saved. These bookings now fall outside it and were kept:' : 'Schedule saved', detail: r.conflicts.join(', ') || undefined })
          }}
        >
          Save
        </Button>
      </div>
      <div className="mt-4 text-sm font-semibold">Blocked periods</div>
      <div className="mt-2 space-y-1.5">
        {resource.exceptions.map((x) => (
          <div key={x.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs">
            <CalendarX className="size-3.5 text-muted" />
            <span className="flex-1">
              {x.kind === 'HOST_USE' ? 'Own car' : 'Blackout'} · {istDateTime(x.start_at)} → {istDateTime(x.end_at)}
            </span>
            <button aria-label="Remove" onClick={() => run('rm', () => api.removeBlackout(x.id), 'Removed')}>
              <Trash2 className="size-3.5 text-muted hover:text-danger" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input type="datetime-local" className={inputClass + ' !h-10 text-sm'} value={bStart} onChange={(e) => setBStart(e.target.value)} aria-label="Block from (IST)" />
        <input type="datetime-local" className={inputClass + ' !h-10 text-sm'} value={bEnd} onChange={(e) => setBEnd(e.target.value)} aria-label="Block until (IST)" />
        <select className={inputClass + ' !h-10 text-sm'} value={kind} onChange={(e) => setKind(e.target.value as 'BLACKOUT' | 'HOST_USE')} aria-label="Kind">
          <option value="HOST_USE">Own car</option>
          <option value="BLACKOUT">Blackout</option>
        </select>
        <Button
          size="sm"
          className="h-10"
          disabled={!bStart || !bEnd}
          onClick={async () => {
            const r = await run('bl', () => api.addBlackout(resource.id, toIso(bStart), toIso(bEnd), kind, kind === 'HOST_USE' ? 'Charging own car' : 'Unavailable'))
            if (r) {
              toast({ tone: r.conflicts.length ? 'info' : 'ok', text: r.conflicts.length ? 'Blocked. Existing bookings overlap and were kept:' : 'Period blocked', detail: r.conflicts.join(', ') || undefined })
              setBStart('')
              setBEnd('')
            }
          }}
        >
          Block
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted">Edits never cancel existing bookings silently — conflicts are listed for you to handle.</p>
    </div>
  )
}
