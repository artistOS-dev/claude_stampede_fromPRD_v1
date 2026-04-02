import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const leaveCircleSchema = z.object({
  circle_id: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = leaveCircleSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: 'circle_id is required' }, { status: 422 })
  }

  const { circle_id } = parseResult.data

  const { error: deleteError } = await supabase
    .from('circle_members')
    .delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('Circle leave error:', deleteError)
    return NextResponse.json({ error: 'Failed to leave circle' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
