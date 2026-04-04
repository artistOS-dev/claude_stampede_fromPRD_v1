import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Shape returned by the DB (matches migration 001 column names)
interface CircleRow {
  id: string
  name: string
  description: string
  core_artists: string[]
  member_count: number
  avg_song_rating: number
  personality_tags: string[]
  image_url: string | null
}

// Shape the frontend expects (CircleData in CircleCard.tsx)
interface Circle {
  id: string
  name: string
  description: string
  core_artists: string[]
  member_count: number
  avg_rating: number
  personality_types: string[]
  cover_image_url: string | null
  slug: string
}

interface CircleMembershipRow {
  circle_id: string
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function mapRow(row: CircleRow): Circle {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    core_artists: row.core_artists ?? [],
    member_count: row.member_count ?? 0,
    avg_rating: row.avg_song_rating ?? 0,
    personality_types: row.personality_tags ?? [],
    cover_image_url: row.image_url ?? null,
    slug: toSlug(row.name),
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const personalityTypesParam = searchParams.get('personality_types')

  const personalityTypes = personalityTypesParam
    ? personalityTypesParam.split(',').filter(Boolean)
    : []

  try {
    const supabase = createClient()

    // Query using the actual column names from migration 001
    let query = supabase
      .from('circles')
      .select('id, name, description, core_artists, member_count, avg_song_rating, personality_tags, image_url')
      .order('member_count', { ascending: false })
      .limit(10)

    if (personalityTypes.length > 0) {
      query = query.overlaps('personality_tags', personalityTypes)
    }

    const { data, error } = await query

    if (error) {
      console.error('Circles DB error:', error.code, error.message)
      return NextResponse.json({ circles: [] }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ circles: [] })
    }

    const circles = (data as CircleRow[]).map(mapRow)
    const circleIds = circles.map((circle) => circle.id)

    const { data: memberships, error: membershipsError } = await supabase
      .from('circle_members')
      .select('circle_id')
      .in('circle_id', circleIds)
      .eq('status', 'active')

    if (membershipsError) {
      console.error('Circle membership count error:', membershipsError.code, membershipsError.message)
      return NextResponse.json({ circles })
    }

    const memberCountByCircle = ((memberships ?? []) as CircleMembershipRow[]).reduce<Record<string, number>>((acc, row) => {
      acc[row.circle_id] = (acc[row.circle_id] ?? 0) + 1
      return acc
      }, {})

    const circlesWithExactMembers = circles.map((circle) => ({
      ...circle,
      member_count: memberCountByCircle[circle.id] ?? 0,
    }))

    return NextResponse.json({ circles: circlesWithExactMembers })
  } catch (err) {
    console.error('Circles fetch error:', err)
    return NextResponse.json({ circles: [] }, { status: 500 })
  }
}
