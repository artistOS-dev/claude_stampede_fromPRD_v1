import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Params = { params: { slug: string } }

// GET /api/stables/[slug]/posts — paginated posts
export async function GET(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cursor = request.nextUrl.searchParams.get('cursor')
  const svc = createServiceClient()

  const { data: stable } = await svc
    .from('stables')
    .select('id, is_published, manager_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!stable) return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  if (!stable.is_published && stable.manager_id !== user.id) {
    return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  }

  let query = svc
    .from('stable_posts')
    .select('*')
    .eq('stable_id', stable.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (cursor) query = query.lt('created_at', cursor)

  const { data: posts, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: posts ?? [] })
}

// POST /api/stables/[slug]/posts — create a post (manager only)
export async function POST(request: NextRequest, { params }: Params) {
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

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content || content.length > 1000) {
    return NextResponse.json({ error: 'content must be 1–1000 characters' }, { status: 400 })
  }

  const media_url = typeof body.media_url === 'string' ? body.media_url || null : null
  const media_type = media_url && typeof body.media_type === 'string' &&
    ['image', 'video'].includes(body.media_type) ? body.media_type : null

  const { data: post, error } = await svc
    .from('stable_posts')
    .insert({ stable_id: stable.id, content, media_url, media_type })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post }, { status: 201 })
}
