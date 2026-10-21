import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { replay, type BookingEvent, type BookingState } from '../domain/booking'
import type { Result, User } from '../domain/types'
import { api } from '../server/api'
import { serverNow } from '../server/db'
import { currentUser, onSessionChange } from '../server/session'
import { subscribe } from '../server/storage'

/* ---------------- Session ---------------- */

export function useSession(): User | null {
  return useSyncExternalStore(onSessionChange, currentUser, currentUser)
}

/* ---------------- Data version ---------------- */

let version = 0
const versionListeners = new Set<() => void>()
subscribe((m) => {
  if (m.kind === 'db_changed' || m.kind === 'reset' || m.kind === 'booking_event') {
    version++
    versionListeners.forEach((l) => l())
  }
})
// Fallback for browsers without BroadcastChannel delivery: storage events from other tabs.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('ampere.v1')) {
      version++
      versionListeners.forEach((l) => l())
    }
  })

export function useDataVersion() {
  return useSyncExternalStore(
    (l) => {
      versionListeners.add(l)
      return () => versionListeners.delete(l)
    },
    () => version,
  )
}

/** Runs an API read and re-runs it whenever data changes in any tab. */
export function useQuery<T>(fn: () => Promise<Result<T>>, deps: unknown[] = []) {
  const v = useDataVersion()
  const [state, setState] = useState<{ data: T | null; error: { code: string; message: string } | null; loading: boolean }>({ data: null, error: null, loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let alive = true
    fnRef.current().then((r) => {
      if (!alive) return
      setState(r.ok ? { data: r.data, error: null, loading: false } : { data: null, error: r.error, loading: false })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, nonce, ...deps])
  return { ...state, refetch: useCallback(() => setNonce((n) => n + 1), []) }
}

/* ---------------- Clock ---------------- */

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(serverNow)
  const v = useDataVersion()
  useEffect(() => {
    setNow(serverNow())
    const t = setInterval(() => setNow(serverNow()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs, v])
  return now
}

/* ---------------- Realtime (per tab) ---------------- */

let realtimePaused = false
const rtListeners = new Set<() => void>()
export const realtime = {
  isPaused: () => realtimePaused,
  setPaused(p: boolean) {
    realtimePaused = p
    rtListeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    rtListeners.add(l)
    return () => rtListeners.delete(l)
  },
}

export function useRealtimePaused() {
  return useSyncExternalStore(realtime.subscribe, realtime.isPaused)
}

export type StreamStatus = 'loading' | 'live' | 'paused' | 'recovering' | 'error'

/**
 * Booking stream client: full replay from the database on load, then applies new
 * events from the live channel. Deduplicates by event_id, applies only contiguous
 * sequences, and fetches missing events on a gap, reconnect or tab resume.
 */
export function useBookingStream(bookingId: string | undefined) {
  const [events, setEvents] = useState<BookingEvent[]>([])
  const [status, setStatus] = useState<StreamStatus>('loading')
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [stats, setStats] = useState({ applied: 0, duplicates: 0, gaps: 0, replays: 0 })
  const eventsRef = useRef<BookingEvent[]>([])
  const paused = useRealtimePaused()

  const commit = (next: BookingEvent[]) => {
    eventsRef.current = next
    setEvents(next)
  }

  const fullReplay = useCallback(async () => {
    if (!bookingId) return
    setStatus('loading')
    const r = await api.getEvents(bookingId)
    if (!r.ok) {
      setError(r.error)
      setStatus('error')
      return
    }
    commit(r.data.events)
    setStats((s) => ({ ...s, replays: s.replays + 1 }))
    setError(null)
    setStatus(realtime.isPaused() ? 'paused' : 'live')
  }, [bookingId])

  const catchUp = useCallback(async () => {
    if (!bookingId) return
    const last = eventsRef.current.at(-1)?.sequence ?? 0
    setStatus('recovering')
    const r = await api.getEvents(bookingId, last)
    if (r.ok) {
      const known = new Set(eventsRef.current.map((e) => e.event_id))
      commit([...eventsRef.current, ...r.data.events.filter((e) => !known.has(e.event_id))].sort((a, b) => a.sequence - b.sequence))
    }
    setStatus(realtime.isPaused() ? 'paused' : 'live')
  }, [bookingId])

  useEffect(() => {
    eventsRef.current = []
    setEvents([])
    void fullReplay()
  }, [fullReplay])

  useEffect(() => {
    if (!bookingId) return
    return subscribe((m) => {
      if (m.kind === 'reset') return void fullReplay()
      if (m.kind !== 'booking_event' || m.booking_id !== bookingId || realtime.isPaused()) return
      const e = m.event as BookingEvent
      const cur = eventsRef.current
      if (cur.some((x) => x.event_id === e.event_id)) {
        setStats((s) => ({ ...s, duplicates: s.duplicates + 1 }))
        return
      }
      const last = cur.at(-1)?.sequence ?? 0
      if (e.sequence === last + 1) {
        commit([...cur, e])
        setStats((s) => ({ ...s, applied: s.applied + 1 }))
      } else if (e.sequence > last + 1) {
        setStats((s) => ({ ...s, gaps: s.gaps + 1 }))
        void catchUp()
      }
    })
  }, [bookingId, fullReplay, catchUp])

  // Reconnect after a simulated disconnect: fetch whatever was missed.
  useEffect(() => {
    if (paused) setStatus('paused')
    else if (eventsRef.current.length) void catchUp()
  }, [paused, catchUp])

  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && void catchUp()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [catchUp])

  let state: BookingState | null = null
  let replayError: string | null = null
  try {
    state = events.length ? replay(events) : null
  } catch (e) {
    replayError = e instanceof Error ? e.message : 'Unsupported stream'
  }
  return { events, state, status, error: error ?? (replayError ? { code: 'UNSUPPORTED_STREAM', message: replayError } : null), stats, fullReplay, catchUp }
}

/* ---------------- PWA install ---------------- */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const installListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    installListeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installListeners.forEach((l) => l())
  })
}

export function useInstall() {
  const available = useSyncExternalStore(
    (l) => {
      installListeners.add(l)
      return () => installListeners.delete(l)
    },
    () => !!deferred,
  )
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  const install = async () => {
    if (!deferred) return false
    await deferred.prompt()
    const r = await deferred.userChoice
    deferred = null
    installListeners.forEach((l) => l())
    return r.outcome === 'accepted'
  }
  return { available, standalone, ios, install }
}

/* ---------------- Misc ---------------- */

export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (l) => {
      const m = window.matchMedia(q)
      m.addEventListener('change', l)
      return () => m.removeEventListener('change', l)
    },
    () => window.matchMedia(q).matches,
  )
}
