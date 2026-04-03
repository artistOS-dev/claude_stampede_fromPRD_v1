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

  const budget = await NominationService.getBudget(user.id, params.id)
  if (!budget) {
    return NextResponse.json({ error: 'Could not load budget' }, { status: 500 })
  }

  return NextResponse.json({ budget })
}
