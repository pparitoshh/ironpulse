'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

function pickByType(list: any[], types: string[], seed: number): any | null {
  const pool = list.filter(s => types.includes(s.type))
  if (pool.length === 0) return null
  return pool[seed % pool.length]
}

export default function HomeDayCard({ trainingDays }: { trainingDays?: string[] | null }) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const hasSchedule = !!trainingDays && trainingDays.length > 0
  const show = hasSchedule && !trainingDays!.includes(todayName)

  useEffect(() => {
    if (!show) return
    let cancelled = false
    fetch('/api/sessions')
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (cancelled || !Array.isArray(data)) return
        const day = dayOfYear()
        const picks = [
          pickByType(data, ['hiit'], day),
          pickByType(data, ['yoga'], day + 1),
          pickByType(data, ['core', 'mobility'], day + 2),
        ].filter(Boolean)
        setSuggestions(picks)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [show])

  if (!show) return null

  return (
    <div className="rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid #f97316' }}>
      <h3 className="font-bold text-base" style={{ color: '#f0f0f0' }}>
        🏠 No gym today
      </h3>
      <p className="text-sm mt-1" style={{ color: '#b4b4c8' }}>
        Pick a home session — HIIT, yoga or mobility
      </p>

      <div className="mt-3 space-y-2">
        {suggestions.map(s => (
          <Link
            key={s.id}
            href={`/sessions?play=${s.id}`}
            className="flex items-center gap-3 rounded-xl p-2 active:scale-[0.99] transition-all"
            style={{ background: '#14141f' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${s.youtube_id}/hqdefault.jpg`}
              alt={s.title}
              className="aspect-video rounded-lg object-cover flex-shrink-0"
              style={{ width: 80 }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate" style={{ color: '#f0f0f0' }}>
                {s.title}
              </div>
              <div className="text-xs" style={{ color: '#b4b4c8' }}>
                {s.duration_min} min
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Link href="/sessions" className="inline-block mt-3 text-sm font-bold" style={{ color: '#f97316' }}>
        Browse all sessions →
      </Link>
    </div>
  )
}
