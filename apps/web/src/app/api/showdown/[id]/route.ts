import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/showdown/[id]   — showdown detail with tallies and caller's vote
// PATCH /api/showdown/[id] — superadmin: update status (close → compute winner)

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawShowdown, error } = await svc
    .from('song_showdowns')
    .select(`
      id, title, description, status, end_date, winner_song_id, created_at,
      song_left:circle_songs!song_left_id(id, title, artist, album, cover_url, avg_rating, rating_count),
      song_right:circle_songs!song_right_id(id, title, artist, album, cover_url, avg_rating, rating_count)
    `)
    .eq('id', params.id)
    .single()

  if (error || !rawShowdown) return NextResponse.json({ error: 'Showdown not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showdown = rawShowdown as any

  const songLeftId  = showdown.song_left?.id  as string | undefined
  const songRightId = showdown.song_right?.id as string | undefined
  const songIds = [songLeftId, songRightId].filter(Boolean) as string[]

  const [{ data: votes }, { data: myVote }, { data: myRatings }] = await Promise.all([
    svc.from('song_showdown_votes').select('chosen_song_id').eq('duel_id', params.id),
    svc.from('song_showdown_votes').select('chosen_song_id').eq('duel_id', params.id).eq('voter_id', user.id).maybeSingle(),
    songIds.length > 0
      ? svc.from('song_ratings').select('song_id, rating').eq('user_id', user.id).in('song_id', songIds)
      : Promise.resolve({ data: [] }),
  ])

  let left = 0, right = 0
  for (const v of votes ?? []) {
    if (v.chosen_song_id === showdown.song_left?.id) left++
    else right++
  }

  const myRatingMap: Record<string, number> = {}
  for (const r of myRatings ?? []) {
    myRatingMap[r.song_id] = r.rating
  }

  return NextResponse.json({
    showdown: {
      ...showdown,
      tally: { left, right, total: left + right },
      my_vote: myVote?.chosen_song_id ?? null,
      my_ratings: myRatingMap,
      is_expired: new Date(showdown.end_date).getTime() < Date.now(),
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { status?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const svc = createServiceClient()

  let winner_song_id: string | null = null
  if (body.status === 'closed') {
    const { data: showdownRow } = await svc
      .from('song_showdowns')
      .select('song_left_id, song_right_id')
      .eq('id', params.id)
      .single()

    if (showdownRow) {
      const { data: votes } = await svc
        .from('song_showdown_votes')
        .select('chosen_song_id')
        .eq('duel_id', params.id)

      let left = 0, right = 0
      for (const v of votes ?? []) {
        if (v.chosen_song_id === showdownRow.song_left_id) left++
        else right++
      }
      winner_song_id = left >= right ? showdownRow.song_left_id : showdownRow.song_right_id
    }
  }

  const updatePayload: Record<string, unknown> = {}
  if (body.status) updatePayload.status = body.status
  if (winner_song_id) updatePayload.winner_song_id = winner_song_id

  const { data: updated, error } = await svc
    .from('song_showdowns')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ showdown: updated })
}
