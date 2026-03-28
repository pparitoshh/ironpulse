'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/ui/BottomNav'

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEALS[number]

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎'
}

export default function FoodPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [logs, setLogs] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch')
  const [textInput, setTextInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'text' | 'photo' | 'manual'>('text')
  const [manual, setManual] = useState({ food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', quantity: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') loadData()
  }, [status])

  async function loadData() {
    const [foodRes, profRes] = await Promise.all([
      fetch(`/api/log-food?date=${today}`),
      fetch('/api/get-progress'),
    ])
    const [f, p] = await Promise.all([foodRes.json(), profRes.json()])
    setLogs(f)
    setProfile(p)
    setLoading(false)
  }

  async function estimateFromText() {
    if (!textInput.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/estimate-macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: textInput }),
      })
      const data = await res.json()
      setPreview(data)
    } catch (e) { console.error(e) }
    finally { setAiLoading(false) }
  }

  function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<{ base64: string; mimeType: string }> {
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
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  async function scanPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiLoading(true)
    try {
      const { base64, mimeType } = await compressImage(file)
      const res = await fetch('/api/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64, mimeType }),
      })
      if (!res.ok) throw new Error('Scan failed')
      const data = await res.json()
      setPreview(data)
    } catch (err) { console.error('Photo scan error:', err) }
    finally { setAiLoading(false) }
  }

  async function logFood(data: any) {
    setSaving(true)
    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        meal_type: selectedMeal,
        food_name: data.food_name,
        calories: parseInt(data.calories),
        protein_g: parseFloat(data.protein_g),
        carbs_g: parseFloat(data.carbs_g),
        fat_g: parseFloat(data.fat_g),
        quantity: data.quantity,
      }),
    })
    await loadData()
    setSaving(false)
    setShowAdd(false)
    setPreview(null)
    setTextInput('')
    setManual({ food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', quantity: '' })
  }

  async function deleteFood(id: string) {
    setDeletingId(id)
    try {
      await fetch('/api/log-food', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setLogs(prev => prev.filter(l => l.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const totals = {
    calories: logs.reduce((s, l) => s + l.calories, 0),
    protein: logs.reduce((s, l) => s + parseFloat(l.protein_g || 0), 0),
    carbs: logs.reduce((s, l) => s + parseFloat(l.carbs_g || 0), 0),
    fat: logs.reduce((s, l) => s + parseFloat(l.fat_g || 0), 0),
  }

  const byMeal = (meal: MealType) => logs.filter(l => l.meal_type === meal)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
      <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#888' }}>Nutrition</p>
          <h1 className="font-bold text-2xl">Food Log</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl"
          style={{ background: '#f97316', color: '#fff' }}>+</button>
      </div>

      <div className="px-5 space-y-4">
        {/* Macro summary */}
        <div className="p-4 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Calories', value: totals.calories, target: profile?.target_calories, unit: '', color: '#f97316' },
              { label: 'Protein', value: Math.round(totals.protein), target: profile?.target_protein, unit: 'g', color: '#3b82f6' },
              { label: 'Carbs', value: Math.round(totals.carbs), target: profile?.target_carbs, unit: 'g', color: '#22c55e' },
              { label: 'Fat', value: Math.round(totals.fat), target: profile?.target_fat, unit: 'g', color: '#f59e0b' },
            ].map(m => (
              <div key={m.label}>
                <div className="text-lg font-bold" style={{ color: m.color }}>{m.value}{m.unit}</div>
                {m.target && <div className="text-xs" style={{ color: '#555' }}>/{m.target}</div>}
                <div className="text-xs mt-0.5" style={{ color: '#888' }}>{m.label}</div>
                <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: '#1c1c2e' }}>
                  <div className="h-full rounded-full" style={{
                    width: m.target ? `${Math.min(100, (m.value / m.target) * 100)}%` : '0%',
                    background: m.color
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meals */}
        {MEALS.map(meal => {
          const items = byMeal(meal)
          const mealCals = items.reduce((s, l) => s + l.calories, 0)
          return (
            <div key={meal} className="rounded-2xl overflow-hidden" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{MEAL_ICONS[meal]}</span>
                  <span className="font-semibold capitalize">{meal}</span>
                </div>
                <div className="flex items-center gap-2">
                  {mealCals > 0 && <span className="text-xs" style={{ color: '#f97316' }}>{mealCals} kcal</span>}
                  <button onClick={() => { setSelectedMeal(meal); setShowAdd(true) }}
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: '#14141f', color: '#888' }}>
                    + Add
                  </button>
                </div>
              </div>
              {items.length > 0 && (
                <div className="px-4 pb-3 space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-t"
                      style={{ borderColor: '#1c1c2e' }}>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.food_name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#888' }}>
                          P:{Math.round(item.protein_g)}g · C:{Math.round(item.carbs_g)}g · F:{Math.round(item.fat_g)}g
                          {item.quantity && ` · ${item.quantity}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: '#f97316' }}>{item.calories}</span>
                        <button onClick={() => deleteFood(item.id)} disabled={deletingId === item.id}
                          className="text-red-500 text-lg disabled:opacity-40">
                          {deletingId === item.id ? (
                            <span className="w-4 h-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin inline-block" />
                          ) : '×'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {items.length === 0 && (
                <div className="px-4 pb-3 text-xs" style={{ color: '#555' }}>Nothing logged yet</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add food modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="w-full max-w-lg mx-auto rounded-3xl animate-fade-in"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="px-5 pt-5 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Add Food</h2>
                <button onClick={() => setShowAdd(false)} className="text-2xl" style={{ color: '#888' }}>×</button>
              </div>

              {/* Meal selector */}
              <div className="flex gap-2 overflow-x-auto mb-4">
                {MEALS.map(m => (
                  <button key={m} onClick={() => setSelectedMeal(m)}
                    className="px-3 py-1.5 rounded-lg text-sm capitalize whitespace-nowrap"
                    style={{
                      background: selectedMeal === m ? 'rgba(249,115,22,0.15)' : '#14141f',
                      border: `1px solid ${selectedMeal === m ? '#f97316' : '#1c1c2e'}`,
                      color: selectedMeal === m ? '#f97316' : '#888',
                    }}>
                    {MEAL_ICONS[m]} {m}
                  </button>
                ))}
              </div>

              {/* Input tabs */}
              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: '#14141f' }}>
                {([['text', '✍️ Describe'], ['photo', '📷 Photo'], ['manual', '📝 Manual']] as const).map(([t, label]) => (
                  <button key={t} onClick={() => setTab(t as any)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: tab === t ? '#0f0f1a' : 'transparent',
                      color: tab === t ? '#f97316' : '#888',
                      border: tab === t ? '1px solid #1c1c2e' : 'none',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Text description */}
              {tab === 'text' && (
                <div>
                  <textarea
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    placeholder="e.g. 2 scrambled eggs with toast and butter, black coffee"
                    rows={3}
                    className="w-full p-3 rounded-xl text-sm outline-none resize-none"
                    style={{ background: '#14141f', border: '1px solid #1c1c2e', color: '#f0f0f0' }}
                  />
                  <button onClick={estimateFromText} disabled={aiLoading || !textInput.trim()}
                    className="w-full mt-3 py-4 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ background: '#f97316', color: '#fff' }}>
                    {aiLoading ? '🤖 Estimating...' : '🤖 Estimate with AI'}
                  </button>
                </div>
              )}

              {/* Photo scan */}
              {tab === 'photo' && (
                <div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    className="hidden" onChange={scanPhoto} />
                  <button onClick={() => fileRef.current?.click()} disabled={aiLoading}
                    className="w-full py-8 rounded-xl border-2 border-dashed text-center disabled:opacity-50"
                    style={{ borderColor: '#1c1c2e', color: '#888' }}>
                    {aiLoading ? (
                      <div>
                        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-2" />
                        <div className="text-sm">Scanning with Gemini...</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-4xl mb-2">📷</div>
                        <div className="text-sm">Take photo or upload</div>
                        <div className="text-xs mt-1" style={{ color: '#555' }}>Gemini AI will estimate macros</div>
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* Manual entry */}
              {tab === 'manual' && (
                <div className="space-y-3">
                  {[
                    { key: 'food_name', label: 'Food Name', type: 'text', placeholder: 'e.g. Chicken Breast' },
                    { key: 'quantity', label: 'Quantity', type: 'text', placeholder: '150g or 1 piece' },
                    { key: 'calories', label: 'Calories', type: 'number', placeholder: '200' },
                    { key: 'protein_g', label: 'Protein (g)', type: 'number', placeholder: '25' },
                    { key: 'carbs_g', label: 'Carbs (g)', type: 'number', placeholder: '0' },
                    { key: 'fat_g', label: 'Fat (g)', type: 'number', placeholder: '4' },
                  ].map(f => (
                    <div key={f.key} className="p-3 rounded-xl" style={{ background: '#14141f', border: '1px solid #1c1c2e' }}>
                      <div className="text-xs mb-1" style={{ color: '#888' }}>{f.label}</div>
                      <input type={f.type} placeholder={f.placeholder}
                        value={(manual as any)[f.key]}
                        onChange={e => setManual(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full bg-transparent text-sm outline-none"
                        style={{ color: '#f0f0f0' }} />
                    </div>
                  ))}
                  <button
                    onClick={() => logFood(manual)}
                    disabled={!manual.food_name || !manual.calories}
                    className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                    style={{ background: '#f97316', color: '#fff' }}>
                    Log Food
                  </button>
                </div>
              )}

              {/* AI Preview */}
              {preview && (
                <div className="mt-4 p-4 rounded-xl animate-fade-in" style={{ background: '#14141f', border: '1px solid #f97316' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">{preview.food_name}</div>
                      {preview.quantity && <div className="text-xs mt-0.5" style={{ color: '#888' }}>{preview.quantity}</div>}
                    </div>
                    <div className="text-xl font-bold" style={{ color: '#f97316' }}>{preview.calories} kcal</div>
                  </div>
                  <div className="flex gap-4 text-sm mb-4">
                    <span style={{ color: '#3b82f6' }}>P: {preview.protein_g}g</span>
                    <span style={{ color: '#22c55e' }}>C: {preview.carbs_g}g</span>
                    <span style={{ color: '#f59e0b' }}>F: {preview.fat_g}g</span>
                  </div>
                  <button onClick={() => logFood(preview)} disabled={saving}
                    className="w-full py-3 rounded-xl font-semibold text-sm"
                    style={{ background: '#f97316', color: '#fff' }}>
                    {saving ? 'Saving...' : '✅ Log This Food'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
