import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/auth/validate-role-key
// Called during signup Step 3 when a candidate selects a privileged role.
// Returns { valid: boolean } — never exposes the actual stored key.
//
// Body: { role: 'artist_manager' | 'stampede_producer', key: string }

export async function POST(request: NextRequest) {
  // User must be authenticated (they are at Step 3 — post email verification)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { role?: string; key?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { role, key } = body
  if (!role || !key) return NextResponse.json({ valid: false })
  if (!['artist_manager', 'stampede_producer'].includes(role)) {
    return NextResponse.json({ valid: false })
  }

  // Use service client to bypass RLS — key comparison is done server-side only
  const svc = createServiceClient()
  const { data } = await svc
    .from('privileged_role_keys')
    .select('secret_key')
    .eq('role', role)
    .maybeSingle()

  if (!data) return NextResponse.json({ valid: false })

  const valid = data.secret_key === key.trim()
  return NextResponse.json({ valid })
}
