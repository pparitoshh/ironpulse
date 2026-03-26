import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { scanFoodImage } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { base64Image, mimeType } = await req.json()
    const result = await scanFoodImage(base64Image, mimeType)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Scan food error:', error)
    return NextResponse.json({ error: 'Failed to scan food image' }, { status: 500 })
  }
}
