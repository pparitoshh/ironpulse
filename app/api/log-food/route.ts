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

    const { data, error } = await supabase.from('food_logs').insert({
      user_id: userId,
      date: body.date,
      meal_type: body.meal_type,
      food_name: body.food_name,
      calories: body.calories,
      protein_g: body.protein_g,
      carbs_g: body.carbs_g,
      fat_g: body.fat_g,
      quantity: body.quantity,
    }).select().single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Log food error:', error)
    return NextResponse.json({ error: 'Failed to log food' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true })

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json()
    const supabase = getServiceClient()
    const userId = (session.user as any).id || session.user.email

    await supabase.from('food_logs').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
