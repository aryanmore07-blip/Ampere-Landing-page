export function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function bookingRef() {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return 'AMP-' + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function requestId() {
  return 'req_' + uuid().slice(0, 8)
}

export function arrivalCode() {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}
