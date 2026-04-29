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

  // Fetch user's current ranking for this rodeo (ordered by rank)
  const { data: myRankingRaw } = await supabase
    .from('rodeo_rankings')
    .select('song_id, rank')
    .eq('rodeo_id', params.id)
    .eq('voter_id', user.id)
    .order('rank', { ascending: true })

  const myRanking = (myRankingRaw ?? []).map((r) => r.song_id)

  // Fetch user's subscription tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

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
    myRanking,
    isSubscribed: profile?.subscription_tier !== 'free',
    isCreator,
    isWinningCircleBoard,
  })
}
