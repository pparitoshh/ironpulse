import { askJSON } from './ai'
import { sortExercises } from './exerciseOrder'
import { foodTextPrompt, normalizeMeal } from './food'

export async function generateWorkoutPlan(profile: {
  gender: string
  goal: string
  level: string
  days_per_week: number
  training_days?: string[]
  equipment: string[]
}) {
  const equipmentStr = profile.equipment.join(', ')
  const daysStr = profile.training_days?.length
    ? `Training days: ${profile.training_days.join(', ')}.`
    : `${profile.days_per_week} days per week.`

  const prompt = `Generate a weekly workout plan for a ${profile.level} ${profile.gender} with goal: ${profile.goal}.
${daysStr}
Available equipment: ${equipmentStr}.
IMPORTANT: The "day" field for each workout MUST match exactly one of the training days listed above (e.g. "Monday", "Tuesday", etc.).

Rules:
- Only use exercises possible with the available equipment
- Match volume and intensity to the fitness level
- For bulk: higher volume, compound-first, 8-12 reps
- For cut: supersets, circuit-style, 12-15 reps  
- For strength: heavy compounds, 3-6 reps, long rest
- For maintain: balanced, 8-12 reps
- Distribute muscle groups appropriately across days
- 3 days = full body, 4 days = upper/lower, 5-6 days = PPL

- muscle_group must be one of: chest, back, shoulders, biceps, triceps, forearms, abs, quads, hamstrings, glutes, calves, cardio (the PRIMARY muscle)
- movement: "compound" for multi-joint lifts (squat, press, row, pull-up, deadlift, lunge), "isolation" for single-joint ones (curl, raise, fly, extension)

Return ONLY valid JSON in this exact format:
{
  "days": [
    {
      "day": "Monday",
      "name": "Push Day",
      "focus": "Chest, Shoulders, Triceps",
      "exercises": [
        {
          "id": "ex1",
          "name": "Barbell Bench Press",
          "muscle_group": "chest",
          "movement": "compound",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "notes": "Focus on controlled eccentric",
          "equipment": "barbell"
        }
      ]
    }
  ],
  "notes": "Progressive overload tip here"
}`

  const parsed: any = await askJSON('workout_plan', prompt)

  // Ensure stable unique IDs — don't trust Groq to generate non-duplicate IDs
  let counter = 0
  parsed.days = (parsed.days ?? []).map((day: any) => ({
    ...day,
    // Body-structure order: big regions first, compound before isolation, regions grouped.
    exercises: sortExercises((day.exercises ?? []).map((ex: any) => ({
      ...ex,
      id: `ex_${++counter}_${(ex.name || 'exercise').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`,
    }))),
  }))

  return parsed
}

/** Text description -> Meal (items with grams + macros). */
export async function estimateMacros(description: string) {
  return normalizeMeal(await askJSON('estimate_macros', foodTextPrompt(description)))
}

export async function getProgressiveOverloadSuggestion(
  exerciseName: string,
  recentSets: { weight_kg: number; reps: number }[]
) {
  const prompt = `Based on recent performance for "${exerciseName}":
${recentSets.map((s, i) => `Set ${i + 1}: ${s.weight_kg}kg x ${s.reps} reps`).join('\n')}

Suggest next session's weight and reps for progressive overload.
Return ONLY valid JSON:
{
  "suggested_weight_kg": 80,
  "suggested_reps": "8-10",
  "reasoning": "brief explanation"
}`

  return askJSON('progressive_overload', prompt)
}
