import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askVisionJSON } from '@/lib/ai'
import { MACHINE_SCAN_PROMPT, normalizeMachine } from '@/lib/machine'

export const maxDuration = 60

/** Photo of a gym machine / its instruction sign -> exercise prefill (not saved). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { base64Image, mimeType } = await req.json()
    if (!base64Image) return NextResponse.json({ error: 'image required' }, { status: 400 })

    const raw = await askVisionJSON('machine_photo', base64Image, mimeType || 'image/jpeg', MACHINE_SCAN_PROMPT)
    const ex = normalizeMachine(raw)
    if (!ex) return NextResponse.json({ error: "That doesn't look like a strength machine. Snap the sign with the machine's name on it (cardio screens go in the Burned card on Home)." }, { status: 422 })
    return NextResponse.json(ex)
  } catch (error: any) {
    console.error('Scan machine error:', error?.message)
    return NextResponse.json({ error: 'Could not read the machine. Try a closer, straighter photo of its sign, or type it in.' }, { status: 500 })
  }
}
