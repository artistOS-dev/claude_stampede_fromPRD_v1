import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/rodeos/[id]/rank
// Body: { song_ids: string[] } — ordered list, index 0 = rank 1 (highest).
// Atomically replaces the caller's entire ranking for this rodeo.
// Voters may resubmit as many times as they like while voting is open.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { song_ids: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.song_ids)) {
    return NextResponse.json({ error: 'song_ids must be an array' }, { status: 400 })
  }
  const songIds = body.song_ids as string[]

  // Rodeo must be open for voting
  const { data: rodeo } = await supabase
    .from('rodeos')
    .select('status')
    .eq('id', params.id)
    .single()

  if (!rodeo || rodeo.status !== 'voting') {
    return NextResponse.json({ error: 'Voting is not open for this rodeo' }, { status: 400 })
  }

  // Subscription required
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (!profile || profile.subscription_tier === 'free') {
    return NextResponse.json(
      { error: 'A paid subscription is required to rank in rodeos' },
      { status: 403 }
    )
  }

  // Validate all song_ids belong to this rodeo
  if (songIds.length > 0) {
    const { data: rodeoEntries } = await supabase
      .from('rodeo_entries')
      .select('id')
      .eq('rodeo_id', params.id)

    const entryIds = (rodeoEntries ?? []).map((e) => e.id)

    const { data: validSongs } = entryIds.length > 0
      ? await supabase
          .from('rodeo_entry_songs')
          .select('song_id')
          .in('entry_id', entryIds)
      : { data: [] }

    const validSet = new Set((validSongs ?? []).map((s) => s.song_id))
    const invalid = songIds.filter((id) => !validSet.has(id))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: 'Some songs do not belong to this rodeo' },
        { status: 400 }
      )
    }
  }

  // Delete existing ranking for this voter+rodeo, then insert fresh rows
  const { error: deleteErr } = await supabase
    .from('rodeo_rankings')
    .delete()
    .eq('rodeo_id', params.id)
    .eq('voter_id', user.id)

  if (deleteErr) {
    console.error('rank delete error:', deleteErr)
    return NextResponse.json({ error: 'Failed to clear previous ranking' }, { status: 500 })
  }

  if (songIds.length > 0) {
    const rows = songIds.map((song_id, i) => ({
      rodeo_id: params.id,
      voter_id: user.id,
      song_id,
      rank: i + 1,
      submitted_at: new Date().toISOString(),
    }))

    const { error: insertErr } = await supabase
      .from('rodeo_rankings')
      .insert(rows)

    if (insertErr) {
      console.error('rank insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to submit ranking' }, { status: 500 })
    }
  }

  return NextResponse.json({ ranked: songIds.length })
}
