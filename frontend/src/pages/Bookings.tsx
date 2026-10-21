import { CalendarDays, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNow, useQuery, useSession } from '../app/hooks'
import { LifecycleChip, LifecycleTracker } from '../components/booking'
import { Page, PageHeader } from '../components/Shell'
import { Card, Chip, EmptyState, Segmented, Skeleton } from '../components/ui'
import { OUTCOME_LABEL } from '../domain/booking'
import { userById } from '../domain/catalogue'
import { istDayLabel, istTime, rupees } from '../lib/format'
import { api } from '../server/api'

export default function Bookings() {
  const user = useSession()!
  const now = useNow(10000)
  const caps = user.capabilities
  const scopes: { value: 'driver' | 'host' | 'all'; label: string }[] = [
    ...(caps.includes('DRIVER') ? [{ value: 'driver' as const, label: 'My trips' }] : []),
    ...(caps.includes('HOST') ? [{ value: 'host' as const, label: 'At my chargers' }] : []),
    ...(caps.includes('ADMIN') || caps.includes('JURY') ? [{ value: 'all' as const, label: 'All demo bookings' }] : []),
  ]
  const [scope, setScope] = useState(scopes[scopes.length > 1 && caps.includes('JURY') ? scopes.length - 1 : 0].value)
  const q = useQuery(() => api.listBookings(scope), [scope])
  const rows = q.data ?? []
  const active = rows.filter((r) => !r.state.ended)
  const past = rows.filter((r) => r.state.ended)
  return (
    <>
      <PageHeader user={user} title="Bookings" />
      <Page>
        {scopes.length > 1 ? <Segmented className="mb-4 max-w-md" size="sm" value={scope} onChange={setScope} options={scopes} /> : null}
        {q.loading && !q.data ? (
          <Skeleton className="h-32" />
        ) : !rows.length ? (
          <EmptyState icon={<CalendarDays className="size-6" />} title="No bookings yet" action={<Link to="/discover" className="font-semibold underline">Find a charger</Link>} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              ['In progress', active],
              ['Past', past],
            ].map(([label, list]) =>
              (list as typeof rows).length ? (
                <section key={label as string}>
                  <h2 className="mb-3 text-[17px] font-semibold text-ink-2">{label as string}</h2>
                  <div className="space-y-3">
                    {(list as typeof rows).map(({ header, state }) => (
                      <Link key={header.id} to={`/booking/${header.id}`} className="block">
                        <Card className="transition hover:shadow-float">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold">{header.booking_ref}</span>
                                {state.source === 'JURY_CONSOLE' ? <Chip tone="outline" className="!py-0 text-[10px]">console</Chip> : null}
                              </div>
                              <div className="mt-0.5 truncate font-semibold">{state.request.site_name}</div>
                              <div className="text-xs text-muted">
                                {istDayLabel(state.request.start_at, now)} {istTime(state.request.start_at)}–{istTime(state.request.end_at)} · {rupees(state.request.quote.total_paise)}
                                {scope !== 'driver' ? ` · ${userById(header.driver_id)?.display_name}` : ''}
                              </div>
                            </div>
                            <LifecycleChip state={state} />
                            <ChevronRight className="mt-1 size-4 text-muted" />
                          </div>
                          <div className="mt-3">
                            <LifecycleTracker state={state} compact />
                          </div>
                          {state.outcome ? <div className="mt-2 text-xs font-semibold text-muted">{OUTCOME_LABEL[state.outcome]}</div> : null}
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>
        )}
      </Page>
    </>
  )
}
