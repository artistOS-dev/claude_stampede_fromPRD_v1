import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { RodeoService } from '@/lib/services/rodeo-service'

// POST /api/rodeos/[id]/accept
// Target circle board accepts the challenge by fielding their songs.
// On success, the rodeo is automatically opened to voting.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { song_ids: string[]; song_labels?: Record<string, 'studio' | 'live'> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.song_ids?.length) {
    return NextResponse.json({ error: 'At least one song is required' }, { status: 400 })
  }

  const { data, error } = await RodeoService.acceptChallenge({
    rodeo_id: params.id,
    song_ids: body.song_ids,
    song_labels: body.song_labels,
  })

  if (error) {
    return NextResponse.json({ error: error.message, code: (error as { code?: string }).code }, { status: (error as { status?: number }).status ?? 400 })
  }

  // Auto-open: both sides are now confirmed — transition rodeo to voting.
  // Use service client to bypass the created_by ownership check in openRodeo().
  const svc = createServiceClient()
  const { error: openErr } = await svc
    .from('rodeos')
    .update({ status: 'voting', start_date: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'pending')

  if (openErr) {
    return NextResponse.json({ error: 'Challenge accepted but failed to open rodeo: ' + openErr.message }, { status: 500 })
  }

  // Insert placeholder result row
  await svc.from('rodeo_results').upsert({ rodeo_id: params.id }, { onConflict: 'rodeo_id', ignoreDuplicates: true })

  return NextResponse.json({ success: true, entry_id: data.entry_id, rodeo_status: 'voting' })
}
