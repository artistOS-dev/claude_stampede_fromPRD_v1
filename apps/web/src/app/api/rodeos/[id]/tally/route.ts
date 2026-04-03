import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/rodeos/[id]/tally
// Returns live per-entry and per-song vote tallies by reading rodeo_votes directly.
// Polled by the voting screen every ~10 s for real-time feel.

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all votes for this rodeo
  const { data: votes, error: votesErr } = await supabase
    .from('rodeo_votes')
    .select('song_id, target_entry_id, voter_type, weight')
    .eq('rodeo_id', params.id)

  if (votesErr) {
    console.error('tally votes error:', votesErr)
    return NextResponse.json({ error: votesErr.message }, { status: 500 })
  }

  // Fetch entries with songs for this rodeo
  const { data: entries, error: entriesErr } = await supabase
    .from('rodeo_entries')
    .select(`
      id, circle_id, artist_id, credits_contributed,
      circles(id, name),
      profiles!rodeo_entries_artist_id_fkey(id, display_name),
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

  // Fetch current user's votes for this rodeo
  const { data: myVotesRaw } = await supabase
    .from('rodeo_votes')
    .select('song_id, target_entry_id, voter_type')
    .eq('rodeo_id', params.id)
    .eq('voter_id', user.id)

  // Fetch user's profile (subscription + voter type context)
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  // ── Aggregate in memory ────────────────────────────────────

  // Per-entry tallies
  interface EntryTally {
    id: string
    name: string
    circle_member_votes: number
    general_public_votes: number
    weighted_score: number
    credits_contributed: number
    songs: SongTally[]
  }

  interface SongTally {
    song_id: string
    entry_id: string
    title: string
    artist: string
    label: string | null
    locked: boolean
    circle_member_votes: number
    general_public_votes: number
    total_votes: number
    weighted_score: number
  }

  const allVotes = votes ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEntries = (entries ?? []) as any[]

  const entryTallies: EntryTally[] = allEntries.map((entry) => {
    const entryVotes = allVotes.filter((v) => v.target_entry_id === entry.id)
    const circleMemberVotes = entryVotes.filter((v) => v.voter_type === 'circle_member').length
    const generalPublicVotes = entryVotes.filter((v) => v.voter_type === 'general_public').length
    const weightedScore = entryVotes.reduce((sum, v) => sum + (v.weight ?? 1), 0)

    const songs: SongTally[] = (entry.rodeo_entry_songs ?? []).map((es: {
      song_id: string
      label: string | null
      locked: boolean
      circle_songs: { id: string; title: string; artist: string } | null
    }) => {
      const songVotes = allVotes.filter(
        (v) => v.song_id === es.song_id && v.target_entry_id === entry.id
      )
      const sCM = songVotes.filter((v) => v.voter_type === 'circle_member').length
      const sGP = songVotes.filter((v) => v.voter_type === 'general_public').length
      return {
        song_id: es.song_id,
        entry_id: entry.id,
        title: es.circle_songs?.title ?? 'Untitled',
        artist: es.circle_songs?.artist ?? 'Unknown',
        label: es.label,
        locked: es.locked,
        circle_member_votes: sCM,
        general_public_votes: sGP,
        total_votes: sCM + sGP,
        weighted_score: songVotes.reduce((sum, v) => sum + (v.weight ?? 1), 0),
      }
    })

    return {
      id: entry.id,
      name: entry.circles?.name ?? entry.profiles?.display_name ?? 'Unknown',
      circle_member_votes: circleMemberVotes,
      general_public_votes: generalPublicVotes,
      weighted_score: weightedScore,
      credits_contributed: entry.credits_contributed ?? 0,
      songs,
    }
  })

  const totalWeighted = entryTallies.reduce((s, e) => s + e.weighted_score, 0)

  return NextResponse.json({
    entries: entryTallies,
    total_weighted: totalWeighted,
    total_votes: allVotes.length,
    my_votes: (myVotesRaw ?? []).map((v) => v.song_id),
    is_subscribed: profile?.subscription_tier !== 'free',
    // Granted credits shown to general public voters as an affordance
    granted_credits: profile?.subscription_tier === 'free' ? 0 : 50,
    voter_type: myVotesRaw?.[0]?.voter_type ?? null,
  })
}
