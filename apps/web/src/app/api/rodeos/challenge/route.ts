import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RodeoService } from '@/lib/services/rodeo-service'

// POST /api/rodeos/challenge
// Body: ChallengeCircleInput (see RodeoService.challengeCircle)

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    challenger_circle_id: string
    target_circle_id: string
    title: string
    description?: string
    credit_buy_in: number
    song_ids: string[]
    song_labels?: Record<string, 'studio' | 'live'>
    end_date?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Basic validation
  if (!body.challenger_circle_id || !body.target_circle_id) {
    return NextResponse.json({ error: 'challenger_circle_id and target_circle_id are required' }, { status: 400 })
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!body.song_ids?.length) {
    return NextResponse.json({ error: 'At least one song is required' }, { status: 400 })
  }
  if (!body.credit_buy_in || body.credit_buy_in <= 0) {
    return NextResponse.json({ error: 'credit_buy_in must be greater than zero' }, { status: 400 })
  }

  const { data, error } = await RodeoService.challengeCircle({
    challenger_circle_id: body.challenger_circle_id,
    target_circle_id: body.target_circle_id,
    title: body.title.trim(),
    description: body.description?.trim(),
    credit_buy_in: body.credit_buy_in,
    song_ids: body.song_ids,
    song_labels: body.song_labels,
    end_date: body.end_date,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    )
  }

  return NextResponse.json({ rodeo_id: data.rodeo_id }, { status: 201 })
}
