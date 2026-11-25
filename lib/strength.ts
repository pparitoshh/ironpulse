// Strength-session maths: intensity (MET) from set effort, calories, and a summary.
// Shared by the API route and the workout UI.

export type WSet = { exercise_name: string; muscle_group?: string; weight_kg: number; reps: number; rpe?: number; is_pr?: boolean }

/**
 * Compendium of Physical Activities: resistance training
 * light effort 3.5 METs, moderate 5.0, vigorous 6.0. Effort comes from the average RPE of logged sets.
 */
export function strengthMET(sets: WSet[]): number {
  const rpes = sets.map(s => Number(s.rpe)).filter(r => r > 0)
  const avg = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 7
  if (avg >= 8) return 6.0
  if (avg >= 6) return 5.0
  return 3.5
}

/** kcal = MET x body weight (kg) x hours. Weight defaults to 70 kg when unknown. */
export function strengthCalories(sets: WSet[], minutes: number, weightKg?: number | null): number {
  if (!sets.length || !(minutes > 0)) return 0
  const kg = weightKg && Number(weightKg) > 30 ? Number(weightKg) : 70
  // A session left open for hours shouldn't count as hours of lifting: cap at 2.5 h.
  const hours = Math.min(minutes, 150) / 60
  return Math.round(strengthMET(sets) * kg * hours)
}

export function minutesBetween(startIso?: string | null, endIso?: string | null): number {
  if (!startIso) return 0
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  return Math.max(0, Math.round((end - new Date(startIso).getTime()) / 60000))
}

export function summarize(sets: WSet[]) {
  const exercises = Array.from(new Set(sets.map(s => s.exercise_name)))
  const muscles = Array.from(new Set(sets.map(s => s.muscle_group).filter(Boolean))) as string[]
  const volume = Math.round(sets.reduce((v, s) => v + (Number(s.weight_kg) || 0) * (Number(s.reps) || 0), 0))
  const prs = sets.filter(s => s.is_pr).map(s => `${s.exercise_name}: ${s.weight_kg} kg × ${s.reps}`)
  return { exercises, muscles, volume, sets: sets.length, prs }
}

export function clock(iso?: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}
