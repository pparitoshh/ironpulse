'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BottomNav } from '@/components/ui/BottomNav'
import { SESSION_TYPES, activityInfo, metCalories } from '@/lib/cardio'
import { localDate } from '@/lib/date'

type Catalog = {
  id: string
  user_id: string | null
  type: string
  title: string
  channel: string | null
  youtube_id: string
  duration_min: number
  level: string
  met: number
  equipment: string | null
  low_impact: boolean
  embeddable: boolean
}

const DURATIONS = [
  { value: 'any', label: 'Any' },
  { value: 'le15', label: '\u226415 min' },
  { value: '15to25', label: '15\u201325' },
  { value: '25plus', label: '25+ min' },
]

const LEVELS = [
  { value: 'any', label: 'Any level' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const SESSION_VALUES = SESSION_TYPES.map(t => t.value)

function Spinner({ color = '#f97316' }: { color?: string }) {
  return (
    <span
      className="inline-block animate-spin rounded-full align-middle"
      style={{ width: 16, height: 16, border: '2px solid #2a2a40', borderTopColor: color }}
    />
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap active:scale-95 transition-all"
      style={{ background: active ? '#f97316' : '#1c1c2e', color: active ? '#ffffff' : '#f0f0f0' }}
    >
      {children}
    </button>
  )
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function SessionPlayer({
  session,
  weightKg,
  onClose,
  onSaved,
}: {
  session: Catalog
  weightKg: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const startRef = useRef<number | null>(null)
  const accumulatedRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const tick = () => {
      if (startRef.current == null) return
      setElapsed(accumulatedRef.current + (Date.now() - startRef.current) / 1000)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [running])

  function startSession() {
    accumulatedRef.current = 0
    startRef.current = Date.now()
    setElapsed(0)
    setRunning(true)
  }

  function pauseSession() {
    if (startRef.current != null) {
      accumulatedRef.current += (Date.now() - startRef.current) / 1000
    }
    startRef.current = null
    setRunning(false)
  }

  function resumeSession() {
    startRef.current = Date.now()
    setRunning(true)
  }

  async function logSession(durationMin: number) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/cardio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: localDate(),
          machine: session.type,
          duration_min: durationMin,
          mets: session.met,
          title: session.title,
          catalog_id: session.id,
          source: 'video',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not save session')
      setSaved(data)
      setRunning(false)
      startRef.current = null
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Could not save session')
    } finally {
      setSaving(false)
    }
  }

  function finish() {
    const mins = Math.max(1, Math.round((elapsed / 60) * 10) / 10)
    logSession(mins)
  }

  const started = running || elapsed > 0
  const liveKcal = metCalories(Number(session.met), elapsed / 60, weightKg)

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: '#080810' }}>
      <div className="max-w-lg mx-auto px-5 pt-12 pb-16">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-bold active:scale-95 transition-all"
            style={{ background: '#1c1c2e', color: '#f0f0f0' }}
          >
            ← Back
          </button>
          <h2 className="flex-1 min-w-0 truncate font-bold text-base" style={{ color: '#f0f0f0' }}>
            {session.title}
          </h2>
        </div>

        {saved ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: '#0f0f1a', border: '1px solid #22c55e' }}
          >
            <div className="text-5xl mb-3">✅</div>
            <h3 className="font-bold text-xl" style={{ color: '#22c55e' }}>
              Session logged!
            </h3>
            <p className="mt-2 text-sm" style={{ color: '#b4b4c8' }}>
              {saved.duration_min} min · {Math.round(Number(saved.calories) || 0)} kcal
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-6 rounded-2xl py-4 font-bold text-base active:scale-95 transition-all"
              style={{ background: '#f97316', color: '#ffffff' }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {session.embeddable ? (
              <iframe
                className="w-full aspect-video rounded-xl"
                src={`https://www.youtube-nocookie.com/embed/${session.youtube_id}?rel=0&modestbranding=1&playsinline=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                title={session.title}
              />
            ) : (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${session.youtube_id}/hqdefault.jpg`}
                  alt={session.title}
                  className="w-full aspect-video object-cover rounded-xl"
                />
                <a
                  href={`https://www.youtube.com/watch?v=${session.youtube_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span
                    className="rounded-2xl py-4 px-6 font-bold text-base active:scale-95 transition-all"
                    style={{ background: '#f97316', color: '#ffffff' }}
                  >
                    ▶ Open in YouTube
                  </span>
                </a>
              </div>
            )}

            <a
              href={`https://www.youtube.com/watch?v=${session.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs underline"
              style={{ color: '#b4b4c8' }}
            >
              Open in YouTube app ↗
            </a>

            <div
              className="mt-5 rounded-2xl p-4"
              style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}
            >
              <div className="flex items-center justify-between">
                <div className="font-mono text-4xl font-bold" style={{ color: '#f0f0f0' }}>
                  {mmss(elapsed)}
                </div>
                <div className="text-lg font-bold" style={{ color: '#f97316' }}>
                  🔥 {liveKcal} kcal
                </div>
              </div>

              {!started ? (
                <div className="mt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={startSession}
                    className="w-full rounded-2xl py-4 font-bold text-base active:scale-95 transition-all"
                    style={{ background: '#f97316', color: '#ffffff' }}
                  >
                    ▶ Start session
                  </button>
                  <button
                    type="button"
                    onClick={() => logSession(session.duration_min)}
                    disabled={saving}
                    className="w-full rounded-2xl py-4 font-bold text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: '#1c1c2e', color: '#f0f0f0' }}
                  >
                    {saving && <Spinner />}✔ Mark as done ({session.duration_min} min)
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={running ? pauseSession : resumeSession}
                    className="flex-1 rounded-2xl py-4 font-bold text-base active:scale-95 transition-all"
                    style={{ background: '#1c1c2e', color: '#f0f0f0' }}
                  >
                    {running ? '⏸ Pause' : '▶ Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={finish}
                    disabled={saving}
                    className="flex-1 rounded-2xl py-4 font-bold text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: '#22c55e', color: '#ffffff' }}
                  >
                    {saving && <Spinner color="#ffffff" />}✅ Finish
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-3 text-sm font-semibold" style={{ color: '#ef4444' }}>
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SessionsPage() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const playId = searchParams.get('play')

  const [catalog, setCatalog] = useState<Catalog[]>([])
  const [doneToday, setDoneToday] = useState<any[]>([])
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [durFilter, setDurFilter] = useState<string>('any')
  const [levelFilter, setLevelFilter] = useState<string>('any')

  const [active, setActive] = useState<Catalog | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [formUrl, setFormUrl] = useState('')
  const [formType, setFormType] = useState<string>(SESSION_TYPES[0].value)
  const [formDuration, setFormDuration] = useState('')
  const [formLevel, setFormLevel] = useState<string>('beginner')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const autoOpened = useRef(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') loadAll()
  }, [status])

  async function loadAll() {
    setLoading(true)
    try {
      const [catRes, progRes, cardioRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/get-progress'),
        fetch(`/api/cardio?date=${localDate()}`),
      ])
      const cat = catRes.ok ? await catRes.json() : []
      setCatalog(Array.isArray(cat) ? cat : [])

      const p = progRes.ok ? await progRes.json() : null
      const w = Number(p?.weight_kg)
      setWeightKg(w > 0 ? w : null)

      const c = cardioRes.ok ? await cardioRes.json() : []
      const arr = Array.isArray(c) ? c : []
      setDoneToday(arr.filter((r: any) => SESSION_VALUES.includes(r.machine)))
    } catch {
      setCatalog([])
      setDoneToday([])
    } finally {
      setLoading(false)
    }
  }

  async function reloadCatalog() {
    const res = await fetch('/api/sessions')
    const data = res.ok ? await res.json() : []
    setCatalog(Array.isArray(data) ? data : [])
  }

  async function reloadDone() {
    const res = await fetch(`/api/cardio?date=${localDate()}`)
    const data = res.ok ? await res.json() : []
    const arr = Array.isArray(data) ? data : []
    setDoneToday(arr.filter((r: any) => SESSION_VALUES.includes(r.machine)))
  }

  useEffect(() => {
    if (!playId || autoOpened.current || catalog.length === 0) return
    const found = catalog.find(s => String(s.id) === String(playId))
    if (found) {
      setActive(found)
      autoOpened.current = true
    }
  }, [playId, catalog])

  async function removeSession(id: string) {
    if (!window.confirm('Delete this video from your sessions?')) return
    try {
      const res = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete video')
      await reloadCatalog()
    } catch (e: any) {
      setAddError(e?.message || 'Could not delete video')
      setAddOpen(true)
    }
  }

  async function addVideo() {
    setAddError(null)
    const duration = Number(formDuration)
    if (!formUrl.trim()) {
      setAddError('Paste a YouTube link')
      return
    }
    if (!(duration > 0)) {
      setAddError('Enter the duration in minutes')
      return
    }
    setAddSaving(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formUrl.trim(),
          type: formType,
          duration_min: duration,
          level: formLevel,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not add video')
      await reloadCatalog()
      setAddOpen(false)
      setFormUrl('')
      setFormDuration('')
      setFormType(SESSION_TYPES[0].value)
      setFormLevel('beginner')
    } catch (e: any) {
      setAddError(e?.message || 'Could not add video')
    } finally {
      setAddSaving(false)
    }
  }

  const filtered = catalog.filter((s: Catalog) => {
    if (typeFilter !== 'all' && s.type !== typeFilter) return false
    if (levelFilter !== 'any' && s.level !== levelFilter) return false
    const d = Number(s.duration_min)
    if (durFilter === 'le15' && !(d <= 15)) return false
    if (durFilter === '15to25' && !(d > 15 && d <= 25)) return false
    if (durFilter === '25plus' && !(d > 25)) return false
    return true
  }).sort((a: Catalog, b: Catalog) => {
    // Own videos first, then the SESSION_TYPES order (HIIT, Yoga, ...), then shortest first.
    const own = Number(!!b.user_id) - Number(!!a.user_id)
    if (own) return own
    const order = SESSION_VALUES as readonly string[]
    const ta = order.indexOf(a.type), tb = order.indexOf(b.type)
    return ta - tb || Number(a.duration_min) - Number(b.duration_min)
  })

  return (
    <div className="min-h-screen pb-28" style={{ background: '#080810' }}>
      <div className="max-w-lg mx-auto px-5 pt-12">
        <h1 className="text-3xl font-bold" style={{ color: '#f0f0f0' }}>
          Home Sessions
        </h1>
        <p className="text-sm mt-1" style={{ color: '#b4b4c8' }}>
          HIIT, yoga &amp; more — for days you skip the gym
        </p>

        {/* Type filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-5 pb-1">
          <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            All
          </Chip>
          {SESSION_TYPES.map(t => (
            <Chip key={t.value} active={typeFilter === t.value} onClick={() => setTypeFilter(t.value)}>
              {t.icon} {t.label}
            </Chip>
          ))}
        </div>

        {/* Duration filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-1">
          {DURATIONS.map(d => (
            <Chip key={d.value} active={durFilter === d.value} onClick={() => setDurFilter(d.value)}>
              {d.label}
            </Chip>
          ))}
        </div>

        {/* Level filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-1">
          {LEVELS.map(l => (
            <Chip key={l.value} active={levelFilter === l.value} onClick={() => setLevelFilter(l.value)}>
              {l.label}
            </Chip>
          ))}
        </div>

        {doneToday.length > 0 && (
          <div className="mt-4 space-y-2">
            {doneToday.map(r => (
              <div
                key={r.id}
                className="rounded-2xl p-3 text-sm font-semibold"
                style={{ background: '#0f0f1a', border: '1px solid #22c55e', color: '#f0f0f0' }}
              >
                ✅ Done today: {r.title || activityInfo(r.machine).label} · {r.duration_min} min ·{' '}
                {Math.round(Number(r.calories) || 0)} kcal
              </div>
            ))}
          </div>
        )}

        {/* Session grid */}
        <div className="grid grid-cols-1 gap-4 mt-5">
          {loading && catalog.length === 0 ? (
            <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: '#b4b4c8' }}>
              <Spinner />
              Loading sessions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm py-8 text-center" style={{ color: '#b4b4c8' }}>
              No sessions match these filters.
            </div>
          ) : (
            filtered.map(s => {
              const info = activityInfo(s.type)
              const kcal = metCalories(Number(s.met), Number(s.duration_min), weightKg)
              return (
                <div
                  key={s.id}
                  onClick={() => setActive(s)}
                  className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-all"
                  style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${s.youtube_id}/hqdefault.jpg`}
                      alt={s.title}
                      className="w-full aspect-video object-cover"
                    />
                    <span
                      className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center text-base"
                      style={{ background: 'rgba(0,0,0,0.65)' }}
                    >
                      {info.icon}
                    </span>
                    <span
                      className="absolute bottom-2 right-2 rounded-lg px-2 py-0.5 text-xs font-bold"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#ffffff' }}
                    >
                      {s.duration_min} min
                    </span>
                    {s.user_id && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          removeSession(s.id)
                        }}
                        title="Delete"
                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold active:scale-95 transition-all"
                        style={{ background: 'rgba(0,0,0,0.7)', color: '#f0f0f0' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-base line-clamp-2" style={{ color: '#f0f0f0' }}>
                      {s.title}
                    </h3>
                    <div className="text-xs mt-1" style={{ color: '#b4b4c8' }}>
                      {[s.channel, s.level, `~${kcal} kcal`].filter(Boolean).join(' · ')}
                    </div>
                    {(s.user_id || s.low_impact || s.equipment === 'dumbbells') && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.user_id && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-lg font-bold"
                            style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}
                          >
                            Mine
                          </span>
                        )}
                        {s.low_impact && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-lg"
                            style={{ background: '#14141f', color: '#b4b4c8' }}
                          >
                            Low impact
                          </span>
                        )}
                        {s.equipment === 'dumbbells' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-lg"
                            style={{ background: '#14141f', color: '#b4b4c8' }}
                          >
                            Dumbbells
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Add your own video */}
        <div className="mt-6 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <button
            type="button"
            onClick={() => setAddOpen(v => !v)}
            className="w-full text-left px-4 py-4 font-bold text-base active:scale-95 transition-all"
            style={{ color: '#f0f0f0' }}
          >
            ➕ Add your own YouTube video
          </button>
          {addOpen && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #1c1c2e', paddingTop: 12 }}>
              <input
                type="url"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-xl px-3 py-2.5 font-semibold outline-none"
                style={{ background: '#14141f', border: '1px solid #2a2a40', color: '#f0f0f0' }}
              />

              <div>
                <div className="text-xs font-medium mb-1" style={{ color: '#b4b4c8' }}>
                  Type
                </div>
                <div className="flex flex-wrap gap-2">
                  {SESSION_TYPES.map(t => (
                    <Chip key={t.value} active={formType === t.value} onClick={() => setFormType(t.value)}>
                      {t.icon} {t.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: '#b4b4c8' }}>
                  Duration (min)
                </span>
                <input
                  inputMode="numeric"
                  value={formDuration}
                  onChange={e => setFormDuration(e.target.value)}
                  className="rounded-xl px-3 py-2.5 font-semibold outline-none w-full"
                  style={{ background: '#14141f', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                />
              </label>

              <div>
                <div className="text-xs font-medium mb-1" style={{ color: '#b4b4c8' }}>
                  Level
                </div>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.filter(l => l.value !== 'any').map(l => (
                    <Chip key={l.value} active={formLevel === l.value} onClick={() => setFormLevel(l.value)}>
                      {l.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {addError && (
                <div className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                  {addError}
                </div>
              )}

              <button
                type="button"
                onClick={addVideo}
                disabled={addSaving}
                className="w-full rounded-2xl py-4 font-bold text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#f97316', color: '#ffffff' }}
              >
                {addSaving && <Spinner color="#ffffff" />}Add video
              </button>
            </div>
          )}
        </div>
      </div>

      {active && (
        <SessionPlayer
          session={active}
          weightKg={weightKg}
          onClose={() => setActive(null)}
          onSaved={reloadDone}
        />
      )}

      <BottomNav />
    </div>
  )
}

export default function SessionsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <SessionsPage />
    </Suspense>
  )
}
