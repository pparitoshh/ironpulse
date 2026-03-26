import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateWorkoutPlan } from '@/lib/groq'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { profile } = body

    const plan = await generateWorkoutPlan(profile)

    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email

    // Save plan
    await supabase.from('workout_plans').insert({
      user_id: userId,
      plan,
    })

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Generate plan error:', error)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email

    const { data } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ plan: data?.plan || null })
  } catch (error) {
    return NextResponse.json({ plan: null })
  }
}
