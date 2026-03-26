'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/ui/BottomNav'

async function fetchOverloadSuggestion(exerciseName: string, sets: {weight_kg: number, reps: number}[]) {
  if (sets.length < 2) return null
  try {
    const res = await fetch('/api/progressive-overload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseName, sets })
    })
    return await res.json()
  } catch { return null }
}

export default function WorkoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plan, setPlan] = useState<any>(null)
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [sets, setSets] = useState<any[]>([])
  const [prs, setPRs] = useState<Record<string, number>>({})
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [restMax, setRestMax] = useState(90)
  const [activeExercise, setActiveExercise] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [overloadTips, setOverloadTips] = useState<Record<string, any>>({})
  const [startTime] = useState(Date.now())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') loadData()
  }, [status])

  useEffect(() => {
    if (restTimer === null) return
    if (restTimer <= 0) { setRestTimer(null); return }
    timerRef.current = setTimeout(() => setRestTimer(t => (t ?? 0) - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [restTimer])

  async function loadData() {
    const [planRes, logRes, histRes] = await Promise.all([
      fetch('/api/generate-plan'),
      fetch(`/api/log-workout?date=${today}`),
      fetch('/api/log-workout?limit=20'),
    ])
    const [p, l, h] = await Promise.all([planRes.json(), logRes.json(), histRes.json()])
    setPlan(p.plan)

    const todayPlan = p.plan?.days?.find((d: any) => d.day === dayName) || p.plan?.days?.[0]
    setSelectedDay(todayPlan)

    // Load existing sets
    const existing = Array.isArray(l) ? l[0] : l
    if (existing?.sets?.length) setSets(existing.sets)

    // Build PRs from history
    const prMap: Record<string, number> = {}
    h.forEach((log: any) => {
      log.sets?.forEach((s: any) => {
        const key = s.exercise_name
        if (!prMap[key] || s.weight_kg > prMap[key]) prMap[key] = s.weight_kg
      })
    })
    setPRs(prMap)
  }

  function addSet(exercise: any) {
    const existingSets = sets.filter(s => s.exercise_id === exercise.id)
    const lastSet = existingSets[existingSets.length - 1]
    const newSet = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      muscle_group: exercise.muscle_group,
      set_number: existingSets.length + 1,
      reps: lastSet?.reps || 10,
      weight_kg: lastSet?.weight_kg || 0,
      rpe: lastSet?.rpe || 7,
      is_pr: false,
    }
    setSets(prev => [...prev, newSet])
    setActiveExercise(exercise.id)
  }

  function updateSet(idx: number, key: string, value: any) {
    setSets(prev => prev.map((s, i) => {
      if (i !== idx) return s
      const updated = { ...s, [key]: value }
      // Check PR
      if (key === 'weight_kg' && prs[s.exercise_name] && value > prs[s.exercise_name]) {
        updated.is_pr = true
      }
      return updated
    }))
  }

  function removeSet(idx: number) {
    setSets(prev => prev.filter((_, i) => i !== idx))
  }

  function startRest(seconds: number) {
    setRestMax(seconds)
    setRestTimer(seconds)
  }

  async function saveWorkout() {
    setSaving(true)
    const duration = Math.round((Date.now() - startTime) / 60000)
    await fetch('/api/log-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        day_name: selectedDay?.name || dayName,
        sets,
        duration_minutes: duration,
      }),
    })
    setSaving(false)
    setSaved(true)

    // Fetch progressive overload suggestions for next session
    const exerciseNames = [...new Set(sets.map(s => s.exercise_name))]
    const tips: Record<string, any> = {}
    await Promise.all(exerciseNames.map(async (name) => {
      const exSets = sets.filter(s => s.exercise_name === name).map(s => ({ weight_kg: s.weight_kg, reps: s.reps }))
      const tip = await fetchOverloadSuggestion(name, exSets)
      if (tip) tips[name] = tip
    }))
    setOverloadTips(tips)
  }

  const exerciseSets = (exerciseId: string) => sets.filter(s => s.exercise_id === exerciseId)

  const circumference = 2 * Math.PI * 40
  const restProgress = restTimer !== null ? (restTimer / restMax) * circumference : 0

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#888' }}>Today</p>
        <h1 className="font-bold text-2xl">{selectedDay?.name || 'Workout'}</h1>
        {selectedDay && <p className="text-sm mt-0.5" style={{ color: '#f97316' }}>{selectedDay.focus}</p>}
      </div>

      {/* Rest Timer */}
      {restTimer !== null && (
        <div className="mx-5 mb-4 p-4 rounded-2xl flex items-center gap-4 animate-fade-in"
          style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid #f97316' }}>
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1c1c2e" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f97316" strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - restProgress}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-lg" style={{ color: '#f97316' }}>
              {restTimer}s
            </div>
          </div>
          <div className="flex-1">
            <div className="font-semibold">Rest Timer</div>
            <div className="text-sm" style={{ color: '#888' }}>Next set starting soon...</div>
          </div>
          <button onClick={() => setRestTimer(null)} className="text-xs px-3 py-2 rounded-lg"
            style={{ background: '#1c1c2e', color: '#888' }}>Skip</button>
        </div>
      )}

      {/* Day selector */}
      {plan?.days && (
        <div className="px-5 mb-4 overflow-x-auto">
          <div className="flex gap-2 w-max">
            {plan.days.map((d: any) => (
              <button key={d.day} onClick={() => setSelectedDay(d)}
                className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                style={{
                  background: selectedDay?.day === d.day ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
                  border: `1px solid ${selectedDay?.day === d.day ? '#f97316' : '#1c1c2e'}`,
                  color: selectedDay?.day === d.day ? '#f97316' : '#888',
                }}>
                {d.day}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 space-y-4">
        {selectedDay?.exercises?.map((exercise: any) => {
          const exSets = exerciseSets(exercise.id)
          const isActive = activeExercise === exercise.id
          const hasPR = exSets.some(s => s.is_pr)

          return (
            <div key={exercise.id} className="rounded-2xl overflow-hidden"
              style={{ background: '#0f0f1a', border: `1px solid ${isActive ? '#f97316' : '#1c1c2e'}` }}>
              {/* Exercise header */}
              <div className="px-4 pt-3 pb-2 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{exercise.name}</h3>
                    {hasPR && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">🏆 PR!</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs capitalize px-2 py-0.5 rounded-lg" style={{ background: '#14141f', color: '#888' }}>
                      {exercise.muscle_group}
                    </span>
                    <span className="text-xs" style={{ color: '#888' }}>
                      {exercise.sets}×{exercise.reps} · {exercise.rest_seconds}s rest
                    </span>
                  </div>
                </div>
                <button onClick={() => startRest(exercise.rest_seconds)}
                  className="text-xs px-2 py-1 rounded-lg" style={{ background: '#14141f', color: '#888' }}>
                  ⏱ Timer
                </button>
              </div>

              {/* Sets */}
              {exSets.length > 0 && (
                <div className="px-4">
                  <div className="grid grid-cols-4 gap-2 mb-1">
                    <span className="text-xs" style={{ color: '#555' }}>Set</span>
                    <span className="text-xs" style={{ color: '#555' }}>Reps</span>
                    <span className="text-xs" style={{ color: '#555' }}>kg</span>
                    <span className="text-xs" style={{ color: '#555' }}>RPE</span>
                  </div>
                  {exSets.map((s, localIdx) => {
                    const globalIdx = sets.findIndex(gs => gs === s)
                    return (
                      <div key={localIdx} className="grid grid-cols-4 gap-2 mb-2 items-center">
                        <span className="text-sm font-medium" style={{ color: s.is_pr ? '#fbbf24' : '#888' }}>
                          {s.set_number}{s.is_pr ? '🏆' : ''}
                        </span>
                        <input type="number" value={s.reps} min={1} max={100}
                          onChange={e => updateSet(globalIdx, 'reps', parseInt(e.target.value) || 0)}
                          className="rounded-lg px-2 py-1.5 text-sm text-center w-full outline-none"
                          style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
                        <input type="number" value={s.weight_kg} min={0} step={0.5}
                          onChange={e => updateSet(globalIdx, 'weight_kg', parseFloat(e.target.value) || 0)}
                          className="rounded-lg px-2 py-1.5 text-sm text-center w-full outline-none"
                          style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
                        <div className="flex items-center gap-1">
                          <input type="number" value={s.rpe} min={1} max={10}
                            onChange={e => updateSet(globalIdx, 'rpe', parseInt(e.target.value) || 0)}
                            className="rounded-lg px-2 py-1.5 text-sm text-center w-full outline-none"
                            style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
                          <button onClick={() => removeSet(globalIdx)} className="text-red-500 text-lg flex-shrink-0">×</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add set button */}
              <div className="px-4 pb-3">
                <button onClick={() => { addSet(exercise); startRest(exercise.rest_seconds) }}
                  className="w-full py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px dashed rgba(249,115,22,0.3)' }}>
                  + Add Set
                </button>
              </div>
            </div>
          )
        })}

        {/* Save button */}
        {sets.length > 0 && (
          <button onClick={saveWorkout} disabled={saving}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50"
            style={{ background: saved ? '#22c55e' : '#f97316', color: '#fff' }}>
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Saving...
              </span>
            ) : saved ? '✅ Workout Saved!' : `Save Workout (${sets.length} sets)`}
          </button>
        )}

        {/* Progressive overload tips */}
        {saved && Object.keys(overloadTips).length > 0 && (
          <div className="rounded-2xl p-4 animate-fade-in" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>📈 Next Session Targets</p>
            <div className="space-y-2">
              {Object.entries(overloadTips).map(([name, tip]: [string, any]) => (
                <div key={name} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#1c1c2e' }}>
                  <span className="text-sm font-medium">{name}</span>
                  <div className="text-right">
                    <span className="font-bold text-sm" style={{ color: '#f97316' }}>
                      {tip.suggested_weight_kg}kg × {tip.suggested_reps}
                    </span>
                    <div className="text-xs" style={{ color: '#666' }}>{tip.reasoning}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedDay && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">😴</div>
            <h3 className="font-semibold text-lg">Rest Day</h3>
            <p className="text-sm mt-1" style={{ color: '#888' }}>Recovery is part of the plan</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
