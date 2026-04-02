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

const MOCK_CIRCLES: Circle[] = [
  {
    id: 'mock-1',
    name: 'Morgan Wallen Nation',
    description: 'The largest Morgan Wallen fan community. Share your love for his music, news, and tour dates.',
    core_artists: ['Morgan Wallen'],
    member_count: 24831,
    avg_rating: 4.8,
    personality_types: ['superfan', 'loyalist', 'trailblazer'],
    cover_image_url: null,
    slug: 'morgan-wallen-nation',
  },
  {
    id: 'mock-2',
    name: 'New Country Discoveries',
    description: 'A community for fans who love unearthing new country talent before they break big.',
    core_artists: ['Zach Bryan', 'Tyler Childers', 'Cody Johnson'],
    member_count: 8472,
    avg_rating: 4.7,
    personality_types: ['trailblazer', 'explorer', 'storyteller'],
    cover_image_url: null,
    slug: 'new-country-discoveries',
  },
  {
    id: 'mock-3',
    name: 'Classic Country Corner',
    description: 'Honoring the legends: Merle Haggard, Loretta Lynn, Johnny Cash and the roots of country music.',
    core_artists: ['Johnny Cash', 'Merle Haggard', 'Loretta Lynn', 'Waylon Jennings'],
    member_count: 15603,
    avg_rating: 4.9,
    personality_types: ['traditionalist', 'loyalist', 'storyteller'],
    cover_image_url: null,
    slug: 'classic-country-corner',
  },
  {
    id: 'mock-4',
    name: 'Country Road Trippers',
    description: 'For fans whose best country moments happen on a long drive with the windows down.',
    core_artists: ['Chris Stapleton', 'Luke Combs', 'Kacey Musgraves'],
    member_count: 6218,
    avg_rating: 4.6,
    personality_types: ['melodist', 'explorer', 'community'],
    cover_image_url: null,
    slug: 'country-road-trippers',
  },
  {
    id: 'mock-5',
    name: 'Songwriters Circle',
    description: 'Celebrate the craft of country songwriting — the stories, the poetry, the truth behind the music.',
    core_artists: ['Kacey Musgraves', 'Tyler Childers', 'Brandi Carlile'],
    member_count: 4891,
    avg_rating: 4.8,
    personality_types: ['storyteller', 'melodist', 'trailblazer'],
    cover_image_url: null,
    slug: 'songwriters-circle',
  },
]

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
      return NextResponse.json({ circles: filterMockCircles(MOCK_CIRCLES, personalityTypes) })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ circles: filterMockCircles(MOCK_CIRCLES, personalityTypes) })
    }

    return NextResponse.json({ circles: (data as CircleRow[]).map(mapRow) })
  } catch (err) {
    console.error('Circles fetch error:', err)
    return NextResponse.json({ circles: filterMockCircles(MOCK_CIRCLES, personalityTypes) })
  }
}

function filterMockCircles(circles: Circle[], personalityTypes: string[]): Circle[] {
  if (personalityTypes.length === 0) return circles
  const withOverlap = circles.filter((c) =>
    c.personality_types.some((pt) => personalityTypes.includes(pt))
  )
  return withOverlap.length >= 2 ? withOverlap : circles.slice(0, 4)
}
