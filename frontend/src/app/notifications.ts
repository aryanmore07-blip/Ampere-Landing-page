import { useMemo } from 'react'
import type { BookingEvent } from '../domain/booking'
import type { User } from '../domain/types'
import { readDb } from '../server/db'
import { readStream } from '../server/eventStore'
import { rupees } from '../lib/format'
import { useDataVersion } from './hooks'

export interface Notice {
  event: BookingEvent
  booking_ref: string
  booking_id: string
  title: string
  body: string
  unread: boolean
}

function describe(e: BookingEvent, asHost: boolean, ref: string, site: string): { title: string; body: string } | null {
  switch (e.event_type) {
    case 'BookingRequested':
      return asHost ? { title: 'New request', body: `${ref} at ${site}. Respond within 2 minutes.` } : { title: 'Request sent', body: `${ref} — waiting for the host. Don’t travel yet.` }
    case 'HostConfirmed':
      return asHost ? { title: 'You confirmed', body: `${ref} — waiting for driver checkout.` } : { title: 'Host confirmed', body: `${ref} — complete checkout within 5 minutes.` }
    case 'HostDeclined':
      return { title: 'Request declined', body: `${ref} — the slot is released. Choose an alternative.` }
    case 'HoldExpired':
      return { title: 'Hold expired', body: `${ref} — ${(e.payload as { phase: string }).phase === 'CHECKOUT' ? 'checkout window closed' : 'no host response in time'}. No charge.` }
    case 'PaymentCaptured':
      return { title: 'Demo payment captured', body: `${ref} — ${rupees((e.payload as { amount_paise: number }).amount_paise)} (simulated).` }
    case 'PaymentFailed':
      return { title: 'Demo payment failed', body: `${ref} — retry while the hold is live.` }
    case 'DriverDeparted':
      return asHost ? { title: 'Driver on the way', body: `${ref} to ${site}.` } : { title: 'On the way', body: `${ref} — arrival details unlocked.` }
    case 'ArrivalVerified':
      return { title: 'Arrival verified', body: `${ref} — code matched.` }
    case 'ChargingStarted':
      return { title: 'Charging started', body: `${ref} — simulated session.` }
    case 'ChargingCompleted':
      return { title: 'Charging done', body: `${ref} — demo receipt ready.` }
    case 'BookingCancelled':
      return { title: 'Booking cancelled', body: `${ref} — ${(e.payload as { reason: string }).reason}.` }
    default:
      return null
  }
}

export function useNotifications(user: User | null) {
  const v = useDataVersion()
  return useMemo(() => {
    if (!user) return { items: [] as Notice[], unread: 0 }
    const db = readDb()
    const read = new Set(db.notif_read[user.id] ?? [])
    const items: Notice[] = []
    for (const h of db.bookings) {
      const asDriver = h.driver_id === user.id
      const asHost = !!user.host_account_id && h.host_account_id === user.host_account_id
      if (!asDriver && !asHost) continue
      const site = db.sites.find((s) => s.id === h.site_id)?.name ?? 'charger'
      for (const e of readStream(h.id)) {
        const d = describe(e, asHost && !asDriver, h.booking_ref, site)
        if (!d) continue
        items.push({ event: e, booking_ref: h.booking_ref, booking_id: h.id, ...d, unread: !read.has(e.event_id) && e.actor_id !== user.id })
      }
    }
    items.sort((a, b) => Date.parse(b.event.recorded_at) - Date.parse(a.event.recorded_at))
    const top = items.slice(0, 60)
    return { items: top, unread: top.filter((n) => n.unread).length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, v])
}
