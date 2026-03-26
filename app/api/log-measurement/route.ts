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

    const { data, error } = await supabase.from('body_measurements').insert({
      user_id: userId,
      ...body,
    }).select().single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save measurement' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email

    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json([])
  }
}
