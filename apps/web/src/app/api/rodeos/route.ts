import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const circle = searchParams.get('circle')   // circle name search
  const artist = searchParams.get('artist')   // artist name search

  let query = supabase
    .from('rodeos')
    .select(`
      id, type, status, title, description, start_date, end_date, created_at,
      credit_pools(total),
      rodeo_entries(
        id, status, circle_id, artist_id, credits_contributed,
        circles(id, name),
        profiles!rodeo_entries_artist_id_fkey(id, display_name)
      ),
      rodeo_results(
        circle_member_votes, general_public_votes, winner_circle_id, winner_artist_id,
        finalized_at
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    console.error('Rodeos fetch error:', error)
    return NextResponse.json({ rodeos: [] })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rodeos = (data ?? []) as any[]

  // Client-side filters for circle/artist name (Supabase doesn't support
  // filtering on nested relation text easily)
  if (circle) {
    const q = circle.toLowerCase()
    rodeos = rodeos.filter((r) =>
      r.rodeo_entries?.some((e: { circles?: { name?: string } | null }) =>
        e.circles?.name?.toLowerCase().includes(q)
      )
    )
  }

  if (artist) {
    const q = artist.toLowerCase()
    rodeos = rodeos.filter((r) =>
      r.rodeo_entries?.some((e: { profiles?: { display_name?: string } | null }) =>
        e.profiles?.display_name?.toLowerCase().includes(q)
      )
    )
  }

  return NextResponse.json({ rodeos })
}
