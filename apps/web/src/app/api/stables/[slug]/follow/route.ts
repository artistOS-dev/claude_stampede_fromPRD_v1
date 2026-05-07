import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/stables/[slug]/follow — toggle follow
export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
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
  if (stable.manager_id === user.id) {
    return NextResponse.json({ error: 'Cannot follow your own stable' }, { status: 400 })
  }

  const { data: existing } = await svc
    .from('stable_followers')
    .select('follower_id')
    .eq('stable_id', stable.id)
    .eq('follower_id', user.id)
    .maybeSingle()

  if (existing) {
    await svc.from('stable_followers').delete().eq('stable_id', stable.id).eq('follower_id', user.id)
    return NextResponse.json({ following: false })
  } else {
    await svc.from('stable_followers').insert({ stable_id: stable.id, follower_id: user.id })
    return NextResponse.json({ following: true })
  }
}
