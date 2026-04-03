import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TierService } from '@/lib/services/tier-service'
import { NominationService } from '@/lib/services/nomination-service'

// Board-only: approve a promotion (Core → Legacy or Young Buck → Core)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; artistId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only board/founder can promote
  const { data: membership } = await supabase
    .from('circle_members')
    .select('role')
    .eq('circle_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['board', 'founder'].includes(membership.role)) {
    return NextResponse.json({ error: 'Board members only' }, { status: 403 })
  }

  const body = await req.json()
  const { action, nomination_id } = body
  // action: 'induct' | 'legacy' | 'decline'

  if (action === 'legacy') {
    // Get artist info
    const { data: ca } = await supabase
      .from('circle_artists')
      .select('artist_name')
      .eq('id', params.artistId)
      .single()

    const result = await TierService.moveToLegacy({
      circle_artist_id: params.artistId,
      board_user_id: user.id,
      circle_id: params.id,
      artist_name: ca?.artist_name ?? 'Unknown Artist',
    })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, action: 'legacy' })
  }

  if (action === 'induct' && nomination_id) {
    const result = await NominationService.induct({
      nomination_id,
      board_user_id: user.id,
    })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, action: 'inducted' })
  }

  if (action === 'decline' && nomination_id) {
    await supabase
      .from('nominations')
      .update({
        status: 'declined',
        board_decided_by: user.id,
        board_decided_at: new Date().toISOString(),
      })
      .eq('id', nomination_id)
    return NextResponse.json({ success: true, action: 'declined' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
