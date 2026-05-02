import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ActivityFeedService } from '@/lib/services/activity-feed-service'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if user is a circle member
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from('circle_members').select('role').eq('circle_id', params.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('is_super_admin, subscription_tier').eq('id', user.id).maybeSingle(),
  ])

  const isSuperAdmin = profile?.is_super_admin === true
  const isSuperfan = !isSuperAdmin && profile?.subscription_tier === 'superfan'

  if (!membership && !isSuperAdmin && !isSuperfan) {
    return NextResponse.json({ error: 'Not a circle member' }, { status: 403 })
  }

  // super_admin always sees board-only events; superfan and actual board members also do
  const isBoardMember = isSuperAdmin || isSuperfan || ['board', 'founder', 'admin'].includes(membership?.role ?? '')

  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '50')
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const events = await ActivityFeedService.getCircleEvents(params.id, {
    board_member: isBoardMember,
    limit,
    offset,
  })

  return NextResponse.json({ events })
}
