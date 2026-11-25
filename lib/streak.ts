import { localDate } from './date'

/** Consecutive days with a logged workout, ending today (or yesterday if today isn't logged yet). */
export function workoutStreak(logs: { date: string; sets?: any[] }[]): number {
  const days = new Set(logs.filter(l => l.sets?.length).map(l => l.date))
  const d = new Date()
  if (!days.has(localDate(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(localDate(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}
