import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { askVisionJSON } from '@/lib/ai'
import { CARDIO_SCAN_PROMPT, cardioCalories, normalizeCardio } from '@/lib/cardio'

export const maxDuration = 60

/** Photo of a cardio machine's summary screen -> prefilled cardio entry (not saved). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id || session.user.email

    const { base64Image, mimeType } = await req.json()
    if (!base64Image) return NextResponse.json({ error: 'image required' }, { status: 400 })

    const [raw, profileRes] = await Promise.all([
      askVisionJSON('cardio_photo', base64Image, mimeType || 'image/jpeg', CARDIO_SCAN_PROMPT),
      getServiceClient().from('user_profiles').select('weight_kg').eq('user_id', userId).single(),
    ])
    const cardio = normalizeCardio(raw)
    const weight = profileRes.data?.weight_kg ?? null
    cardio.calories = cardioCalories(cardio, weight)
    return NextResponse.json({ ...cardio, weight_kg: weight, raw })
  } catch (error: any) {
    console.error('Scan cardio error:', error?.message)
    return NextResponse.json({ error: 'Could not read the machine screen. Try a straighter, closer photo or enter it manually.' }, { status: 500 })
  }
}
