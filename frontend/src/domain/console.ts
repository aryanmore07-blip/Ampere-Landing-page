import { CONNECTOR_ALIASES, VEHICLE_MODELS } from './catalogue'
import type { ConnectorStandard, VehicleModel } from './types'

export type ParsedCommand =
  | { kind: 'TICKET'; model: VehicleModel; modelInput: string; soc: number; lat: number; lng: number; connector: ConnectorStandard }
  | { kind: 'READY'; ref: string; reportedAt: string; reportedInput: string; assumedTimezone: boolean }
  | { kind: 'HELP' }
  | { kind: 'CLEAR' }

export interface ParseError {
  code: string
  message: string
}

const num = (s: string) => (/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(s) ? Number(s) : NaN)

export function resolveModel(input: string): VehicleModel | ParseError {
  const q = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q) return { code: 'EMPTY_FIELD', message: 'Car model is empty.' }
  const exact = VEHICLE_MODELS.filter((m) => m.aliases.includes(q))
  if (exact.length === 1) return exact[0]
  const partial = VEHICLE_MODELS.filter((m) => m.aliases.some((a) => a.startsWith(q)) || `${m.make} ${m.model}`.toLowerCase() === q)
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) return { code: 'AMBIGUOUS_MODEL', message: `“${input.trim()}” matches ${partial.map((m) => `${m.make} ${m.model}`).join(', ')}. Be more specific.` }
  return { code: 'UNKNOWN_MODEL', message: `Unknown car model “${input.trim()}”. Known: ${VEHICLE_MODELS.map((m) => `${m.make} ${m.model}`).join(', ')}.` }
}

export function resolveConnector(input: string): ConnectorStandard | null {
  const key = input.trim().toUpperCase().replace(/\s+/g, ' ')
  return CONNECTOR_ALIASES[key] ?? CONNECTOR_ALIASES[key.replace(/[\s-]/g, '')] ?? null
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/

/** Strict ISO 8601 datetime. Missing offset → Asia/Kolkata (+05:30), reported back to the user. */
export function parseIsoTime(input: string): { iso: string; assumedTimezone: boolean } | ParseError {
  const m = ISO.exec(input.trim())
  if (!m) return { code: 'INVALID_TIME', message: 'Time must be a full ISO 8601 datetime, e.g. 2026-10-22T10:30:00+05:30.' }
  const [, y, mo, d, h, mi, s = '00', frac = '', tz] = m
  const Y = +y, M = +mo, D = +d, H = +h, MI = +mi, S = +s
  const probe = new Date(Date.UTC(Y, M - 1, D, H, MI, S))
  if (probe.getUTCFullYear() !== Y || probe.getUTCMonth() !== M - 1 || probe.getUTCDate() !== D || H > 23 || MI > 59 || S > 59)
    return { code: 'INVALID_TIME', message: `“${input.trim()}” is not a valid calendar date and time.` }
  let offsetMin = 330
  if (tz && tz !== 'Z') {
    const sign = tz[0] === '-' ? -1 : 1
    const [oh, om] = tz.slice(1).split(':').map(Number)
    if (oh > 14 || om > 59) return { code: 'INVALID_TIME', message: 'Invalid timezone offset.' }
    offsetMin = sign * (oh * 60 + om)
  } else if (tz === 'Z') offsetMin = 0
  const ms = probe.getTime() - offsetMin * 60_000 + (frac ? Math.round(Number('0' + frac) * 1000) : 0)
  return { iso: new Date(ms).toISOString(), assumedTimezone: !tz }
}

export function parseCommand(line: string): ParsedCommand | ParseError {
  const raw = line.trim()
  if (!raw) return { code: 'EMPTY_COMMAND', message: 'Type a command.' }
  const upper = raw.toUpperCase()
  if (upper === 'HELP' || upper === '?') return { kind: 'HELP' }
  if (upper === 'CLEAR') return { kind: 'CLEAR' }
  const parts = raw.split('|').map((p) => p.trim())
  const cmd = parts[0].toUpperCase()
  if (cmd === 'TICKET') {
    if (parts.length !== 6) return { code: 'INVALID_FIELDS', message: `TICKET needs exactly 6 pipe-separated fields, got ${parts.length}. Format: TICKET|<car model>|<battery percent>|<lat>|<lon>|<connector>` }
    const empty = parts.findIndex((p) => p === '')
    if (empty >= 0) return { code: 'EMPTY_FIELD', message: `Field ${empty + 1} is empty.` }
    const model = resolveModel(parts[1])
    if ('code' in model) return model
    const soc = num(parts[2].replace(/%$/, ''))
    if (!Number.isFinite(soc) || soc < 0 || soc > 100) return { code: 'INVALID_BATTERY', message: 'Battery percent must be a number from 0 to 100.' }
    const lat = num(parts[3])
    const lng = num(parts[4])
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { code: 'INVALID_COORDINATES', message: 'Latitude must be a number from -90 to 90.' }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { code: 'INVALID_COORDINATES', message: 'Longitude must be a number from -180 to 180.' }
    const connector = resolveConnector(parts[5])
    if (!connector) return { code: 'UNKNOWN_CONNECTOR', message: `Unknown connector “${parts[5]}”. Use CCS2, Type 2, Bharat AC-001 or CHAdeMO.` }
    return { kind: 'TICKET', model, modelInput: parts[1], soc, lat, lng, connector }
  }
  if (cmd === 'READY') {
    if (parts.length !== 3) return { code: 'INVALID_FIELDS', message: `READY needs exactly 3 pipe-separated fields, got ${parts.length}. Format: READY|<booking ref>|<ISO time>` }
    if (!parts[1]) return { code: 'EMPTY_FIELD', message: 'Booking reference is empty.' }
    if (!parts[2]) return { code: 'EMPTY_FIELD', message: 'ISO time is empty.' }
    const t = parseIsoTime(parts[2])
    if ('code' in t) return t
    return { kind: 'READY', ref: parts[1].toUpperCase(), reportedAt: t.iso, reportedInput: parts[2], assumedTimezone: t.assumedTimezone }
  }
  return { code: 'UNKNOWN_COMMAND', message: `Unknown command “${parts[0]}”. Use TICKET, READY, HELP or CLEAR.` }
}
