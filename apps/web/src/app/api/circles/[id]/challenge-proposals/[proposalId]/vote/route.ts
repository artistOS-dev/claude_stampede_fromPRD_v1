import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChallengeBoardService } from '@/lib/services/challenge-board-service'

// POST /api/circles/[id]/challenge-proposals/[proposalId]/vote
// Cast or update a board member's vote on a challenge proposal.
// Automatically resolves the proposal if majority is reached.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; proposalId: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { vote: 'approve' | 'hold' | 'decline'; comment?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!['approve', 'hold', 'decline'].includes(body.vote)) {
    return NextResponse.json({ error: 'vote must be approve, hold, or decline' }, { status: 400 })
  }

  const { data, error } = await ChallengeBoardService.castBoardVote({
    proposal_id: params.proposalId,
    vote: body.vote,
    comment: body.comment,
  })

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }

  return NextResponse.json({ resolved: data.resolved, outcome: data.outcome })
}
