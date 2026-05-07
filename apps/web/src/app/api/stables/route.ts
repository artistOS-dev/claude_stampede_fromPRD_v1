import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// GET /api/stables — list all published stables with counts
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const svc = createServiceClient()

  let query = svc
    .from('stables')
    .select(`
      id, artist_name, slug, bio, avatar_url, banner_url, genres, location, is_published,
      created_at,
      stable_followers(count),
      stable_songs(count)
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (q) query = query.ilike('artist_name', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check if current user has their own (possibly unpublished) stable
  const { data: myStable } = await svc
    .from('stables')
    .select('id, artist_name, slug, is_published')
    .eq('manager_id', user.id)
    .maybeSingle()

  const stables = (data ?? []).map((s) => ({
    ...s,
    follower_count: (s.stable_followers as unknown as { count: number }[])[0]?.count ?? 0,
    song_count: (s.stable_songs as unknown as { count: number }[])[0]?.count ?? 0,
    stable_followers: undefined,
    stable_songs: undefined,
  }))

  return NextResponse.json({ stables, my_stable: myStable ?? null })
}

// POST /api/stables — create a stable (artist_manager only, one per manager)
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // Check role
  const { data: profile } = await svc
    .from('profiles')
    .select('role, is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'artist_manager' && !profile?.is_super_admin) {
    return NextResponse.json({ error: 'Only artist managers can create stables' }, { status: 403 })
  }

  // One stable per manager
  const { data: existing } = await svc
    .from('stables')
    .select('id')
    .eq('manager_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a stable' }, { status: 409 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const artist_name = typeof body.artist_name === 'string' ? body.artist_name.trim() : ''
  if (!artist_name) return NextResponse.json({ error: 'artist_name is required' }, { status: 400 })

  // Generate unique slug
  let base = slugify(artist_name)
  if (!base) base = 'artist'
  let slug = base
  let attempt = 0
  while (true) {
    const { data: taken } = await svc
      .from('stables')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!taken) break
    attempt++
    slug = `${base}-${attempt}`
  }

  const { data: stable, error } = await svc
    .from('stables')
    .insert({
      manager_id: user.id,
      artist_name,
      slug,
      bio: typeof body.bio === 'string' ? body.bio.trim() || null : null,
      genres: Array.isArray(body.genres) ? body.genres : null,
      location: typeof body.location === 'string' ? body.location.trim() || null : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stable }, { status: 201 })
}
