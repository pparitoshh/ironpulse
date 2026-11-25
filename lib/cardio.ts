// Cardio: machine types, normalizing a vision reading, and calorie maths.
// Shared by server routes and client UI (no Node-only imports here).

export const MACHINES = [
  { value: 'treadmill', label: 'Treadmill', icon: '🏃', met: 8.0 },
  { value: 'bike', label: 'Bike', icon: '🚴', met: 6.8 },
  { value: 'stair_climber', label: 'Stair climber', icon: '🪜', met: 9.0 },
  { value: 'elliptical', label: 'Elliptical', icon: '⭕', met: 5.0 },
  { value: 'rower', label: 'Rower', icon: '🚣', met: 7.0 },
  { value: 'other', label: 'Other', icon: '❤️', met: 6.0 },
] as const

export type Machine = typeof MACHINES[number]['value']

/** Home sessions from the video catalog (logged into cardio_logs with machine = type). */
export const SESSION_TYPES = [
  { value: 'hiit', label: 'HIIT', icon: '⚡' },
  { value: 'yoga', label: 'Yoga', icon: '🧘' },
  { value: 'core', label: 'Core', icon: '🎯' },
  { value: 'mobility', label: 'Mobility', icon: '🤸' },
  { value: 'stretch', label: 'Stretch', icon: '🙆' },
  { value: 'walk', label: 'Walk', icon: '🚶' },
] as const

export type SessionType = typeof SESSION_TYPES[number]['value']

/** Icon + label for any cardio_logs.machine value (machines and home sessions). */
export function activityInfo(value: string): { label: string; icon: string } {
  return MACHINES.find(m => m.value === value) || SESSION_TYPES.find(t => t.value === value) || { label: value, icon: '❤️' }
}

/** kcal = MET x kg x hours. */
export function metCalories(met: number, durationMin: number, weightKg?: number | null) {
  return Math.round(met * (weightKg && weightKg > 30 ? weightKg : CONSOLE_DEFAULT_KG) * (durationMin / 60))
}

/** Extract an 11-char YouTube video id from any common URL form (or a bare id). */
export function youtubeId(input: string): string | null {
  const s = (input || '').trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export type Cardio = {
  machine: Machine
  duration_min: number
  calories_machine: number | null
  calories: number | null
  distance_km: number | null
  floors: number | null
  steps: number | null
  avg_hr: number | null
  max_hr: number | null
  mets: number | null
  avg_speed: string | null
  incline_pct: number | null
  resistance: number | null
}

/** Weight most consoles assume when no user weight was entered. */
export const CONSOLE_DEFAULT_KG = 70

const n = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'object') return n(v.value ?? v.total ?? v.bpm)
  const x = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(x) ? x : null
}

/** "12:01" / "12:01 min" / 12.01 (mm.ss misread) / 721 s -> minutes. */
export function parseDuration(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(typeof v === 'object' ? v.value ?? '' : v).trim()
  const hms = s.match(/^(\d{1,2}):(\d{2}):(\d{2})/)
  if (hms) return +hms[1] * 60 + +hms[2] + +hms[3] / 60
  const ms = s.match(/^(\d{1,3}):(\d{2})/)
  if (ms) return +ms[1] + +ms[2] / 60
  const x = n(s)
  return x === null ? null : x
}

export function machineFrom(v: any): Machine {
  const s = String(v || '').toLowerCase()
  if (/stair|step|climb|treppe|etage/.test(s)) return 'stair_climber'
  if (/tread|lauf|run/.test(s)) return 'treadmill'
  if (/bike|cycle|rad|ergometer|spin/.test(s)) return 'bike'
  if (/ellip|cross/.test(s)) return 'elliptical'
  if (/row|ruder/.test(s)) return 'rower'
  return 'other'
}

/** Coerce a model's (loosely-typed) reading into a Cardio record. */
export function normalizeCardio(r: any): Cardio {
  const duration = parseDuration(r?.duration_min ?? r?.duration ?? r?.time)
  return {
    machine: machineFrom(r?.machine_type ?? r?.machine),
    duration_min: duration ? Math.round(duration * 10) / 10 : 0,
    calories_machine: n(r?.calories) !== null ? Math.round(n(r?.calories)!) : null,
    calories: null,
    distance_km: n(r?.distance_km),
    floors: n(r?.floors) !== null ? Math.round(n(r?.floors)!) : null,
    steps: n(r?.steps) !== null ? Math.round(n(r?.steps)!) : null,
    avg_hr: n(r?.avg_hr) !== null ? Math.round(n(r?.avg_hr)!) : null,
    max_hr: n(r?.max_hr) !== null ? Math.round(n(r?.max_hr)!) : null,
    mets: n(r?.mets),
    avg_speed: r?.avg_speed == null ? null : typeof r.avg_speed === 'object'
      ? [r.avg_speed.value, r.avg_speed.unit].filter(Boolean).join(' ') : String(r.avg_speed),
    incline_pct: n(r?.incline_pct),
    resistance: n(r?.resistance),
  }
}

/**
 * Calories for the user's real body weight.
 * 1. Console showed METs: kcal = METs × kg × hours (standard ACSM formula).
 * 2. Only console kcal: scale by kg / console default weight.
 * 3. Nothing: typical MET for the machine.
 */
export function cardioCalories(c: Pick<Cardio, 'machine' | 'duration_min' | 'mets' | 'calories_machine'>, weightKg?: number | null): number {
  const hours = (c.duration_min || 0) / 60
  const kg = weightKg && weightKg > 30 ? weightKg : null
  if (c.mets && kg) return Math.round(c.mets * kg * hours)
  if (c.calories_machine && kg) return Math.round(c.calories_machine * (kg / CONSOLE_DEFAULT_KG))
  if (c.calories_machine) return c.calories_machine
  const met = c.mets || MACHINES.find(m => m.value === c.machine)?.met || 6
  return Math.round(met * (kg || CONSOLE_DEFAULT_KG) * hours)
}

export const CARDIO_SCAN_PROMPT = `This is a photo of a gym cardio machine's display, usually the workout summary screen.
The screen may be in German or another language. Common German labels:
Abgelaufen/Zeit = elapsed time, Kalorien = calories, Gestiegene Etagen = floors climbed, Schritte = steps,
Distanz/Strecke = distance, Durchschn. Herzfrequenz = average heart rate, Max. Herzfrequenz = max heart rate,
METs = METs, Geschwindigkeit = speed, Steigung = incline, Widerstand/Stufe = resistance level.

Return ONLY a JSON object with these keys (null when not shown; numbers as plain numbers, no units):
{
  "machine_type": "treadmill | bike | stair_climber | elliptical | rower | other",
  "duration": "elapsed time exactly as shown, e.g. \\"12:01\\"",
  "calories": total calories burned (not calories per hour),
  "distance_km": number,
  "floors": number,
  "steps": number,
  "avg_hr": average heart rate bpm,
  "max_hr": max heart rate bpm,
  "mets": number,
  "avg_speed": "value with unit as shown",
  "incline_pct": number,
  "resistance": number
}
Infer machine_type from the metrics (floors/steps => stair_climber, incline/km/h => treadmill, rpm/watts => bike, strokes/500m => rower).`
