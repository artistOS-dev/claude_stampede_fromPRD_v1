import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/circles/[id]/rodeo-history
// Returns:
//  - circle metadata + overall record (wins/losses/credits)
//  - per-rodeo history entries (opponent, songs, vote breakdown, credits)
//  - per-artist record derived from songs fielded across rodeos

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const circleId = params.id
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. Circle metadata ──────────────────────────────────────
  const { data: circle } = await supabase
    .from('circles')
    .select('id, name, member_count, description')
    .eq('id', circleId)
    .single()

  // ── 2. All rodeo entries for this circle ────────────────────
  const { data: myEntries, error: entriesErr } = await supabase
    .from('rodeo_entries')
    .select(`
      id, credits_contributed, status, created_at,
      rodeos(
        id, title, type, status, end_date, archived_at, created_at,
        rodeo_entries(
          id, circle_id, credits_contributed, status,
          circles(id, name)
        )
      ),
      rodeo_entry_songs(
        song_id, label,
        circle_songs(id, title, artist)
      )
    `)
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })

  if (entriesErr) {
    console.error('rodeo-history entries error:', entriesErr)
    return NextResponse.json({ error: entriesErr.message }, { status: 500 })
  }

  // Filter to closed/archived rodeos only
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closedEntries = ((myEntries ?? []) as any[]).filter((e) =>
    ['closed', 'archived'].includes(e.rodeos?.status ?? '')
  )

  // ── 3. Rodeo results for those rodeos ───────────────────────
  const rodeoIds = closedEntries.map((e) => e.rodeos?.id).filter(Boolean) as string[]

  const resultsMap = new Map<string, {
    winner_circle_id: string | null
    winner_artist_id: string | null
    circle_member_votes: number
    general_public_votes: number
    finalized_at: string | null
    song_results: Array<{ song_id: string; entry_id: string; total_votes: number; weighted_score: number; circle_member_votes: number; general_public_votes: number }>
    distributions: Array<{ recipient_type: string; amount: number }>
  }>()

  if (rodeoIds.length > 0) {
    const { data: results } = await supabase
      .from('rodeo_results')
      .select(`
        rodeo_id,
        winner_circle_id, winner_artist_id,
        circle_member_votes, general_public_votes, finalized_at,
        rodeo_song_results(song_id, entry_id, total_votes, weighted_score, circle_member_votes, general_public_votes),
        rodeo_credit_distributions(recipient_type, amount)
      `)
      .in('rodeo_id', rodeoIds)

    for (const r of (results ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = r as any
      resultsMap.set(row.rodeo_id, {
        winner_circle_id: row.winner_circle_id,
        winner_artist_id: row.winner_artist_id,
        circle_member_votes: row.circle_member_votes ?? 0,
        general_public_votes: row.general_public_votes ?? 0,
        finalized_at: row.finalized_at,
        song_results: row.rodeo_song_results ?? [],
        distributions: row.rodeo_credit_distributions ?? [],
      })
    }
  }

  // ── 4. Circle artists roster ────────────────────────────────
  const { data: circleArtistsRaw } = await supabase
    .from('circle_artists')
    .select('id, artist_name')
    .eq('circle_id', circleId)

  const circleArtistNames = new Set(
    (circleArtistsRaw ?? []).map((a) => (a.artist_name as string).toLowerCase())
  )

  // ── 5. Build per-rodeo history ──────────────────────────────

  interface SongEntry {
    song_id: string
    title: string
    artist: string
    label: 'studio' | 'live' | null
    total_votes: number
    weighted_score: number
    circle_member_votes: number
    general_public_votes: number
  }

  interface RodeoHistoryEntry {
    rodeo_id: string
    title: string
    type: string
    date: string | null
    archived: boolean
    opponent: { id: string; name: string } | null
    result: 'win' | 'loss' | 'draw' | 'pending'
    songs: SongEntry[]
    votes: { circle_member: number; general_public: number }
    credits_contributed: number
    credits_won: number
    credits_net: number
    finalized_at: string | null
  }

  const rodeoHistory: RodeoHistoryEntry[] = []

  // Artist stats accumulator
  const artistStats = new Map<string, {
    rodeos: number
    wins: number
    losses: number
    songs_fielded: number
    total_weighted_score: number
    credits_earned: number
  }>()

  for (const entry of closedEntries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rodeo = entry.rodeos as any
    if (!rodeo) continue

    const result = resultsMap.get(rodeo.id)
    const didWin = result?.winner_circle_id === circleId
    const noWinner = !result?.winner_circle_id && !result?.winner_artist_id
    const outcome: 'win' | 'loss' | 'draw' | 'pending' = !result
      ? 'pending'
      : noWinner
      ? 'draw'
      : didWin
      ? 'win'
      : 'loss'

    // Opponent: the other entry in this rodeo that isn't this circle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opponentEntry = (rodeo.rodeo_entries ?? []).find((e: any) => e.circle_id !== circleId)
    const opponent = opponentEntry?.circles
      ? { id: opponentEntry.circles.id, name: opponentEntry.circles.name }
      : null

    // Songs this circle fielded
    const songScoreMap = new Map(
      (result?.song_results ?? []).map((sr) => [sr.song_id, sr])
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const songs: SongEntry[] = (entry.rodeo_entry_songs ?? []).map((es: any) => {
      const sr = songScoreMap.get(es.song_id)
      return {
        song_id: es.song_id,
        title: es.circle_songs?.title ?? 'Untitled',
        artist: es.circle_songs?.artist ?? 'Unknown',
        label: es.label ?? null,
        total_votes: sr?.total_votes ?? 0,
        weighted_score: sr?.weighted_score ?? 0,
        circle_member_votes: sr?.circle_member_votes ?? 0,
        general_public_votes: sr?.general_public_votes ?? 0,
      }
    })

    // Credits won: if winner, sum non-platform distributions; else 0
    const creditsWon = didWin
      ? (result?.distributions ?? [])
          .filter((d) => d.recipient_type !== 'platform')
          .reduce((sum, d) => sum + (d.amount ?? 0), 0)
      : 0
    const creditsContributed = entry.credits_contributed ?? 0
    const creditsNet = didWin
      ? creditsWon - creditsContributed
      : -creditsContributed

    rodeoHistory.push({
      rodeo_id: rodeo.id,
      title: rodeo.title,
      type: rodeo.type,
      date: rodeo.end_date ?? rodeo.archived_at ?? rodeo.created_at,
      archived: rodeo.status === 'archived',
      opponent,
      result: outcome,
      songs,
      votes: {
        circle_member: result?.circle_member_votes ?? 0,
        general_public: result?.general_public_votes ?? 0,
      },
      credits_contributed: creditsContributed,
      credits_won: Math.round(creditsWon),
      credits_net: Math.round(creditsNet),
      finalized_at: result?.finalized_at ?? null,
    })

    // Accumulate artist stats for songs fielded
    for (const song of songs) {
      const key = song.artist.toLowerCase()
      const current = artistStats.get(key) ?? {
        rodeos: 0, wins: 0, losses: 0, songs_fielded: 0,
        total_weighted_score: 0, credits_earned: 0,
      }
      current.songs_fielded++
      current.total_weighted_score += song.weighted_score
      // Count unique rodeos per artist (track by rodeo_id)
      // We'll re-count properly below using a Set per artist
      if (outcome === 'win') { current.wins++ }
      else if (outcome === 'loss') { current.losses++ }
      if (outcome === 'win') { current.credits_earned += Math.round(creditsWon / Math.max(songs.length, 1)) }
      artistStats.set(key, current)
    }
  }

  // Deduplicate artist rodeo counts (a circle can field multiple songs per rodeo)
  // Re-pass: count distinct rodeos per artist
  const artistRodeoSet = new Map<string, Set<string>>()
  for (const entry of closedEntries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rodeo = entry.rodeos as any
    if (!rodeo) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const es of (entry.rodeo_entry_songs ?? []) as any[]) {
      const artist = (es.circle_songs?.artist ?? 'Unknown').toLowerCase()
      if (!artistRodeoSet.has(artist)) artistRodeoSet.set(artist, new Set())
      artistRodeoSet.get(artist)!.add(rodeo.id)
    }
  }
  for (const [artist, rodeoSet] of Array.from(artistRodeoSet.entries())) {
    const stats = artistStats.get(artist)
    if (stats) stats.rodeos = rodeoSet.size
  }

  // Build artist records — prioritise circle artist roster, then any artist that
  // appeared in a rodeo song even if not in the roster list
  const artistRecords = Array.from(artistStats.entries())
    .map(([artistLower, stats]) => ({
      artist_name: artistLower,   // will be overwritten with proper casing below
      is_core_artist: circleArtistNames.has(artistLower),
      rodeos: stats.rodeos,
      wins: stats.wins,
      losses: stats.losses,
      songs_fielded: stats.songs_fielded,
      avg_score: stats.songs_fielded > 0
        ? Math.round((stats.total_weighted_score / stats.songs_fielded) * 10) / 10
        : 0,
      credits_earned: stats.credits_earned,
    }))
    .sort((a, b) => b.wins - a.wins || b.rodeos - a.rodeos)

  // Restore proper artist name casing from the actual song data
  for (const entry of closedEntries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const es of (entry.rodeo_entry_songs ?? []) as any[]) {
      const artistOrig: string = es.circle_songs?.artist ?? 'Unknown'
      const rec = artistRecords.find((r) => r.artist_name === artistOrig.toLowerCase())
      if (rec && rec.artist_name === artistOrig.toLowerCase()) {
        rec.artist_name = artistOrig
      }
    }
  }

  // ── 6. Overall circle record ────────────────────────────────
  const wins   = rodeoHistory.filter((r) => r.result === 'win').length
  const losses = rodeoHistory.filter((r) => r.result === 'loss').length
  const draws  = rodeoHistory.filter((r) => r.result === 'draw').length
  const total  = rodeoHistory.length
  const creditsEarned = rodeoHistory.reduce((s, r) => s + (r.credits_won), 0)
  const creditsLost   = rodeoHistory.reduce((s, r) => s + r.credits_contributed, 0)

  return NextResponse.json({
    circle: circle ?? { id: circleId, name: 'Circle', member_count: 0 },
    record: {
      total,
      wins,
      losses,
      draws,
      win_pct: total > 0 ? Math.round((wins / total) * 100) : 0,
      credits_earned: Math.round(creditsEarned),
      credits_contributed: Math.round(creditsLost),
      credits_net: Math.round(creditsEarned - creditsLost),
    },
    rodeos: rodeoHistory,
    artist_records: artistRecords,
  })
}
