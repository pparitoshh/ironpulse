export type Gender = 'male' | 'female'
export type Goal = 'bulk' | 'cut' | 'maintain' | 'strength' | 'endurance'
export type Level = 'beginner' | 'intermediate' | 'advanced'

export interface UserProfile {
  id: string
  user_id: string
  gender: Gender
  goal: Goal
  level: Level
  days_per_week: number
  equipment: string[]
  age?: number
  weight_kg?: number
  height_cm?: number
  target_calories?: number
  target_protein?: number
  target_carbs?: number
  target_fat?: number
  created_at: string
  updated_at: string
}

export interface WorkoutPlan {
  id: string
  user_id: string
  plan: WeeklyPlan
  created_at: string
}

export interface WeeklyPlan {
  days: WorkoutDay[]
  notes?: string
}

export interface WorkoutDay {
  day: string
  name: string
  focus: string
  exercises: Exercise[]
}

export interface Exercise {
  id: string
  name: string
  muscle_group: string
  sets: number
  reps: string
  rest_seconds: number
  notes?: string
  equipment?: string
}

export interface WorkoutLog {
  id: string
  user_id: string
  date: string
  day_name: string
  sets: SetLog[]
  duration_minutes?: number
  notes?: string
  created_at: string
}

export interface SetLog {
  exercise_id: string
  exercise_name: string
  set_number: number
  reps: number
  weight_kg: number
  rpe?: number
  is_pr?: boolean
}

export interface FoodLog {
  id: string
  user_id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  quantity?: string
  created_at: string
}

export interface BodyMeasurement {
  id: string
  user_id: string
  date: string
  weight_kg?: number
  chest_cm?: number
  waist_cm?: number
  hips_cm?: number
  bicep_cm?: number
  thigh_cm?: number
  created_at: string
}

export interface PersonalRecord {
  exercise_name: string
  max_weight_kg: number
  max_reps: number
  date: string
}

export const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Barbell + Rack', icon: '🏋️' },
  { id: 'dumbbells', label: 'Dumbbells', icon: '💪' },
  { id: 'cables', label: 'Cables / Cable Machine', icon: '🔄' },
  { id: 'machines', label: 'Gym Machines', icon: '⚙️' },
  { id: 'bands', label: 'Resistance Bands', icon: '🔗' },
  { id: 'cardio', label: 'Cardio Machines', icon: '🏃' },
  { id: 'pullup_bar', label: 'Pull-up Bar', icon: '🔝' },
  { id: 'bodyweight', label: 'Bodyweight Only', icon: '🤸' },
  { id: 'full_gym', label: 'Full Commercial Gym', icon: '🏪' },
]

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves', 'cardio'
]
