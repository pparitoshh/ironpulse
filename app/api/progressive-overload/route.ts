import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProgressiveOverloadSuggestion } from '@/lib/groq'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { exerciseName, sets } = await req.json()
    const result = await getProgressiveOverloadSuggestion(exerciseName, sets)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Progressive overload error:', error)
    return NextResponse.json({ error: 'Failed to get suggestion' }, { status: 500 })
  }
}
