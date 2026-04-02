import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; songId: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = rateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 422 })
  }

  const { error } = await supabase.from('song_ratings').upsert(
    { song_id: params.songId, user_id: user.id, rating: parsed.data.rating },
    { onConflict: 'song_id,user_id' }
  )

  if (error) {
    console.error('Rate song error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return updated avg for optimistic UI
  const { data: song } = await supabase
    .from('circle_songs')
    .select('avg_rating, rating_count')
    .eq('id', params.songId)
    .single()

  return NextResponse.json({ success: true, avg_rating: song?.avg_rating, rating_count: song?.rating_count })
}
