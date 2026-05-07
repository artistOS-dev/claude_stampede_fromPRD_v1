import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const songSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  album: z.string().max(200).optional().nullable(),
  release_year: z.number().int().optional().nullable(),
  cover_url: z.string().url().optional().nullable(),
  spotify_url: z.string().url().optional().nullable(),
  apple_music_url: z.string().url().optional().nullable(),
})

const bulkSchema = z.object({
  songs: z.array(songSchema).min(1).max(100),
})

// POST /api/stables/[slug]/songs/bulk
// Inserts multiple songs into a stable's catalog. Manager only.
// Skips duplicates (same title + artist) already in the stable.

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: stable } = await svc
    .from('stables')
    .select('id, manager_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!stable) return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  if (stable.manager_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  // Fetch existing songs to detect duplicates
  const { data: existing } = await svc
    .from('stable_songs')
    .select('title, artist')
    .eq('stable_id', stable.id)

  const existingSet = new Set(
    (existing ?? []).map((s) => `${s.title.toLowerCase()}|||${s.artist.toLowerCase()}`)
  )

  const toInsert = parsed.data.songs
    .filter((s) => !existingSet.has(`${s.title.toLowerCase()}|||${s.artist.toLowerCase()}`))
    .map((s) => ({ ...s, stable_id: stable.id }))

  const skipped = parsed.data.songs.length - toInsert.length

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped, message: 'All songs already in catalog' })
  }

  const { data: inserted, error } = await svc
    .from('stable_songs')
    .insert(toInsert)
    .select('id, title, artist')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: inserted?.length ?? 0,
    skipped,
    songs: inserted ?? [],
  })
}
