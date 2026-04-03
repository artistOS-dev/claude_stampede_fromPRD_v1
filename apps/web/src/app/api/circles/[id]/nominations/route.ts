import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NominationService } from '@/lib/services/nomination-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nominations = await NominationService.listNominations(params.id)
  return NextResponse.json({ nominations })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { artist_name, tier_target, circle_artist_id, message } = body

  if (!artist_name || !tier_target) {
    return NextResponse.json({ error: 'artist_name and tier_target required' }, { status: 400 })
  }

  if (!['young_buck', 'core'].includes(tier_target)) {
    return NextResponse.json({ error: 'tier_target must be young_buck or core' }, { status: 400 })
  }

  const result = await NominationService.submitNomination({
    user_id: user.id,
    circle_id: params.id,
    artist_name,
    tier_target,
    circle_artist_id,
    message,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ nomination: result.nomination }, { status: 201 })
}
