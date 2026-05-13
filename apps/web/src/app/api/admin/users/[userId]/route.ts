import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/admin/users/[userId] — super_admin changes a user's role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } },
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Must be super_admin
  const { data: me } = await supabase
    .from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!me?.is_super_admin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { role?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { role } = body
  if (!role || !['fan', 'artist_manager', 'stampede_producer'].includes(role))
    return NextResponse.json({ error: 'role must be fan | artist_manager | stampede_producer' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('profiles')
    .update({ role, subscription_tier: role === 'fan' ? 'fan' : role })
    .eq('id', params.userId)
    .select('id, display_name, email, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}
