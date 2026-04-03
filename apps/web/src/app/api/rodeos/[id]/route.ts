import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RodeoService } from '@/lib/services/rodeo-service'

// ── GET /api/rodeos/[id] — full rodeo detail ──────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rodeo, error } = await RodeoService.getRodeo(params.id)
  if (error) {
    console.error('getRodeo error:', error)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch current user's votes for this rodeo so the UI can show voted state
  const { data: myVotes } = await supabase
    .from('rodeo_votes')
    .select('song_id, target_entry_id, voter_type')
    .eq('rodeo_id', params.id)
    .eq('voter_id', user.id)

  // Fetch user's subscription tier for vote-gating
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  // Permission flags for the Result Screen
  const isCreator = rodeo?.created_by === user.id

  // Check if user is board/founder of the winning circle
  let isWinningCircleBoard = false
  const winnerCircleId = rodeo?.rodeo_results?.winner_circle_id ?? null
  if (winnerCircleId) {
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', winnerCircleId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('role', ['board', 'founder'])
      .maybeSingle()
    isWinningCircleBoard = !!membership
  }

  return NextResponse.json({
    rodeo,
    myVotes: myVotes ?? [],
    isSubscribed: profile?.subscription_tier !== 'free',
    isCreator,
    isWinningCircleBoard,
  })
}

// ── POST /api/rodeos/[id] — cast a vote ───────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { song_id: string; target_entry_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.song_id || !body.target_entry_id) {
    return NextResponse.json({ error: 'song_id and target_entry_id are required' }, { status: 400 })
  }

  const { data, error } = await RodeoService.castVote({
    rodeo_id: params.id,
    song_id: body.song_id,
    target_entry_id: body.target_entry_id,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    )
  }

  return NextResponse.json({ vote_id: data.vote_id })
}
