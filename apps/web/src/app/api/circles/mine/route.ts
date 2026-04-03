import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns circles where the authenticated user is board or founder.
// Used by the challenge flow to determine which circle the user can challenge from.

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('circle_members')
    .select('role, circles(id, name, description, member_count, personality_tags, image_url)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['board', 'founder'])

  if (error) {
    console.error('circles/mine error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const circles = (data ?? [])
    .filter((row) => row.circles)
    .map((row) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(row.circles as any),
      role: row.role,
    }))

  return NextResponse.json({ circles })
}
