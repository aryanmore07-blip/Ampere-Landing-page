/** Formatting helpers. Money stays integer paise until display. */

export function rupees(paise: number, opts: { decimals?: boolean } = {}) {
  const value = paise / 100
  const decimals = opts.decimals ?? paise % 100 !== 0
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })
}

export function kwh(wh: number, digits = 1) {
  return (wh / 1000).toFixed(digits) + ' kWh'
}

export function km(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

export function minutes(seconds: number) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

const IST_OFFSET_MS = 330 * 60_000

/** Formats an instant in Asia/Kolkata. */
export function istTime(iso: string | number) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
}

export function istDateTime(iso: string | number) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
}

export function istDayLabel(iso: string | number, now: number) {
  const day = (t: number) => Math.floor((t + IST_OFFSET_MS) / 86_400_000)
  const d = day(new Date(iso).getTime()) - day(now)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

/** ISO 8601 with the +05:30 offset, used at the console boundary. */
export function isoIst(t: number) {
  const d = new Date(t + IST_OFFSET_MS)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+05:30`
}

export function relativeAge(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
