import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/circles/[id]/incoming-challenges
// Returns pending rodeos where this circle is the target (challenged side).
// Board/founder or super_admin only.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from('circle_members').select('role').eq('circle_id', params.id).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    supabase.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle(),
  ])

  const isSuperAdmin = profile?.is_super_admin === true
  const isBoardMember = ['board', 'founder'].includes(membership?.role ?? '')

  if (!isBoardMember && !isSuperAdmin) {
    return NextResponse.json({ error: 'Board or founder access required' }, { status: 403 })
  }

  const svc = createServiceClient()

  // Find pending rodeo entries where this circle is the target
  const { data: pendingEntries, error } = await svc
    .from('rodeo_entries')
    .select('rodeo_id')
    .eq('circle_id', params.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pendingEntries?.length) return NextResponse.json({ challenges: [] })

  const rodeoIds = pendingEntries.map((e) => e.rodeo_id)

  // Fetch full rodeo data for each pending entry
  const { data: rodeos } = await svc
    .from('rodeos')
    .select(`
      id, title, description, created_at, created_by_circle,
      credit_pools ( circle_credits ),
      rodeo_entries (
        id, circle_id, status,
        circles ( id, name ),
        rodeo_entry_songs (
          song_id, label, locked,
          circle_songs ( id, title, artist )
        )
      )
    `)
    .in('id', rodeoIds)
    .eq('status', 'pending')

  if (!rodeos?.length) return NextResponse.json({ challenges: [] })

  const challenges = rodeos.map((rodeo) => {
    const entries = rodeo.rodeo_entries ?? []
    const targetEntry = entries.find((e) => e.circle_id === params.id)
    const challengerEntry = entries.find((e) => e.circle_id !== params.id && e.status === 'confirmed')

    const creditBuyIn = (rodeo.credit_pools as { circle_credits: number }[] | null)?.[0]?.circle_credits ?? 0

    type SongRow = { title: string; artist: string }
    type CircleRow = { id: string; name: string }

    const challengerSongs = (challengerEntry?.rodeo_entry_songs ?? []).map((s) => {
      const cs = (s.circle_songs as unknown as SongRow | null)
      return {
        song_id: s.song_id,
        title: cs?.title ?? 'Unknown',
        artist: cs?.artist ?? '',
        label: s.label,
      }
    })

    const circleInfo = (challengerEntry?.circles as unknown as CircleRow | null)

    return {
      rodeo_id: rodeo.id,
      title: rodeo.title,
      description: rodeo.description,
      credit_buy_in: creditBuyIn,
      created_at: rodeo.created_at,
      challenger_circle: {
        id: circleInfo?.id ?? rodeo.created_by_circle ?? '',
        name: circleInfo?.name ?? 'Unknown Circle',
      },
      challenger_songs: challengerSongs,
      target_entry_id: targetEntry?.id ?? null,
    }
  })

  return NextResponse.json({ challenges })
}
