// Exercise order by body structure:
//   big muscle regions before small (legs -> back -> chest -> shoulders -> arms -> calves -> core -> cardio),
//   multi-joint (compound) lifts before single-joint (isolation) within a region,
//   so each region's exercises stay together. Warm-up cardio (flag `warmup`) goes first.

export type Orderable = { name: string; muscle_group?: string; movement?: string; warmup?: boolean }

const REGION_OF: Record<string, number> = {
  quads: 0, hamstrings: 0, glutes: 0, legs: 0,
  back: 1, lats: 1, traps: 1,
  chest: 2,
  shoulders: 3, delts: 3,
  biceps: 4, triceps: 4, forearms: 4, arms: 4,
  calves: 5,
  abs: 6, core: 6, obliques: 6,
  cardio: 7,
}

// Multi-joint movement patterns (used when the plan doesn't say compound/isolation).
const COMPOUND = /squat|deadlift|lunge|split squat|leg press|hack|step[- ]?up|hip thrust|good morning|pull[- ]?up|chin[- ]?up|pulldown|pull[- ]?down|row|bench|press|push[- ]?up|dip|clean|snatch|thruster|pull[- ]?through|rdl|romanian/i
// Single-joint patterns that contain a "compound" word (e.g. "leg press" vs "tricep press machine").
const ISOLATION = /curl|extension|raise|fly|flye|pec deck|kickback|pushdown|push[- ]?down|crunch|abduction|adduction|shrug|face pull|calf|tricep press|triceps press|skull|rotation|plank|pullover/i

/** Region weight for a muscle group (unknown groups sort with arms). */
export function regionRank(muscle?: string): number {
  return REGION_OF[(muscle || '').toLowerCase()] ?? 4
}

export function isCompound(ex: Orderable): boolean {
  if (ex.movement === 'compound') return true
  if (ex.movement === 'isolation') return false
  if (ISOLATION.test(ex.name)) return false
  return COMPOUND.test(ex.name)
}

export function orderKey(ex: Orderable): number {
  if (ex.warmup) return -1
  return regionRank(ex.muscle_group) * 2 + (isCompound(ex) ? 0 : 1)
}

/** Stable sort into body-structure order. */
export function sortExercises<T extends Orderable>(list: T[]): T[] {
  return list.map((ex, i) => ({ ex, i })).sort((a, b) => orderKey(a.ex) - orderKey(b.ex) || a.i - b.i).map(x => x.ex)
}

/** Index where a new exercise belongs in an already-ordered list (after its peers), without reshuffling the others. */
export function insertIndex<T extends Orderable>(list: T[], ex: Orderable): number {
  const k = orderKey(ex)
  let idx = list.length
  for (let i = list.length - 1; i >= 0; i--) {
    if (orderKey(list[i]) <= k) { idx = i + 1; break }
    idx = i
  }
  return idx
}
