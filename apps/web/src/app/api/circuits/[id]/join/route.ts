import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/circuits/[id]/join — artist_manager registers their artist.
// When the final spot is filled the bracket is seeded automatically so
// no producer action is needed to get the circuit into 'active' state.

function getRoundName(totalRounds: number, roundNumber: number): string {
  const fromFinal = totalRounds - roundNumber
  if (fromFinal === 0) return 'Grand Final'
  if (fromFinal === 1) return 'Semifinals'
  if (fromFinal === 2) return 'Quarterfinals'
  return `Round of ${Math.pow(2, fromFinal + 1)}`
}

async function seedBracket(
  svc: ReturnType<typeof createServiceClient>,
  circuitId: string,
  maxArtists: number,
) {
  // Guard: only seed once (status must still be 'open')
  const { data: fresh } = await svc
    .from('circuits').select('status').eq('id', circuitId).single()
  if (fresh?.status !== 'open') return // already seeded by a concurrent request

  const { data: participants } = await svc
    .from('circuit_participants')
    .select('*').eq('circuit_id', circuitId).order('created_at')
  if (!participants || participants.length !== maxArtists) return

  const totalRounds = Math.log2(maxArtists)

  // Assign seeds 1..N in registration order
  await Promise.all(
    participants.map((p, i) =>
      svc.from('circuit_participants').update({ seed: i + 1 }).eq('id', p.id),
    ),
  )

  // Round-1 matchups: seed 1 vs N, seed 2 vs N-1, …
  const r1Duels = []
  for (let i = 0; i < maxArtists / 2; i++) {
    r1Duels.push({
      circuit_id: circuitId,
      round_number: 1,
      position: i + 1,
      participant_left_id:  participants[i].id,
      participant_right_id: participants[maxArtists - 1 - i].id,
      status: 'song_selection',
    })
  }
  await svc.from('circuit_duels').insert(r1Duels)

  // Stub duels for rounds 2..totalRounds
  const stubs = []
  for (let r = 2; r <= totalRounds; r++) {
    const duelsInRound = Math.pow(2, totalRounds - r)
    for (let pos = 1; pos <= duelsInRound; pos++) {
      stubs.push({ circuit_id: circuitId, round_number: r, position: pos, status: 'pending' })
    }
  }
  if (stubs.length > 0) await svc.from('circuit_duels').insert(stubs)

  await svc
    .from('circuits')
    .update({ status: 'active', current_round: 1 })
    .eq('id', circuitId)
    .eq('status', 'open') // atomic guard against double-seed
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'artist_manager')
    return NextResponse.json({ error: 'Only Artist Managers can join circuits' }, { status: 403 })

  let body: { artist_name: string; artist_image_url?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { artist_name, artist_image_url } = body
  if (!artist_name?.trim())
    return NextResponse.json({ error: 'artist_name is required' }, { status: 400 })

  const svc = createServiceClient()

  const { data: circuit } = await svc
    .from('circuits').select('status, max_artists').eq('id', params.id).single()
  if (!circuit) return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
  if (circuit.status !== 'open')
    return NextResponse.json({ error: 'Circuit is not open for registration' }, { status: 400 })

  // Check capacity
  const { count } = await svc
    .from('circuit_participants')
    .select('id', { count: 'exact', head: true })
    .eq('circuit_id', params.id)
  if ((count ?? 0) >= circuit.max_artists)
    return NextResponse.json({ error: 'Circuit is full' }, { status: 400 })

  const { data, error: insertErr } = await svc
    .from('circuit_participants')
    .insert({
      circuit_id: params.id,
      artist_manager_id: user.id,
      artist_name: artist_name.trim(),
      artist_image_url: artist_image_url?.trim() || null,
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Auto-seed when the final spot is now filled
  const newCount = (count ?? 0) + 1
  const bracketSeeded = newCount >= circuit.max_artists
  if (bracketSeeded) {
    await seedBracket(svc, params.id, circuit.max_artists)
  }

  return NextResponse.json({ participant: data, bracket_seeded: bracketSeeded }, { status: 201 })
}
