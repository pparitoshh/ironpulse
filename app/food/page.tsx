'use client'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/ui/BottomNav'
import { localDate } from '@/lib/date'
import { mealTotals, scaleItem } from '@/lib/food'
import type { FoodItem, Meal } from '@/lib/food'

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEALS[number]

const MEAL_ICON: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
}

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

type Tab = 'photo' | 'text' | 'recent' | 'manual'
type Source = 'photo' | 'text' | 'manual' | 'recent'
type Confidence = 'high' | 'medium' | 'low'
type NumericKey = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'

const TABS: { key: Tab; label: string }[] = [
  { key: 'photo', label: '📷 Photo' },
  { key: 'text', label: '✍️ Describe' },
  { key: 'recent', label: '⭐ Recent' },
  { key: 'manual', label: '✏️ Manual' },
]

const EMPTY_ITEM: FoodItem = {
  name: '',
  grams: null,
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
}

const EMPTY_MANUAL = {
  name: '',
  grams: '',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
  fiber_g: '',
}

const CARD = { background: '#0f0f1a', border: '1px solid #1c1c2e' }
const INPUT = { background: '#14141f', border: '1px solid #2a2a40', color: '#f0f0f0' }

const r1 = (v: number) => Math.round(v * 10) / 10

function fmt1(v: number): string {
  const x = r1(Number.isFinite(v) ? v : 0)
  return Number.isInteger(x) ? String(x) : x.toFixed(1)
}

function num(v: any): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function parseNum(s: string): number | null {
  const t = String(s ?? '').trim()
  if (t === '') return null
  const x = parseFloat(t.replace(',', '.'))
  return Number.isFinite(x) ? x : null
}

function inputNum(v: number): string {
  return v ? String(v) : ''
}

