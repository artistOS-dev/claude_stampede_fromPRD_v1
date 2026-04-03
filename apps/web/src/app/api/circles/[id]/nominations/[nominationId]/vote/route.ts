import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NominationService } from '@/lib/services/nomination-service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; nominationId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { vote } = body

  if (!vote || !['for', 'against'].includes(vote)) {
    return NextResponse.json({ error: 'vote must be "for" or "against"' }, { status: 400 })
  }

  const result = await NominationService.castNominationVote({
    nomination_id: params.nominationId,
    voter_id: user.id,
    vote,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ resolved: result.resolved, status: result.status })
}
