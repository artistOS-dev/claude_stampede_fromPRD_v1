import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/circuits/[id]/duels/[duelId]/song
// Artist manager picks the song their artist will perform in this duel.
// stampede_producer (or super_admin) can pick a song for any side by passing side: 'left' | 'right'.
// Each song can be used at most twice by a participant across the whole circuit (manager-only limit).

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; duelId: string } },
) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { song_id: string; side?: 'left' | 'right' }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { song_id, side: bodySide } = body
  if (!song_id) return NextResponse.json({ error: 'song_id is required' }, { status: 400 })

  const svc = createServiceClient()

  // Check role — producers can pick for any participant, managers only for their own
  const { data: profile } = await supabase
    .from('profiles').select('role, is_super_admin').eq('id', user.id).maybeSingle()
  const isProducer = profile?.role === 'stampede_producer' || profile?.is_super_admin === true

  const { data: duel } = await svc
    .from('circuit_duels').select('*').eq('id', params.duelId).eq('circuit_id', params.id).single()
  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
  if (duel.status !== 'song_selection')
    return NextResponse.json({ error: 'Song selection is not open for this duel' }, { status: 400 })

  let isLeft: boolean
  let isRight: boolean
  let targetParticipantId: string | null = null

  if (isProducer) {
    if (bodySide !== 'left' && bodySide !== 'right')
      return NextResponse.json({ error: 'side ("left" or "right") is required for producers' }, { status: 400 })
    isLeft  = bodySide === 'left'
    isRight = bodySide === 'right'
    targetParticipantId = isLeft ? duel.participant_left_id : duel.participant_right_id
  } else {
    // Artist manager: must be a registered participant in this circuit
    const { data: myParticipants } = await svc
      .from('circuit_participants')
      .select('*').eq('circuit_id', params.id).eq('artist_manager_id', user.id)
    if (!myParticipants || myParticipants.length === 0)
      return NextResponse.json({ error: 'You are not a participant in this circuit' }, { status: 403 })

    // Find which participant is in this duel
    const mine = myParticipants.find(
      (p) => p.id === duel.participant_left_id || p.id === duel.participant_right_id
    )
    if (!mine)
      return NextResponse.json({ error: 'You are not competing in this duel' }, { status: 403 })

    isLeft  = duel.participant_left_id  === mine.id
    isRight = duel.participant_right_id === mine.id
    targetParticipantId = mine.id
  }

  // Verify the song exists in circle_songs (the FK table for circuit duels)
  const { data: song } = await svc.from('circle_songs').select('id, title, artist').eq('id', song_id).maybeSingle()
  if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })

  // Enforce max 2 uses per song per participant per circuit (artist managers only)
  if (!isProducer && targetParticipantId) {
    const [{ data: usedLeft }, { data: usedRight }] = await Promise.all([
      svc.from('circuit_duels').select('id')
        .eq('circuit_id', params.id).eq('participant_left_id', targetParticipantId).eq('song_left_id', song_id),
      svc.from('circuit_duels').select('id')
        .eq('circuit_id', params.id).eq('participant_right_id', targetParticipantId).eq('song_right_id', song_id),
    ])
    const totalUses = (usedLeft?.length ?? 0) + (usedRight?.length ?? 0)
    if (totalUses >= 2)
      return NextResponse.json({ error: 'This song has already been used twice in this circuit' }, { status: 400 })
  }

  const field = isLeft ? 'song_left_id' : 'song_right_id'
  const { data: updated, error: updateErr } = await svc
    .from('circuit_duels')
    .update({ [field]: song_id })
    .eq('id', params.duelId)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ duel: updated, song })
}
