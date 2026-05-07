import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = ['t-shirt', 'hoodie', 'poster', 'vinyl', 'hat', 'accessory', 'other'] as const

type Params = { params: { slug: string } }

// POST /api/stables/[slug]/merch — add merch item (manager only)
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: stable } = await svc
    .from('stables')
    .select('id, manager_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!stable) return NextResponse.json({ error: 'Stable not found' }, { status: 404 })
  if (stable.manager_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const price_cents = Number(body.price_cents)
  if (!Number.isInteger(price_cents) || price_cents <= 0) {
    return NextResponse.json({ error: 'price_cents must be a positive integer' }, { status: 400 })
  }

  const category = typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category as typeof VALID_CATEGORIES[number])
    ? body.category
    : 'other'

  const { data: item, error } = await svc
    .from('stable_merchandise')
    .insert({
      stable_id: stable.id,
      name,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      price_cents,
      image_url: typeof body.image_url === 'string' ? body.image_url || null : null,
      category,
      sizes: Array.isArray(body.sizes) ? body.sizes : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item }, { status: 201 })
}
