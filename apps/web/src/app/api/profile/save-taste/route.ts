import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  favorite_genres:       z.array(z.string().max(50)).max(15).default([]),
  favorite_artist_ids:   z.array(z.string().max(100)).max(30).default([]),
  favorite_artist_names: z.array(z.string().max(100)).max(30).default([]),
  personality_types:     z.array(z.string().max(50)).max(8).default([]),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { favorite_genres, favorite_artist_ids, favorite_artist_names, personality_types } = parsed.data

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (favorite_genres.length > 0)       update.favorite_genres       = favorite_genres
  if (favorite_artist_ids.length > 0)   update.favorite_artist_ids   = favorite_artist_ids
  if (favorite_artist_names.length > 0) update.favorite_artist_names = favorite_artist_names
  if (personality_types.length > 0)     update.personality_types     = personality_types

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
