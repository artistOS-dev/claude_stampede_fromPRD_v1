import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// ── POST /api/admin/seed-super-users ─────────────────────────
// Creates two super admin accounts if they don't already exist.
// Must supply the ADMIN_SECRET env var as the X-Admin-Secret header.
//
// Credentials created:
//   admin@stampede.app  / Stampede2024!
//   admin2@stampede.app / Stampede2024!

const SUPER_USERS = [
  { email: 'admin@stampede.app',  password: 'Stampede2024!', display_name: 'Admin One' },
  { email: 'admin2@stampede.app', password: 'Stampede2024!', display_name: 'Admin Two' },
]

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  const expected = process.env.ADMIN_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const results: { email: string; action: string; error?: string }[] = []

  for (const u of SUPER_USERS) {
    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, is_super_admin')
      .eq('email', u.email)
      .maybeSingle()

    if (existing) {
      if (!existing.is_super_admin) {
        await supabase
          .from('profiles')
          .update({ is_super_admin: true, subscription_tier: 'superfan' })
          .eq('id', existing.id)
        results.push({ email: u.email, action: 'promoted_to_super_admin' })
      } else {
        results.push({ email: u.email, action: 'already_super_admin' })
      }
      continue
    }

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    })

    if (authErr || !authData.user) {
      results.push({ email: u.email, action: 'error', error: authErr?.message ?? 'Unknown error' })
      continue
    }

    // Upsert profile with super admin flag
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email: u.email,
      display_name: u.display_name,
      role: 'fan',
      subscription_tier: 'superfan',
      is_super_admin: true,
      signup_completed_at: new Date().toISOString(),
    })

    if (profileErr) {
      results.push({ email: u.email, action: 'auth_created_profile_error', error: profileErr.message })
    } else {
      results.push({ email: u.email, action: 'created' })
    }
  }

  return NextResponse.json({ results })
}
