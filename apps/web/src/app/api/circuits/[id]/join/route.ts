import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/circuits/[id]/join — artist_manager registers their artist

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'artist_manager')
    return NextResponse.json({ error: 'Only Artist Managers can join circuits' }, { status: 403 })

  let body: { artist_name: string; artist_image_url?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { artist_name, artist_image_url } = body
  if (!artist_name?.trim())
    return NextResponse.json({ error: 'artist_name is required' }, { status: 400 })

  const svc = createServiceClient()

  const { data: circuit } = await svc
    .from('circuits').select('status, max_artists').eq('id', params.id).single()
  if (!circuit) return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
  if (circuit.status !== 'open')
    return NextResponse.json({ error: 'Circuit is not open for registration' }, { status: 400 })

  // Check capacity
  const { count } = await svc
    .from('circuit_participants')
    .select('id', { count: 'exact', head: true })
    .eq('circuit_id', params.id)
  if ((count ?? 0) >= circuit.max_artists)
    return NextResponse.json({ error: 'Circuit is full' }, { status: 400 })

  const { data, error: insertErr } = await svc
    .from('circuit_participants')
    .insert({
      circuit_id: params.id,
      artist_manager_id: user.id,
      artist_name: artist_name.trim(),
      artist_image_url: artist_image_url?.trim() || null,
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ participant: data }, { status: 201 })
}
