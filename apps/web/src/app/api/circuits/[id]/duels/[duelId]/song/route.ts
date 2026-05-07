import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/circuits/[id]/duels/[duelId]/song
// Artist manager picks the song their artist will perform in this duel.
// Each song can be used at most twice by a participant across the whole circuit.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; duelId: string } },
) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { song_id: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { song_id } = body
  if (!song_id) return NextResponse.json({ error: 'song_id is required' }, { status: 400 })

  const svc = createServiceClient()

  // Load duel and the user's participant in this circuit in parallel
  const [{ data: duel }, { data: myParticipant }] = await Promise.all([
    svc.from('circuit_duels').select('*').eq('id', params.duelId).eq('circuit_id', params.id).single(),
    svc.from('circuit_participants').select('*').eq('circuit_id', params.id).eq('artist_manager_id', user.id).maybeSingle(),
  ])

  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
  if (!myParticipant) return NextResponse.json({ error: 'You are not a participant in this circuit' }, { status: 403 })
  if (duel.status !== 'song_selection')
    return NextResponse.json({ error: 'Song selection is not open for this duel' }, { status: 400 })

  // Determine which side the user is on
  const isLeft  = duel.participant_left_id  === myParticipant.id
  const isRight = duel.participant_right_id === myParticipant.id
  if (!isLeft && !isRight)
    return NextResponse.json({ error: 'You are not competing in this duel' }, { status: 403 })

  // Verify the song exists
  const { data: song } = await svc.from('circle_songs').select('id, title, artist').eq('id', song_id).maybeSingle()
  if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })

  // Enforce max 2 uses per song per participant per circuit
  // Count duels in this circuit where this participant has already used this song
  const { data: usedLeft }  = await svc.from('circuit_duels')
    .select('id').eq('circuit_id', params.id).eq('participant_left_id', myParticipant.id).eq('song_left_id', song_id)
  const { data: usedRight } = await svc.from('circuit_duels')
    .select('id').eq('circuit_id', params.id).eq('participant_right_id', myParticipant.id).eq('song_right_id', song_id)

  const totalUses = (usedLeft?.length ?? 0) + (usedRight?.length ?? 0)
  if (totalUses >= 2)
    return NextResponse.json({ error: 'This song has already been used twice in this circuit' }, { status: 400 })

  const field = isLeft ? 'song_left_id' : 'song_right_id'
  const { data: updated, error: updateErr } = await svc
    .from('circuit_duels')
    .update({ [field]: song_id })
    .eq('id', params.duelId)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ duel: updated, song, uses_remaining: 2 - (totalUses + 1) })
}
