/** Asia/Kolkata has no DST, so a fixed +05:30 offset is exact. */
export const IST_OFFSET_MIN = 330

export function istParts(t: number) {
  const d = new Date(t + IST_OFFSET_MIN * 60_000)
  return { weekday: d.getUTCDay(), minuteOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(), dayStart: t - ((t + IST_OFFSET_MIN * 60_000) % 86_400_000) }
}

/** Rounds up to the next multiple of `stepMin` minutes (aligned to IST wall clock). */
export function ceilToStep(t: number, stepMin: number) {
  const step = stepMin * 60_000
  const shifted = t + IST_OFFSET_MIN * 60_000
  return Math.ceil(shifted / step) * step - IST_OFFSET_MIN * 60_000
}
