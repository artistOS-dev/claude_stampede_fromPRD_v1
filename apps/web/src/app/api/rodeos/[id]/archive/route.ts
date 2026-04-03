import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ArchiveService } from '@/lib/services/archive-service'

// POST /api/rodeos/[id]/archive
// Permanently archives a closed rodeo to both Circle timelines.
// Sets archived_to_circle_history = true. Cannot be undone.
// Only the rodeo creator may call this.

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ArchiveService.writeToCircleHistory(params.id)

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    )
  }

  return NextResponse.json({ success: data.success })
}
