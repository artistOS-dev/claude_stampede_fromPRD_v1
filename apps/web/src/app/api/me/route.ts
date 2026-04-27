import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, is_super_admin, display_name, role')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    id: user.id,
    email: user.email,
    subscription_tier: profile?.subscription_tier ?? 'free',
    is_super_admin: profile?.is_super_admin ?? false,
    display_name: profile?.display_name ?? null,
    role: profile?.role ?? null,
  })
}
