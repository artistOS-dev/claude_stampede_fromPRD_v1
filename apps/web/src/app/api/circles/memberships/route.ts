import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (error) {
    console.error('Memberships fetch error:', error)
    return NextResponse.json({ circle_ids: [] })
  }

  return NextResponse.json({ circle_ids: (data ?? []).map((r) => r.circle_id) })
}
