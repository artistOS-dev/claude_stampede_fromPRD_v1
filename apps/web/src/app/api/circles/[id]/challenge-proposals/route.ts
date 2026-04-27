import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChallengeBoardService } from '@/lib/services/challenge-board-service'

// GET /api/circles/[id]/challenge-proposals
// Lists proposals for this circle (board/founder only).

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from('circle_members').select('role').eq('circle_id', params.id).eq('user_id', user.id).eq('status', 'active').in('role', ['board', 'founder']).maybeSingle(),
    supabase.from('profiles').select('is_super_admin, subscription_tier').eq('id', user.id).maybeSingle(),
  ])

  const isSuperAdmin = profile?.is_super_admin === true
  const isSuperfan = !isSuperAdmin && profile?.subscription_tier === 'superfan'

  if (!membership && !isSuperAdmin && !isSuperfan) {
    return NextResponse.json({ error: 'Board or founder access required' }, { status: 403 })
  }

  const status = new URL(request.url).searchParams.get('status') ?? undefined
  const { data, error } = await ChallengeBoardService.listProposals(params.id, status)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also return board member count for tally context
  const { data: boardMembers } = await ChallengeBoardService.getBoardMembers(params.id)

  return NextResponse.json({
    proposals: data ?? [],
    board_seat_count: boardMembers?.length ?? 0,
    my_user_id: user.id,
    can_vote: !!membership || isSuperAdmin,
    read_only: !membership && isSuperfan,
  })
}

// POST /api/circles/[id]/challenge-proposals
// Submit a new challenge proposal for board review.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    target_circle_id: string
    title: string
    description?: string
    credit_buy_in: number
    song_ids: string[]
    song_labels?: Record<string, 'studio' | 'live'>
    end_date?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data, error } = await ChallengeBoardService.submitProposal({
    circle_id: params.id,
    ...body,
  })

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }

  return NextResponse.json({ proposal_id: data.proposal_id }, { status: 201 })
}