function dateLabel(d: string): string {
  const today = localDate()
  if (d === today) return 'Today'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (d === localDate(y)) return 'Yesterday'
  const [yy, mm, dd] = d.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function shiftDate(d: string, delta: number): string {
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  dt.setDate(dt.getDate() + delta)
  return localDate(dt)
}

function defaultMeal(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

function rowToItem(row: any): FoodItem {
  const g = row?.grams != null ? Number(row.grams) : NaN
  return {
    name: String(row?.food_name ?? ''),
    grams: Number.isFinite(g) && g > 0 ? g : null,
    calories: Math.round(num(row?.calories)),
    protein_g: r1(num(row?.protein_g)),
    carbs_g: r1(num(row?.carbs_g)),
    fat_g: r1(num(row?.fat_g)),
    fiber_g: r1(num(row?.fiber_g)),
  }
}

type ReviewRow = { base: FoodItem; item: FoodItem }

type ReviewState = {
  meal_name: string
  confidence: Confidence | null
  notes: string
  rows: ReviewRow[]
}

type EditState = {
  row: any
  food_name: string
  grams: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  fiber_g: string
  meal_type: MealType
  base: FoodItem | null
}

function Spinner({ color = '#f97316' }: { color?: string }) {
  return (
    <span
      className="inline-block animate-spin rounded-full align-middle"
      style={{ width: 16, height: 16, border: '2px solid #2a2a40', borderTopColor: color }}
    />
  )
}

function NumInput({
  value,
  onChange,
  className,
  style,
  placeholder,
}: {
  value: number
  onChange: (n: number) => void
  className?: string
  style?: CSSProperties
  placeholder?: string
}) {
  const [text, setText] = useState(inputNum(value))
  const lastValue = useRef(value)

  useEffect(() => {
    if (lastValue.current === value) return
    lastValue.current = value
    const parsed = parseFloat(text.replace(',', '.'))
    if (!Number.isFinite(parsed) || Math.abs(parsed - value) > 1e-9) {
      setText(inputNum(value))
    }
  }, [value, text])

  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={e => {
        const raw = e.target.value
        setText(raw)
        const n = parseFloat(raw.replace(',', '.'))
        if (Number.isFinite(n) && n >= 0) onChange(n)
      }}
      className={className}
      style={style}
    />
  )
}

function MiniNum({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold" style={{ color: '#b4b4c8' }}>
        {label}
      </span>
      <NumInput
        value={value}
        onChange={onChange}
        className="w-full rounded-lg px-2 py-1.5 text-sm font-semibold outline-none"
        style={{ background: '#0f0f1a', border: '1px solid #2a2a40', color: '#f0f0f0' }}
      />
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  decimal,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  decimal?: boolean
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold" style={{ color: '#b4b4c8' }}>
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        inputMode={decimal ? 'decimal' : 'text'}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 font-semibold outline-none"
        style={INPUT}
      />
    </label>
  )
}

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-[55]"
        style={{ background: 'rgba(0,0,0,0.72)' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-w-lg flex-col rounded-t-3xl"
        style={{ ...CARD, maxHeight: '90vh' }}
      >
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid #1c1c2e' }}
        >
          <h2 className="text-lg font-bold" style={{ color: '#f0f0f0' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 text-2xl leading-none active:scale-95"
            style={{ color: '#b4b4c8' }}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-8">{children}</div>
      </div>
    </>
  )
}

function confidenceStyle(c: Confidence) {
  if (c === 'high') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (c === 'low') return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
  return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
}

export default function FoodPage() {
  const { status } = useSession()
  const router = useRouter()

  const [selectedDate, setSelectedDate] = useState(localDate())
  const [logs, setLogs] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [cardioKcal, setCardioKcal] = useState(0)
  const [liftingKcal, setLiftingKcal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addMeal, setAddMeal] = useState<MealType>('lunch')
  const [addTab, setAddTab] = useState<Tab>('photo')
  const [review, setReview] = useState<ReviewState | null>(null)
  const [source, setSource] = useState<Source>('manual')
  const [scanning, setScanning] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [manual, setManual] = useState({ ...EMPTY_MANUAL })
  const [recent, setRecent] = useState<any[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  const [edit, setEdit] = useState<EditState | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadSeq = useRef(0)

  const today = localDate()

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    let alive = true
    fetch('/api/get-progress')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(p => {
        if (alive) setProfile(p)
      })
    return () => {
      alive = false
    }
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    let alive = true
    ;(async () => {
      try {
        await loadDay(selectedDate)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedDate])

  useEffect(() => {
    if (!addOpen || addTab !== 'recent' || review) return
    let alive = true
    ;(async () => {
      setRecentLoading(true)
      try {
        const res = await fetch('/api/log-food?recent=1')
        const data = res.ok ? await res.json() : []
        if (alive) setRecent(Array.isArray(data) ? data : [])
      } catch {
        if (alive) setRecent([])
      } finally {
        if (alive) setRecentLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [addOpen, addTab, review])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  async function loadDay(date: string) {
    const seq = ++loadSeq.current
    const [foodRes, cardioRes, workoutRes] = await Promise.all([
      fetch(`/api/log-food?date=${date}`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/api/cardio?date=${date}`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/api/log-workout?date=${date}`).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ])
    if (seq !== loadSeq.current) return
    const food = Array.isArray(foodRes) ? foodRes : []
    const cardio = Array.isArray(cardioRes) ? cardioRes : []
    const workouts = Array.isArray(workoutRes) ? workoutRes : workoutRes ? [workoutRes] : []
    setLogs(food)
    setCardioKcal(cardio.reduce((s: number, c: any) => s + num(c?.calories), 0))
    setLiftingKcal(num(workouts[0]?.calories))
  }

  function compressImage(file: File, maxWidth = 1280, quality = 0.8): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not process the image'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve({ base64: dataUrl.split(',')[1] || '', mimeType: 'image/jpeg' })
      }
      img.onerror = () => reject(new Error('Could not read the image'))
      img.src = URL.createObjectURL(file)
    })
  }

  function openAdd(meal: MealType) {
    setAddMeal(meal)
    setAddTab('photo')
    setReview(null)
    setAddError(null)
    setTextInput('')
    setManual({ ...EMPTY_MANUAL })
    setSource('manual')
    setAddOpen(true)
  }

  function closeAdd() {
    if (saving) return
    setAddOpen(false)
    setReview(null)
    setAddError(null)
  }

  function applyMeal(meal: Meal, src: Source) {
    const items = Array.isArray(meal?.items) ? meal.items : []
    const rows: ReviewRow[] = (items.length ? items : [{ ...EMPTY_ITEM }]).map(it => ({
      base: { ...it },
      item: { ...it },
    }))
    setReview({
      meal_name: meal?.meal_name || rows[0]?.item.name || '',
      confidence: meal?.confidence || 'medium',
      notes: meal?.notes || '',
      rows,
    })
    setSource(src)
    setAddError(null)
  }

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setAddError(null)
    try {
      const { base64, mimeType } = await compressImage(file, 1280, 0.8)
      const res = await fetch('/api/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64, mimeType }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || 'Could not analyse the photo.')
      }
      applyMeal(data as Meal, 'photo')
    } catch (err: any) {
      setAddError(err?.message || 'Could not analyse the photo.')
    } finally {
      setScanning(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  async function estimateFromText() {
    if (!textInput.trim()) return
    setEstimating(true)
    setAddError(null)
    try {
      const res = await fetch('/api/estimate-macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: textInput }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || 'Could not estimate the meal.')
      }
      applyMeal(data as Meal, 'text')
    } catch (err: any) {
      setAddError(err?.message || 'Could not estimate the meal.')
    } finally {
      setEstimating(false)
    }
  }

  function pickRecent(row: any) {
    const item = rowToItem(row)
    if (!item.name) item.name = 'Food'
    setReview({
      meal_name: item.name,
      confidence: null,
      notes: '',
      rows: [{ base: { ...item }, item: { ...item } }],
    })
    setSource('recent')
    setAddError(null)
  }

  function reviewManual() {
    const item: FoodItem = {
      name: manual.name.trim() || 'Food',
      grams: parseNum(manual.grams),
      calories: Math.round(parseNum(manual.calories) ?? 0),
      protein_g: r1(parseNum(manual.protein_g) ?? 0),
      carbs_g: r1(parseNum(manual.carbs_g) ?? 0),
      fat_g: r1(parseNum(manual.fat_g) ?? 0),
      fiber_g: r1(parseNum(manual.fiber_g) ?? 0),
    }
    setReview({
      meal_name: item.name,
      confidence: null,
      notes: '',
      rows: [{ base: { ...item }, item: { ...item } }],
    })
    setSource('manual')
    setAddError(null)
  }

  function setReviewName(i: number, name: string) {
    setReview(r => {
      if (!r) return r
      const rows = r.rows.map((row, idx) => (idx === i ? { ...row, item: { ...row.item, name } } : row))
      return { ...r, rows }
    })
  }

  function setReviewNum(i: number, key: NumericKey, value: number) {
    setReview(r => {
      if (!r) return r
      const rows = r.rows.map((row, idx) =>
        idx === i
          ? { ...row, item: { ...row.item, [key]: value }, base: { ...row.base, [key]: value } }
          : row
      )
      return { ...r, rows }
    })
  }

  function setReviewGrams(i: number, grams: number) {
    setReview(r => {
      if (!r) return r
      const rows = r.rows.map((row, idx) => {
        if (idx !== i) return row
        const scaled = scaleItem(row.base, grams)
        return { ...row, item: { ...scaled, name: row.item.name } }
      })
      return { ...r, rows }
    })
  }

  function adjustReviewGrams(i: number, delta: number) {
    setReview(r => {
      if (!r) return r
      const row = r.rows[i]
      if (!row) return r
      const next = Math.max(0, Math.round((row.item.grams ?? 0) + delta))
      if (next <= 0) return r
      const rows = r.rows.map((x, idx) => {
        if (idx !== i) return x
        const scaled = scaleItem(x.base, next)
        return { ...x, item: { ...scaled, name: x.item.name } }
      })
      return { ...r, rows }
    })
  }

  function removeReviewItem(i: number) {
    setReview(r => (r ? { ...r, rows: r.rows.filter((_, idx) => idx !== i) } : r))
  }

  function addReviewItem() {
    setReview(r =>
      r ? { ...r, rows: [...r.rows, { base: { ...EMPTY_ITEM }, item: { ...EMPTY_ITEM } }] } : r
    )
  }

  async function logMeal() {
    if (!review) return
    const items = review.rows
      .map(r => ({ ...r.item, name: r.item.name.trim() }))
      .filter(it => it.name)
    if (!items.length) {
      setAddError('Add at least one food item.')
      return
    }
    setSaving(true)
    setAddError(null)
    try {
      const res = await fetch('/api/log-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          meal_type: addMeal,
          source,
          items: items.map(it => ({
            name: it.name,
            grams: it.grams,
            calories: it.calories,
            protein_g: it.protein_g,
            carbs_g: it.carbs_g,
            fat_g: it.fat_g,
            fiber_g: it.fiber_g,
          })),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Could not log the food.')
      }
      const kcal = Math.round(mealTotals(items).calories)
      setAddOpen(false)
      setReview(null)
      await loadDay(selectedDate)
      showToast(`Logged ${kcal} kcal`)
    } catch (err: any) {
      setAddError(err?.message || 'Could not log the food.')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row: any) {
    const base = rowToItem(row)
    setEdit({
      row,
      food_name: base.name,
      grams: base.grams != null ? String(base.grams) : '',
      calories: String(base.calories),
      protein_g: inputNum(base.protein_g),
      carbs_g: inputNum(base.carbs_g),
      fat_g: inputNum(base.fat_g),
      fiber_g: inputNum(base.fiber_g),
      meal_type: (MEALS as readonly string[]).includes(row?.meal_type) ? row.meal_type : 'snack',
      base,
    })
    setEditError(null)
  }

  function closeEdit() {
    if (editSaving) return
    setEdit(null)
    setEditError(null)
  }

  function onEditGrams(raw: string) {
    setEdit(e => {
      if (!e) return e
      const g = parseNum(raw)
      if (raw.trim() === '' || g == null || g <= 0 || !e.base) {
        return { ...e, grams: raw }
      }
      const scaled = scaleItem(e.base, g)
      return {
        ...e,
        grams: raw,
        calories: String(scaled.calories),
        protein_g: inputNum(scaled.protein_g),
        carbs_g: inputNum(scaled.carbs_g),
        fat_g: inputNum(scaled.fat_g),
        fiber_g: inputNum(scaled.fiber_g),
      }
    })
  }

  function adjustEditGrams(delta: number) {
    setEdit(e => {
      if (!e) return e
      const next = Math.max(0, Math.round((parseNum(e.grams) ?? 0) + delta))
      if (next <= 0) return e
      const scaled = e.base ? scaleItem(e.base, next) : null
      if (!scaled) return { ...e, grams: String(next) }
      return {
        ...e,
        grams: String(next),
        calories: String(scaled.calories),
        protein_g: inputNum(scaled.protein_g),
        carbs_g: inputNum(scaled.carbs_g),
        fat_g: inputNum(scaled.fat_g),
        fiber_g: inputNum(scaled.fiber_g),
      }
    })
  }

  async function saveEdit() {
    if (!edit) return
    setEditSaving(true)
    setEditError(null)
    try {
      const body: any = {
        id: edit.row.id,
        food_name: edit.food_name,
        meal_type: edit.meal_type,
        calories: Math.round(parseNum(edit.calories) ?? 0),
        protein_g: parseNum(edit.protein_g) ?? 0,
        carbs_g: parseNum(edit.carbs_g) ?? 0,
        fat_g: parseNum(edit.fat_g) ?? 0,
        fiber_g: parseNum(edit.fiber_g) ?? 0,
      }
      const g = parseNum(edit.grams)
      if (edit.base?.grams != null && g != null && g > 0) body.grams = g
      const res = await fetch('/api/log-food', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Could not save the entry.')
      }
      setEdit(null)
      await loadDay(selectedDate)
      showToast('Entry saved')
    } catch (err: any) {
      setEditError(err?.message || 'Could not save the entry.')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteEdit() {
    if (!edit) return
    if (!window.confirm('Delete this food entry?')) return
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch('/api/log-food', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: edit.row.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Could not delete the entry.')
      }
      setEdit(null)
      await loadDay(selectedDate)
      showToast('Entry deleted')
    } catch (err: any) {
      setEditError(err?.message || 'Could not delete the entry.')
    } finally {
      setEditSaving(false)
    }
  }

  const totals = {
    calories: logs.reduce((s, l) => s + num(l?.calories), 0),
    protein: logs.reduce((s, l) => s + num(l?.protein_g), 0),
    carbs: logs.reduce((s, l) => s + num(l?.carbs_g), 0),
    fat: logs.reduce((s, l) => s + num(l?.fat_g), 0),
    fiber: logs.reduce((s, l) => s + num(l?.fiber_g), 0),
  }

  const targetCal = num(profile?.target_calories)
  const targetProtein = num(profile?.target_protein)
  const targetCarbs = num(profile?.target_carbs)
  const targetFat = num(profile?.target_fat)
  const burned = cardioKcal + liftingKcal
  const over = targetCal > 0 && totals.calories > targetCal
  const remaining = targetCal - totals.calories

  const macroBars: { label: string; value: number; target: number; color: string }[] = [
    { label: 'Protein', value: totals.protein, target: targetProtein, color: '#3b82f6' },
    { label: 'Carbs', value: totals.carbs, target: targetCarbs, color: '#22c55e' },
    { label: 'Fat', value: totals.fat, target: targetFat, color: '#f59e0b' },
    { label: 'Fiber', value: totals.fiber, target: 30, color: '#14b8a6' },
  ]

  const reviewItems = review ? review.rows.map(r => r.item) : []
  const reviewTotals = mealTotals(reviewItems)
  const ringR = 52
  const ringC = 2 * Math.PI * ringR
  const ringPct = targetCal > 0 ? Math.min(1, totals.calories / targetCal) : 0
  const ringColor = over ? '#ef4444' : '#f97316'

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32" style={{ background: '#080810', color: '#f0f0f0' }}>
      <div className="px-5 pt-12 pb-4">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#b4b4c8' }}>
          Nutrition
        </p>
        <h1 className="font-bold text-2xl">Food Log</h1>
      </div>

      <div className="px-5 space-y-4">
        <div className="flex items-center justify-between rounded-2xl px-2 py-2" style={CARD}>
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="h-11 w-11 rounded-xl font-bold text-xl active:scale-95 transition-all"
            style={{ background: '#14141f', color: '#f0f0f0' }}
          >
            ‹
          </button>
          <div className="text-center">
            <div className="text-base font-bold">{dateLabel(selectedDate)}</div>
            <div className="text-xs" style={{ color: '#b4b4c8' }}>
              {selectedDate}
            </div>
          </div>
          <button
            type="button"
            disabled={selectedDate === today}
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="h-11 w-11 rounded-xl font-bold text-xl active:scale-95 transition-all disabled:opacity-40"
            style={{ background: '#14141f', color: '#f0f0f0' }}
          >
            ›
          </button>
        </div>

        <div className="rounded-2xl p-4" style={CARD}>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0" style={{ width: 132, height: 132 }}>
              <svg width={132} height={132} viewBox="0 0 132 132">
                <circle cx={66} cy={66} r={ringR} fill="none" stroke="#1c1c2e" strokeWidth={12} />
                <circle
                  cx={66}
                  cy={66}
                  r={ringR}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeDasharray={`${ringPct * ringC} ${ringC}`}
                  transform="rotate(-90 66 66)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold">{Math.round(totals.calories)}</div>
                <div className="text-[11px] text-center px-2" style={{ color: '#b4b4c8' }}>
                  {targetCal > 0 ? `of ${Math.round(targetCal)} kcal` : 'kcal'}
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {targetCal > 0 ? (
                over ? (
                  <div>
                    <div className="text-xs font-semibold" style={{ color: '#b4b4c8' }}>
                      Over by
                    </div>
                    <div className="text-xl font-bold" style={{ color: '#ef4444' }}>
                      {Math.round(Math.abs(remaining))} kcal
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold" style={{ color: '#b4b4c8' }}>
                      Remaining
                    </div>
                    <div className="text-xl font-bold" style={{ color: '#f0f0f0' }}>
                      {Math.round(remaining)} kcal
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <div className="text-xs font-semibold" style={{ color: '#b4b4c8' }}>
                    Eaten
                  </div>
                  <div className="text-xl font-bold">{Math.round(totals.calories)} kcal</div>
                </div>
              )}
              <div className="text-sm font-bold" style={{ color: '#f0f0f0' }}>
                🔥 Burned {Math.round(burned)} kcal
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {macroBars.map(m => {
              const pct = m.target > 0 ? Math.min(100, (m.value / m.target) * 100) : 0
              return (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: '#b4b4c8' }}>
                      {m.label}
                    </span>
                    <span className="text-xs font-bold">
                      {fmt1(m.value)}
                      {m.target > 0 ? ` / ${Math.round(m.target)} g` : ' g'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1c1c2e' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: m.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {MEALS.map(meal => {
          const items = logs.filter(l => l?.meal_type === meal)
          const subtotal = items.reduce((s, l) => s + num(l?.calories), 0)
          return (
            <div key={meal} className="rounded-2xl overflow-hidden" style={CARD}>
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: items.length ? '1px solid #1c1c2e' : 'none' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{MEAL_ICON[meal]}</span>
                  <span className="font-bold">{MEAL_LABEL[meal]}</span>
                </div>
                <div className="flex items-center gap-3">
                  {subtotal > 0 && (
                    <span className="text-sm font-bold" style={{ color: '#f97316' }}>
                      {Math.round(subtotal)} kcal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => openAdd(meal)}
                    className="rounded-xl px-3 py-2 text-sm font-bold active:scale-95 transition-all"
                    style={{ background: '#14141f', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {items.length > 0 && (
                <div className="px-4 pb-1">
                  {items.map(item => {
                    const parts: string[] = []
                    if (item.grams != null && num(item.grams) > 0) parts.push(`${Math.round(num(item.grams))} g`)
                    parts.push(`P ${fmt1(num(item.protein_g))}`)
                    parts.push(`C ${fmt1(num(item.carbs_g))}`)
                    parts.push(`F ${fmt1(num(item.fat_g))}`)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openEdit(item)}
                        className="flex w-full items-center gap-3 py-2.5 text-left"
                        style={{ borderTop: '1px solid #1c1c2e' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">{item.food_name}</div>
                          <div className="mt-0.5 text-xs truncate" style={{ color: '#b4b4c8' }}>
                            {parts.join(' · ')}
                          </div>
                        </div>
                        <div className="whitespace-nowrap text-sm font-bold" style={{ color: '#f97316' }}>
                          {Math.round(num(item.calories))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => openAdd(defaultMeal())}
        className="fixed bottom-24 right-5 z-40 flex items-center justify-center rounded-full text-3xl font-bold active:scale-95 transition-all"
        style={{
          width: 60,
          height: 60,
          background: '#f97316',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
        }}
      >
        +
      </button>

      {toast && (
        <div
          className="fixed bottom-28 left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold"
          style={{ background: '#f97316', color: '#ffffff' }}
        >
          {toast}
        </div>
      )}

      {addOpen && (
        <BottomSheet title={`Add to ${MEAL_LABEL[addMeal]}`} onClose={closeAdd}>
          <div className="flex gap-2 overflow-x-auto pt-3 pb-1">
            {MEALS.map(m => {
              const active = addMeal === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAddMeal(m)}
                  className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold active:scale-95 transition-all"
                  style={{
                    background: active ? '#f97316' : '#14141f',
                    border: `1px solid ${active ? '#f97316' : '#2a2a40'}`,
                    color: active ? '#ffffff' : '#b4b4c8',
                  }}
                >
                  {MEAL_ICON[m]} {MEAL_LABEL[m]}
                </button>
              )
            })}
          </div>

          {review ? (
            <div className="pt-3">
              <div className="flex items-center gap-2">
                <input
                  value={review.meal_name}
                  onChange={e => setReview(r => (r ? { ...r, meal_name: e.target.value } : r))}
                  placeholder="Meal name"
                  className="flex-1 bg-transparent text-lg font-bold outline-none"
                  style={{ color: '#f0f0f0' }}
                />
                <button
                  type="button"
                  onClick={() => setReview(null)}
                  className="rounded-xl px-3 py-2 text-xs font-bold active:scale-95 transition-all"
                  style={{ background: '#14141f', color: '#b4b4c8' }}
                >
                  ‹ Back
                </button>
              </div>

              {(review.confidence || review.notes) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {review.confidence && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold capitalize"
                      style={confidenceStyle(review.confidence)}
                    >
                      {review.confidence} confidence
                    </span>
                  )}
                  {review.notes && (
                    <span className="text-xs" style={{ color: '#b4b4c8' }}>
                      {review.notes}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 space-y-3">
                {review.rows.map((row, i) => (
                  <div key={i} className="rounded-2xl p-3" style={{ background: '#14141f', border: '1px solid #2a2a40' }}>
                    <div className="flex items-center gap-2">
                      <input
                        value={row.item.name}
                        onChange={e => setReviewName(i, e.target.value)}
                        placeholder="Food name"
                        className="flex-1 rounded-xl px-3 py-2.5 font-semibold outline-none"
                        style={{ background: '#0f0f1a', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeReviewItem(i)}
                        className="h-10 w-10 rounded-xl font-bold active:scale-95 transition-all"
                        style={{ background: '#0f0f1a', border: '1px solid #2a2a40', color: '#ef4444' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustReviewGrams(i, -10)}
                        className="h-10 w-10 rounded-xl text-lg font-bold active:scale-95 transition-all"
                        style={{ background: '#0f0f1a', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                      >
                        −
                      </button>
                      <NumInput
                        value={row.item.grams ?? 0}
                        onChange={g => {
                          if (g > 0) setReviewGrams(i, g)
                        }}
                        className="w-20 rounded-xl px-2 py-2.5 text-center font-semibold outline-none"
                        style={{ background: '#0f0f1a', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                      />
                      <span className="text-xs font-semibold" style={{ color: '#b4b4c8' }}>
                        g
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustReviewGrams(i, 10)}
                        className="h-10 w-10 rounded-xl text-lg font-bold active:scale-95 transition-all"
                        style={{ background: '#0f0f1a', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                      >
                        +
                      </button>
                      <span className="ml-auto text-sm font-bold" style={{ color: '#f97316' }}>
                        {Math.round(row.item.calories)} kcal
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <MiniNum label="kcal" value={row.item.calories} onChange={n => setReviewNum(i, 'calories', n)} />
                      <MiniNum label="P (g)" value={row.item.protein_g} onChange={n => setReviewNum(i, 'protein_g', n)} />
                      <MiniNum label="C (g)" value={row.item.carbs_g} onChange={n => setReviewNum(i, 'carbs_g', n)} />
                      <MiniNum label="F (g)" value={row.item.fat_g} onChange={n => setReviewNum(i, 'fat_g', n)} />
                      <MiniNum label="Fi (g)" value={row.item.fiber_g} onChange={n => setReviewNum(i, 'fiber_g', n)} />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addReviewItem}
                className="mt-3 w-full rounded-2xl py-3 font-bold active:scale-95 transition-all"
                style={{ background: '#14141f', border: '1px dashed #2a2a40', color: '#f0f0f0' }}
              >
                + Add item
              </button>

              {addError && (
                <div className="mt-3 text-sm font-semibold" style={{ color: '#ef4444' }}>
                  {addError}
                </div>
              )}

              <div
                className="sticky bottom-0 -mx-5 mt-4 px-5 pt-3 pb-2"
                style={{ background: '#0f0f1a', borderTop: '1px solid #1c1c2e' }}
              >
                <div className="mb-2 text-sm font-bold">
                  {Math.round(reviewTotals.calories)} kcal · P {fmt1(reviewTotals.protein_g)} · C{' '}
                  {fmt1(reviewTotals.carbs_g)} · F {fmt1(reviewTotals.fat_g)}
                </div>
                <button
                  type="button"
                  onClick={logMeal}
                  disabled={saving || review.rows.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold active:scale-95 transition-all disabled:opacity-50"
                  style={{ background: '#f97316', color: '#ffffff' }}
                >
                  {saving && <Spinner color="#ffffff" />}
                  ✅ Log {review.rows.length} items
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {TABS.map(t => {
                  const active = addTab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setAddTab(t.key)}
                      className="rounded-2xl py-3 text-sm font-bold active:scale-95 transition-all"
                      style={{
                        background: active ? 'rgba(249,115,22,0.15)' : '#14141f',
                        border: `1px solid ${active ? '#f97316' : '#2a2a40'}`,
                        color: active ? '#f97316' : '#b4b4c8',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {addTab === 'photo' && (
                <div className="mt-4">
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhoto}
                  />
                  <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  {scanning ? (
                    <div
                      className="rounded-2xl py-10 text-center"
                      style={{ background: '#14141f', border: '1px solid #2a2a40' }}
                    >
                      <Spinner />
                      <div className="mt-3 text-sm font-bold">Analysing your plate…</div>
                      <div className="mt-1 text-xs" style={{ color: '#b4b4c8' }}>
                        This can take up to 15 seconds.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        type="button"
                        onClick={() => cameraRef.current?.click()}
                        className="rounded-2xl py-5 text-base font-bold active:scale-95 transition-all"
                        style={{ background: '#f97316', color: '#ffffff' }}
                      >
                        📷 Take photo
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryRef.current?.click()}
                        className="rounded-2xl py-5 text-base font-bold active:scale-95 transition-all"
                        style={{ background: '#1c1c2e', color: '#f0f0f0' }}
                      >
                        🖼️ Gallery
                      </button>
                    </div>
                  )}
                </div>
              )}

              {addTab === 'text' && (
                <div className="mt-4">
                  <textarea
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    placeholder="e.g. 2 eggs, 2 toast with butter, a coffee with milk"
                    rows={4}
                    className="w-full resize-none rounded-xl px-3 py-2.5 font-semibold outline-none"
                    style={INPUT}
                  />
                  <button
                    type="button"
                    onClick={estimateFromText}
                    disabled={estimating || !textInput.trim()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold active:scale-95 transition-all disabled:opacity-50"
                    style={{ background: '#f97316', color: '#ffffff' }}
                  >
                    {estimating && <Spinner color="#ffffff" />}
                    {estimating ? 'Estimating…' : 'Estimate'}
                  </button>
                </div>
              )}

              {addTab === 'recent' && (
                <div className="mt-4">
                  {recentLoading ? (
                    <div className="flex items-center gap-2 py-4 text-sm font-semibold" style={{ color: '#b4b4c8' }}>
                      <Spinner /> Loading recent foods…
                    </div>
                  ) : recent.length === 0 ? (
                    <div className="py-4 text-sm" style={{ color: '#b4b4c8' }}>
                      No recent foods yet.
                    </div>
                  ) : (
                    recent.map((r, idx) => (
                      <button
                        key={`${r.id}-${idx}`}
                        type="button"
                        onClick={() => pickRecent(r)}
                        className="flex w-full items-center gap-3 py-3 text-left"
                        style={{ borderTop: idx === 0 ? 'none' : '1px solid #1c1c2e' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-bold">{r.food_name}</div>
                          <div className="mt-0.5 text-xs" style={{ color: '#b4b4c8' }}>
                            {r.grams != null && num(r.grams) > 0 ? `${Math.round(num(r.grams))} g · ` : ''}
                            {Math.round(num(r.calories))} kcal
                          </div>
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}
                        >
                          ×{num(r.times) || 1}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {addTab === 'manual' && (
                <div className="mt-4 space-y-3">
                  <TextField
                    label="Name"
                    value={manual.name}
                    onChange={v => setManual(m => ({ ...m, name: v }))}
                    placeholder="e.g. Chicken breast"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="Grams"
                      value={manual.grams}
                      onChange={v => setManual(m => ({ ...m, grams: v }))}
                      placeholder="150"
                      decimal
                    />
                    <TextField
                      label="Calories"
                      value={manual.calories}
                      onChange={v => setManual(m => ({ ...m, calories: v }))}
                      placeholder="200"
                      decimal
                    />
                    <TextField
                      label="Protein (g)"
                      value={manual.protein_g}
                      onChange={v => setManual(m => ({ ...m, protein_g: v }))}
                      placeholder="25"
                      decimal
                    />
                    <TextField
                      label="Carbs (g)"
                      value={manual.carbs_g}
                      onChange={v => setManual(m => ({ ...m, carbs_g: v }))}
                      placeholder="0"
                      decimal
                    />
                    <TextField
                      label="Fat (g)"
                      value={manual.fat_g}
                      onChange={v => setManual(m => ({ ...m, fat_g: v }))}
                      placeholder="4"
                      decimal
                    />
                    <TextField
                      label="Fiber (g)"
                      value={manual.fiber_g}
                      onChange={v => setManual(m => ({ ...m, fiber_g: v }))}
                      placeholder="0"
                      decimal
                    />
                  </div>
                  <button
                    type="button"
                    onClick={reviewManual}
                    disabled={!manual.name.trim()}
                    className="w-full rounded-2xl py-4 text-base font-bold active:scale-95 transition-all disabled:opacity-50"
                    style={{ background: '#f97316', color: '#ffffff' }}
                  >
                    Review
                  </button>
                </div>
              )}

              {addError && (
                <div className="mt-3 text-sm font-semibold" style={{ color: '#ef4444' }}>
                  {addError}
                </div>
              )}
            </>
          )}
        </BottomSheet>
      )}

      {edit && (
        <BottomSheet title="Edit entry" onClose={closeEdit}>
          <div className="space-y-3 pt-4">
            <TextField
              label="Food name"
              value={edit.food_name}
              onChange={v => setEdit(e => (e ? { ...e, food_name: v } : e))}
              placeholder="Food name"
            />

            {edit.base?.grams != null && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold" style={{ color: '#b4b4c8' }}>
                  Grams
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustEditGrams(-10)}
                    className="h-10 w-10 rounded-xl text-lg font-bold active:scale-95 transition-all"
                    style={{ background: '#14141f', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                  >
                    −
                  </button>
                  <input
                    inputMode="decimal"
                    value={edit.grams}
                    onChange={e => onEditGrams(e.target.value)}
                    className="w-24 rounded-xl px-3 py-2.5 text-center font-semibold outline-none"
                    style={INPUT}
                  />
                  <button
                    type="button"
                    onClick={() => adjustEditGrams(10)}
                    className="h-10 w-10 rounded-xl text-lg font-bold active:scale-95 transition-all"
                    style={{ background: '#14141f', border: '1px solid #2a2a40', color: '#f0f0f0' }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Calories"
                value={edit.calories}
                onChange={v => setEdit(e => (e ? { ...e, calories: v } : e))}
                decimal
              />
              <TextField
                label="Protein (g)"
                value={edit.protein_g}
                onChange={v => setEdit(e => (e ? { ...e, protein_g: v } : e))}
                decimal
              />
              <TextField
                label="Carbs (g)"
                value={edit.carbs_g}
                onChange={v => setEdit(e => (e ? { ...e, carbs_g: v } : e))}
                decimal
              />
              <TextField
                label="Fat (g)"
                value={edit.fat_g}
                onChange={v => setEdit(e => (e ? { ...e, fat_g: v } : e))}
                decimal
              />
              <TextField
                label="Fiber (g)"
                value={edit.fiber_g}
                onChange={v => setEdit(e => (e ? { ...e, fiber_g: v } : e))}
                decimal
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {MEALS.map(m => {
                const active = edit.meal_type === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEdit(e => (e ? { ...e, meal_type: m } : e))}
                    className="rounded-xl px-3 py-2 text-sm font-bold active:scale-95 transition-all"
                    style={{
                      background: active ? '#f97316' : '#14141f',
                      border: `1px solid ${active ? '#f97316' : '#2a2a40'}`,
                      color: active ? '#ffffff' : '#b4b4c8',
                    }}
                  >
                    {MEAL_ICON[m]} {MEAL_LABEL[m]}
                  </button>
                )
              })}
            </div>

            {editError && (
              <div className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                {editError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold active:scale-95 transition-all disabled:opacity-50"
                style={{ background: '#f97316', color: '#ffffff' }}
              >
                {editSaving && <Spinner color="#ffffff" />}
                Save
              </button>
              <button
                type="button"
                onClick={deleteEdit}
                disabled={editSaving}
                className="rounded-2xl px-5 py-4 text-base font-bold active:scale-95 transition-all disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', color: '#ef4444' }}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      <BottomNav />
    </div>
  )
}
