import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/songs/search?q=<query>&limit=<n>
// Any authenticated user can search songs (used when creating duels).

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 10), 30)

  const svc = createServiceClient()
  const query = svc
    .from('circle_songs')
    .select('id, title, artist, album, circles(name)')
    .limit(limit)

  const { data, error } = q
    ? await query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
    : await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ songs: data ?? [] })
}
