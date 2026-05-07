import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/showdown/[id]/vote
// Body: { chosen_song_id: string }
// One vote per user per showdown; showdown must be active and not expired.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { chosen_song_id: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.chosen_song_id !== 'string' || !body.chosen_song_id) {
    return NextResponse.json({ error: 'chosen_song_id is required' }, { status: 400 })
  }
  const chosen_song_id = body.chosen_song_id

  const svc = createServiceClient()

  const { data: showdown } = await svc
    .from('song_showdowns')
    .select('status, end_date, song_left_id, song_right_id')
    .eq('id', params.id)
    .single()

  if (!showdown) return NextResponse.json({ error: 'Showdown not found' }, { status: 404 })
  if (showdown.status !== 'active')
    return NextResponse.json({ error: 'Showdown is not open for voting' }, { status: 400 })
  if (new Date(showdown.end_date).getTime() < Date.now())
    return NextResponse.json({ error: 'Voting deadline has passed' }, { status: 400 })
  if (chosen_song_id !== showdown.song_left_id && chosen_song_id !== showdown.song_right_id)
    return NextResponse.json({ error: 'Chosen song is not in this showdown' }, { status: 400 })

  const { error: voteErr } = await svc
    .from('song_showdown_votes')
    .upsert(
      { duel_id: params.id, voter_id: user.id, chosen_song_id, voted_at: new Date().toISOString() },
      { onConflict: 'duel_id,voter_id' }
    )

  if (voteErr) return NextResponse.json({ error: voteErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, chosen_song_id })
}
