import { Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery, useSession } from '../app/hooks'
import { Page, PageHeader } from '../components/Shell'
import { Card, EmptyState, Notice, StatTile } from '../components/ui'
import { POLICY } from '../domain/policy'
import { istDateTime, kwh, rupees } from '../lib/format'
import { api } from '../server/api'

export default function HostEarnings() {
  const user = useSession()!
  const q = useQuery(() => api.hostEarnings())
  const rows = q.data?.rows ?? []
  return (
    <>
      <PageHeader user={user} title="Earnings" subtitle="Illustrative — no payouts in the demo" />
      <Page className="mx-auto max-w-3xl">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={<Wallet className="size-4" />} label="Pending proceeds" value={rupees(q.data?.pending_paise ?? 0, { decimals: true })} />
          <StatTile label="Completed sessions" value={rows.length} />
        </div>
        <Notice className="mt-4" tone="amber" title="Before your costs">
          Proceeds = energy line − {POLICY.commission_bps / 100}% illustrative commission. They are not profit: electricity, maintenance, depreciation, insurance and tax remain your costs. Estimated → pending → eligible → paid only after reconciliation (pilot).
        </Notice>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <Link key={r.header.id} to={`/receipt/${r.header.id}`} className="block">
              <Card className="flex items-center justify-between gap-3 !p-3.5">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {r.header.booking_ref} · {r.state.request.site_name}
                  </div>
                  <div className="text-xs text-muted">
                    {istDateTime(r.state.completed_at!)} · {kwh(r.state.completed!.grid_wh)} · energy {rupees(r.energy_paise, { decimals: true })} − {rupees(r.commission_paise, { decimals: true })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{rupees(r.host_paise, { decimals: true })}</div>
                  <div className="text-[11px] text-muted">pending · demo</div>
                </div>
              </Card>
            </Link>
          ))}
          {q.data && !rows.length ? <EmptyState title="No completed sessions yet" /> : null}
        </div>
      </Page>
    </>
  )
}
