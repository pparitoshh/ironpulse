import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { estimateMacros } from '@/lib/groq'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { description } = await req.json()
    const result = await estimateMacros(description)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Estimate macros error:', error)
    return NextResponse.json({ error: 'Failed to estimate macros' }, { status: 500 })
  }
}
