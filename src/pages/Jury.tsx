import { Copy, CornerDownLeft, ExternalLink, Map as MapIcon, RefreshCw, Terminal } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBookingStream, useNow, useSession } from '../app/hooks'
import { EventLog, LifecycleChip, LifecycleTracker, OutcomeNotice } from '../components/booking'
import { Logo } from '../components/Shell'
import { Button, useToast } from '../components/ui'
import { cn } from '../lib/cn'
import { isoIst } from '../lib/format'
import { uuid } from '../lib/ids'
import { api } from '../server/api'
import { HELP_LINES, type ConsoleLine } from '../server/jury'

interface Entry {
  id: string
  input: string
  lines: ConsoleLine[]
  pending?: boolean
}

const EXAMPLE = 'TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2'

export default function Jury() {
  const user = useSession()!
  const now = useNow(1000)
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const bookingId = params.get('booking') ?? undefined
  const [entries, setEntries] = useState<Entry[]>([{ id: 'help', input: 'HELP', lines: HELP_LINES }])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const [next, setNext] = useState<string | null>(null)
  const [mapLink, setMapLink] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stream = useBookingStream(bookingId)

  // Dark page: paint the whole document, not just this subtree.
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = 'var(--color-night)'
    return () => {
      document.body.style.background = prev
    }
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [entries])

  // Keep the copyable READY line pointed at the current server time.
  const readyLine = stream.state && stream.state.lifecycle === 'requested' && !stream.state.ended ? `READY|${stream.state.booking_ref}|${isoIst(now)}` : next

  const runLines = async (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setRunning(true)
    for (const line of lines) {
      if (line.toUpperCase() === 'CLEAR') {
        setEntries([])
        continue
      }
      const id = uuid()
      setEntries((e) => [...e, { id, input: line, lines: [], pending: true }])
      const res = await api.juryCommand(line, id)
      setEntries((e) => e.map((x) => (x.id === id ? { ...x, lines: res.lines, pending: false } : x)))
      if (res.booking_id) {
        const p = new URLSearchParams(params)
        p.set('booking', res.booking_id)
        setParams(p, { replace: true })
      }
      if (res.next_command) setNext(res.next_command)
      if (res.map_link) setMapLink(res.map_link)
    }
    setHistory((h) => [...lines.reverse(), ...h].slice(0, 30))
    setHIdx(-1)
    setRunning(false)
  }

  const submit = () => {
    const t = input
    setInput('')
    void runLines(t)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    } else if (e.key === 'ArrowUp' && !input.includes('\n')) {
      e.preventDefault()
      const i = Math.min(hIdx + 1, history.length - 1)
      if (history[i]) {
        setHIdx(i)
        setInput(history[i])
      }
    } else if (e.key === 'ArrowDown' && !input.includes('\n')) {
      e.preventDefault()
      const i = hIdx - 1
      setHIdx(Math.max(-1, i))
      setInput(i >= 0 ? history[i] : '')
    }
  }

  const copy = (t: string) => {
    void navigator.clipboard?.writeText(t)
    toast({ tone: 'info', text: 'Copied', detail: t })
  }

  const notJury = !user.capabilities.includes('JURY')

  return (
    <div className="min-h-dvh text-white">
      <div className="pt-safe mx-auto max-w-6xl px-4 pb-36 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-night-3">
              <Terminal className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Jury console</h1>
              <div className="font-mono text-xs text-white/50">server {isoIst(now)}</div>
            </div>
          </div>
          <div className="hidden sm:block">
            <Logo dark />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-night-3 px-2.5 py-1 text-xs font-semibold text-white/80">Signed in: {user.display_name}</span>
          <span className="rounded-full bg-night-3 px-2.5 py-1 text-xs font-semibold text-white/80">Same services as the app</span>
          <span className="rounded-full bg-amber/20 px-2.5 py-1 text-xs font-semibold text-amber">Demo · simulated booking</span>
        </div>
        {notJury ? <div className="mt-3 rounded-2xl bg-amber/15 p-3 text-sm text-amber">This account has no jury capability: TICKET works as a driver request; READY only works for bookings at your own chargers.</div> : null}

        <div className="mt-5 lg:grid lg:grid-cols-[1.25fr_1fr] lg:gap-6">
          {/* Terminal */}
          <div className="overflow-hidden rounded-[24px] bg-black/60 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-xs text-white/40">ampere://jury</span>
            </div>
            <div ref={scroller} className="h-[46dvh] overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed sm:h-[52dvh] lg:h-[60dvh]" role="log" aria-live="polite">
              {entries.map((e) => (
                <div key={e.id} className="mb-3">
                  <div className="whitespace-pre-wrap break-all text-white">
                    <span className="text-volt">›</span> {e.input}
                  </div>
                  {e.pending ? <div className="text-white/40">…</div> : null}
                  {e.lines.map((l, i) => (
                    <div key={i} className={cn('whitespace-pre-wrap break-words', l.tone === 'err' ? 'text-[#ff8a75]' : l.tone === 'ok' ? 'text-[#9fd38a]' : l.tone === 'dim' ? 'text-white/40' : l.tone === 'accent' ? 'font-semibold text-[#f2c879]' : 'text-white/85')}>
                      {l.text}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 focus-within:ring-volt">
                <span className="pb-2 pl-1 font-mono text-volt">›</span>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  rows={Math.min(5, Math.max(1, input.split('\n').length))}
                  placeholder="TICKET|<car model>|<battery %>|<lat>|<lon>|<connector>"
                  aria-label="Console command"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="min-h-9 flex-1 resize-none bg-transparent py-2 font-mono text-[13px] text-white outline-none placeholder:text-white/30"
                />
                <Button size="sm" className="!bg-white !text-ink" disabled={!input.trim() || running} loading={running} onClick={submit} aria-label="Run">
                  <CornerDownLeft className="size-4" />
                </Button>
              </div>
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                <button className="h-8 shrink-0 rounded-full bg-white/10 px-3 font-mono text-[11px] text-white/80 hover:bg-white/15" onClick={() => (setInput(EXAMPLE), inputRef.current?.focus())}>
                  Example TICKET
                </button>
                {readyLine ? (
                  <button className="h-8 shrink-0 rounded-full bg-[#f2c879]/15 px-3 font-mono text-[11px] text-[#f2c879] hover:bg-[#f2c879]/25" onClick={() => (setInput(readyLine), inputRef.current?.focus())}>
                    Insert {readyLine.slice(0, 22)}…
                  </button>
                ) : null}
                {readyLine ? (
                  <button className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 text-[11px] text-white/80" onClick={() => copy(readyLine)}>
                    <Copy className="size-3" /> Copy READY
                  </button>
                ) : null}
                <button className="h-8 shrink-0 rounded-full bg-white/10 px-3 font-mono text-[11px] text-white/80" onClick={() => void runLines('HELP')}>
                  HELP
                </button>
                <button className="h-8 shrink-0 rounded-full bg-white/10 px-3 font-mono text-[11px] text-white/80" onClick={() => setEntries([])}>
                  CLEAR
                </button>
              </div>
              <p className="mt-2 text-[11px] text-white/35">Enter runs · Shift+Enter new line · paste several lines to run them in order · ↑ history. Input is parsed as plain text only.</p>
            </div>
          </div>

          {/* Persisted booking panel */}
          <div className="mt-5 lg:mt-0">
            <div className="rounded-[24px] bg-surface p-4 text-ink">
              {!bookingId ? (
                <div className="py-6 text-center text-sm text-muted">
                  Run a TICKET. The booking it creates appears here, loaded from the database by its reference in the URL — reload the page to prove it is restored by replay.
                </div>
              ) : stream.error ? (
                <div className="text-sm text-danger">{stream.error.message}</div>
              ) : stream.state ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-lg font-semibold">{stream.state.booking_ref}</div>
                      <div className="text-xs text-muted">{stream.state.request.site_name}</div>
                    </div>
                    <LifecycleChip state={stream.state} />
                  </div>
                  <div className="mt-4">
                    <LifecycleTracker state={stream.state} />
                  </div>
                  <div className="mt-3">
                    <OutcomeNotice state={stream.state} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void stream.fullReplay()}>
                      <RefreshCw className="size-3.5" /> Replay from DB
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                      Hard refresh
                    </Button>
                    <Link to={`/booking/${bookingId}`}>
                      <Button size="sm" variant="secondary">
                        <ExternalLink className="size-3.5" /> Open in app
                      </Button>
                    </Link>
                    {mapLink ? (
                      <Link to={mapLink}>
                        <Button size="sm" variant="secondary">
                          <MapIcon className="size-3.5" /> Same search on map
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-5 text-sm font-semibold text-ink-2">Event history (from the database)</div>
                  <EventLog className="mt-3" events={stream.events} />
                  <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-xs text-muted">
                    Lifecycle “{stream.state.lifecycle.replace('_', ' ')}” is derived by replaying {stream.events.length} ordered events. The host’s Confirm button and READY append the same HostConfirmed event; the driver still pays and departs in the normal app.
                  </p>
                </>
              ) : (
                <div className="py-6 text-center text-sm text-muted">Loading stream…</div>
              )}
            </div>
            <div className="mt-4 rounded-[24px] bg-night-2 p-4 text-sm text-white/70">
              <div className="font-semibold text-white">Fixture notes</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>At 4% from 18.5362, 73.8939 the budget is 4.0 km: Ember & Ohm Café (1.8 km, CCS2) is inside; Aundh Works Campus (11.2 km, CCS2) is hidden; Lane 7 Cowork (Bharat AC-001, 1.1 km) is hidden.</li>
                <li>Try 10% to reveal Aundh, a Hinjewadi origin (18.5913, 73.7389) for NO_MATCH, or “Tata” for an ambiguous model.</li>
                <li>All listings are synthetic and labelled demo — not verified real-world chargers.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
