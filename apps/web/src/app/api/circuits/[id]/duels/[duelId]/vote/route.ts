import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/circuits/[id]/duels/[duelId]/vote
// Any authenticated member can vote; can change vote while duel is open.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; duelId: string } },
) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { chosen_participant_id: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { chosen_participant_id } = body
  if (!chosen_participant_id)
    return NextResponse.json({ error: 'chosen_participant_id is required' }, { status: 400 })

  const svc = createServiceClient()

  const { data: duel } = await svc
    .from('circuit_duels').select('*').eq('id', params.duelId).eq('circuit_id', params.id).single()
  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
  if (duel.status !== 'voting')
    return NextResponse.json({ error: 'Voting is not open for this duel' }, { status: 400 })
  if (duel.voting_ends_at && new Date(duel.voting_ends_at).getTime() < Date.now())
    return NextResponse.json({ error: 'Voting has ended for this duel' }, { status: 400 })

  if (chosen_participant_id !== duel.participant_left_id && chosen_participant_id !== duel.participant_right_id)
    return NextResponse.json({ error: 'Invalid participant choice' }, { status: 400 })

  // Upsert vote (allows changing vote)
  const { error: upsertErr } = await svc
    .from('circuit_duel_votes')
    .upsert(
      { circuit_duel_id: params.duelId, voter_id: user.id, chosen_participant_id },
      { onConflict: 'circuit_duel_id,voter_id' },
    )

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, voted_for: chosen_participant_id })
}
