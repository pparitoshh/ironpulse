'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BottomNav } from '@/components/ui/BottomNav'

const MUSCLE_GROUPS = ['chest','back','shoulders','biceps','triceps','abs','quads','hamstrings','glutes','calves']

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)
  const [todayLog, setTodayLog] = useState<any>(null)
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [todayFood, setTodayFood] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') loadData()
  }, [status])

  async function loadData() {
    try {
      // Check profile first — redirect to onboarding if missing
      const profileRes = await fetch('/api/get-progress')
      const p = await profileRes.json()
      if (!p || !p.gender) { router.push('/onboarding'); return }
      setProfile(p)

      // Fetch remaining data in parallel — generate-plan GET returns existing plan only
      const [planRes, logRes, foodRes, recentRes] = await Promise.all([
        fetch('/api/generate-plan'),
        fetch(`/api/log-workout?date=${today}`),
        fetch(`/api/log-food?date=${today}`),
        fetch('/api/log-workout?limit=7'),
      ])
      const [pl, l, f, r] = await Promise.all([
        planRes.json(), logRes.json(), foodRes.json(), recentRes.json()
      ])
      setPlan(pl.plan)
      setTodayLog(Array.isArray(l) ? l[0] : l)
      setTodayFood(f)
      setRecentLogs(r)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const todayCalories = todayFood.reduce((s: number, f: any) => s + f.calories, 0)
  const todayProtein = todayFood.reduce((s: number, f: any) => s + parseFloat(f.protein_g || 0), 0)
  const workoutStreak = recentLogs.filter(l => l.sets?.length > 0).length
  const todayPlan = plan?.days?.find((d: any) => d.day === dayName) || plan?.days?.[0]

  // Muscle heatmap from recent logs
  const trainedMuscles = new Set<string>()
  recentLogs.slice(0, 3).forEach((log: any) => {
    log.sets?.forEach((s: any) => {
      if (s.muscle_group) trainedMuscles.add(s.muscle_group)
    })
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
      <div className="text-center">
        <div className="font-display text-5xl mb-2" style={{ color: '#f97316' }}>IRON<br/>PULSE</div>
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mt-6" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: '#888' }}>{dayName}</p>
          <h1 className="font-display text-4xl tracking-wide" style={{ color: '#f97316' }}>IRONPULSE</h1>
          <p className="text-sm mt-0.5" style={{ color: '#666' }}>
            Hey {session?.user?.name?.split(' ')[0]} 👋
          </p>
        </div>
        <button onClick={() => signOut()} className="text-xs px-3 py-2 rounded-lg" style={{ background: '#0f0f1a', color: '#666', border: '1px solid #1c1c2e' }}>
          Sign out
        </button>
      </div>

      <div className="px-5 space-y-4">
        {/* Today's workout card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#888' }}>Today's Workout</p>
              <h2 className="font-semibold text-lg">{todayPlan?.name || 'Rest Day'}</h2>
              {todayPlan && <p className="text-xs mt-0.5" style={{ color: '#f97316' }}>{todayPlan.focus}</p>}
            </div>
            {todayLog?.sets?.length > 0 ? (
              <span className="text-2xl">✅</span>
            ) : (
              <span className="px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                Pending
              </span>
            )}
          </div>
          {todayPlan && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-1 mb-3">
                {todayPlan.exercises?.slice(0, 4).map((ex: any, i: number) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#14141f', color: '#aaa' }}>
                    {ex.name}
                  </span>
                ))}
                {todayPlan.exercises?.length > 4 && (
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ background: '#14141f', color: '#555' }}>
                    +{todayPlan.exercises.length - 4} more
                  </span>
                )}
              </div>
              <Link href="/workout" className="block w-full text-center py-3 rounded-xl font-semibold text-sm"
                style={{ background: '#f97316', color: '#fff' }}>
                {todayLog?.sets?.length > 0 ? 'Continue Workout' : 'Start Workout →'}
              </Link>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Calories', value: todayCalories, target: profile?.target_calories, unit: 'kcal', color: '#f97316' },
            { label: 'Protein', value: Math.round(todayProtein), target: profile?.target_protein, unit: 'g', color: '#3b82f6' },
            { label: 'Streak', value: workoutStreak, target: null, unit: 'days', color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-2xl text-center" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              {s.target && <div className="text-xs" style={{ color: '#555' }}>/{s.target}</div>}
              <div className="text-xs mt-1" style={{ color: '#888' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Calorie progress bar */}
        {profile?.target_calories && (
          <div className="p-4 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            <div className="flex justify-between text-xs mb-2" style={{ color: '#888' }}>
              <span>Calories Today</span>
              <span style={{ color: '#f97316' }}>{todayCalories} / {profile.target_calories} kcal</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1c1c2e' }}>
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (todayCalories / profile.target_calories) * 100)}%`,
                  background: todayCalories > profile.target_calories ? '#ef4444' : '#f97316'
                }} />
            </div>
          </div>
        )}

        {/* Muscle heatmap */}
        <div className="p-4 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>Muscles Trained (Last 3 days)</p>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map(m => (
              <span key={m} className="text-xs px-2 py-1 rounded-lg capitalize transition-all"
                style={{
                  background: trainedMuscles.has(m) ? 'rgba(249,115,22,0.2)' : '#14141f',
                  color: trainedMuscles.has(m) ? '#f97316' : '#444',
                  border: `1px solid ${trainedMuscles.has(m) ? '#f97316' : '#1c1c2e'}`,
                }}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Recent workouts */}
        <div className="p-4 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>Recent Activity</p>
          {recentLogs.length === 0 ? (
            <p className="text-sm" style={{ color: '#555' }}>No workouts logged yet. Start today!</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.slice(0, 5).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#1c1c2e' }}>
                  <div>
                    <div className="text-sm font-medium">{log.day_name || 'Workout'}</div>
                    <div className="text-xs" style={{ color: '#888' }}>{log.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm" style={{ color: '#f97316' }}>{log.sets?.length || 0} sets</div>
                    {log.duration_minutes && <div className="text-xs" style={{ color: '#666' }}>{log.duration_minutes}m</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          <Link href="/food" className="p-4 rounded-2xl text-center"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            <div className="text-3xl mb-1">🍽️</div>
            <div className="text-sm font-medium">Log Food</div>
          </Link>
          <Link href="/progress" className="p-4 rounded-2xl text-center"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            <div className="text-3xl mb-1">📈</div>
            <div className="text-sm font-medium">View Progress</div>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
