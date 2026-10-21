import { ArrowRight, Download, MonitorSmartphone } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useInstall } from '../app/hooks'
import { USERS } from '../domain/catalogue'
import { Avatar, homePath, Logo } from '../components/Shell'
import { Button, Chip, Notice } from '../components/ui'
import { signIn } from '../server/session'

export default function SignIn() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { available, install, standalone, ios } = useInstall()
  const choose = (id: string) => {
    signIn(id)
    const u = USERS.find((x) => x.id === id)!
    const next = params.get('next')
    nav(next && next !== '/' ? next : homePath(u), { replace: true })
  }
  return (
    <div className="pt-safe pb-safe mx-auto min-h-dvh max-w-2xl px-4 py-8 sm:px-6 lg:py-16">
      <Logo />
      <h1 className="mt-10 text-4xl font-light tracking-tight sm:text-5xl">Choose a demo account</h1>
      <p className="mt-3 text-ink-2">
        This is a front-end demo: accounts, chargers, bookings, payments and charging are simulated and stored in this browser. Each tab keeps its own sign-in — open a host in a second tab and watch bookings update live.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {USERS.map((u) => (
          <li key={u.id}>
            <button onClick={() => choose(u.id)} className="group flex w-full items-center gap-3 rounded-[24px] bg-surface p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-float">
              <Avatar user={u} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{u.display_name}</div>
                <div className="truncate text-sm text-muted">{u.blurb}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {u.capabilities.map((c) => (
                    <Chip key={c} tone={c === 'JURY' ? 'night' : c === 'HOST' ? 'volt' : c === 'ADMIN' ? 'amber' : 'neutral'} className="!py-0.5 text-[10px]">
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
              <ArrowRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </button>
          </li>
        ))}
      </ul>
      <Notice className="mt-6" icon={<MonitorSmartphone className="size-4" />} title="Two-user demo">
        Sign in as <b>Aarav</b> here, open a new tab as <b>Rohan</b> (café host). Requests, confirmations and charging progress appear in both tabs without refreshing.
      </Notice>
      {!standalone ? (
        <div className="mt-4">
          {available ? (
            <Button variant="secondary" onClick={install}>
              <Download className="size-4" /> Install Ampere
            </Button>
          ) : ios ? (
            <p className="text-sm text-muted">Install on iPhone: tap Share → “Add to Home Screen”.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
