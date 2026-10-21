import { userById } from '../domain/catalogue'
import type { User } from '../domain/types'

/*
 * Simulated authentication. Each browser tab keeps its own signed-in account in
 * sessionStorage, so a driver tab and a host tab can run side by side. The last
 * account is remembered for convenience when a fresh tab opens.
 */
const TAB_KEY = 'ampere.session'
const LAST_KEY = 'ampere.lastUser'
type L = () => void
const listeners = new Set<L>()

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function currentUser(): User | null {
  const id = safe(() => sessionStorage.getItem(TAB_KEY), null) ?? safe(() => localStorage.getItem(LAST_KEY), null)
  return id ? (userById(id) ?? null) : null
}

export function signIn(userId: string) {
  safe(() => sessionStorage.setItem(TAB_KEY, userId), undefined)
  safe(() => localStorage.setItem(LAST_KEY, userId), undefined)
  listeners.forEach((l) => l())
}

export function signOut() {
  safe(() => sessionStorage.removeItem(TAB_KEY), undefined)
  safe(() => localStorage.removeItem(LAST_KEY), undefined)
  listeners.forEach((l) => l())
}

export function onSessionChange(l: L) {
  listeners.add(l)
  return () => listeners.delete(l)
}
