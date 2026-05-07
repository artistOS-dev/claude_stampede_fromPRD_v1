import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Params = { params: { slug: string; postId: string } }

// DELETE /api/stables/[slug]/posts/[postId]
export async function DELETE(_req: NextRequest, { params }: Params) {
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

  const { error } = await svc
    .from('stable_posts')
    .delete()
    .eq('id', params.postId)
    .eq('stable_id', stable.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
