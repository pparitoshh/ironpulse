import Groq from 'groq-sdk'

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

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

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 3000,
  })

  const text = completion.choices[0]?.message?.content || '{}'
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  // Ensure stable unique IDs — don't trust Groq to generate non-duplicate IDs
  let counter = 0
  parsed.days = (parsed.days ?? []).map((day: any) => ({
    ...day,
    exercises: (day.exercises ?? []).map((ex: any) => ({
      ...ex,
      id: `ex_${++counter}_${(ex.name || 'exercise').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`,
    })),
  }))

  return parsed
}

export async function estimateMacros(description: string) {
  const prompt = `You are a precise nutrition analyst. Estimate macros accurately for: "${description}"

STEP 1 - IDENTIFY all food items:
- List every ingredient separately
- Identify cooking method (fried, boiled, grilled, air-fried)
- Estimate portion size (small/medium/large)

STEP 2 - ESTIMATE portions:
- Estimate weight in grams per item
- A fist = ~150g carbs, palm = ~120g protein, thumb = ~15g fat

STEP 3 - CRITICAL: Always account for hidden calories:
- Cooking oil: +150-200 kcal per dish unless stated otherwise
- Sauces/marinades: +50-100 kcal
- If stir-fried: assume 1-2 tbsp oil used

STEP 4 - Calculate using USDA standards per 100g:
- Identify each ingredient
- Apply portion weight
- Sum all items

ACCURACY RULES:
- Never underestimate oil/fat from cooking
- Mixed dishes → estimate conservatively high
- If uncertain about portion → use the higher estimate

Return ONLY valid JSON:
{
  "food_name": "descriptive name",
  "calories": 350,
  "protein_g": 25,
  "carbs_g": 40,
  "fat_g": 8,
  "quantity": "1 serving (approximately 200g)",
  "items_breakdown": [
    {"item": "item name", "weight_g": 150, "calories": 200, "protein_g": 15, "carbs_g": 20, "fat_g": 5}
  ],
  "notes": "any flags about hidden calories"
}`

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    max_tokens: 300,
  })

  const text = completion.choices[0]?.message?.content || '{}'
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
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

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    max_tokens: 200,
  })

  const text = completion.choices[0]?.message?.content || '{}'
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
