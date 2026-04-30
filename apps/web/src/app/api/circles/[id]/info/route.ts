import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/circles/[id]/info
// Returns circle name, member count, and the current user's role.

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: circle }, { data: membership }] = await Promise.all([
    supabase
      .from('circles')
      .select('id, name, member_count')
      .eq('id', params.id)
      .single(),
    supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', params.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })

  return NextResponse.json({
    id: circle.id,
    name: circle.name,
    member_count: circle.member_count ?? 0,
    my_role: (membership?.role ?? null) as 'member' | 'board' | 'founder' | null,
  })
}
