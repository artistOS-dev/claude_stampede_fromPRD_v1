import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const addArtistSchema = z.object({
  artist_name: z.string().min(1).max(200),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('circle_artists')
    .select('id, artist_name, created_at, added_by, profiles!circle_artists_added_by_fkey(display_name)')
    .eq('circle_id', params.id)
    .order('artist_name', { ascending: true })

  if (error) {
    console.error('Artists fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ artists: data ?? [] })
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

  const parsed = addArtistSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'artist_name is required' }, { status: 422 })
  }

  const { error } = await supabase.from('circle_artists').insert({
    circle_id: params.id,
    added_by: user.id,
    artist_name: parsed.data.artist_name,
  })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That artist is already in this circle.' }, { status: 409 })
    if (error.code === '42501') return NextResponse.json({ error: 'You must be a member of this circle.' }, { status: 403 })
    console.error('Add artist error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const artistId = searchParams.get('artist_id')
  if (!artistId) return NextResponse.json({ error: 'artist_id required' }, { status: 400 })

  const { error } = await supabase
    .from('circle_artists')
    .delete()
    .eq('id', artistId)
    .eq('circle_id', params.id)

  if (error) {
    console.error('Remove artist error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
