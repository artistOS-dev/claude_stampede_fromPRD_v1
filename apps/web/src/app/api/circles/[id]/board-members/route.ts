import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MANAGEABLE_ROLES = ['member', 'board'] as const

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: myMembership } = await supabase
    .from('circle_members')
    .select('role')
    .eq('circle_id', params.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!myMembership || !['board', 'founder'].includes(myMembership.role)) {
    return NextResponse.json({ error: 'Board or founder access required' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('circle_members')
    .select('user_id, role, status, joined_at')
    .eq('circle_id', params.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (data ?? []).map((row) => row.user_id)
  let profiles: Array<{ id: string; display_name: string | null; email: string | null }> = []
  if (userIds.length > 0) {
    const serviceSupabase = createServiceClient()
    const { data: profileRows } = await serviceSupabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds)
    profiles = profileRows ?? []
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  const members = (data ?? []).map((row) => {
    const profile = profileById.get(row.user_id)
    return {
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      joined_at: row.joined_at,
      display_name: profile?.display_name ?? null,
      email: profile?.email ?? null,
    }
  })

  return NextResponse.json({ my_role: myMembership.role, members })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: myMembership } = await supabase
    .from('circle_members')
    .select('role')
    .eq('circle_id', params.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!myMembership || myMembership.role !== 'founder') {
    return NextResponse.json({ error: 'Founder access required' }, { status: 403 })
  }

  let body: { user_id?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.user_id || !body.role) {
    return NextResponse.json({ error: 'user_id and role are required' }, { status: 422 })
  }

  if (!MANAGEABLE_ROLES.includes(body.role as (typeof MANAGEABLE_ROLES)[number])) {
    return NextResponse.json({ error: 'role must be member or board' }, { status: 422 })
  }

  if (body.user_id === user.id) {
    return NextResponse.json({ error: 'Founders cannot change their own role' }, { status: 400 })
  }

  const { data: targetMembership } = await supabase
    .from('circle_members')
    .select('user_id, role')
    .eq('circle_id', params.id)
    .eq('user_id', body.user_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!targetMembership) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  if (targetMembership.role === 'founder') {
    return NextResponse.json({ error: 'Founder role cannot be changed here' }, { status: 400 })
  }

  const { error } = await supabase
    .from('circle_members')
    .update({ role: body.role })
    .eq('circle_id', params.id)
    .eq('user_id', body.user_id)
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
