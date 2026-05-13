import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const songSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  album: z.string().max(200).optional().nullable(),
  apple_music_url: z.string().url().optional().nullable(),
  spotify_url: z.string().url().optional().nullable(),
  cover_url: z.string().url().optional().nullable(),
})

const bulkSchema = z.object({
  songs: z.array(songSchema).min(1).max(100),
})

// POST /api/circles/[id]/songs/bulk
// Inserts multiple songs at once. User must be a member of the circle.
// Skips duplicates (same title + artist, case-insensitive) within the circle.

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

  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  // Fetch existing songs in this circle to detect duplicates
  const { data: existing } = await supabase
    .from('circle_songs')
    .select('title, artist')
    .eq('circle_id', params.id)

  const existingSet = new Set(
    (existing ?? []).map((s) => `${s.title.toLowerCase()}|||${s.artist.toLowerCase()}`)
  )

  const toInsert = parsed.data.songs
    .filter((s) => !existingSet.has(`${s.title.toLowerCase()}|||${s.artist.toLowerCase()}`))
    .map((s) => ({ ...s, circle_id: params.id, shared_by: user.id }))

  const skipped = parsed.data.songs.length - toInsert.length

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped, message: 'All songs already exist in this circle' })
  }

  const { data: inserted, error } = await supabase
    .from('circle_songs')
    .insert(toInsert)
    .select('id, title, artist')

  if (error) {
    if (error.code === '42501') return NextResponse.json({ error: 'You must be a member of this circle.' }, { status: 403 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: inserted?.length ?? 0, skipped })
}
