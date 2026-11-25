import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { minutesBetween, strengthCalories } from '@/lib/strength'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email

    const row: Record<string, any> = {
      user_id: userId,
      date: body.date,
      day_name: body.day_name,
      sets: body.sets,
      duration_minutes: body.duration_minutes,
      notes: body.notes,
    }
    // Session timing: only touch the columns the client sent (null clears ended_at on "continue").
    if ('started_at' in body) row.started_at = body.started_at || null
    if ('ended_at' in body) row.ended_at = body.ended_at || null
    if (row.started_at) row.duration_minutes = minutesBetween(row.started_at, row.ended_at)

    if (row.ended_at && Array.isArray(body.sets)) {
      const { data: profile } = await supabase.from('user_profiles').select('weight_kg').eq('user_id', userId).single()
      row.calories = strengthCalories(body.sets, row.duration_minutes || 0, profile?.weight_kg)
    } else if ('ended_at' in body) {
      row.calories = null
    }

    const { data, error } = await supabase.from('workout_logs').upsert(row, { onConflict: 'user_id,date' }).select().single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Log workout error:', error)
    return NextResponse.json({ error: 'Failed to log workout' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const limit = searchParams.get('limit') || '30'

    let query = supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(parseInt(limit))

    if (date) query = query.eq('date', date)

    const { data } = await query
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json([])
  }
}
