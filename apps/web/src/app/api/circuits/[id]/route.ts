import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/circuits/[id]   — full bracket detail
// PATCH /api/circuits/[id] — admin actions: open | seed | start_voting | close_round

function getRoundName(totalRounds: number, roundNumber: number): string {
  const fromFinal = totalRounds - roundNumber
  if (fromFinal === 0) return 'Grand Final'
  if (fromFinal === 1) return 'Semifinals'
  if (fromFinal === 2) return 'Quarterfinals'
  return `Round of ${Math.pow(2, fromFinal + 1)}`
}

// Build all round stub duels for rounds 2..totalRounds
async function createFutureRoundStubs(
  svc: ReturnType<typeof createServiceClient>,
  circuitId: string,
  totalRounds: number,
) {
  const stubs = []
  for (let r = 2; r <= totalRounds; r++) {
    const duelsInRound = Math.pow(2, totalRounds - r)
    for (let pos = 1; pos <= duelsInRound; pos++) {
      stubs.push({ circuit_id: circuitId, round_number: r, position: pos, status: 'pending' })
    }
  }
  if (stubs.length > 0) {
    await svc.from('circuit_duels').insert(stubs)
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const [{ data: circuit, error: circuitErr }, { data: participants }, { data: rawDuels }] =
    await Promise.all([
      svc.from('circuits').select('*').eq('id', params.id).single(),
      svc.from('circuit_participants').select('*').eq('circuit_id', params.id).order('seed').order('created_at'),
      svc.from('circuit_duels').select(`
        id, round_number, position, status,
        winner_participant_id, voting_starts_at, voting_ends_at,
        participant_left_id, participant_right_id,
        song_left:circle_songs!song_left_id(id, title, artist, cover_url),
        song_right:circle_songs!song_right_id(id, title, artist, cover_url)
      `).eq('circuit_id', params.id).order('round_number').order('position'),
    ])

  if (circuitErr || !circuit) return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })

  const duelIds = (rawDuels ?? []).map((d) => d.id)

  // vote tallies + user's votes in parallel
  const [{ data: allVotes }, { data: myVotes }, { data: profile }] = await Promise.all([
    duelIds.length > 0
      ? svc.from('circuit_duel_votes').select('circuit_duel_id, chosen_participant_id').in('circuit_duel_id', duelIds)
      : Promise.resolve({ data: [] }),
    duelIds.length > 0
      ? svc.from('circuit_duel_votes').select('circuit_duel_id, chosen_participant_id').eq('voter_id', user.id).in('circuit_duel_id', duelIds)
      : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('role, is_super_admin').eq('id', user.id).maybeSingle(),
  ])

  // tally map: duelId → { left: n, right: n }
  const tallyMap: Record<string, { left: number; right: number }> = {}
  for (const v of allVotes ?? []) {
    if (!tallyMap[v.circuit_duel_id]) tallyMap[v.circuit_duel_id] = { left: 0, right: 0 }
    const duel = (rawDuels ?? []).find((d) => d.id === v.circuit_duel_id)
    if (!duel) continue
    if (v.chosen_participant_id === duel.participant_left_id) tallyMap[v.circuit_duel_id].left++
    else tallyMap[v.circuit_duel_id].right++
  }

  const myVoteMap: Record<string, string> = {}
  for (const v of myVotes ?? []) myVoteMap[v.circuit_duel_id] = v.chosen_participant_id

  // participant lookup map
  const pMap: Record<string, typeof participants extends (infer T)[] | null ? T : never> = {}
  for (const p of participants ?? []) pMap[p.id] = p

  const totalRounds = Math.log2(circuit.max_artists)

  // Enrich duels with participant objects and tallies
  const enrichedDuels = (rawDuels ?? []).map((d) => ({
    ...d,
    participant_left:  d.participant_left_id  ? (pMap[d.participant_left_id]  ?? null) : null,
    participant_right: d.participant_right_id ? (pMap[d.participant_right_id] ?? null) : null,
    tally: tallyMap[d.id] ?? { left: 0, right: 0 },
    my_vote: myVoteMap[d.id] ?? null,
    is_expired: d.voting_ends_at ? new Date(d.voting_ends_at).getTime() < Date.now() : false,
  }))

  // Group by round
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).map((rn) => ({
    round_number: rn,
    round_name: getRoundName(totalRounds, rn),
    duels: enrichedDuels.filter((d) => d.round_number === rn),
  }))

  // My participants (all of manager's artists in this circuit)
  const myParticipants = (participants ?? []).filter((p) => p.artist_manager_id === user.id)

  return NextResponse.json({
    circuit: {
      ...circuit,
      total_rounds: totalRounds,
      participants: participants ?? [],
      rounds,
      my_participant: myParticipants[0] ?? null, // kept for backwards compat
      my_participants: myParticipants,
      my_votes: myVoteMap,
      is_admin: profile?.role === 'stampede_producer' || profile?.is_super_admin === true,
      is_artist_manager: profile?.role === 'artist_manager',
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, is_super_admin').eq('id', user.id).maybeSingle()
  if (!profile || (profile.role !== 'stampede_producer' && !profile.is_super_admin))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { action: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: circuit } = await svc.from('circuits').select('*').eq('id', params.id).single()
  if (!circuit) return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })

  // ── open ─────────────────────────────────────────────────────
  if (body.action === 'open') {
    if (circuit.status !== 'draft')
      return NextResponse.json({ error: 'Circuit must be in draft to open' }, { status: 400 })
    const { data, error: e } = await svc
      .from('circuits').update({ status: 'open' }).eq('id', params.id).select().single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json({ circuit: data })
  }

  // ── seed ─────────────────────────────────────────────────────
  if (body.action === 'seed') {
    if (circuit.status !== 'open')
      return NextResponse.json({ error: 'Circuit must be open to seed' }, { status: 400 })

    const { data: participants } = await svc
      .from('circuit_participants').select('*').eq('circuit_id', params.id).order('created_at')
    if (!participants || participants.length !== circuit.max_artists)
      return NextResponse.json({
        error: `Need exactly ${circuit.max_artists} participants (have ${participants?.length ?? 0})`,
      }, { status: 400 })

    const totalRounds = Math.log2(circuit.max_artists)

    // Assign seeds 1..N in registration order
    await Promise.all(
      participants.map((p, i) =>
        svc.from('circuit_participants').update({ seed: i + 1 }).eq('id', p.id),
      ),
    )

    // Build round-1 matchups: seed 1 vs seed N, seed 2 vs seed N-1, ...
    const sorted = participants
    const r1Duels = []
    for (let i = 0; i < participants.length / 2; i++) {
      r1Duels.push({
        circuit_id: params.id,
        round_number: 1,
        position: i + 1,
        participant_left_id: sorted[i].id,
        participant_right_id: sorted[participants.length - 1 - i].id,
        status: 'song_selection',
      })
    }
    await svc.from('circuit_duels').insert(r1Duels)

    // Stub duels for future rounds
    await createFutureRoundStubs(svc, params.id, totalRounds)

    const { data, error: e } = await svc
      .from('circuits').update({ status: 'active', current_round: 1 }).eq('id', params.id).select().single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json({ circuit: data })
  }

  // ── start_voting ─────────────────────────────────────────────
  if (body.action === 'start_voting') {
    const currentRound = circuit.current_round
    const { data: duels } = await svc
      .from('circuit_duels').select('*').eq('circuit_id', params.id).eq('round_number', currentRound)
    if (!duels || duels.length === 0)
      return NextResponse.json({ error: 'No duels found for current round' }, { status: 400 })

    const missingSongs = duels.filter((d) => !d.song_left_id || !d.song_right_id)
    if (missingSongs.length > 0)
      return NextResponse.json({ error: `${missingSongs.length} duel(s) still need songs selected` }, { status: 400 })

    const now = new Date()
    const endsAt = new Date(now.getTime() + circuit.voting_hours_per_round * 3_600_000)

    await svc
      .from('circuit_duels')
      .update({ status: 'voting', voting_starts_at: now.toISOString(), voting_ends_at: endsAt.toISOString() })
      .eq('circuit_id', params.id)
      .eq('round_number', currentRound)

    return NextResponse.json({ ok: true, voting_ends_at: endsAt.toISOString() })
  }

  // ── close_round ──────────────────────────────────────────────
  if (body.action === 'close_round') {
    const currentRound = circuit.current_round
    const totalRounds = Math.log2(circuit.max_artists)

    const { data: duels } = await svc
      .from('circuit_duels').select('*').eq('circuit_id', params.id).eq('round_number', currentRound)
    if (!duels || duels.length === 0)
      return NextResponse.json({ error: 'No duels found for current round' }, { status: 400 })

    // Compute winner for each duel via vote tally
    const duelIds = duels.map((d) => d.id)
    const { data: votes } = await svc
      .from('circuit_duel_votes').select('circuit_duel_id, chosen_participant_id').in('circuit_duel_id', duelIds)

    const tallyMap: Record<string, { left: number; right: number }> = {}
    for (const v of votes ?? []) {
      const duel = duels.find((d) => d.id === v.circuit_duel_id)
      if (!duel) continue
      if (!tallyMap[v.circuit_duel_id]) tallyMap[v.circuit_duel_id] = { left: 0, right: 0 }
      if (v.chosen_participant_id === duel.participant_left_id) tallyMap[v.circuit_duel_id].left++
      else tallyMap[v.circuit_duel_id].right++
    }

    const winners: string[] = []
    const losers: string[] = []

    for (const duel of duels) {
      const t = tallyMap[duel.id] ?? { left: 0, right: 0 }
      const winnerId = t.left >= t.right ? duel.participant_left_id : duel.participant_right_id
      const loserId  = winnerId === duel.participant_left_id ? duel.participant_right_id : duel.participant_left_id
      winners.push(winnerId)
      if (loserId) losers.push(loserId)
      await svc.from('circuit_duels').update({ status: 'complete', winner_participant_id: winnerId }).eq('id', duel.id)
    }

    // Mark losers as eliminated
    if (losers.length > 0)
      await svc.from('circuit_participants').update({ status: 'eliminated' }).in('id', losers)

    const isFinal = currentRound === totalRounds

    if (isFinal) {
      // Circuit complete
      const champion = winners[0]
      await svc.from('circuit_participants').update({ status: 'champion' }).eq('id', champion)
      const { data } = await svc
        .from('circuits')
        .update({ status: 'complete', winner_participant_id: champion })
        .eq('id', params.id).select().single()
      return NextResponse.json({ circuit: data, champion_id: champion })
    }

    // Advance winners to next round stubs
    const nextRound = currentRound + 1
    for (let i = 0; i < duels.length; i++) {
      const duel = duels[i]
      const winner = winners[i]
      const nextPos = Math.ceil(duel.position / 2)
      const isLeft  = duel.position % 2 === 1
      const field   = isLeft ? 'participant_left_id' : 'participant_right_id'
      await svc
        .from('circuit_duels')
        .update({ [field]: winner, status: 'song_selection' })
        .eq('circuit_id', params.id)
        .eq('round_number', nextRound)
        .eq('position', nextPos)
    }

    // Check if both sides of all next-round duels are filled; if only one side, keep song_selection
    const { data } = await svc
      .from('circuits').update({ current_round: nextRound }).eq('id', params.id).select().single()
    return NextResponse.json({ circuit: data })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
