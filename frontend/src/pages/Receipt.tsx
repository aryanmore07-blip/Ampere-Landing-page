import { useParams } from 'react-router-dom'
import { useBookingStream, useSession } from '../app/hooks'
import { Page, PageHeader } from '../components/Shell'
import { Card, Chip, EmptyState, Notice, Skeleton } from '../components/ui'
import { illustrativeHostProceeds } from '../domain/calc'
import { CONNECTOR_LABEL } from '../domain/catalogue'
import { POLICY } from '../domain/policy'
import { istDateTime, kwh, minutes, rupees } from '../lib/format'
import { readDb } from '../server/db'

export default function Receipt() {
  const { id } = useParams()
  const user = useSession()!
  const { state, error } = useBookingStream(id)
  if (error) return <EmptyState title="Receipt unavailable">{error.message}</EmptyState>
  if (!state) return <Page className="pt-6"><Skeleton className="h-96" /></Page>
  if (state.lifecycle !== 'done' || !state.completed) return (<><PageHeader back title="Receipt" /><EmptyState title="No receipt yet">A receipt is issued when the session is done.</EmptyState></>)
  const q = state.request.quote
  const header = readDb().bookings.find((b) => b.id === id)!
  const isHost = user.host_account_id === header.host_account_id
  const proceeds = illustrativeHostProceeds(q.energy_subtotal_paise, POLICY.commission_bps)
  const row = (k: string, v: string, strong = false) => (
    <div className={`flex justify-between gap-4 py-1.5 ${strong ? 'text-base font-semibold' : 'text-sm'}`}>
      <span className={strong ? '' : 'text-muted'}>{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )
  return (
    <>
      <PageHeader back title="Demo receipt" subtitle={state.booking_ref} />
      <Page className="mx-auto max-w-xl">
        <Card className="relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-muted">Ampere · simulated session</div>
              <div className="mt-1 text-4xl font-light tracking-tight">{rupees(state.paid_paise || q.total_paise, { decimals: true })}</div>
            </div>
            <Chip tone="amber">Illustrative — not a tax invoice</Chip>
          </div>
          <div className="my-4 border-t border-dashed border-line" />
          {row('Site', state.request.site_name)}
          {row('Connector', `${CONNECTOR_LABEL[q.connector_standard]} ${q.charging_mode} · ${q.effective_power_kw} kW`)}
          {row('Session', `${istDateTime(state.session!.started_at)} → ${istDateTime(state.completed_at!)}`)}
          {row('Metering source', 'DEMO (simulated, not a meter reading)')}
          <div className="my-3 border-t border-line" />
          {row('Grid energy (billed)', kwh(state.completed.grid_wh, 3))}
          {row(`Estimated battery gain (×${POLICY.efficiency})`, kwh(state.completed.battery_gain_wh, 3))}
          {row('Estimated real charging time', minutes(q.duration_s))}
          <div className="my-3 border-t border-line" />
          {row(`Energy ${kwh(q.grid_wh, 3)} × ${rupees(q.energy_paise_per_kwh)}/kWh`, rupees(q.energy_subtotal_paise, { decimals: true }))}
          {row(q.plan === 'STANDARD' ? 'Standard booking fee' : 'Booking fee', rupees(q.booking_fee_paise, { decimals: true }))}
          {row('Tax', 'Illustrative — final treatment needs approval')}
          {row('Total', rupees(q.total_paise, { decimals: true }), true)}
          {row('Payment', state.payment === 'CAPTURED' ? 'Demo capture (no real money)' : state.payment)}
        </Card>
        {isHost ? (
          <Card className="mt-4">
            <div className="font-semibold">Your illustrative proceeds</div>
            {row('Energy line', rupees(q.energy_subtotal_paise, { decimals: true }))}
            {row(`Platform commission (${POLICY.commission_bps / 100}%, illustrative)`, `− ${rupees(proceeds.commission_paise, { decimals: true })}`)}
            {row('Pending illustrative proceeds', rupees(proceeds.host_paise, { decimals: true }), true)}
            <p className="mt-2 text-xs text-muted">Before your electricity, maintenance and tax costs. No payout is executed in the demo.</p>
          </Card>
        ) : null}
        <Notice className="mt-4">Demo receipt for a synthetic booking. In the pilot, billing uses approved meter evidence and a provider-approved tax configuration.</Notice>
      </Page>
    </>
  )
}
