import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/showdown
// Returns active + closed showdowns enriched with vote tallies and the
// caller's own vote. Query ?unvoted=true returns only the count of
// active showdowns the caller hasn't voted on (used for the nav badge).
//
// POST /api/showdown — stampede_producer or superadmin only
// Body: { title, description?, song_left_id, song_right_id, end_date, status }

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const unvotedOnly = request.nextUrl.searchParams.get('unvoted') === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawShowdowns, error: showdownsErr } = await svc
    .from('song_showdowns')
    .select(`
      id, title, description, status, end_date, winner_song_id, created_at,
      song_left:circle_songs!song_left_id(id, title, artist, album, cover_url),
      song_right:circle_songs!song_right_id(id, title, artist, album, cover_url)
    `)
    .in('status', ['active', 'closed'])
    .order('created_at', { ascending: false })

  if (showdownsErr) return NextResponse.json({ error: showdownsErr.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showdownList = (rawShowdowns ?? []) as any[]

  const showdownIds = showdownList.map((d) => d.id)
  const { data: myVotes } = showdownIds.length > 0
    ? await svc
        .from('song_showdown_votes')
        .select('duel_id, chosen_song_id')
        .eq('voter_id', user.id)
        .in('duel_id', showdownIds)
    : { data: [] }

  const myVoteMap = new Map((myVotes ?? []).map((v) => [v.duel_id, v.chosen_song_id]))

  if (unvotedOnly) {
    const unvotedCount = showdownList.filter(
      (d) => d.status === 'active' &&
             new Date(d.end_date).getTime() > Date.now() &&
             !myVoteMap.has(d.id)
    ).length
    return NextResponse.json({ unvoted_count: unvotedCount })
  }

  const { data: allVotes } = showdownIds.length > 0
    ? await svc
        .from('song_showdown_votes')
        .select('duel_id, chosen_song_id')
        .in('duel_id', showdownIds)
    : { data: [] }

  type Tally = { left: number; right: number; total: number }
  const tallyMap = new Map<string, Tally>()
  for (const v of allVotes ?? []) {
    const showdown = showdownList.find((d) => d.id === v.duel_id)
    if (!showdown) continue
    const t = tallyMap.get(v.duel_id) ?? { left: 0, right: 0, total: 0 }
    if (v.chosen_song_id === showdown.song_left?.id) t.left++
    else t.right++
    t.total++
    tallyMap.set(v.duel_id, t)
  }

  const enriched = showdownList.map((d) => ({
    ...d,
    tally: tallyMap.get(d.id) ?? { left: 0, right: 0, total: 0 },
    my_vote: myVoteMap.get(d.id) ?? null,
    is_expired: new Date(d.end_date).getTime() < Date.now(),
  }))

  return NextResponse.json({ showdowns: enriched })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'stampede_producer' && !profile.is_super_admin)) {
    return NextResponse.json({ error: 'Only Stampede Producers can create showdowns' }, { status: 403 })
  }

  let body: {
    title: string
    description?: string
    song_left_id: string
    song_right_id: string
    end_date: string
    status?: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, description, song_left_id, song_right_id, end_date, status = 'draft' } = body

  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!song_left_id || !song_right_id)
    return NextResponse.json({ error: 'Both song IDs are required' }, { status: 400 })
  if (song_left_id === song_right_id)
    return NextResponse.json({ error: 'Songs must differ' }, { status: 400 })
  if (!end_date || new Date(end_date).getTime() <= Date.now())
    return NextResponse.json({ error: 'end_date must be in the future' }, { status: 400 })
  if (!['draft', 'active'].includes(status))
    return NextResponse.json({ error: 'status must be draft or active' }, { status: 400 })

  const svc = createServiceClient()
  const { data: showdown, error } = await svc
    .from('song_showdowns')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      song_left_id,
      song_right_id,
      end_date,
      status,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ showdown }, { status: 201 })
}
