import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { Music2, Users, Star, Headphones, ChevronRight } from 'lucide-react'

export default async function HomePage() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: memberships }, { data: songsShared }, { data: recentSongs }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('display_name, avatar_url, role, subscription_tier')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('circle_members')
        .select('circle_id, joined_at, circles(id, name, description, member_count)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false }),
      supabase
        .from('circle_songs')
        .select('id', { count: 'exact', head: true })
        .eq('shared_by', user.id),
      supabase
        .from('circle_songs')
        .select(`
          id, title, artist, avg_rating, rating_count, created_at,
          circles(id, name)
        `)
        .eq('shared_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberCircleIds = ((memberships ?? []) as any[])
    .map((m) => m.circle_id)
    .filter(Boolean) as string[]

  let memberCountByCircle: Record<string, number> = {}
  if (memberCircleIds.length > 0) {
    const { data: activeMemberships } = await supabase
      .from('circle_members')
      .select('circle_id')
      .in('circle_id', memberCircleIds)
      .eq('status', 'active')

    memberCountByCircle = ((activeMemberships ?? []) as Array<{ circle_id: string }>)
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.circle_id] = (acc[row.circle_id] ?? 0) + 1
        return acc
      }, {})
  }

  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'there'
  const avatarUrl = profile?.avatar_url ?? null
  const tier = profile?.subscription_tier ?? 'free'

  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myCircles = ((memberships ?? []) as any[])
    .map((m) => m.circles)
    .filter(Boolean)
    .map((circle) => ({
      ...circle,
      member_count: memberCountByCircle[circle.id] ?? circle.member_count ?? 0,
    })) as Array<{ id: string; name: string; description: string; member_count: number }>

  const songsCount = (songsShared as unknown as { count?: number } | null)?.count ?? 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myRecentSongs = ((recentSongs ?? []) as any[]) as Array<{
    id: string
    title: string
    artist: string
    avg_rating: number
    rating_count: number
    circles: { id: string; name: string } | null
  }>

  return (
    <div className="space-y-8">
      {/* Welcome hero */}
      <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover border-2 border-zinc-700/30"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full bg-zinc-900/20 flex items-center justify-center text-xl font-bold border-2 border-zinc-700/30"
                aria-label={`Avatar for ${displayName}`}
              >
                {initials}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Welcome to Stampede, {displayName}!</h1>
            <p className="text-pink-200 mt-1">
              {tier === 'superfan'
                ? 'Superfan member — you have full access'
                : tier === 'fan'
                ? 'Fan member — thanks for supporting Stampede'
                : 'Free member — the home of country music'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="/circles" className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-sm p-6 flex items-center gap-4 hover:border-pink-800 transition-colors">
          <div className="w-10 h-10 rounded-full bg-pink-900/30 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-pink-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Your circles</p>
            <p className="text-xl font-bold text-white">{myCircles.length}</p>
          </div>
        </a>

        <div className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-sm p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-pink-900/30 flex items-center justify-center flex-shrink-0">
            <Headphones className="w-5 h-5 text-pink-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Songs shared</p>
            <p className="text-xl font-bold text-white">{songsCount}</p>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-sm p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-pink-900/30 flex items-center justify-center flex-shrink-0">
            <Star className="w-5 h-5 text-pink-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Artists following</p>
            <p className="text-xl font-bold text-white">0</p>
          </div>
        </div>
      </div>

      {/* My Circles */}
      {myCircles.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">My Circles</h2>
            <a href="/circles" className="text-sm text-pink-400 hover:text-pink-300 font-medium">
              Browse more
            </a>
          </div>
          <div className="space-y-2">
            {myCircles.map((circle) => (
              <a
                key={circle.id}
                href={`/circles/${circle.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-pink-800 hover:bg-pink-950/20 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-4 h-4 text-pink-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-pink-400 transition-colors truncate">
                    {circle.name}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{circle.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-zinc-600">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{circle.member_count?.toLocaleString() ?? 0}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-pink-400 transition-colors" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recently shared songs */}
      {myRecentSongs.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-sm p-6">
          <h2 className="text-lg font-bold text-white mb-4">Songs I&apos;ve Shared</h2>
          <div className="space-y-3">
            {myRecentSongs.map((song) => (
              <div key={song.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-4 h-4 text-pink-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {song.artist}
                    {song.circles ? (
                      <> · <a href={`/circles/${song.circles.id}`} className="text-pink-400 hover:text-pink-400">{song.circles.name}</a></>
                    ) : null}
                  </p>
                </div>
                {song.avg_rating > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" aria-hidden="true" />
                    <span className="text-xs text-zinc-500">{song.avg_rating.toFixed(1)}</span>
                    <span className="text-xs text-zinc-600">({song.rating_count})</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Getting started / Explore */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-sm p-6">
        <h2 className="text-lg font-bold text-white mb-4">
          {myCircles.length === 0 ? 'Get started' : 'Explore more'}
        </h2>
        <div className="space-y-3">
          <a href="/circles" className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors group">
            <div className="w-9 h-9 rounded-full bg-pink-900/30 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-pink-400" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white group-hover:text-pink-400 transition-colors">Browse Circles</p>
              <p className="text-xs text-zinc-500">Find communities of fans who share your taste</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-pink-400 transition-colors" />
          </a>
        </div>
      </div>
    </div>
  )
}
