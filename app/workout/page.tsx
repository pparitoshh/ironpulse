'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/ui/BottomNav'
import { MUSCLE_GROUPS } from '@/types'
import { localDate } from '@/lib/date'
import CardioCard from '@/components/CardioCard'
import HomeDayCard from '@/components/HomeDayCard'
import WorkoutSummary from '@/components/WorkoutSummary'
import WarmCoolCard from '@/components/WarmCoolCard'
import { insertIndex, sortExercises } from '@/lib/exerciseOrder'
import NumInput from '@/components/NumInput'
import { clock, minutesBetween } from '@/lib/strength'

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

/** Epley estimated one-rep max. */
function e1rm(weight: number, reps: number) {
  const w = Number(weight) || 0, r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  return r === 1 ? w : w * (1 + r / 30)
}

function restDoneAlert() {
  try { navigator.vibrate?.([300, 150, 300]) } catch {}
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.25].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = 880
      o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.3, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2)
    })
  } catch {}
}

function elapsedLabel(startIso: string | null) {
  if (!startIso) return '0:00'
  const s = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function WorkoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plan, setPlan] = useState<any>(null)
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [sets, setSets] = useState<any[]>([])
  const [prs, setPRs] = useState<Record<string, number>>({})
  // Last session's sets per exercise name (for the "Previous" column)
  const [previous, setPrevious] = useState<Record<string, { weight_kg: number; reps: number }[]>>({})
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [restMax, setRestMax] = useState(90)
  const [activeExercise, setActiveExercise] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [overloadTips, setOverloadTips] = useState<Record<string, any>>({})
  // Session timing (stored on the day's workout_logs row, so it survives reloads)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [endedAt, setEndedAt] = useState<string | null>(null)
  const [sessionKcal, setSessionKcal] = useState<number | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryCardio, setSummaryCardio] = useState<any[]>([])
  const [, setTick] = useState(0)
  const timingRef = useRef<{ startedAt: string | null; endedAt: string | null }>({ startedAt: null, endedAt: null })
  timingRef.current = { startedAt, endedAt }
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const [autoSaving, setAutoSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [movingExercise, setMovingExercise] = useState<string | null>(null)
  const [renamingDay, setRenamingDay] = useState<string | null>(null)
  const [newExercise, setNewExercise] = useState({
    name: '', muscle_group: 'chest', sets: 3, reps: '10', rest_seconds: 90, equipment: '', notes: '', youtube_url: ''
  })
  const [trainingDays, setTrainingDays] = useState<string[] | null>(null)

  const today = localDate()
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') loadData()
  }, [status])

  // Rest timer counts down from a fixed end time, so it stays correct when the
  // phone locks or the tab is backgrounded (setTimeout chains get throttled).
  const restEndRef = useRef<number | null>(null)
  useEffect(() => {
    if (restTimer === null || restEndRef.current === null) return
    timerRef.current = setTimeout(() => {
      const left = Math.max(0, Math.ceil((restEndRef.current! - Date.now()) / 1000))
      if (left <= 0) {
        restEndRef.current = null
        setRestTimer(null)
        restDoneAlert()
      } else setRestTimer(left)
    }, 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [restTimer])

  // Auto-save sets after changes (debounced 1.5s)
  const setsLoaded = useRef(false)
  const [savedOk, setSavedOk] = useState<boolean | null>(null)
  const pendingRef = useRef<any[] | null>(null)
  useEffect(() => {
    // Skip until today's log has loaded, so we never overwrite it with an empty session.
    if (!setsLoaded.current) return
    if (sets.length === 0) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    pendingRef.current = sets
    autoSaveRef.current = setTimeout(async () => {
      autoSaveRef.current = null
      pendingRef.current = null
      setAutoSaving(true)
      const res = await postLog(sets, timingRef.current.startedAt, timingRef.current.endedAt)
      if (res?.calories != null) setSessionKcal(res.calories)
      setSavedOk(!!res)
      setAutoSaving(false)
    }, 1500)
  }, [sets])

  // If the app is closed/backgrounded inside the 1.5 s debounce, send the pending sets right away
  // (keepalive lets the request finish after the page is gone).
  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current) return
      if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null }
      const pending = pendingRef.current
      pendingRef.current = null
      postLog(pending, timingRef.current.startedAt, timingRef.current.endedAt, true)
    }
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', flush) }
  })

  // Live elapsed clock while a session is running.
  useEffect(() => {
    if (!startedAt || endedAt) return
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [startedAt, endedAt])

  async function postLog(currentSets: any[], started: string | null, ended: string | null, keepalive = false) {
    const res = await fetch('/api/log-workout', {
      method: 'POST',
      keepalive,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        day_name: selectedDay?.name || dayName,
        sets: currentSets,
        started_at: started,
        ended_at: ended,
      }),
    })
    return res.ok ? res.json() : null
  }

  async function startWorkout() {
    const now = new Date().toISOString()
    setStartedAt(now)
    setEndedAt(null)
    await postLog(sets, now, null)
  }

  async function finishWorkout() {
    setSaving(true)
    const start = startedAt || new Date(Date.now() - 60000).toISOString()
    const end = new Date().toISOString()
    setStartedAt(start)
    setEndedAt(end)
    const [res, cardio] = await Promise.all([
      postLog(sets, start, end),
      fetch(`/api/cardio?date=${today}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ])
    setSessionKcal(res?.calories ?? 0)
    setSummaryCardio(Array.isArray(cardio) ? cardio : [])
    setSaving(false)
    setSaved(true)
    setShowSummary(true)
    loadOverloadTips()
  }

  async function continueWorkout() {
    setShowSummary(false)
    setSaved(false)
    setEndedAt(null)
    setSessionKcal(null)
    await postLog(sets, startedAt, null)
  }

  async function openSummary() {
    const cardio = await fetch(`/api/cardio?date=${today}`).then(r => r.ok ? r.json() : []).catch(() => [])
    setSummaryCardio(Array.isArray(cardio) ? cardio : [])
    setShowSummary(true)
  }

  async function loadData() {
    const [planRes, logRes, histRes, progRes] = await Promise.all([
      fetch('/api/generate-plan'),
      fetch(`/api/log-workout?date=${today}`),
      fetch('/api/log-workout?limit=20'),
      fetch('/api/get-progress'),
    ])
    const [p, l, h, prog] = await Promise.all([
      planRes.json(), logRes.json(), histRes.json(), progRes.json().catch(() => null),
    ])
    setTrainingDays(prog?.training_days ?? null)
    setPlan(p.plan)

    const todayPlan = p.plan?.days?.find((d: any) => d.day === dayName) || p.plan?.days?.[0]
    setSelectedDay(todayPlan)

    // Load existing sets
    const existing = Array.isArray(l) ? l[0] : l
    if (existing?.sets?.length) setSets(existing.sets)
    if (existing?.started_at) setStartedAt(existing.started_at)
    if (existing?.ended_at) { setEndedAt(existing.ended_at); setSaved(true) }
    if (existing?.calories != null) setSessionKcal(existing.calories)
    setsLoaded.current = true

    // Build PRs from history
    // Best estimated 1RM per exercise from PREVIOUS days only (today's sets must not
    // compete against themselves).
    const prMap: Record<string, number> = {}
    h.filter((log: any) => log.date !== today).forEach((log: any) => {
      log.sets?.forEach((s: any) => {
        const key = s.exercise_name
        const e = e1rm(s.weight_kg, s.reps)
        if (e > 0 && (!prMap[key] || e > prMap[key])) prMap[key] = e
      })
    })
    setPRs(prMap)

    // "Previous" = the sets from the most recent earlier day that had this exercise.
    const prev: Record<string, { weight_kg: number; reps: number }[]> = {}
    ;[...h].filter((log: any) => log.date !== today)
      .sort((a: any, b: any) => (a.date < b.date ? 1 : -1))
      .forEach((log: any) => {
        const byName: Record<string, any[]> = {}
        log.sets?.forEach((s: any) => { (byName[s.exercise_name] ||= []).push(s) })
        for (const [name, list] of Object.entries(byName)) {
          if (!prev[name]) prev[name] = list.map(s => ({ weight_kg: Number(s.weight_kg) || 0, reps: Number(s.reps) || 0 }))
        }
      })
    setPrevious(prev)
  }

  function addSet(exercise: any) {
    if (!startedAt) setStartedAt(new Date().toISOString())
    const existingSets = sets.filter(s => s.exercise_id === exercise.id)
    const lastSet = existingSets[existingSets.length - 1]
    const newSet = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      muscle_group: exercise.muscle_group,
      set_number: existingSets.length + 1,
      reps: lastSet?.reps || previous[exercise.name]?.[existingSets.length]?.reps || previous[exercise.name]?.[0]?.reps || parseInt(String(exercise.reps)) || 10,
      weight_kg: lastSet?.weight_kg || previous[exercise.name]?.[existingSets.length]?.weight_kg || previous[exercise.name]?.[0]?.weight_kg || 0,
      rpe: lastSet?.rpe || 7,
      done: false,
      is_pr: false,
    }
    setSets(prev => [...prev, newSet])
    setActiveExercise(exercise.id)
  }

  function updateSet(idx: number, key: string, value: any) {
    setSets(prev => prev.map((s, i) => {
      if (i !== idx) return s
      const updated = { ...s, [key]: value }
      // PR = beats the best previous estimated 1RM (weight or reps). Recomputed on
      // every edit so lowering the weight clears the badge.
      const best = prs[s.exercise_name]
      updated.is_pr = !!best && e1rm(updated.weight_kg, updated.reps) > best
      return updated
    }))
  }

  /** ✓ a set: mark done and start the rest timer (Hevy-style). Untick to undo. */
  function toggleDone(idx: number, restSeconds: number) {
    const willBeDone = !sets[idx]?.done
    setSets(prev => prev.map((s, i) => (i === idx ? { ...s, done: willBeDone } : s)))
    if (willBeDone) startRest(restSeconds || 90)
  }

  /** Put the selected day's exercises into body-structure order. */
  function sortDay() {
    if (!plan || !selectedDay) return
    const updatedDays = plan.days.map((d: any) => (d.day === selectedDay.day ? { ...d, exercises: sortExercises(d.exercises) } : d))
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
    savePlanToServer(updatedPlan)
  }

  function removeSet(idx: number) {
    setSets(prev => prev.filter((_, i) => i !== idx))
  }

  function startRest(seconds: number) {
    restEndRef.current = Date.now() + seconds * 1000
    setRestMax(seconds)
    setRestTimer(seconds)
  }

  async function loadOverloadTips() {
    // Fetch progressive overload suggestions for next session
    const exerciseNames = Array.from(new Set(sets.map(s => s.exercise_name)))
    const tips: Record<string, any> = {}
    await Promise.all(exerciseNames.map(async (name) => {
      const exSets = sets.filter(s => s.exercise_name === name).map(s => ({ weight_kg: s.weight_kg, reps: s.reps }))
      const tip = await fetchOverloadSuggestion(name, exSets)
      if (tip) tips[name] = tip
    }))
    setOverloadTips(tips)
  }

  async function savePlanToServer(updatedPlan: any) {
    await fetch('/api/generate-plan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: updatedPlan }),
    })
  }

  function removeExercise(exerciseId: string) {
    if (!plan || !selectedDay) return
    const updatedDays = plan.days.map((d: any) => {
      if (d.day !== selectedDay.day) return d
      return { ...d, exercises: d.exercises.filter((e: any) => e.id !== exerciseId) }
    })
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
    // Remove any logged sets for this exercise
    setSets(prev => prev.filter(s => s.exercise_id !== exerciseId))
    savePlanToServer(updatedPlan)
  }

  function addExercise() {
    if (!plan || !selectedDay || !newExercise.name.trim()) return
    const id = `ex_custom_${Date.now()}_${newExercise.name.toLowerCase().replace(/\s+/g, '_')}`
    const exercise = { id, ...newExercise, sets: Number(newExercise.sets), rest_seconds: Number(newExercise.rest_seconds) }
    const updatedDays = plan.days.map((d: any) => {
      if (d.day !== selectedDay.day) return d
      // Slot it in by body structure (after its region's lifts) without reshuffling the rest.
      const list = [...d.exercises]
      list.splice(insertIndex(list, exercise), 0, exercise)
      return { ...d, exercises: list }
    })
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
    setShowAddExercise(false)
    setNewExercise({ name: '', muscle_group: 'chest', sets: 3, reps: '10', rest_seconds: 90, equipment: '', notes: '', youtube_url: '' })
    savePlanToServer(updatedPlan)
  }

  function updateExerciseField(exerciseId: string, field: string, value: any) {
    if (!plan || !selectedDay) return
    const updatedDays = plan.days.map((d: any) => {
      if (d.day !== selectedDay.day) return d
      return {
        ...d,
        exercises: d.exercises.map((e: any) => e.id === exerciseId ? { ...e, [field]: value } : e),
      }
    })
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
  }

  function saveExerciseEdits() {
    if (!plan) return
    savePlanToServer(plan)
  }

  function moveExerciseToDay(exerciseId: string, targetDayName: string) {
    if (!plan || !selectedDay || targetDayName === selectedDay.day) return
    const exercise = selectedDay.exercises.find((e: any) => e.id === exerciseId)
    if (!exercise) return
    const updatedDays = plan.days.map((d: any) => {
      if (d.day === selectedDay.day) {
        return { ...d, exercises: d.exercises.filter((e: any) => e.id !== exerciseId) }
      }
      if (d.day === targetDayName) {
        return { ...d, exercises: [...d.exercises, exercise] }
      }
      return d
    })
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
    setSets(prev => prev.filter(s => s.exercise_id !== exerciseId))
    setMovingExercise(null)
    savePlanToServer(updatedPlan)
  }

  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  function deleteDay(dayName: string) {
    if (!plan) return
    const updatedDays = plan.days.filter((d: any) => d.day !== dayName)
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    if (selectedDay?.day === dayName) {
      setSelectedDay(updatedDays[0] || null)
    }
    setSets([])
    savePlanToServer(updatedPlan)
  }

  function addDay() {
    if (!plan) return
    const usedDays = plan.days.map((d: any) => d.day)
    const nextDay = WEEKDAYS.find(wd => !usedDays.includes(wd))
    if (!nextDay) return // all 7 days already used
    const newDay = { day: nextDay, name: 'New Workout', focus: '', exercises: [] }
    const updatedPlan = { ...plan, days: [...plan.days, newDay] }
    setPlan(updatedPlan)
    setSelectedDay(newDay)
    savePlanToServer(updatedPlan)
  }

  function renameDay(oldDayName: string, newDayName: string) {
    if (!plan || oldDayName === newDayName) return
    const updatedDays = plan.days.map((d: any) =>
      d.day === oldDayName ? { ...d, day: newDayName } : d
    )
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    if (selectedDay?.day === oldDayName) {
      setSelectedDay(updatedDays.find((d: any) => d.day === newDayName))
    }
    setRenamingDay(null)
    savePlanToServer(updatedPlan)
  }

  function moveExercise(exerciseId: string, direction: 'up' | 'down') {
    if (!plan || !selectedDay) return
    const updatedDays = plan.days.map((d: any) => {
      if (d.day !== selectedDay.day) return d
      const exercises = [...d.exercises]
      const idx = exercises.findIndex((e: any) => e.id === exerciseId)
      if (idx < 0) return d
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= exercises.length) return d
      ;[exercises[idx], exercises[swapIdx]] = [exercises[swapIdx], exercises[idx]]
      return { ...d, exercises }
    })
    const updatedPlan = { ...plan, days: updatedDays }
    setPlan(updatedPlan)
    setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
    savePlanToServer(updatedPlan)
  }

  const exerciseSets = (exerciseId: string) => sets.filter(s => s.exercise_id === exerciseId)

  const circumference = 2 * Math.PI * 40
  const restProgress = restTimer !== null ? (restTimer / restMax) * circumference : 0

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#b4b4c8' }}>Today</p>
            {autoSaving && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#f97316' }}>
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Saving...
              </span>
            )}
            {!autoSaving && savedOk === true && (
              <span className="text-xs font-bold" style={{ color: '#4ade80' }}>✓ Saved</span>
            )}
            {!autoSaving && savedOk === false && (
              <span className="text-xs font-bold" style={{ color: '#f87171' }}>⚠ Not saved, check connection</span>
            )}
          </div>
          <h1 className="font-bold text-2xl">{selectedDay?.name || 'Workout'}</h1>
          {selectedDay && <p className="text-sm mt-0.5" style={{ color: '#f97316' }}>{selectedDay.focus}</p>}
        </div>
        {selectedDay && (
          <button
            onClick={() => setEditMode(prev => !prev)}
            className="mt-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: editMode ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
              border: `1px solid ${editMode ? '#f97316' : '#1c1c2e'}`,
              color: editMode ? '#f97316' : '#888',
            }}>
            {editMode ? 'Done Editing' : 'Edit Plan'}
          </button>
        )}
      </div>

      {/* Session bar: start / live clock / finished */}
      {selectedDay && (
        <div className="mx-5 mb-4">
          {!startedAt ? (
            <button onClick={startWorkout}
              className="w-full py-4 rounded-2xl font-bold text-lg active:scale-95 transition-all"
              style={{ background: '#22c55e', color: '#fff', boxShadow: '0 4px 0 #15803d' }}>
              ▶ Start workout
            </button>
          ) : null}
          {!startedAt && <WarmCoolCard kind="warmup" />}
          {!startedAt ? null : !endedAt ? (
            <div className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid #22c55e' }}>
              <div>
                <div className="text-xs uppercase tracking-widest font-bold" style={{ color: '#86efac' }}>● In progress · started {clock(startedAt)}</div>
                <div className="text-3xl font-bold mt-1 font-mono" style={{ color: '#f0f0f0' }}>{elapsedLabel(startedAt)}</div>
              </div>
              <button onClick={finishWorkout} disabled={saving || sets.length === 0}
                className="px-4 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                style={{ background: '#f97316', color: '#fff' }}>🏁 Finish</button>
            </div>
          ) : (
            <button onClick={openSummary} className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
              style={{ background: '#0f0f1a', border: '2px solid #22c55e' }}>
              <div className="text-xs uppercase tracking-widest font-bold" style={{ color: '#86efac' }}>✅ Workout finished</div>
              <div className="text-lg font-bold mt-1" style={{ color: '#f0f0f0' }}>
                {clock(startedAt)} → {clock(endedAt)} · {minutesBetween(startedAt, endedAt)} min{sessionKcal != null ? ` · 🔥 ${sessionKcal} kcal` : ''}
              </div>
              <div className="text-sm mt-0.5" style={{ color: '#b4b4c8' }}>Tap for summary</div>
            </button>
          )}
          {endedAt && <WarmCoolCard kind="cooldown" />}
        </div>
      )}

      {showSummary && (
        <WorkoutSummary
          dayName={selectedDay?.name || dayName}
          startedAt={startedAt}
          endedAt={endedAt}
          minutes={minutesBetween(startedAt, endedAt)}
          sets={sets}
          strengthKcal={sessionKcal ?? 0}
          cardio={summaryCardio}
          onClose={() => setShowSummary(false)}
          onContinue={continueWorkout}
        />
      )}

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
            <div className="text-sm" style={{ color: '#b4b4c8' }}>Next set starting soon...</div>
          </div>
          <button onClick={() => setRestTimer(null)} className="text-xs px-3 py-2 rounded-lg"
            style={{ background: '#1c1c2e', color: '#b4b4c8' }}>Skip</button>
        </div>
      )}

      {/* Day selector */}
      {plan?.days && (
        <div className="px-5 mb-4">
          <div className="overflow-x-auto">
            <div className="flex gap-2 w-max">
              {plan.days.map((d: any) => {
                const isSelected = selectedDay?.day === d.day
                return (
                  <div key={d.day} className="flex items-center gap-0.5">
                    <button onClick={() => setSelectedDay(d)}
                      className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                      style={{
                        background: isSelected ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
                        border: `1px solid ${isSelected ? '#f97316' : '#1c1c2e'}`,
                        color: isSelected ? '#f97316' : '#888',
                        borderRadius: editMode && isSelected ? '12px 0 0 12px' : undefined,
                      }}>
                      {d.day}
                    </button>
                    {editMode && isSelected && (
                      <button onClick={() => deleteDay(d.day)}
                        className="px-2 py-2 text-xs font-medium transition-all"
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderLeft: 'none',
                          borderRadius: '0 12px 12px 0',
                          color: '#ef4444',
                        }}>
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {editMode && plan.days.length < 7 && (
                <button onClick={addDay}
                  className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                  style={{
                    background: 'rgba(249,115,22,0.08)',
                    border: '1px dashed rgba(249,115,22,0.3)',
                    color: '#f97316',
                  }}>
                  + Add Day
                </button>
              )}
            </div>
          </div>
          {/* Rename day dropdown */}
          {editMode && selectedDay && (<>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs" style={{ color: '#9a9ab0' }}>Day:</span>
              <select
                value={selectedDay.day}
                onChange={e => renameDay(selectedDay.day, e.target.value)}
                className="rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}>
                {WEEKDAYS.map(wd => (
                  <option key={wd} value={wd} disabled={wd !== selectedDay.day && plan.days.some((d: any) => d.day === wd)}>
                    {wd}{wd !== selectedDay.day && plan.days.some((d: any) => d.day === wd) ? ' (taken)' : ''}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={selectedDay.name}
                onChange={e => {
                  const updatedDays = plan.days.map((d: any) =>
                    d.day === selectedDay.day ? { ...d, name: e.target.value } : d
                  )
                  const updatedPlan = { ...plan, days: updatedDays }
                  setPlan(updatedPlan)
                  setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
                }}
                onBlur={() => savePlanToServer(plan)}
                placeholder="Day name (e.g. Push Day)"
                className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs" style={{ color: '#9a9ab0' }}>Focus:</span>
              <input
                type="text"
                value={selectedDay.focus || ''}
                onChange={e => {
                  const updatedDays = plan.days.map((d: any) =>
                    d.day === selectedDay.day ? { ...d, focus: e.target.value } : d
                  )
                  const updatedPlan = { ...plan, days: updatedDays }
                  setPlan(updatedPlan)
                  setSelectedDay(updatedDays.find((d: any) => d.day === selectedDay.day))
                }}
                onBlur={() => savePlanToServer(plan)}
                placeholder="e.g. Chest, Shoulders, Triceps"
                className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}
              />
            </div>
          </>)}
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
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {editMode ? (
                        <input
                          type="text"
                          value={exercise.name}
                          onChange={e => updateExerciseField(exercise.id, 'name', e.target.value)}
                          onBlur={saveExerciseEdits}
                          className="font-semibold bg-transparent outline-none border-b w-full"
                          style={{ borderColor: '#f97316', color: '#f0f0f0' }}
                        />
                      ) : (
                        <h3 className="font-bold text-base" style={{ color: '#f0f0f0' }}>{exercise.name}</h3>
                      )}
                      {hasPR && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 flex-shrink-0">🏆 PR!</span>}
                    </div>
                    {!editMode && (
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs capitalize px-2 py-0.5 rounded-lg" style={{ background: '#14141f', color: '#b4b4c8' }}>
                          {exercise.muscle_group}
                        </span>
                        <span className="text-xs" style={{ color: '#b4b4c8' }}>
                          {exercise.sets}×{exercise.reps} · {exercise.rest_seconds}s rest
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editMode ? (
                      <>
                        <button onClick={() => moveExercise(exercise.id, 'up')} className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: '#14141f', color: '#b4b4c8' }}>↑</button>
                        <button onClick={() => moveExercise(exercise.id, 'down')} className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: '#14141f', color: '#b4b4c8' }}>↓</button>
                        <div className="relative">
                          <button onClick={() => setMovingExercise(movingExercise === exercise.id ? null : exercise.id)}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{
                              background: movingExercise === exercise.id ? 'rgba(59,130,246,0.15)' : '#14141f',
                              color: movingExercise === exercise.id ? '#3b82f6' : '#888',
                              border: movingExercise === exercise.id ? '1px solid #3b82f6' : '1px solid transparent',
                            }}>
                            Move
                          </button>
                          {movingExercise === exercise.id && (
                            <div className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-lg"
                              style={{ background: '#14141f', border: '1px solid #1c1c2e', minWidth: '140px' }}>
                              <div className="px-3 py-1.5 text-xs" style={{ color: '#9a9ab0', borderBottom: '1px solid #1c1c2e' }}>
                                Move to...
                              </div>
                              {plan.days
                                .filter((d: any) => d.day !== selectedDay.day)
                                .map((d: any) => (
                                  <button key={d.day}
                                    onClick={() => moveExerciseToDay(exercise.id, d.day)}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                    style={{ color: '#f0f0f0' }}>
                                    {d.day} <span style={{ color: '#9a9ab0' }}>· {d.name}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => removeExercise(exercise.id)} className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Remove</button>
                      </>
                    ) : (
                      <button onClick={() => startRest(exercise.rest_seconds)}
                        className="text-xs px-2 py-1 rounded-lg" style={{ background: '#14141f', color: '#b4b4c8' }}>
                        ⏱ Timer
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit mode: inline fields for muscle group, sets, reps, rest */}
                {editMode && (
                  <>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div>
                        <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Muscle</label>
                        <select
                          value={exercise.muscle_group}
                          onChange={e => { updateExerciseField(exercise.id, 'muscle_group', e.target.value); saveExerciseEdits() }}
                          className="w-full rounded-lg px-2 py-1.5 text-xs outline-none capitalize"
                          style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}>
                          {MUSCLE_GROUPS.map(mg => (
                            <option key={mg} value={mg}>{mg}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Sets</label>
                        <NumInput decimals={false} value={exercise.sets} onChange={n => updateExerciseField(exercise.id, 'sets', Math.min(n, 20) || 1)}
                          onBlur={saveExerciseEdits}
                          className="w-full rounded-lg px-2 py-1.5 text-xs text-center outline-none"
                          style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
                      </div>
                      <div>
                        <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Reps</label>
                        <input type="text" value={exercise.reps}
                          onChange={e => updateExerciseField(exercise.id, 'reps', e.target.value)}
                          onBlur={saveExerciseEdits}
                          className="w-full rounded-lg px-2 py-1.5 text-xs text-center outline-none"
                          style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
                      </div>
                      <div>
                        <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Rest(s)</label>
                        <NumInput decimals={false} value={exercise.rest_seconds} onChange={n => updateExerciseField(exercise.id, 'rest_seconds', n)}
                          onBlur={saveExerciseEdits}
                          className="w-full rounded-lg px-2 py-1.5 text-xs text-center outline-none"
                          style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>YouTube Link</label>
                      <input
                        type="url"
                        placeholder="https://youtube.com/watch?v=..."
                        value={exercise.youtube_url || ''}
                        onChange={e => updateExerciseField(exercise.id, 'youtube_url', e.target.value)}
                        onBlur={saveExerciseEdits}
                        className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}
                      />
                    </div>
                  </>
                )}

                {/* YouTube link in normal mode */}
                {!editMode && exercise.youtube_url && (
                  <div className="mt-1">
                    <a
                      href={exercise.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.5 31.5 0 000 12a31.5 31.5 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.5 31.5 0 0024 12a31.5 31.5 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>
                      Watch Form
                    </a>
                  </div>
                )}
              </div>

              {/* Sets: Set | Previous | kg | Reps | RPE | ✓ */}
              {exSets.length > 0 && (
                <div className="px-3">
                  <div className="grid gap-1.5 mb-1 px-1 text-[11px] font-bold uppercase tracking-wide"
                    style={{ gridTemplateColumns: '28px 1fr 64px 52px 40px 40px', color: '#b4b4c8' }}>
                    <span>Set</span><span>Previous</span><span className="text-center">kg</span>
                    <span className="text-center">Reps</span><span className="text-center">RPE</span><span className="text-center">✓</span>
                  </div>
                  {exSets.map((s, localIdx) => {
                    const globalIdx = sets.findIndex(gs => gs === s)
                    const prev = previous[exercise.name]?.[localIdx]
                    const done = !!s.done
                    const inputStyle = {
                      background: done ? 'rgba(34,197,94,0.18)' : '#14141f',
                      border: `1px solid ${done ? '#22c55e' : '#2a2a40'}`, color: '#f0f0f0',
                    }
                    return (
                      <div key={localIdx} className="grid gap-1.5 mb-1.5 items-center rounded-xl px-1 py-1"
                        style={{ gridTemplateColumns: '28px 1fr 64px 52px 40px 40px', background: done ? 'rgba(34,197,94,0.08)' : 'transparent' }}>
                        <button onClick={() => removeSet(globalIdx)} title="Remove set"
                          className="text-sm font-bold text-left" style={{ color: s.is_pr ? '#fbbf24' : '#f0f0f0' }}>
                          {s.set_number}{s.is_pr ? '🏆' : ''}
                        </button>
                        <button disabled={!prev}
                          onClick={() => { if (prev) { updateSet(globalIdx, 'weight_kg', prev.weight_kg); updateSet(globalIdx, 'reps', prev.reps) } }}
                          className="text-sm font-semibold text-left truncate" style={{ color: prev ? '#b4b4c8' : '#6b6b80' }}>
                          {prev ? `${prev.weight_kg} kg × ${prev.reps}` : '—'}
                        </button>
                        <NumInput value={s.weight_kg} onChange={n => updateSet(globalIdx, 'weight_kg', n)}
                          className="rounded-lg px-1 py-2 text-base font-bold text-center w-full outline-none" style={inputStyle} />
                        <NumInput decimals={false} value={s.reps} onChange={n => updateSet(globalIdx, 'reps', Math.min(n, 100))}
                          className="rounded-lg px-1 py-2 text-base font-bold text-center w-full outline-none" style={inputStyle} />
                        <button onClick={() => updateSet(globalIdx, 'rpe', (s.rpe || 7) >= 10 ? 5 : (s.rpe || 7) + 1)}
                          title="Effort 1-10 (tap to change)"
                          className="rounded-lg py-2 text-sm font-bold text-center" style={{ ...inputStyle, color: (s.rpe || 7) >= 8 ? '#fb923c' : '#f0f0f0' }}>
                          {s.rpe || 7}
                        </button>
                        <button onClick={() => toggleDone(globalIdx, exercise.rest_seconds)}
                          className="rounded-lg py-2 text-base font-bold active:scale-90 transition-all"
                          style={{ background: done ? '#22c55e' : '#1c1c2e', color: done ? '#fff' : '#9a9ab0', boxShadow: done ? '0 2px 0 #15803d' : 'none' }}>
                          ✓
                        </button>
                      </div>
                    )
                  })}
                  <p className="text-[11px] px-1 mb-1" style={{ color: '#9a9ab0' }}>Tap ✓ to finish a set and start rest · tap Previous to copy it · tap the set number to delete</p>
                </div>
              )}

              {/* Add set button */}
              <div className="px-3 pb-3 pt-1">
                <button onClick={() => addSet(exercise)}
                  className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all"
                  style={{ background: 'rgba(249,115,22,0.14)', color: '#fb923c', border: '1px dashed rgba(249,115,22,0.5)' }}>
                  + Add Set
                </button>
              </div>
            </div>
          )
        })}

        {/* Sort by body structure (edit mode) */}
        {editMode && selectedDay && (
          <button onClick={sortDay}
            className="w-full py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all"
            style={{ background: '#1c1c2e', color: '#f0f0f0', border: '1px solid #2a2a40' }}>
            ↕ Sort by body order (legs → back → chest → shoulders → arms → core)
          </button>
        )}

        {/* Add Exercise (edit mode) */}
        {editMode && selectedDay && !showAddExercise && (
          <button onClick={() => setShowAddExercise(true)}
            className="w-full py-3 rounded-2xl text-sm font-medium transition-all"
            style={{ background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px dashed rgba(249,115,22,0.3)' }}>
            + Add Exercise
          </button>
        )}

        {/* Add Exercise Form */}
        {editMode && showAddExercise && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#0f0f1a', border: '1px solid #f97316' }}>
            <p className="text-xs uppercase tracking-widest" style={{ color: '#f97316' }}>New Exercise</p>
            <input
              type="text"
              placeholder="Exercise name"
              value={newExercise.name}
              onChange={e => setNewExercise(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Muscle Group</label>
                <select
                  value={newExercise.muscle_group}
                  onChange={e => setNewExercise(prev => ({ ...prev, muscle_group: e.target.value }))}
                  className="w-full rounded-lg px-2 py-2 text-sm outline-none capitalize"
                  style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}>
                  {MUSCLE_GROUPS.map(mg => (
                    <option key={mg} value={mg}>{mg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Equipment</label>
                <input type="text" placeholder="e.g. Barbell"
                  value={newExercise.equipment}
                  onChange={e => setNewExercise(prev => ({ ...prev, equipment: e.target.value }))}
                  className="w-full rounded-lg px-2 py-2 text-sm outline-none"
                  style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
              </div>
            </div>
            <div>
              <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>YouTube Link</label>
              <input type="url" placeholder="https://youtube.com/watch?v=..."
                value={newExercise.youtube_url}
                onChange={e => setNewExercise(prev => ({ ...prev, youtube_url: e.target.value }))}
                className="w-full rounded-lg px-2 py-2 text-sm outline-none"
                style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Sets</label>
                <NumInput decimals={false} value={newExercise.sets} onChange={n => setNewExercise(prev => ({ ...prev, sets: n || 1 }))}
                  className="w-full rounded-lg px-2 py-2 text-sm text-center outline-none"
                  style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
              </div>
              <div>
                <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Reps</label>
                <input type="text" value={newExercise.reps}
                  onChange={e => setNewExercise(prev => ({ ...prev, reps: e.target.value }))}
                  className="w-full rounded-lg px-2 py-2 text-sm text-center outline-none"
                  style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
              </div>
              <div>
                <label className="text-xs block mb-0.5" style={{ color: '#9a9ab0' }}>Rest (s)</label>
                <NumInput decimals={false} value={newExercise.rest_seconds} onChange={n => setNewExercise(prev => ({ ...prev, rest_seconds: n }))}
                  className="w-full rounded-lg px-2 py-2 text-sm text-center outline-none"
                  style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addExercise}
                disabled={!newExercise.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: '#f97316', color: '#fff' }}>
                Add
              </button>
              <button onClick={() => setShowAddExercise(false)}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ background: '#14141f', color: '#b4b4c8' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Save button */}
        {sets.length > 0 && (
          <button onClick={endedAt ? openSummary : finishWorkout} disabled={saving}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50"
            style={{ background: endedAt ? '#22c55e' : '#f97316', color: '#fff' }}>
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Finishing...
              </span>
            ) : endedAt ? '✅ Finished · View summary' : `🏁 Finish workout (${sets.length} sets)`}
          </button>
        )}

        {/* Progressive overload tips */}
        {saved && Object.keys(overloadTips).length > 0 && (
          <div className="rounded-2xl p-4 animate-fade-in" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#b4b4c8' }}>📈 Next Session Targets</p>
            <div className="space-y-2">
              {Object.entries(overloadTips).map(([name, tip]: [string, any]) => (
                <div key={name} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#1c1c2e' }}>
                  <span className="text-sm font-medium">{name}</span>
                  <div className="text-right">
                    <span className="font-bold text-sm" style={{ color: '#f97316' }}>
                      {tip.suggested_weight_kg}kg × {tip.suggested_reps}
                    </span>
                    <div className="text-xs" style={{ color: '#9a9ab0' }}>{tip.reasoning}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cardio (scan the machine's summary screen or add manually) */}
        <CardioCard date={today} />
        <HomeDayCard trainingDays={trainingDays} />

        {!selectedDay && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">😴</div>
            <h3 className="font-semibold text-lg">Rest Day</h3>
            <p className="text-sm mt-1" style={{ color: '#b4b4c8' }}>Recovery is part of the plan</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
