import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const addSongSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  album: z.string().max(200).optional().nullable(),
  spotify_url: z.string().url().optional().nullable(),
  cover_url: z.string().url().optional().nullable(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('circle_songs')
    .select(`
      id, title, artist, album, spotify_url, cover_url,
      avg_rating, rating_count, created_at,
      shared_by,
      profiles!circle_songs_shared_by_fkey(display_name, avatar_url),
      song_ratings!left(rating, user_id)
    `)
    .eq('circle_id', params.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Songs fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Attach the current user's rating to each song
  const songs = (data ?? []).map((s: {
    id: string
    title: string
    artist: string
    album: string | null
    spotify_url: string | null
    cover_url: string | null
    avg_rating: number
    rating_count: number
    created_at: string
    shared_by: string
    profiles: { display_name: string; avatar_url: string | null } | null
    song_ratings: Array<{ rating: number; user_id: string }>
  }) => {
    const myRating = s.song_ratings?.find((r) => r.user_id === user.id)?.rating ?? null
    const { song_ratings, ...rest } = s
    return { ...rest, my_rating: myRating }
  })

  return NextResponse.json({ songs })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = addSongSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { error } = await supabase.from('circle_songs').insert({
    circle_id: params.id,
    shared_by: user.id,
    ...parsed.data,
  })

  if (error) {
    console.error('Add song error:', error)
    if (error.code === '42501') return NextResponse.json({ error: 'You must be a member of this circle.' }, { status: 403 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
