// Dates are stored as the user's LOCAL calendar day (YYYY-MM-DD).
// toISOString() is UTC, which puts late-night Berlin entries on the previous day.

export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local date `n` days before today. */
export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDate(d)
}
