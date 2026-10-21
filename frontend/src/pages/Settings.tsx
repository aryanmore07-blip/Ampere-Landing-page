import { Download, FastForward, LogOut, RotateCcw, Route, Terminal, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { realtime, useInstall, useNow, useQuery, useRealtimePaused, useSession } from '../app/hooks'
import { Avatar } from '../components/Shell'
import { Page, PageHeader } from '../components/Shell'
import { Button, Card, Chip, Notice, SectionTitle, Segmented, Sheet, useAction } from '../components/ui'
import { isoIst } from '../lib/format'
import { api } from '../server/api'
import { readDb } from '../server/db'
import { signOut } from '../server/session'

export default function Settings() {
  const user = useSession()!
  const nav = useNavigate()
  const now = useNow(1000)
  const paused = useRealtimePaused()
  const { run, busy } = useAction()
  const { available, install, standalone, ios } = useInstall()
  const [resetOpen, setResetOpen] = useState(false)
  const db = useQuery(async () => ({ ok: true as const, data: readDb(), request_id: '' }))
  const offset = db.data?.clock_offset_ms ?? 0
  const provider = db.data?.settings.route_provider ?? 'DEMO'

  return (
    <>
      <PageHeader back title="Settings & demo" />
      <Page className="mx-auto max-w-2xl">
        <Card className="flex items-center gap-3">
          <Avatar user={user} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{user.display_name}</div>
            <div className="truncate text-sm text-muted">{user.email}</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => nav('/signin')}>
            Switch
          </Button>
        </Card>

        <SectionTitle>App</SectionTitle>
        <Card className="space-y-3">
          {standalone ? (
            <div className="text-sm text-muted">Installed — running as an app.</div>
          ) : available ? (
            <Button className="w-full" onClick={install}>
              <Download className="size-4" /> Install Ampere
            </Button>
          ) : (
            <div className="text-sm text-muted">{ios ? 'On iPhone: tap Share → “Add to Home Screen”.' : 'Use your browser menu → “Install app” / “Add to Home screen”.'} Works offline for browsing fixtures; live multi-user booking needs this browser’s shared storage.</div>
          )}
          {user.capabilities.includes('JURY') || user.capabilities.includes('ADMIN') ? null : (
            <Link to="/jury" className="flex items-center gap-2 text-sm font-semibold">
              <Terminal className="size-4" /> Open the jury console
            </Link>
          )}
        </Card>

        <SectionTitle>Demo controls</SectionTitle>
        <Card className="space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Server clock</div>
              {offset ? <Chip tone="amber">+{Math.round(offset / 60000)} min</Chip> : <Chip>real time</Chip>}
            </div>
            <div className="mt-1 font-mono text-sm text-muted">{isoIst(now)}</div>
            <p className="mt-1 text-xs text-muted">Injected demo clock, shared by every tab. Deadlines, expiry and arrival windows all use it — never the device clock.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 5, 15, 60].map((m) => (
                <Button key={m} size="sm" variant="secondary" onClick={() => run('c', () => api.advanceClock(m * 60_000), `Clock +${m} min`)}>
                  <FastForward className="size-3.5" /> +{m} min
                </Button>
              ))}
              <Button size="sm" variant="ghost" disabled={!offset} onClick={() => run('c', () => api.advanceClock(0), 'Clock back to real time')}>
                Reset clock
              </Button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Live updates (this tab)</div>
              <Chip tone={paused ? 'amber' : 'volt'} icon={paused ? <WifiOff className="size-3" /> : <Wifi className="size-3" />}>
                {paused ? 'disconnected' : 'connected'}
              </Chip>
            </div>
            <p className="mt-1 text-xs text-muted">Simulate a dropped connection. On reconnect, open bookings fetch the events they missed and replay them in sequence.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => realtime.setPaused(!paused)}>
              {paused ? 'Reconnect' : 'Disconnect'}
            </Button>
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Route className="size-4" /> Route evidence away from the demo origin
            </div>
            <Segmented
              className="mt-2"
              size="sm"
              value={provider}
              onChange={(v) => run('r', () => api.setRouteProvider(v), v === 'OSRM' ? 'Using live OSRM demo routing' : 'Using labelled demo estimates')}
              options={[
                { value: 'DEMO', label: 'Labelled demo estimate' },
                { value: 'OSRM', label: 'Live OSRM (public demo)' },
              ]}
            />
            <p className="mt-2 text-xs text-muted">The demo origin always uses seeded road distances so jury results are reproducible. OSRM’s public server has no SLA; failures fall back to the labelled estimate.</p>
          </div>
          <div>
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              <RotateCcw className="size-4" /> Reset demo data
            </Button>
          </div>
        </Card>

        <SectionTitle>What’s simulated</SectionTitle>
        <Notice>
          This build runs entirely in your browser — the “server”, database and realtime channel are simulated with local storage, cross-tab locks and a broadcast channel. Listings are synthetic; payments, refunds, metering, receipts and payouts are demo-only; tariffs (₹14/kWh, ₹20 Standard fee) are illustrative, not approved tariffs or tax treatment. Range estimates are disclosed assumptions, not guarantees.
        </Notice>

        <Button variant="secondary" className="mt-6 w-full" onClick={() => (signOut(), nav('/signin'))}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </Page>
      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Reset demo data?">
        <p className="text-sm text-ink-2">Deletes every booking stream, quote and listing change in this browser and re-seeds the synthetic catalogue. Other open tabs reload their streams. This only works in the isolated demo environment.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            Keep data
          </Button>
          <Button variant="danger" loading={busy === 'reset'} onClick={async () => (await run('reset', () => api.resetDemo(), 'Demo data reset')) !== null && setResetOpen(false)}>
            Reset
          </Button>
        </div>
      </Sheet>
    </>
  )
}
