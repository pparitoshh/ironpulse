'use client'
import { clock, summarize, WSet } from '@/lib/strength'
import WarmCoolCard from '@/components/WarmCoolCard'

type Props = {
  dayName: string
  startedAt: string | null
  endedAt: string | null
  minutes: number
  sets: WSet[]
  strengthKcal: number
  cardio: any[]
  onClose: () => void
  onContinue: () => void
}

export default function WorkoutSummary({ dayName, startedAt, endedAt, minutes, sets, strengthKcal, cardio, onClose, onContinue }: Props) {
  const s = summarize(sets)
  const cardioKcal = cardio.reduce((t, c) => t + (Number(c.calories) || 0), 0)
  const cardioMin = Math.round(cardio.reduce((t, c) => t + (Number(c.duration_min) || 0), 0))
  const total = strengthKcal + cardioKcal
  const h = Math.floor(minutes / 60), m = minutes % 60

  const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="rounded-2xl p-3" style={{ background: '#14141f', border: '1px solid #2a2a40' }}>
      <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#b4b4c8' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: '#f0f0f0' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#b4b4c8' }}>{sub}</div>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" style={{ background: 'rgba(8,8,16,0.97)' }}>
      <div className="max-w-lg mx-auto px-5 pt-12 pb-10 animate-fade-in">
        <div className="text-center">
          <div className="text-6xl">🏁</div>
          <h2 className="text-3xl font-bold mt-3" style={{ color: '#f0f0f0' }}>Workout complete!</h2>
          <p className="text-base mt-1 font-semibold" style={{ color: '#f97316' }}>{dayName}</p>
        </div>

        <div className="mt-6 rounded-2xl p-5 text-center" style={{ background: 'rgba(249,115,22,0.12)', border: '2px solid #f97316' }}>
          <div className="text-xs uppercase tracking-widest font-bold" style={{ color: '#fdba74' }}>🔥 Burned this session</div>
          <div className="text-5xl font-bold mt-2" style={{ color: '#f97316' }}>{total}<span className="text-2xl"> kcal</span></div>
          <div className="text-sm mt-2" style={{ color: '#f0f0f0' }}>
            🏋️ Lifting {strengthKcal} kcal{cardio.length > 0 && <> · 🫀 Cardio {cardioKcal} kcal ({cardioMin} min)</>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stat label="⏱ Time" value={h ? `${h}h ${m}m` : `${m} min`} sub={`${clock(startedAt)} → ${clock(endedAt)}`} />
          <Stat label="🏋️ Volume" value={`${s.volume.toLocaleString()} kg`} sub="weight × reps" />
          <Stat label="📋 Sets" value={s.sets} sub={`${s.exercises.length} exercises`} />
          <Stat label="🏆 PRs" value={s.prs.length} sub={s.prs.length ? 'new personal bests' : 'keep pushing'} />
        </div>

        {s.prs.length > 0 && (
          <div className="mt-4 rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid #f59e0b' }}>
            <div className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: '#fbbf24' }}>🏆 Personal records</div>
            {s.prs.map(p => <div key={p} className="text-sm font-semibold py-1" style={{ color: '#f0f0f0' }}>{p}</div>)}
          </div>
        )}

        {s.muscles.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {s.muscles.map(mg => (
              <span key={mg} className="px-3 py-1.5 rounded-full text-sm font-semibold capitalize"
                style={{ background: '#1c1c2e', color: '#f0f0f0' }}>{mg}</span>
            ))}
          </div>
        )}

        <p className="text-xs mt-4" style={{ color: '#9a9ab0' }}>
          Lifting calories are an estimate: METs from your set effort (RPE) × your body weight × time.
        </p>

        <WarmCoolCard kind="cooldown" />

        <button onClick={onClose} className="w-full mt-6 py-4 rounded-2xl font-bold text-base active:scale-95 transition-all"
          style={{ background: '#f97316', color: '#fff' }}>Done</button>
        <button onClick={onContinue} className="w-full mt-3 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all"
          style={{ background: '#1c1c2e', color: '#f0f0f0' }}>↩ Continue workout</button>
      </div>
    </div>
  )
}
