'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MACHINES, cardioCalories } from '@/lib/cardio'

type Props = {
  date: string
  onChange?: (sessions: any[]) => void
}

type Form = {
  machine: string
  duration_min: string
  distance_km: string
  floors: string
  steps: string
  avg_hr: string
  max_hr: string
  mets: string
  calories_machine: string
  avg_speed: string
  incline_pct: string
  resistance: string
}

const EMPTY_FORM: Form = {
  machine: 'treadmill',
  duration_min: '',
  distance_km: '',
  floors: '',
  steps: '',
  avg_hr: '',
  max_hr: '',
  mets: '',
  calories_machine: '',
  avg_speed: '',
  incline_pct: '',
  resistance: '',
}

function num(v: string): number | null {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const x = parseFloat(s.replace(',', '.'))
  return Number.isFinite(x) ? x : null
}

function str(v: any): string {
  return v === null || v === undefined || v === '' ? '' : String(v)
}

function Spinner({ color = '#f97316' }: { color?: string }) {
  return (
    <span
      className="inline-block animate-spin rounded-full align-middle"
      style={{ width: 16, height: 16, border: '2px solid #2a2a40', borderTopColor: color }}
    />
  )
}

function NumField({
  label,
  value,
  onChange,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: '#b4b4c8' }}>
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="rounded-xl px-3 py-2.5 font-semibold outline-none w-full"
        style={{ background: '#14141f', border: '1px solid #2a2a40', color: '#f0f0f0' }}
      />
    </label>
  )
}

function detailLine(s: any): string {
  const parts: string[] = []
  if (s.distance_km != null) parts.push(`${s.distance_km} km`)
  if (s.floors != null) parts.push(`${s.floors} floors`)
  if (s.steps != null) parts.push(`${s.steps} steps`)
  if (s.avg_hr != null && s.max_hr != null) parts.push(`♥ ${s.avg_hr} avg / ${s.max_hr} max`)
  else if (s.avg_hr != null) parts.push(`♥ ${s.avg_hr} avg`)
  else if (s.max_hr != null) parts.push(`♥ ${s.max_hr} max`)
  if (s.mets != null) parts.push(`${s.mets} METs`)
  if (s.avg_speed) parts.push(String(s.avg_speed))
  if (s.incline_pct != null) parts.push(`${s.incline_pct}% incline`)
  if (s.resistance != null) parts.push(`resistance ${s.resistance}`)
  return parts.join(' · ')
}

