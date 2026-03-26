'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { BottomNav } from '@/components/ui/BottomNav'

export default function ProgressPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [measurements, setMeasurements] = useState<any[]>([])
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showMeasure, setShowMeasure] = useState(false)
  const [measure, setMeasure] = useState({ weight_kg: '', chest_cm: '', waist_cm: '', hips_cm: '', bicep_cm: '', thigh_cm: '' })
  const [activeChart, setActiveChart] = useState<'weight' | 'calories' | 'volume'>('weight')
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') loadData()
  }, [status])

  const [calorieData, setCalorieData] = useState<any[]>([])

  async function loadData() {
    const [mRes, wRes, pRes] = await Promise.all([
      fetch('/api/log-measurement'),
      fetch('/api/log-workout?limit=30'),
      fetch('/api/get-progress'),
    ])
    const [m, w, p] = await Promise.all([mRes.json(), wRes.json(), pRes.json()])
    setMeasurements(m)
    setWorkoutLogs(w)
    setProfile(p)

    // Fetch last 7 days of food logs for calorie chart
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toISOString().slice(0, 10)
    })
    const foodResults = await Promise.all(last7.map(date => fetch(`/api/log-food?date=${date}`).then(r => r.json())))
    const calData = last7.map((date, i) => ({
      date: date.slice(5),
      calories: (foodResults[i] as any[]).reduce((s: number, f: any) => s + (f.calories || 0), 0),
    }))
    setCalorieData(calData)

    setLoading(false)
  }

  async function saveMeasurement() {
    const body = Object.fromEntries(
      Object.entries(measure).filter(([, v]) => v !== '').map(([k, v]) => [k, parseFloat(v as string)])
    )
    await fetch('/api/log-measurement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, ...body }),
    })
    await loadData()
    setShowMeasure(false)
    setMeasure({ weight_kg: '', chest_cm: '', waist_cm: '', hips_cm: '', bicep_cm: '', thigh_cm: '' })
  }

  // PRs from workout logs
  const prMap: Record<string, { weight: number; date: string }> = {}
  workoutLogs.forEach((log: any) => {
    log.sets?.forEach((s: any) => {
      const key = s.exercise_name
      if (!prMap[key] || s.weight_kg > prMap[key].weight) {
        prMap[key] = { weight: s.weight_kg, date: log.date }
      }
    })
  })
  const prs = Object.entries(prMap).sort((a, b) => b[1].weight - a[1].weight)

  // Weekly volume
  const weeklyVolume = workoutLogs.slice(0, 7).map((log: any) => ({
    date: log.date?.slice(5),
    sets: log.sets?.length || 0,
    volume: log.sets?.reduce((s: number, set: any) => s + (set.weight_kg * set.reps), 0) || 0,
  })).reverse()

  // Weight chart data
  const weightData = measurements.filter(m => m.weight_kg).map(m => ({
    date: m.date?.slice(5),
    weight: m.weight_kg,
  }))

  // Streak
  const streak = workoutLogs.filter(l => l.sets?.length > 0).length
  const totalSets = workoutLogs.reduce((s, l) => s + (l.sets?.length || 0), 0)
  const latestWeight = measurements.length > 0 ? measurements[measurements.length - 1].weight_kg : null
  const firstWeight = measurements.length > 1 ? measurements[0].weight_kg : null
  const weightChange = latestWeight && firstWeight ? (latestWeight - firstWeight).toFixed(1) : null

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
      <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="px-3 py-2 rounded-xl text-xs" style={{ background: '#14141f', border: '1px solid #1c1c2e' }}>
          <p style={{ color: '#888' }}>{label}</p>
          <p style={{ color: '#f97316' }}>{payload[0]?.value} {activeChart === 'weight' ? 'kg' : activeChart === 'calories' ? 'kcal' : 'sets'}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#888' }}>Analytics</p>
          <h1 className="font-bold text-2xl">Progress</h1>
        </div>
        <button onClick={() => setShowMeasure(true)}
          className="px-3 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
          + Measure
        </button>
      </div>

      <div className="px-5 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Workouts', value: streak, unit: 'logged', color: '#f97316' },
            { label: 'Total Sets', value: totalSets, unit: 'sets', color: '#3b82f6' },
            { label: 'Weight Δ', value: weightChange ? `${weightChange}kg` : '–', unit: '', color: weightChange && parseFloat(weightChange) > 0 ? '#22c55e' : '#ef4444' },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-2xl text-center" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-1" style={{ color: '#888' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="p-4 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {([['weight', 'Body Weight'], ['volume', 'Workout Volume'], ['calories', 'Calories']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setActiveChart(k)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                style={{
                  background: activeChart === k ? 'rgba(249,115,22,0.15)' : '#14141f',
                  color: activeChart === k ? '#f97316' : '#888',
                  border: `1px solid ${activeChart === k ? '#f97316' : '#1c1c2e'}`,
                }}>
                {label}
              </button>
            ))}
          </div>

          {activeChart === 'weight' && (
            weightData.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weightData}>
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: '#555' }}>
                Log body weight measurements to see chart
              </div>
            )
          )}

          {activeChart === 'volume' && (
            weeklyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyVolume}>
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sets" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: '#555' }}>
                Log workouts to see volume chart
              </div>
            )
          )}

          {activeChart === 'calories' && (
            calorieData.some(d => d.calories > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={calorieData}>
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="calories" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: '#555' }}>
                Log food to see calorie chart
              </div>
            )
          )}
        </div>

        {/* Personal Records */}
        <div className="p-4 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>🏆 Personal Records</p>
          {prs.length === 0 ? (
            <p className="text-sm" style={{ color: '#555' }}>Start logging workouts to track PRs</p>
          ) : (
            <div className="space-y-2">
              {prs.slice(0, 8).map(([name, data]) => (
                <div key={name} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#1c1c2e' }}>
                  <span className="text-sm font-medium">{name}</span>
                  <div className="text-right">
                    <span className="font-bold" style={{ color: '#f97316' }}>{data.weight}kg</span>
                    <div className="text-xs" style={{ color: '#555' }}>{data.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest measurements */}
        {measurements.length > 0 && (
          <div className="p-4 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>Latest Measurements</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'weight_kg', label: 'Weight', unit: 'kg' },
                { key: 'chest_cm', label: 'Chest', unit: 'cm' },
                { key: 'waist_cm', label: 'Waist', unit: 'cm' },
                { key: 'bicep_cm', label: 'Bicep', unit: 'cm' },
                { key: 'hips_cm', label: 'Hips', unit: 'cm' },
                { key: 'thigh_cm', label: 'Thigh', unit: 'cm' },
              ].map(f => {
                const latest = [...measurements].reverse().find(m => m[f.key])
                return latest ? (
                  <div key={f.key} className="p-3 rounded-xl" style={{ background: '#14141f' }}>
                    <div className="text-xs mb-1" style={{ color: '#888' }}>{f.label}</div>
                    <div className="font-bold" style={{ color: '#f97316' }}>{latest[f.key]} {f.unit}</div>
                    <div className="text-xs" style={{ color: '#555' }}>{latest.date}</div>
                  </div>
                ) : null
              })}
            </div>
          </div>
        )}
      </div>

      {/* Measurement modal */}
      {showMeasure && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={e => e.target === e.currentTarget && setShowMeasure(false)}>
          <div className="w-full max-w-lg mx-auto rounded-t-3xl p-5"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Log Measurements</h2>
              <button onClick={() => setShowMeasure(false)} className="text-2xl" style={{ color: '#888' }}>×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { key: 'weight_kg', label: 'Weight (kg)' },
                { key: 'chest_cm', label: 'Chest (cm)' },
                { key: 'waist_cm', label: 'Waist (cm)' },
                { key: 'hips_cm', label: 'Hips (cm)' },
                { key: 'bicep_cm', label: 'Bicep (cm)' },
                { key: 'thigh_cm', label: 'Thigh (cm)' },
              ].map(f => (
                <div key={f.key} className="p-3 rounded-xl" style={{ background: '#14141f', border: '1px solid #1c1c2e' }}>
                  <div className="text-xs mb-1" style={{ color: '#888' }}>{f.label}</div>
                  <input type="number" step="0.1" placeholder="—"
                    value={(measure as any)[f.key]}
                    onChange={e => setMeasure(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: '#f0f0f0' }} />
                </div>
              ))}
            </div>
            <button onClick={saveMeasurement}
              className="w-full py-4 rounded-2xl font-bold"
              style={{ background: '#f97316', color: '#fff' }}>
              Save Measurements
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
