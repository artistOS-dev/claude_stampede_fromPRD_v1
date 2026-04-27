import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/admin/sync-superadmin-boards
// Makes every is_super_admin user a board member in every circle.
// Re-runnable: upgrades 'member' → 'board', never downgrades 'founder'.
// Protected by X-Admin-Secret header.

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Fetch all super admins and all circles
  const [{ data: superAdmins, error: adminsErr }, { data: circles, error: circlesErr }] = await Promise.all([
    supabase.from('profiles').select('id, email, display_name').eq('is_super_admin', true),
    supabase.from('circles').select('id, name'),
  ])

  if (adminsErr) return NextResponse.json({ error: adminsErr.message }, { status: 500 })
  if (circlesErr) return NextResponse.json({ error: circlesErr.message }, { status: 500 })

  if (!superAdmins?.length) {
    return NextResponse.json({ message: 'No super admins found', inserted: 0, upgraded: 0 })
  }
  if (!circles?.length) {
    return NextResponse.json({ message: 'No circles found', inserted: 0, upgraded: 0 })
  }

  // Fetch existing memberships for all super admins
  const adminIds = superAdmins.map((a) => a.id)
  const { data: existing } = await supabase
    .from('circle_members')
    .select('circle_id, user_id, role')
    .in('user_id', adminIds)

  const existingMap = new Map(
    (existing ?? []).map((m) => [`${m.circle_id}:${m.user_id}`, m.role])
  )

  const toInsert: { circle_id: string; user_id: string; role: string; status: string }[] = []
  const toUpgrade: { circle_id: string; user_id: string }[] = []

  for (const admin of superAdmins) {
    for (const circle of circles) {
      const key = `${circle.id}:${admin.id}`
      const currentRole = existingMap.get(key)

      if (!currentRole) {
        toInsert.push({ circle_id: circle.id, user_id: admin.id, role: 'board', status: 'active' })
      } else if (currentRole === 'member') {
        toUpgrade.push({ circle_id: circle.id, user_id: admin.id })
      }
      // 'board' or 'founder' → no change needed
    }
  }

  let inserted = 0
  let upgraded = 0

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from('circle_members').insert(toInsert)
    if (insertErr) return NextResponse.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 })
    inserted = toInsert.length
  }

  for (const { circle_id, user_id } of toUpgrade) {
    await supabase
      .from('circle_members')
      .update({ role: 'board', status: 'active' })
      .eq('circle_id', circle_id)
      .eq('user_id', user_id)
    upgraded++
  }

  return NextResponse.json({
    super_admins: superAdmins.map((a) => a.email ?? a.id),
    circles_total: circles.length,
    inserted,
    upgraded,
    skipped: superAdmins.length * circles.length - inserted - upgraded,
  })
}