export default function CardioCard({ date, onChange }: Props) {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [source, setSource] = useState<'photo' | 'manual'>('manual')
  const [raw, setRaw] = useState<any>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [profileWeight, setProfileWeight] = useState<number | null>(null)
  const [editingKcal, setEditingKcal] = useState(false)
  const [kcalOverride, setKcalOverride] = useState('')

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cardio?date=${encodeURIComponent(date)}`)
      const data = res.ok ? await res.json() : []
      const arr = Array.isArray(data) ? data : []
      setSessions(arr)
      onChangeRef.current?.(arr)
    } catch {
      setSessions([])
      onChangeRef.current?.([])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  // Body weight drives the calorie maths for manual entries too.
  useEffect(() => {
    fetch('/api/get-progress').then(r => r.ok ? r.json() : null).then(p => {
      const w = Number(p?.weight_kg)
      if (w > 0) setProfileWeight(w)
    }).catch(() => {})
  }, [])

  const totalKcal = sessions.reduce((sum, s) => sum + (Number(s.calories) || 0), 0)

  const parsedDuration = num(form.duration_min) || 0
  const parsedMets = num(form.mets)
  const parsedMachineKcal = num(form.calories_machine)
  const computedKcal = cardioCalories(
    {
      machine: form.machine as any,
      duration_min: parsedDuration,
      mets: parsedMets,
      calories_machine: parsedMachineKcal,
    },
    weightKg
  )
  const effectiveKcal = editingKcal ? num(kcalOverride) ?? computedKcal : computedKcal

  let explanation = 'Estimated from typical intensity'
  if (parsedMets && weightKg) explanation = `Based on METs × your weight (${weightKg} kg)`
  else if (parsedMachineKcal && weightKg) explanation = `Machine estimate adjusted to your weight (${weightKg} kg)`
  else if (parsedMachineKcal) explanation = 'From the machine'

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function openManual() {
    setForm(EMPTY_FORM)
    setSource('manual')
    setRaw(null)
    setWeightKg(profileWeight)
    setEditingKcal(false)
    setKcalOverride('')
    setError(null)
    setFormOpen(true)
  }

  function openFromScan(r: any) {
    setForm({
      machine: r?.machine || 'treadmill',
      duration_min: str(r?.duration_min),
      distance_km: str(r?.distance_km),
      floors: str(r?.floors),
      steps: str(r?.steps),
      avg_hr: str(r?.avg_hr),
      max_hr: str(r?.max_hr),
      mets: str(r?.mets),
      calories_machine: str(r?.calories_machine),
      avg_speed: str(r?.avg_speed),
      incline_pct: str(r?.incline_pct),
      resistance: str(r?.resistance),
    })
    setSource('photo')
    setRaw(r?.raw ?? null)
    setWeightKg(Number(r?.weight_kg) > 0 ? Number(r.weight_kg) : profileWeight)
    setEditingKcal(false)
    setKcalOverride('')
    setError(null)
    setFormOpen(true)
  }

  async function compress(file: File): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Could not read the image'))
      reader.readAsDataURL(file)
    })
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not read the image'))
      image.src = dataUrl
    })
    const scale = img.width > 1280 ? 1280 / img.width : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the image')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const jpeg = canvas.toDataURL('image/jpeg', 0.8)
    return jpeg.split(',')[1] || ''
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return
    setScanning(true)
    setError(null)
    try {
      const base64Image = await compress(file)
      const res = await fetch('/api/scan-cardio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image, mimeType: 'image/jpeg' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || 'Could not read the machine screen.')
      }
      openFromScan(data)
    } catch (e: any) {
      setError(e?.message || 'Could not read the machine screen.')
    } finally {
      setScanning(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  async function save() {
    const duration = num(form.duration_min)
    if (!duration || duration <= 0) return
    setSaving(true)
    setError(null)
    try {
      const calories = editingKcal ? num(kcalOverride) ?? computedKcal : computedKcal
      const body = {
        date,
        machine: form.machine,
        duration_min: duration,
        calories,
        calories_machine: parsedMachineKcal,
        distance_km: num(form.distance_km),
        floors: num(form.floors),
        steps: num(form.steps),
        avg_hr: num(form.avg_hr),
        max_hr: num(form.max_hr),
        mets: parsedMets,
        avg_speed: form.avg_speed.trim() ? form.avg_speed.trim() : null,
        incline_pct: num(form.incline_pct),
        resistance: num(form.resistance),
        source,
        raw,
      }
      const res = await fetch('/api/cardio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not save cardio')
      setFormOpen(false)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not save cardio')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: any) {
    if (!window.confirm('Delete this cardio session?')) return
    try {
      const res = await fetch(`/api/cardio?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete cardio')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not delete cardio')
    }
  }

  return (
    <div className="rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', padding: 16 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: '#f0f0f0' }}>
          🫀 Cardio
        </h2>
        <span className="text-sm font-bold" style={{ color: '#f97316' }}>
          {Math.round(totalKcal)} kcal
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={scanning}
          className="rounded-2xl py-4 font-bold text-base active:scale-95 transition-all disabled:opacity-60"
          style={{ background: '#f97316', color: '#ffffff' }}
        >
          📷 Scan machine screen
        </button>
        <button
          type="button"
          onClick={openManual}
          className="rounded-2xl py-4 font-bold text-base active:scale-95 transition-all"
          style={{ background: '#1c1c2e', color: '#f0f0f0' }}
        >
          ✍️ Add manually
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="text-xs underline"
          style={{ color: '#b4b4c8' }}
        >
          or pick from gallery
        </button>
      </div>

      {scanning && (
        <div className="flex items-center justify-center gap-2 mt-3 text-sm font-semibold" style={{ color: '#f0f0f0' }}>
          <Spinner />
          <span>Reading the screen… (up to 30 s)</span>
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm font-semibold" style={{ color: '#ef4444' }}>
          {error}
        </div>
      )}

      {formOpen && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1c1c2e' }}>
          <div className="flex flex-wrap gap-2 mb-4">
            {MACHINES.map(m => {
              const active = form.machine === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => update('machine', m.value)}
                  className="rounded-xl px-3 py-2 text-sm font-bold active:scale-95 transition-all"
                  style={{
                    background: active ? '#f97316' : '#14141f',
                    border: `1px solid ${active ? '#f97316' : '#2a2a40'}`,
                    color: active ? '#ffffff' : '#b4b4c8',
                  }}
                >
                  {m.icon} {m.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumField label="Duration (min)" value={form.duration_min} onChange={v => update('duration_min', v)} required />
            <NumField label="Distance (km)" value={form.distance_km} onChange={v => update('distance_km', v)} />
            <NumField label="Floors" value={form.floors} onChange={v => update('floors', v)} />
            <NumField label="Steps" value={form.steps} onChange={v => update('steps', v)} />
            <NumField label="Avg HR" value={form.avg_hr} onChange={v => update('avg_hr', v)} />
            <NumField label="Max HR" value={form.max_hr} onChange={v => update('max_hr', v)} />
            <NumField label="METs" value={form.mets} onChange={v => update('mets', v)} />
            <NumField label="Machine kcal" value={form.calories_machine} onChange={v => update('calories_machine', v)} />
          </div>

          <div className="mt-4">
            <div className="text-2xl font-bold" style={{ color: '#f97316' }}>
              🔥 {effectiveKcal} kcal burned
            </div>
            <div className="text-xs mt-1" style={{ color: '#b4b4c8' }}>
              {explanation}
            </div>
            {!editingKcal ? (
              <button
                type="button"
                onClick={() => {
                  setKcalOverride(String(effectiveKcal))
                  setEditingKcal(true)
                }}
                className="text-xs underline mt-1"
                style={{ color: '#b4b4c8' }}
              >
                Edit
              </button>
            ) : (
              <div className="mt-2 max-w-[180px]">
                <NumField label="Override kcal" value={kcalOverride} onChange={setKcalOverride} />
                <button
                  type="button"
                  onClick={() => setEditingKcal(false)}
                  className="text-xs underline mt-1"
                  style={{ color: '#b4b4c8' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={save}
              disabled={saving || parsedDuration <= 0}
              className="flex-1 rounded-2xl py-3 font-bold text-base active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#f97316', color: '#ffffff' }}
            >
              {saving && <Spinner color="#ffffff" />}
              Save cardio
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-2xl px-5 py-3 font-bold text-base active:scale-95 transition-all"
              style={{ background: '#1c1c2e', color: '#f0f0f0' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {loading && sessions.length === 0 ? (
          <div className="text-sm" style={{ color: '#b4b4c8' }}>
            Loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-sm" style={{ color: '#b4b4c8' }}>
            No cardio yet today.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(s => {
              const machine = MACHINES.find(m => m.value === s.machine)
              const detail = detailLine(s)
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-xl">{machine?.icon || '❤️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: '#f0f0f0' }}>
                      {machine?.label || s.machine} · {s.duration_min} min
                    </div>
                    {detail && (
                      <div className="text-xs truncate" style={{ color: '#b4b4c8' }}>
                        {detail}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap" style={{ color: '#f97316' }}>
                    {Math.round(Number(s.calories) || 0)} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    title="Delete"
                    className="text-xs active:scale-95 transition-all"
                    style={{ color: '#b4b4c8' }}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
