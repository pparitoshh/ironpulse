import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { SESSION_TYPES, youtubeId } from '@/lib/cardio'

// Home-session video catalog: built-in rows (user_id null) + the user's own videos.
const DEFAULT_MET: Record<string, number> = { hiit: 8, core: 4.5, yoga: 2.8, mobility: 2.5, stretch: 2.3, walk: 4.5, warmup: 3.5, cooldown: 2.3 }
const LEVEL_MET: Record<string, number> = { beginner: 0.8, intermediate: 1, advanced: 1.12 }

async function userIdOf() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  return ((session.user as any).id || session.user.email) as string
}

export async function GET() {
  const userId = await userIdOf()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await getServiceClient().from('session_catalog').select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('type').order('duration_min')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** Add your own YouTube video: { url, type, duration_min, level? } */
export async function POST(req: NextRequest) {
  const userId = await userIdOf()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const id = youtubeId(body.url)
  if (!id) return NextResponse.json({ error: 'That does not look like a YouTube link' }, { status: 400 })
  const type = SESSION_TYPES.some(t => t.value === body.type) ? body.type : 'hiit'
  const level = ['beginner', 'intermediate', 'advanced'].includes(body.level) ? body.level : 'intermediate'
  const duration = Math.round(Number(body.duration_min))
  if (!(duration > 0 && duration < 300)) return NextResponse.json({ error: 'duration_min required' }, { status: 400 })

  // Title/channel from YouTube oEmbed (also tells us whether embedding is allowed).
  let title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'My video'
  let channel: string | null = null
  let embeddable = true
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)
    if (r.ok) { const o = await r.json(); title = o.title || title; channel = o.author_name || null }
    else if (r.status === 401 || r.status === 403) embeddable = false
    else if (r.status === 404) return NextResponse.json({ error: 'Video not found' }, { status: 400 })
  } catch {}

  const met = Math.round((DEFAULT_MET[type] ?? 6) * (LEVEL_MET[level] ?? 1) * 10) / 10
  const { data, error } = await getServiceClient().from('session_catalog').upsert({
    user_id: userId, type, title: title.slice(0, 200), channel, youtube_id: id,
    duration_min: duration, level, met, embeddable,
  }, { onConflict: 'user_id,youtube_id', ignoreDuplicates: false }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const userId = await userIdOf()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await getServiceClient().from('session_catalog').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
