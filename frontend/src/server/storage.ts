/*
 * Browser storage layer standing in for the database. All tabs of the app share
 * localStorage; Web Locks serialise writers across tabs (resource → booking → db
 * lock order, as in the spec); BroadcastChannel carries new events to other tabs
 * like a Realtime subscription.
 */

const memory = new Map<string, string>()

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function kvGet<T>(key: string): T | null {
  try {
    const raw = ls()?.getItem(key) ?? memory.get(key) ?? null
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function kvSet(key: string, value: unknown) {
  const raw = JSON.stringify(value)
  memory.set(key, raw)
  try {
    ls()?.setItem(key, raw)
  } catch {
    /* quota or privacy mode: memory copy keeps this tab working */
  }
}

export function kvKeys(prefix: string): string[] {
  const keys = new Set<string>()
  const s = ls()
  if (s) for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (k?.startsWith(prefix)) keys.add(k)
  }
  for (const k of memory.keys()) if (k.startsWith(prefix)) keys.add(k)
  return [...keys]
}

export function kvRemove(key: string) {
  memory.delete(key)
  try {
    ls()?.removeItem(key)
  } catch {
    /* ignore */
  }
}

/* ---------------- Locks ---------------- */

const localChains = new Map<string, Promise<unknown>>()

function localLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = localChains.get(name) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  localChains.set(name, run.catch(() => undefined))
  return run
}

/** Acquires named locks in the given order, then runs fn. Cross-tab via Web Locks when available. */
export async function withLocks<T>(names: string[], fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null
  const acquire = (i: number): Promise<T> => {
    if (i >= names.length) return fn()
    const name = 'ampere:' + names[i]
    return locks ? (locks.request(name, () => acquire(i + 1)) as Promise<T>) : localLock(name, () => acquire(i + 1))
  }
  return acquire(0)
}

/* ---------------- Realtime ---------------- */

export type RealtimeMessage = { kind: 'booking_event'; booking_id: string; event: unknown } | { kind: 'db_changed' } | { kind: 'reset' }

type Listener = (m: RealtimeMessage) => void
const listeners = new Set<Listener>()
let channel: BroadcastChannel | null = null

function getChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return channel
  channel = new BroadcastChannel('ampere-realtime')
  channel.onmessage = (ev) => listeners.forEach((l) => l(ev.data as RealtimeMessage))
  return channel
}

export function publish(m: RealtimeMessage) {
  getChannel()?.postMessage(m)
  // BroadcastChannel does not echo to the sender; deliver locally too.
  queueMicrotask(() => listeners.forEach((l) => l(m)))
}

export function subscribe(l: Listener) {
  getChannel()
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
