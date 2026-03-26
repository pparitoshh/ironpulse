import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email

    const { data, error } = await supabase.from('workout_logs').upsert({
      user_id: userId,
      date: body.date,
      day_name: body.day_name,
      sets: body.sets,
      duration_minutes: body.duration_minutes,
      notes: body.notes,
    }, { onConflict: 'user_id,date' }).select().single()

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
