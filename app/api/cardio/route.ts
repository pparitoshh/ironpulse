import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { MACHINES, cardioCalories, normalizeCardio } from '@/lib/cardio'

async function userIdOf() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  return ((session.user as any).id || session.user.email) as string
}

export async function GET(req: NextRequest) {
  const userId = await userIdOf()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 200)

  let q = getServiceClient().from('cardio_logs').select('*').eq('user_id', userId)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
  q = date ? q.eq('date', date) : q.limit(limit)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const userId = await userIdOf()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body?.date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const c = normalizeCardio({ ...body, machine_type: body.machine, duration: body.duration_min })
  if (MACHINES.some(m => m.value === body.machine)) c.machine = body.machine
  if (!c.duration_min || c.duration_min <= 0) return NextResponse.json({ error: 'duration_min required' }, { status: 400 })
  c.calories_machine = body.calories_machine ?? c.calories_machine

  const supabase = getServiceClient()
  const { data: profile } = await supabase.from('user_profiles').select('weight_kg').eq('user_id', userId).single()
  // The user may have edited the final kcal on the confirm screen; respect that.
  const calories = body.calories != null && body.calories !== '' ? Math.round(Number(body.calories))
    : cardioCalories(c, profile?.weight_kg)

  const { data, error } = await supabase.from('cardio_logs').insert({
    ...c,
    calories,
    user_id: userId,
    date: body.date,
    source: body.source === 'photo' ? 'photo' : 'manual',
    raw: body.raw ?? null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const userId = await userIdOf()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await getServiceClient().from('cardio_logs').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
