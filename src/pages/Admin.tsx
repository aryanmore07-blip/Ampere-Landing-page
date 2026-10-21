import { Check, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { useNow, useQuery, useSession } from '../app/hooks'
import { SITE_TYPE_LABEL, siteIcon } from '../components/booking'
import { Page, PageHeader } from '../components/Shell'
import { Button, Card, Chip, inputClass, SectionTitle, Skeleton, useAction } from '../components/ui'
import { CONNECTOR_LABEL, hostUser, userById } from '../domain/catalogue'
import { relativeAge } from '../lib/format'
import { api } from '../server/api'
import { readDb } from '../server/db'
import { STATE_TONE } from './HostListings'
import type { adminQueue } from '../server/listings'

export default function Admin() {
  const user = useSession()!
  const now = useNow(30000)
  const q = useQuery(() => api.adminQueue())
  const rows = q.data ?? []
  const groups: [string, typeof rows][] = [
    ['Needs review', rows.filter((r) => r.site.listing_state === 'PENDING_REVIEW')],
    ['Live', rows.filter((r) => r.site.listing_state === 'ACTIVE')],
    ['Paused, suspended, rejected or draft', rows.filter((r) => !['PENDING_REVIEW', 'ACTIVE'].includes(r.site.listing_state))],
  ]
  const audit = readDb().audit.slice(-12).reverse()
  return (
    <>
      <PageHeader user={user} title="Verification queue" subtitle="Each check is a separate, recorded decision" />
      <Page>
        {q.loading && !q.data ? <Skeleton className="h-60" /> : null}
        {groups.map(([label, list]) =>
          list.length ? (
            <section key={label}>
              <SectionTitle>
                {label} · {list.length}
              </SectionTitle>
              <div className="grid gap-3 xl:grid-cols-2">
                {list.map((r) => (
                  <SiteReview key={r.site.id} row={r} />
                ))}
              </div>
            </section>
          ) : null,
        )}
        <SectionTitle>Audit log</SectionTitle>
        <Card className="space-y-2 text-sm">
          {audit.length ? (
            audit.map((a) => (
              <div key={a.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-mono text-xs font-semibold">{a.action}</span> · {a.detail}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {userById(a.actor_id)?.display_name} · {relativeAge(a.at, now)}
                </span>
              </div>
            ))
          ) : (
            <span className="text-muted">No privileged actions recorded yet.</span>
          )}
        </Card>
      </Page>
    </>
  )
}

function SiteReview({ row }: { row: ReturnType<typeof adminQueue>[number] }) {
  const { run, busy } = useAction()
  const [reason, setReason] = useState('')
  const { site, checks } = row
  const allApproved = checks.every((c) => c.outcome === 'APPROVED')
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2">{siteIcon(site.site_type)}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{site.name}</div>
          <div className="text-xs text-muted">
            {SITE_TYPE_LABEL[site.site_type]} · {site.public_area} · host {hostUser(site.host_account_id)?.display_name}
          </div>
          <div className="mt-1 text-xs text-muted">{row.resources.map((r) => `${r.label}: ${r.connectors.map((c) => `${CONNECTOR_LABEL[c.standard]} ${c.rated_power_kw} kW`).join(', ')}`).join(' · ')}</div>
        </div>
        <Chip tone={STATE_TONE[site.listing_state]}>{site.listing_state.replace('_', ' ').toLowerCase()}</Chip>
      </div>
      <div className="space-y-1.5">
        {checks.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
            {c.outcome === 'APPROVED' ? <ShieldCheck className="size-4 text-volt-strong" /> : <ShieldAlert className="size-4 text-amber" />}
            <span className="flex-1 text-sm font-semibold">{c.check_type.replace('_', ' ').toLowerCase()}</span>
            <span className="text-xs text-muted">{c.outcome.toLowerCase()}</span>
            {c.outcome !== 'APPROVED' ? (
              <>
                <button aria-label={`Approve ${c.check_type}`} onClick={() => run(c.id, () => api.recordCheck(c.id, 'APPROVED', 'Synthetic demo evidence reviewed'), 'Check approved')} className="grid size-8 place-items-center rounded-full bg-volt text-white">
                  <Check className="size-4" />
                </button>
                {c.outcome !== 'REJECTED' ? (
                  <button aria-label={`Reject ${c.check_type}`} onClick={() => run(c.id + 'r', () => api.recordCheck(c.id, 'REJECTED', 'Evidence insufficient'), 'Check rejected')} className="grid size-8 place-items-center rounded-full bg-danger-soft text-danger">
                    <X className="size-4" />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </div>
      {!row.has_schedule ? <div className="text-xs font-semibold text-danger">No valid schedule</div> : null}
      {site.listing_state !== 'ACTIVE' ? (
        <Button className="w-full" variant="volt" disabled={!allApproved || site.listing_state === 'DRAFT' || site.listing_state === 'REJECTED'} loading={busy === 'act'} onClick={() => run('act', () => api.activateSite(site.id), `${site.name} is live`)}>
          {allApproved ? 'Activate listing' : 'Approve every check to activate'}
        </Button>
      ) : null}
      <div className="flex gap-2">
        <input className={inputClass + ' !h-10 text-sm'} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        {site.listing_state === 'PENDING_REVIEW' ? (
          <Button size="sm" variant="danger" className="h-10" disabled={!reason.trim()} onClick={() => run('rej', () => api.rejectSite(site.id, [reason]), 'Returned to host with reasons')}>
            Request changes
          </Button>
        ) : null}
        {site.listing_state === 'ACTIVE' || site.listing_state === 'PAUSED' ? (
          <Button
            size="sm"
            variant="danger"
            className="h-10"
            disabled={!reason.trim()}
            onClick={() => run('sus', () => api.suspendSite(site.id, reason), (d) => (d.affected.length ? `Suspended. Follow up on: ${d.affected.join(', ')}` : 'Suspended'))}
          >
            Suspend
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
