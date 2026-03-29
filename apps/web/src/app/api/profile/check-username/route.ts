import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Simple in-memory rate limiter
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(ip)

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }

  if (record.count >= RATE_LIMIT) {
    return true
  }

  record.count++
  return false
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429 }
    )
  }

  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  // Validate username format
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json(
      { available: false, reason: 'Username must be 3-30 characters: letters, numbers, underscores only' },
      { status: 200 }
    )
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('display_name', username)
    .maybeSingle()

  if (error) {
    console.error('Username check error:', error)
    // If the table doesn't exist yet, treat as available
    if (error.code === '42P01') {
      return NextResponse.json({ available: true })
    }
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ available: data === null })
}
