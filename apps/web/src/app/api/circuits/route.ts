import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/circuits  — list all non-draft circuits
// POST /api/circuits — create a circuit (stampede_producer or super_admin)

export async function GET(_request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, is_super_admin').eq('id', user.id).maybeSingle()
  const isProducer = profile?.role === 'stampede_producer' || profile?.is_super_admin === true

  const svc = createServiceClient()

  // Producers/admins also see their own draft circuits
  const [{ data: circuits, error: err }, { data: drafts }] = await Promise.all([
    svc
      .from('circuits')
      .select('id, title, description, event_name, event_date, cover_image_url, status, max_artists, current_round, voting_hours_per_round, created_at')
      .neq('status', 'draft')
      .order('created_at', { ascending: false }),
    isProducer
      ? svc
          .from('circuits')
          .select('id, title, description, event_name, event_date, cover_image_url, status, max_artists, current_round, voting_hours_per_round, created_at')
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  const ids = (circuits ?? []).map((c) => c.id)

  // participant counts and user's own participation — in parallel
  const [{ data: pCounts }, { data: myParticipations }] = await Promise.all([
    ids.length > 0
      ? svc.from('circuit_participants').select('circuit_id').in('circuit_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length > 0
      ? svc.from('circuit_participants').select('circuit_id').eq('artist_manager_id', user.id).in('circuit_id', ids)
      : Promise.resolve({ data: [] }),
  ])

  const countMap: Record<string, number> = {}
  for (const p of pCounts ?? []) countMap[p.circuit_id] = (countMap[p.circuit_id] ?? 0) + 1
  const mySet = new Set((myParticipations ?? []).map((p) => p.circuit_id))

  const enriched = (circuits ?? []).map((c) => ({
    ...c,
    participant_count: countMap[c.id] ?? 0,
    total_rounds: Math.log2(c.max_artists),
    i_am_participating: mySet.has(c.id),
  }))

  const enrichedDrafts = (drafts ?? []).map((c) => ({
    ...c,
    participant_count: 0,
    total_rounds: Math.log2(c.max_artists),
    i_am_participating: false,
  }))

  return NextResponse.json({ circuits: enriched, drafts: enrichedDrafts })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, is_super_admin').eq('id', user.id).maybeSingle()
  if (!profile || (profile.role !== 'stampede_producer' && !profile.is_super_admin))
    return NextResponse.json({ error: 'Only Stampede Producers can create circuits' }, { status: 403 })

  let body: {
    title: string
    description?: string
    event_name?: string
    event_date?: string
    max_artists?: number
    voting_hours_per_round?: number
    cover_image_url?: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, description, event_name, event_date, max_artists = 8, voting_hours_per_round = 24, cover_image_url } = body
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (![4, 8, 16, 32].includes(max_artists))
    return NextResponse.json({ error: 'max_artists must be 4, 8, 16, or 32' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error: insertErr } = await svc
    .from('circuits')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      event_name: event_name?.trim() || null,
      event_date: event_date || null,
      max_artists,
      voting_hours_per_round,
      cover_image_url: cover_image_url || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  return NextResponse.json({ circuit: data }, { status: 201 })
}
