import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { localDate } from '@/lib/date'

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
const SOURCES = ['photo', 'text', 'manual', 'recent']

async function userIdOf() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  return ((session.user as any).id || session.user.email) as string
}

const n = (v: any) => {
  const x = Number(v)
  return Number.isFinite(x) && x >= 0 ? x : 0
}

/** Whitelist + coerce one food row. */
function toRow(it: any, userId: string, date: string, meal: string, source: string) {
  return {
    user_id: userId,
    date,
    meal_type: MEALS.includes(it.meal_type) ? it.meal_type : meal,
    food_name: String(it.food_name ?? it.name ?? 'Food').slice(0, 200),
    calories: Math.round(n(it.calories)),
    protein_g: n(it.protein_g),
    carbs_g: n(it.carbs_g),
    fat_g: n(it.fat_g),
    fiber_g: n(it.fiber_g),
    grams: it.grams ? n(it.grams) : null,
    quantity: it.quantity ? String(it.quantity).slice(0, 100) : (it.grams ? `${Math.round(n(it.grams))} g` : null),
    source: SOURCES.includes(it.source) ? it.source : source,
  }
}

/**
 * Log food. Body is either one item { date, meal_type, food_name, calories, ... }
 * or a whole meal { date, meal_type, source, items: [{ name, grams, calories, protein_g, carbs_g, fat_g, fiber_g }] }.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await userIdOf()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const date = typeof body.date === 'string' ? body.date : localDate()
    const meal = MEALS.includes(body.meal_type) ? body.meal_type : 'snack'
    const source = SOURCES.includes(body.source) ? body.source : 'manual'
    const list = Array.isArray(body.items) ? body.items : [body]
    const rows = list.map((it: any) => toRow(it, userId, date, meal, source)).filter((r: any) => r.food_name)
    if (!rows.length) return NextResponse.json({ error: 'Nothing to log' }, { status: 400 })

    const { data, error } = await getServiceClient().from('food_logs').insert(rows).select()
    if (error) throw error
    return NextResponse.json(Array.isArray(body.items) ? data : data?.[0])
  } catch (error) {
    console.error('Log food error:', error)
    return NextResponse.json({ error: 'Failed to log food' }, { status: 500 })
  }
}

/**
 * GET ?date=YYYY-MM-DD  -> that day's entries
 * GET ?recent=1         -> up to 20 distinct foods from the last 30 days, most-logged first
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await userIdOf()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = getServiceClient()
    const { searchParams } = new URL(req.url)

    if (searchParams.get('recent')) {
      const since = new Date(); since.setDate(since.getDate() - 30)
      const { data } = await supabase.from('food_logs').select('*').eq('user_id', userId)
        .gte('date', localDate(since)).order('created_at', { ascending: false }).limit(400)
      const byName = new Map<string, any>()
      for (const row of data || []) {
        const key = String(row.food_name).trim().toLowerCase()
        const hit = byName.get(key)
        if (hit) hit.times += 1
        else byName.set(key, { ...row, times: 1 })
      }
      const recent = Array.from(byName.values()).sort((a, b) => b.times - a.times).slice(0, 20)
      return NextResponse.json(recent)
    }

    const date = searchParams.get('date') || localDate()
    const { data } = await supabase.from('food_logs').select('*').eq('user_id', userId).eq('date', date)
      .order('created_at', { ascending: true })
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json([])
  }
}

/** Edit one entry: { id, grams?, calories?, protein_g?, carbs_g?, fat_g?, fiber_g?, food_name?, meal_type? } */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await userIdOf()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const patch: Record<string, any> = {}
    for (const k of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'grams']) {
      if (k in body) patch[k] = k === 'calories' ? Math.round(n(body[k])) : n(body[k])
    }
    if ('grams' in body) patch.quantity = `${Math.round(n(body.grams))} g`
    if (typeof body.food_name === 'string') patch.food_name = body.food_name.slice(0, 200)
    if (MEALS.includes(body.meal_type)) patch.meal_type = body.meal_type
    const { data, error } = await getServiceClient().from('food_logs').update(patch)
      .eq('id', body.id).eq('user_id', userId).select().single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await userIdOf()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await req.json()
    await getServiceClient().from('food_logs').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
