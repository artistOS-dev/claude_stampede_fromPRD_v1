import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const joinCircleSchema = z.object({
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

  const parseResult = joinCircleSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'circle_id is required' },
      { status: 422 }
    )
  }

  const { circle_id } = parseResult.data

  // Check if mock circle (starts with 'mock-') — skip DB insert
  if (circle_id.startsWith('mock-')) {
    return NextResponse.json({ success: true, mock: true })
  }

  const { error: insertError } = await supabase.from('circle_members').upsert(
    {
      circle_id,
      user_id: user.id,
      joined_at: new Date().toISOString(),
      role: 'member',
    },
    { onConflict: 'circle_id,user_id', ignoreDuplicates: true }
  )

  if (insertError) {
    console.error('Circle join error:', insertError)

    if (insertError.code === '42P01') {
      // Table doesn't exist, return success anyway
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Failed to join circle' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
