import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateProfileSchema = z.object({
  display_name: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  role: z.enum(['fan', 'artist', 'producer']),
  avatar_url: z.string().url().optional().nullable(),
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

  const parseResult = updateProfileSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.flatten() },
      { status: 422 }
    )
  }

  const { display_name, role, avatar_url } = parseResult.data

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name,
      role,
      avatar_url: avatar_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (upsertError) {
    console.error('Profile update error:', upsertError)

    // Handle unique constraint violation on display_name
    if (upsertError.code === '23505') {
      return NextResponse.json(
        { error: 'That display name is already taken.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
