import { NextRequest, NextResponse } from 'next/server'
import { RodeoService } from '@/lib/services/rodeo-service'

// POST /api/rodeos/[id]/decline
// Target circle board declines the challenge.
// Rodeo is closed and challenger is notified via feed event.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await RodeoService.declineChallenge(params.id)

  if (error) {
    return NextResponse.json({ error: error.message, code: (error as { code?: string }).code }, { status: (error as { status?: number }).status ?? 400 })
  }

  return NextResponse.json({ success: true })
}
