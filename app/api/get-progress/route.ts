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

    // Only pass known columns to avoid Supabase errors
    const allowedFields = [
      'gender', 'goal', 'level', 'days_per_week', 'training_days', 'equipment',
      'age', 'weight_kg', 'height_cm',
      'target_calories', 'target_protein', 'target_carbs', 'target_fat',
    ]
    const filtered: Record<string, any> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) filtered[key] = body[key]
    }

    const { data, error } = await supabase.from('user_profiles').upsert({
      user_id: userId,
      ...filtered,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Save profile error:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    return NextResponse.json(data || null)
  } catch (error) {
    return NextResponse.json(null)
  }
}
