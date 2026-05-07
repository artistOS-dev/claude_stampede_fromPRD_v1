'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Search, Users, Music, Plus, ChevronRight, MapPin, Tag } from 'lucide-react'

interface MyStable {
  id: string
  artist_name: string
  slug: string
  is_published: boolean
}

interface StableCard {
  id: string
  artist_name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  genres: string[] | null
  location: string | null
  follower_count: number
  song_count: number
}

function CreateStableForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [bio, setBio]         = useState('')
  const [location, setLoc]    = useState('')
  const [genres, setGenres]   = useState('')
  const [submitting, setSub]  = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Artist name is required'); return }
    setSub(true)
    try {
      const res = await fetch('/api/stables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: name.trim(),
          bio: bio.trim() || null,
          location: location.trim() || null,
          genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
        }),
      })
      const json: { stable?: { slug: string }; error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create stable')
      onCreated(json.stable!.slug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stable')
    } finally { setSub(false) }
  }, [name, bio, location, genres, onCreated])

  return (
    <div className="border border-stone-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-stone-950 text-left"
      >
        <Plus className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">Create Your Stable</span>
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-stone-900/50">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Artist Name *</p>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your artist name"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Bio</p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              placeholder="Tell fans about your music..."
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Location</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLoc(e.target.value)}
                placeholder="Nashville, TN"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Genres (comma-separated)</p>
              <input
                type="text"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder="Country, Folk"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {submitting ? 'Creating…' : 'Create Stable'}
          </button>
        </form>
      )}
    </div>
  )
}

function StableListCard({ stable, onClick }: { stable: StableCard; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden hover:border-amber-700/60 transition-colors group"
    >
      {/* Banner placeholder */}
      <div className="h-16 bg-gradient-to-r from-amber-900/40 via-stone-800 to-stone-900 relative">
        {stable.avatar_url && (
          <img
            src={stable.avatar_url}
            alt={stable.artist_name}
            className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-full border-2 border-stone-900 object-cover"
          />
        )}
        {!stable.avatar_url && (
          <div className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-full border-2 border-stone-900 bg-amber-900/50 flex items-center justify-center">
            <span className="text-lg font-bold text-amber-200">{stable.artist_name[0].toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="pt-8 px-4 pb-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-white group-hover:text-amber-300 transition-colors">{stable.artist_name}</h3>
            {stable.location && (
              <p className="flex items-center gap-1 text-xs text-stone-500 mt-0.5">
                <MapPin className="w-3 h-3" />{stable.location}
              </p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-amber-400 transition-colors shrink-0 mt-0.5" />
        </div>

        {stable.bio && (
          <p className="text-xs text-stone-400 line-clamp-2">{stable.bio}</p>
        )}

        {stable.genres && stable.genres.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="w-3 h-3 text-stone-600" />
            {stable.genres.slice(0, 3).map((g) => (
              <span key={g} className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded-full">{g}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-1">
          <span className="flex items-center gap-1 text-xs text-stone-500">
            <Users className="w-3.5 h-3.5" />
            {stable.follower_count} follower{stable.follower_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1 text-xs text-stone-500">
            <Music className="w-3.5 h-3.5" />
            {stable.song_count} song{stable.song_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </button>
  )
}

export default function StablesPage() {
  const router = useRouter()
  const [stables, setStables]     = useState<StableCard[]>([])
  const [myStable, setMyStable]   = useState<MyStable | null>(null)
  const [isLoading, setLoading]   = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [q, setQ]                 = useState('')
  const [isManager, setIsManager] = useState(false)

  const load = useCallback(async (query = '') => {
    try {
      const res = await fetch(`/api/stables${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      if (!res.ok) throw new Error('Failed to load')
      const json: { stables: StableCard[]; my_stable: MyStable | null } = await res.json()
      setStables(json.stables ?? [])
      setMyStable(json.my_stable ?? null)
    } catch {
      setError('Could not load stables. Please refresh.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    // Check if user is an artist_manager
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle().then(({ data }) => {
          setIsManager(data?.role === 'artist_manager')
        })
      })
    })
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 p-6 border border-amber-800/40 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <Home className="w-7 h-7 text-amber-300" />
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-amber-100">Stables</h1>
        </div>
        <p className="text-amber-200/70 text-sm">Artist hubs — follow your favorites, rate their songs, shop merch.</p>
      </div>

      {/* My stable quick-access or create form */}
      {isManager && myStable && (
        <button
          type="button"
          onClick={() => router.push(`/stables/${myStable.slug}`)}
          className="w-full flex items-center justify-between px-4 py-3 bg-amber-950/30 border border-amber-800/50 rounded-xl hover:bg-amber-950/50 transition-colors text-left"
        >
          <div>
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide">Your Stable</p>
            <p className="text-sm font-bold text-white">{myStable.artist_name}</p>
            {!myStable.is_published && (
              <p className="text-xs text-stone-500 mt-0.5">Draft — not visible to fans yet</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </button>
      )}
      {isManager && !myStable && !isLoading && (
        <CreateStableForm onCreated={(slug) => router.push(`/stables/${slug}`)} />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
        <input
          type="text"
          placeholder="Search artists…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-700 bg-stone-900 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {!isLoading && !error && stables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Home className="w-12 h-12 text-stone-700 mb-3" />
          <p className="text-stone-500 font-medium">No stables yet</p>
          <p className="text-stone-600 text-sm mt-1">Artist managers can create their stable to get started</p>
        </div>
      )}

      {!isLoading && stables.length > 0 && (
        <div className="space-y-3">
          {stables.map((s) => (
            <StableListCard key={s.id} stable={s} onClick={() => router.push(`/stables/${s.slug}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
