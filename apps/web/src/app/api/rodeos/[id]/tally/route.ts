import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/rodeos/[id]/tally
// Returns per-song and per-entry Borda scores computed from rodeo_rankings.
// Borda count for subsets: a voter ranking K songs gives (K − rank + 1) points
// to the song at position rank. Unranked songs receive 0 from that voter.
// Polled by the ranking screen every ~12 s for live feel.

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // All ranking rows for this rodeo
  const { data: rankings, error: rankErr } = await supabase
    .from('rodeo_rankings')
    .select('voter_id, song_id, rank')
    .eq('rodeo_id', params.id)

  if (rankErr) {
    console.error('tally rankings error:', rankErr)
    return NextResponse.json({ error: rankErr.message }, { status: 500 })
  }

  // Entries with their songs
  const { data: entries, error: entriesErr } = await supabase
    .from('rodeo_entries')
    .select(`
      id, circle_id, artist_id, credits_contributed,
      circles(id, name),
      rodeo_entry_songs(
        id, song_id, label, locked,
        circle_songs(id, title, artist)
      )
    `)
    .eq('rodeo_id', params.id)
    .neq('status', 'withdrawn')

  if (entriesErr) {
    console.error('tally entries error:', entriesErr)
    return NextResponse.json({ error: entriesErr.message }, { status: 500 })
  }

  // Current user's ranking (ordered by rank ascending)
  const { data: myRankingRaw } = await supabase
    .from('rodeo_rankings')
    .select('song_id, rank')
    .eq('rodeo_id', params.id)
    .eq('voter_id', user.id)
    .order('rank', { ascending: true })

  // Subscription check
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  // ── Borda scoring ──────────────────────────────────────────────

  const allRankings = rankings ?? []

  // Group by voter to know each ballot's size K
  const byVoter = new Map<string, Array<{ song_id: string; rank: number }>>()
  for (const r of allRankings) {
    const list = byVoter.get(r.voter_id) ?? []
    list.push({ song_id: r.song_id, rank: r.rank })
    byVoter.set(r.voter_id, list)
  }

  // Accumulate Borda points per song
  const songBorda = new Map<string, { score: number; ranker_count: number }>()
  for (const [, voterRanks] of Array.from(byVoter.entries())) {
    const K = voterRanks.length
    for (const { song_id, rank } of voterRanks) {
      const cur = songBorda.get(song_id) ?? { score: 0, ranker_count: 0 }
      cur.score += K - rank + 1   // rank 1 → K pts, rank K → 1 pt
      cur.ranker_count++
      songBorda.set(song_id, cur)
    }
  }

  // ── Build response ─────────────────────────────────────────────

  interface SongTally {
    song_id: string
    entry_id: string
    title: string
    artist: string
    label: string | null
    locked: boolean
    borda_score: number
    ranker_count: number
  }

  interface EntryTally {
    id: string
    name: string
    borda_score: number
    credits_contributed: number
    songs: SongTally[]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEntries = (entries ?? []) as any[]

  const entryTallies: EntryTally[] = allEntries.map((entry) => {
    const entrySongs = (entry.rodeo_entry_songs ?? []) as Array<{
      song_id: string
      label: string | null
      locked: boolean
      circle_songs: { id: string; title: string; artist: string } | null
    }>

    const songs: SongTally[] = entrySongs.map((es) => {
      const b = songBorda.get(es.song_id) ?? { score: 0, ranker_count: 0 }
      return {
        song_id: es.song_id,
        entry_id: entry.id,
        title: es.circle_songs?.title ?? 'Untitled',
        artist: es.circle_songs?.artist ?? 'Unknown',
        label: es.label,
        locked: es.locked,
        borda_score: b.score,
        ranker_count: b.ranker_count,
      }
    })

    return {
      id: entry.id,
      name: entry.circles?.name ?? 'Unknown',
      borda_score: songs.reduce((s, sg) => s + sg.borda_score, 0),
      credits_contributed: entry.credits_contributed ?? 0,
      songs,
    }
  })

  return NextResponse.json({
    entries: entryTallies,
    total_borda: entryTallies.reduce((s, e) => s + e.borda_score, 0),
    total_rankers: byVoter.size,
    my_ranking: (myRankingRaw ?? []).map((r) => r.song_id),
    is_subscribed: profile?.subscription_tier !== 'free',
  })
}
