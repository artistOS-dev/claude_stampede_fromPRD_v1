import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Params = { params: { slug: string; songId: string } }

// POST /api/stables/[slug]/songs/[songId]/rate
// Body: { rating: 1-5 }
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { rating: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'rating must be an integer 1–5' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Confirm song belongs to this stable
  const { data: song } = await svc
    .from('stable_songs')
    .select('id, stable_id, stables!inner(slug)')
    .eq('id', params.songId)
    .maybeSingle()

  if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((song as any).stables?.slug !== params.slug) {
    return NextResponse.json({ error: 'Song not found in this stable' }, { status: 404 })
  }

  const { error } = await svc
    .from('stable_song_ratings')
    .upsert(
      { song_id: params.songId, rater_id: user.id, rating, rated_at: new Date().toISOString() },
      { onConflict: 'song_id,rater_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rating })
}
