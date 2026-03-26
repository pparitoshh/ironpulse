'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EQUIPMENT_OPTIONS } from '@/types'

const GOALS = [
  { value: 'bulk', label: 'Build Muscle', icon: '💪', desc: 'Gain mass & strength' },
  { value: 'cut', label: 'Lose Fat', icon: '🔥', desc: 'Lean out & cut' },
  { value: 'maintain', label: 'Stay Fit', icon: '⚖️', desc: 'Maintain & tone' },
  { value: 'strength', label: 'Get Stronger', icon: '🏆', desc: 'Max strength gains' },
]

const LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: '< 1 year training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years training' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years training' },
]

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    gender: '',
    goal: '',
    level: '',
    days_per_week: 4,
    training_days: [] as string[],
    equipment: [] as string[],
    age: '',
    weight_kg: '',
    height_cm: '',
    target_calories: '',
    target_protein: '',
    target_carbs: '',
    target_fat: '',
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const toggleEquip = (id: string) => {
    set('equipment', form.equipment.includes(id)
      ? form.equipment.filter(e => e !== id)
      : [...form.equipment, id])
  }
  const toggleDay = (day: string) => {
    const days = form.training_days.includes(day)
      ? form.training_days.filter(d => d !== day)
      : [...form.training_days, day]
    set('training_days', days)
    set('days_per_week', days.length)
  }

  const steps = [
    { title: 'Who are you?', subtitle: 'Personalize your experience' },
    { title: 'Your goal?', subtitle: 'What do you want to achieve' },
    { title: 'Experience level?', subtitle: 'Be honest for best results' },
    { title: 'Training days?', subtitle: 'How many days per week' },
    { title: 'Equipment available?', subtitle: 'Select all that you have access to' },
    { title: 'Body stats', subtitle: 'Optional — for better calorie targets' },
  ]

  async function handleFinish() {
    setLoading(true)
    try {
      const profile = {
        ...form,
        age: form.age ? parseInt(form.age) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        target_calories: form.target_calories ? parseInt(form.target_calories) : null,
        target_protein: form.target_protein ? parseInt(form.target_protein) : null,
        target_carbs: form.target_carbs ? parseInt(form.target_carbs) : null,
        target_fat: form.target_fat ? parseInt(form.target_fat) : null,
      }

      // Save profile
      const saveRes = await fetch('/api/get-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        console.error('Failed to save profile:', err)
        alert('Failed to save profile. Please try again.')
        return
      }

      // Generate plan
      const planRes = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      })
      if (!planRes.ok) {
        console.error('Failed to generate plan')
        // Still redirect — plan can be regenerated later
      }

      router.push('/dashboard')
    } catch (e) {
      console.error(e)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canNext = () => {
    if (step === 0) return form.gender !== ''
    if (step === 1) return form.goal !== ''
    if (step === 2) return form.level !== ''
    if (step === 3) return form.training_days.length >= 2
    if (step === 4) return form.equipment.length > 0
    return true
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-8" style={{ background: '#080810' }}>
      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all"
            style={{ background: i <= step ? '#f97316' : '#1c1c2e' }} />
        ))}
      </div>

      <div className="flex-1 animate-fade-in" key={step}>
        <h2 className="text-2xl font-bold mb-1">{steps[step].title}</h2>
        <p className="text-sm mb-8" style={{ color: '#888' }}>{steps[step].subtitle}</p>

        {/* Step 0: Gender */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: 'male', icon: '♂️', label: 'Male' },
              { value: 'female', icon: '♀️', label: 'Female' },
            ].map(g => (
              <button key={g.value} onClick={() => set('gender', g.value)}
                className="p-8 rounded-2xl text-center transition-all"
                style={{
                  background: form.gender === g.value ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
                  border: `2px solid ${form.gender === g.value ? '#f97316' : '#1c1c2e'}`,
                }}>
                <div className="text-5xl mb-3">{g.icon}</div>
                <div className="font-semibold text-lg">{g.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Goal */}
        {step === 1 && (
          <div className="space-y-3">
            {GOALS.map(g => (
              <button key={g.value} onClick={() => set('goal', g.value)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                style={{
                  background: form.goal === g.value ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
                  border: `2px solid ${form.goal === g.value ? '#f97316' : '#1c1c2e'}`,
                }}>
                <span className="text-3xl">{g.icon}</span>
                <div>
                  <div className="font-semibold">{g.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#888' }}>{g.desc}</div>
                </div>
                {form.goal === g.value && <span className="ml-auto text-orange-500">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Level */}
        {step === 2 && (
          <div className="space-y-3">
            {LEVELS.map(l => (
              <button key={l.value} onClick={() => set('level', l.value)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                style={{
                  background: form.level === l.value ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
                  border: `2px solid ${form.level === l.value ? '#f97316' : '#1c1c2e'}`,
                }}>
                <div className="flex-1">
                  <div className="font-semibold">{l.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#888' }}>{l.desc}</div>
                </div>
                {form.level === l.value && <span className="text-orange-500">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Days */}
        {step === 3 && (
          <div>
            <div className="text-center mb-6">
              <div className="font-display text-6xl mb-1" style={{ color: '#f97316' }}>
                {form.training_days.length}
              </div>
              <div className="text-sm" style={{ color: '#888' }}>days selected</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                <button key={day} onClick={() => toggleDay(day)}
                  className="flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
                  style={{
                    background: form.training_days.includes(day) ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
                    border: `2px solid ${form.training_days.includes(day) ? '#f97316' : '#1c1c2e'}`,
                  }}>
                  <span className="font-medium">{day}</span>
                  {form.training_days.includes(day) && <span className="ml-auto text-orange-500">✓</span>}
                </button>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl text-sm" style={{ background: '#0f0f1a', color: '#888' }}>
              {form.training_days.length <= 1 && '→ Select at least 2 training days'}
              {form.training_days.length === 2 && '→ Full body workouts recommended'}
              {form.training_days.length === 3 && '→ Full body workouts recommended'}
              {form.training_days.length === 4 && '→ Upper/Lower split recommended'}
              {form.training_days.length >= 5 && '→ Push/Pull/Legs split recommended'}
            </div>
          </div>
        )}

        {/* Step 4: Equipment */}
        {step === 4 && (
          <div className="grid grid-cols-2 gap-3">
            {EQUIPMENT_OPTIONS.map(e => (
              <button key={e.id} onClick={() => toggleEquip(e.id)}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{
                  background: form.equipment.includes(e.id) ? 'rgba(249,115,22,0.15)' : '#0f0f1a',
                  border: `2px solid ${form.equipment.includes(e.id) ? '#f97316' : '#1c1c2e'}`,
                }}>
                <span className="text-2xl">{e.icon}</span>
                <span className="text-xs font-medium">{e.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 5: Body stats */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-xs mb-6" style={{ color: '#666' }}>All fields optional. Used to calculate calorie targets.</p>
            {[
              { key: 'age', label: 'Age', placeholder: '25', unit: 'years' },
              { key: 'weight_kg', label: 'Weight', placeholder: '75', unit: 'kg' },
              { key: 'height_cm', label: 'Height', placeholder: '175', unit: 'cm' },
              { key: 'target_calories', label: 'Daily Calorie Target', placeholder: '2500', unit: 'kcal' },
              { key: 'target_protein', label: 'Protein Target', placeholder: '150', unit: 'g' },
              { key: 'target_carbs', label: 'Carbs Target', placeholder: '250', unit: 'g' },
              { key: 'target_fat', label: 'Fat Target', placeholder: '70', unit: 'g' },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
                <div className="flex-1">
                  <div className="text-xs mb-1" style={{ color: '#888' }}>{f.label}</div>
                  <input
                    type="number"
                    placeholder={f.placeholder}
                    value={(form as any)[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: '#f0f0f0' }}
                  />
                </div>
                <span className="text-xs" style={{ color: '#555' }}>{f.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex gap-3 mt-8 pb-6">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex-1 py-4 rounded-2xl font-semibold"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
            Back
          </button>
        )}
        <button
          onClick={step < steps.length - 1 ? () => setStep(s => s + 1) : handleFinish}
          disabled={!canNext() || loading}
          className="flex-1 py-4 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50"
          style={{ background: '#f97316', color: '#fff' }}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Generating plan...
            </span>
          ) : step < steps.length - 1 ? 'Continue' : 'Generate My Plan 🚀'}
        </button>
      </div>
    </div>
  )
}
