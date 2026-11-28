// Gym machine instruction sign (e.g. Life Fitness "LEG PRESS" placard) -> exercise for the plan.
import { MUSCLE_GROUPS } from '@/types'
import { isCompound } from './exerciseOrder'

export const MACHINE_SCAN_PROMPT = `This photo shows a gym machine or its instruction sign/placard (it may be German or English).
Identify the exercise the machine is for. Read the printed name if there is one; otherwise judge from the machine and the highlighted muscles.

Return ONLY JSON:
{
  "exercise_name": "short common English name, Title Case, e.g. Leg Press, Hip Abduction, Lat Pulldown, Seated Chest Press",
  "printed_name": "the name exactly as printed on the sign, or null",
  "primary_muscle": "one of: ${MUSCLE_GROUPS.join(', ')}",
  "secondary_muscles": ["other worked muscles, same list"],
  "movement": "compound or isolation",
  "equipment": "machine, cable, smith machine, plate-loaded, free weights or cardio",
  "setup_tips": ["2-3 short form/setup cues for this machine"],
  "confidence": "high, medium or low"
}
If it is not a gym machine or sign at all, return {"exercise_name": null}.`

export type MachineScan = {
  name: string
  printed_name: string | null
  muscle_group: string
  secondary: string[]
  movement: 'compound' | 'isolation'
  equipment: string
  tips: string[]
  confidence: string
  sets: number
  reps: string
  rest_seconds: number
  youtube_url: string
}

// Muscle words the model might use instead of our list.
const ALIAS: Record<string, string> = {
  quadriceps: 'quads', quad: 'quads', thighs: 'quads', legs: 'quads',
  hamstring: 'hamstrings', glute: 'glutes', gluteus: 'glutes', 'gluteus maximus': 'glutes', 'gluteus medius': 'glutes', 'hip abductors': 'glutes', abductors: 'glutes', adductors: 'glutes', 'hip adductors': 'glutes',
  lats: 'back', 'latissimus dorsi': 'back', 'upper back': 'back', 'lower back': 'back', rhomboids: 'back', traps: 'back', trapezius: 'back',
  pecs: 'chest', pectorals: 'chest', 'pectoralis major': 'chest',
  delts: 'shoulders', deltoids: 'shoulders', 'rear delts': 'shoulders', 'front delts': 'shoulders',
  bicep: 'biceps', tricep: 'triceps', abdominals: 'abs', core: 'abs', obliques: 'abs', calf: 'calves',
}

export function toMuscle(m: unknown): string | null {
  const s = String(m ?? '').toLowerCase().trim()
  if ((MUSCLE_GROUPS as string[]).includes(s)) return s
  if (ALIAS[s]) return ALIAS[s]
  const hit = Object.keys(ALIAS).find(k => s.includes(k))
  return hit ? ALIAS[hit] : null
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

/** Clean the model's answer into an exercise with sensible defaults; null if no machine was found. */
export function normalizeMachine(raw: any): MachineScan | null {
  const name0 = String(raw?.exercise_name || raw?.printed_name || '').trim()
  if (!name0) return null
  const name = titleCase(name0)
  const secondary = (Array.isArray(raw?.secondary_muscles) ? raw.secondary_muscles : [])
    .map(toMuscle).filter((m: string | null): m is string => !!m)
  const muscle = toMuscle(raw?.primary_muscle) || secondary[0] || 'quads'
  const movement: 'compound' | 'isolation' =
    raw?.movement === 'compound' || raw?.movement === 'isolation'
      ? raw.movement
      : (isCompound({ name, muscle_group: muscle }) ? 'compound' : 'isolation')
  const compound = movement === 'compound'
  return {
    name,
    printed_name: raw?.printed_name ? String(raw.printed_name) : null,
    muscle_group: muscle,
    secondary: Array.from(new Set(secondary.filter((m: string) => m !== muscle))),
    movement,
    equipment: String(raw?.equipment || 'machine').toLowerCase(),
    tips: (Array.isArray(raw?.setup_tips) ? raw.setup_tips : []).map(String).filter(Boolean).slice(0, 3),
    confidence: ['high', 'medium', 'low'].includes(raw?.confidence) ? raw.confidence : 'medium',
    // Muscle-building defaults: compound 3x8-12 / 90 s, isolation 3x10-15 / 60 s.
    sets: 3,
    reps: compound ? '8-12' : '10-15',
    rest_seconds: compound ? 90 : 60,
    youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' machine proper form')}`,
  }
}

/** Same exercise already in the day? (case/punctuation-insensitive, ignores "machine"). */
export function sameExercise(a: string, b: string): boolean {
  const k = (s: string) => s.toLowerCase().replace(/machine|seated|\(.*?\)/g, '').replace(/[^a-z]/g, '')
  return !!k(a) && k(a) === k(b)
}
