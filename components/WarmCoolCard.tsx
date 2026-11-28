'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Suggests the warm-up video before a gym session and the cool-down video after it.
// Prefers the user's own warm-up/cool-down videos, else the built-in ones.
export default function WarmCoolCard({ kind }: { kind: 'warmup' | 'cooldown' }) {
  const [video, setVideo] = useState<any>(null)

  useEffect(() => {
    fetch('/api/sessions').then(r => (r.ok ? r.json() : [])).then((list: any[]) => {
      const pool = (Array.isArray(list) ? list : []).filter(s => s.type === kind)
      setVideo(pool.find(s => s.user_id) || pool[0] || null)
    }).catch(() => {})
  }, [kind])

  if (!video) return null
  const warm = kind === 'warmup'
  return (
    <Link href={`/sessions?play=${video.id}`}
      className="flex items-center gap-3 rounded-2xl p-3 mt-3 active:scale-[0.99] transition-all"
      style={{ background: '#0f0f1a', border: `2px solid ${warm ? '#f97316' : '#38bdf8'}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`} alt=""
        className="rounded-xl object-cover flex-shrink-0 aspect-video" style={{ width: 96 }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest font-bold" style={{ color: warm ? '#fdba74' : '#7dd3fc' }}>
          {warm ? '🔥 Warm up first' : '❄️ Cool down now'}
        </div>
        <div className="text-sm font-bold truncate mt-0.5" style={{ color: '#f0f0f0' }}>{video.title}</div>
        <div className="text-xs mt-0.5" style={{ color: '#b4b4c8' }}>{video.duration_min} min · {video.channel}</div>
      </div>
      <span className="text-2xl" style={{ color: '#f0f0f0' }}>▶</span>
    </Link>
  )
}
