import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ArchiveService } from '@/lib/services/archive-service'

// POST /api/rodeos/[id]/finalize
// Ends voting, computes winner + song scores + credit distributions.
// Only the rodeo creator may call this.

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ArchiveService.finalizeResult(params.id)

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    )
  }

  return NextResponse.json({ result_id: data.result_id })
}
