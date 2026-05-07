'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Users, Music, ShoppingBag, FileText, Info,
  Star, Trash2, Plus, ExternalLink, MapPin, Tag, Radio,
  Instagram, Youtube, Globe, Edit2, CheckCircle2, X,
  Search, Package, Swords,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Stable {
  id: string
  artist_name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  genres: string[] | null
  location: string | null
  instagram_url: string | null
  twitter_url: string | null
  tiktok_url: string | null
  spotify_url: string | null
  apple_music_url: string | null
  youtube_url: string | null
  website_url: string | null
  next_concert_at: string | null
  concert_stream_url: string | null
  is_published: boolean
  created_at: string
}

interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  release_year: number | null
  cover_url: string | null
  spotify_url: string | null
  avg_rating: number | null
  rating_count: number
  my_rating: number | null
}

interface Post {
  id: string
  content: string
  media_url: string | null
  media_type: 'image' | 'video' | null
  created_at: string
}

interface MerchItem {
  id: string
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  category: string
  sizes: string[] | null
  is_available: boolean
}

interface CircuitEntry {
  participant_id: string
  song_uses: number
  circuit: { id: string; name: string; status: string; created_at: string } | null
}

interface StableDetail {
  stable: Stable
  is_manager: boolean
  follower_count: number
  is_following: boolean
  songs: Song[]
  posts: Post[]
  merch: MerchItem[]
  circuit_history: CircuitEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StarRating({
  rating, myRating, count, onRate, disabled,
}: {
  rating: number | null
  myRating: number | null
  count: number
  onRate?: (r: number) => void
  disabled?: boolean
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onRate?.(n)}
          onMouseEnter={() => !disabled && setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="disabled:cursor-default"
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              n <= (hover || myRating || 0)
                ? 'text-amber-400 fill-amber-400'
                : 'text-stone-600'
            }`}
          />
        </button>
      ))}
      {rating !== null && (
        <span className="text-xs text-stone-500 ml-1">
          {rating.toFixed(1)} ({count})
        </span>
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// ── Add Song Modal ────────────────────────────────────────────────────────────

function AddSongModal({ slug, onAdded, onClose }: { slug: string; onAdded: (song: Song) => void; onClose: () => void }) {
  const [title, setTitle]   = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum]   = useState('')
  const [year, setYear]     = useState('')
  const [spotify, setSpotify] = useState('')
  const [submitting, setSub] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSub(true)
    try {
      const res = await fetch(`/api/stables/${slug}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          album: album.trim() || null,
          release_year: year ? Number(year) : null,
          spotify_url: spotify.trim() || null,
        }),
      })
      const json: { song?: Song; error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      onAdded(json.song!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add song')
    } finally { setSub(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <h3 className="font-bold text-white">Add Song to Catalog</h3>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {[
            { label: 'Title *', value: title, set: setTitle, placeholder: 'Song title', required: true },
            { label: 'Artist *', value: artist, set: setArtist, placeholder: 'Artist name', required: true },
            { label: 'Album', value: album, set: setAlbum, placeholder: 'Album name', required: false },
            { label: 'Release Year', value: year, set: setYear, placeholder: '2024', required: false },
            { label: 'Spotify URL', value: spotify, set: setSpotify, placeholder: 'https://open.spotify.com/…', required: false },
          ].map(({ label, value, set, placeholder, required }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">{label}</p>
              <input
                type="text"
                required={required}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !title.trim() || !artist.trim()}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {submitting ? 'Adding…' : 'Add Song'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Add Merch Modal ───────────────────────────────────────────────────────────

const CATEGORIES = ['t-shirt', 'hoodie', 'poster', 'vinyl', 'hat', 'accessory', 'other'] as const

function AddMerchModal({ slug, onAdded, onClose }: { slug: string; onAdded: (item: MerchItem) => void; onClose: () => void }) {
  const [name, setName]       = useState('')
  const [desc, setDesc]       = useState('')
  const [price, setPrice]     = useState('')
  const [category, setCategory] = useState<string>('other')
  const [imageUrl, setImage]  = useState('')
  const [sizes, setSizes]     = useState('')
  const [submitting, setSub]  = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const price_cents = Math.round(parseFloat(price) * 100)
    if (isNaN(price_cents) || price_cents <= 0) { setError('Enter a valid price'); return }
    setSub(true)
    try {
      const res = await fetch(`/api/stables/${slug}/merch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || null,
          price_cents,
          category,
          image_url: imageUrl.trim() || null,
          sizes: sizes ? sizes.split(',').map((s) => s.trim()).filter(Boolean) : null,
        }),
      })
      const json: { item?: MerchItem; error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      onAdded(json.item!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    } finally { setSub(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <h3 className="font-bold text-white">Add Merch Item</h3>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Name *</p>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Classic Tee" className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Description</p>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              placeholder="100% cotton, printed in Nashville"
              className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Price (USD) *</p>
              <input type="number" required min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="29.99" className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Category</p>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Sizes (comma-separated)</p>
            <input type="text" value={sizes} onChange={(e) => setSizes(e.target.value)}
              placeholder="S, M, L, XL" className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Image URL</p>
            <input type="url" value={imageUrl} onChange={(e) => setImage(e.target.value)}
              placeholder="https://…" className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={submitting || !name.trim() || !price}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            {submitting ? 'Adding…' : 'Add Item'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Edit Stable Modal ─────────────────────────────────────────────────────────

function EditStableModal({ stable, onSaved, onClose }: { stable: Stable; onSaved: (s: Stable) => void; onClose: () => void }) {
  const [bio, setBio]         = useState(stable.bio ?? '')
  const [location, setLoc]    = useState(stable.location ?? '')
  const [genres, setGenres]   = useState((stable.genres ?? []).join(', '))
  const [instagram, setIG]    = useState(stable.instagram_url ?? '')
  const [twitter, setTW]      = useState(stable.twitter_url ?? '')
  const [tiktok, setTT]       = useState(stable.tiktok_url ?? '')
  const [spotify, setSp]      = useState(stable.spotify_url ?? '')
  const [youtube, setYT]      = useState(stable.youtube_url ?? '')
  const [website, setWS]      = useState(stable.website_url ?? '')
  const [concert, setConcert] = useState(stable.next_concert_at ? new Date(stable.next_concert_at).toISOString().slice(0, 16) : '')
  const [streamUrl, setStream] = useState(stable.concert_stream_url ?? '')
  const [published, setPublished] = useState(stable.is_published)
  const [submitting, setSub]  = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSub(true)
    try {
      const res = await fetch(`/api/stables/${stable.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: bio.trim() || null,
          location: location.trim() || null,
          genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
          instagram_url: instagram.trim() || null,
          twitter_url: twitter.trim() || null,
          tiktok_url: tiktok.trim() || null,
          spotify_url: spotify.trim() || null,
          youtube_url: youtube.trim() || null,
          website_url: website.trim() || null,
          next_concert_at: concert ? new Date(concert).toISOString() : null,
          concert_stream_url: streamUrl.trim() || null,
          is_published: published,
        }),
      })
      const json: { stable?: Stable; error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      onSaved(json.stable!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSub(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <h3 className="font-bold text-white">Edit Stable</h3>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Bio</p>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="Tell fans about your music…"
              className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Location</p>
              <input type="text" value={location} onChange={(e) => setLoc(e.target.value)} placeholder="Nashville, TN"
                className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Genres</p>
              <input type="text" value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Country, Folk"
                className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>

          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Social Links</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Instagram', val: instagram, set: setIG },
              { label: 'Twitter / X', val: twitter, set: setTW },
              { label: 'TikTok', val: tiktok, set: setTT },
              { label: 'Spotify', val: spotify, set: setSp },
              { label: 'YouTube', val: youtube, set: setYT },
              { label: 'Website', val: website, set: setWS },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <p className="text-xs text-stone-500 mb-1">{label}</p>
                <input type="url" value={val} onChange={(e) => set(e.target.value)} placeholder="https://…"
                  className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Virtual Concert</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-stone-500 mb-1">Next Concert Date</p>
              <input type="datetime-local" value={concert} onChange={(e) => setConcert(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">Stream URL</p>
              <input type="url" value={streamUrl} onChange={(e) => setStream(e.target.value)} placeholder="https://…"
                className="w-full px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-white">Published (visible to fans)</span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Create Post Form ──────────────────────────────────────────────────────────

function CreatePostForm({ slug, onCreated }: { slug: string; onCreated: (post: Post) => void }) {
  const [content, setContent] = useState('')
  const [mediaUrl, setMedia]  = useState('')
  const [mediaType, setMType] = useState<'image' | 'video'>('image')
  const [submitting, setSub]  = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSub(true)
    try {
      const res = await fetch(`/api/stables/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          media_url: mediaUrl.trim() || null,
          media_type: mediaUrl.trim() ? mediaType : null,
        }),
      })
      const json: { post?: Post; error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      onCreated(json.post!)
      setContent('')
      setMedia('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally { setSub(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-800/50 border border-stone-700 rounded-xl p-4 space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Share an update with your fans…"
        className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={mediaUrl}
          onChange={(e) => setMedia(e.target.value)}
          placeholder="Media URL (optional)"
          className="flex-1 px-3 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {mediaUrl && (
          <select value={mediaType} onChange={(e) => setMType(e.target.value as 'image' | 'video')}
            className="px-2 py-2 rounded-lg border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-600">{content.length}/1000</span>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={submitting || !content.trim()}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'about' | 'songs' | 'posts' | 'merch' | 'circuits'

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StableDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [data, setData]         = useState<StableDetail | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tab, setTab]           = useState<Tab>('about')
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)

  // Modals
  const [showAddSong, setShowAddSong]   = useState(false)
  const [showAddMerch, setShowAddMerch] = useState(false)
  const [showEdit, setShowEdit]         = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stables/${slug}`)
      if (res.status === 404) { setError('Stable not found'); setLoading(false); return }
      if (!res.ok) throw new Error('Failed to load')
      const json: StableDetail = await res.json()
      setData(json)
      setFollowing(json.is_following)
      setFollowerCount(json.follower_count)
    } catch {
      setError('Could not load stable. Please refresh.')
    } finally { setLoading(false) }
  }, [slug])

  useEffect(() => { load() }, [load])

  const handleFollow = async () => {
    if (!data) return
    setFollowLoading(true)
    try {
      const res = await fetch(`/api/stables/${slug}/follow`, { method: 'POST' })
      const json: { following: boolean } = await res.json()
      if (res.ok) {
        setFollowing(json.following)
        setFollowerCount((c) => json.following ? c + 1 : c - 1)
      }
    } finally { setFollowLoading(false) }
  }

  const handleRate = async (songId: string, rating: number) => {
    if (!data) return
    await fetch(`/api/stables/${slug}/songs/${songId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    })
    setData((d) => d ? {
      ...d,
      songs: d.songs.map((s) => s.id === songId ? { ...s, my_rating: rating } : s),
    } : d)
  }

  const handleDeleteSong = async (songId: string) => {
    if (!confirm('Remove this song from your catalog?')) return
    await fetch(`/api/stables/${slug}/songs/${songId}`, { method: 'DELETE' })
    setData((d) => d ? { ...d, songs: d.songs.filter((s) => s.id !== songId) } : d)
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/stables/${slug}/posts/${postId}`, { method: 'DELETE' })
    setData((d) => d ? { ...d, posts: d.posts.filter((p) => p.id !== postId) } : d)
  }

  const handleToggleMerch = async (item: MerchItem) => {
    const res = await fetch(`/api/stables/${slug}/merch/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: !item.is_available }),
    })
    const json: { item?: MerchItem } = await res.json()
    if (res.ok && json.item) {
      setData((d) => d ? { ...d, merch: d.merch.map((m) => m.id === item.id ? json.item! : m) } : d)
    }
  }

  const handleDeleteMerch = async (itemId: string) => {
    if (!confirm('Remove this merch item?')) return
    await fetch(`/api/stables/${slug}/merch/${itemId}`, { method: 'DELETE' })
    setData((d) => d ? { ...d, merch: d.merch.filter((m) => m.id !== itemId) } : d)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-red-400 text-center">
          {error ?? 'Stable not found'}
        </div>
      </div>
    )
  }

  const { stable, is_manager, songs, posts, merch, circuit_history } = data

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'about',    label: 'About',    icon: <Info className="w-4 h-4" /> },
    { id: 'songs',    label: 'Songs',    icon: <Music className="w-4 h-4" />, count: songs.length },
    { id: 'posts',    label: 'Posts',    icon: <FileText className="w-4 h-4" />, count: posts.length },
    { id: 'merch',    label: 'Merch',    icon: <ShoppingBag className="w-4 h-4" />, count: merch.filter((m) => m.is_available).length },
    { id: 'circuits', label: 'Circuits', icon: <Swords className="w-4 h-4" />, count: circuit_history.length },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-0">
      {/* Back + edit row */}
      <div className="flex items-center justify-between pb-2">
        <button onClick={() => router.push('/stables')} className="flex items-center gap-1.5 text-stone-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Stables
        </button>
        <div className="flex items-center gap-2">
          {!stable.is_published && <span className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded-full">Draft</span>}
          {is_manager && (
            <button type="button" onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/30 px-3 py-1.5 rounded-lg transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 bg-gradient-to-br from-amber-900/50 via-stone-800 to-stone-900">
        {stable.banner_url && (
          <img src={stable.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        {/* Avatar */}
        <div className="absolute bottom-0 left-5 translate-y-1/2">
          {stable.avatar_url ? (
            <img src={stable.avatar_url} alt={stable.artist_name}
              className="w-20 h-20 rounded-full border-4 border-stone-950 object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-stone-950 bg-amber-900/60 flex items-center justify-center">
              <span className="text-3xl font-bold text-amber-200">{stable.artist_name[0].toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Profile header */}
      <div className="pt-14 px-1 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white font-display">{stable.artist_name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {stable.location && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="w-3 h-3" />{stable.location}
                </span>
              )}
              {stable.genres && stable.genres.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Tag className="w-3 h-3" />{stable.genres.join(', ')}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-stone-500">
                <Users className="w-3 h-3" />{followerCount} follower{followerCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {!is_manager && (
            <button
              type="button"
              onClick={handleFollow}
              disabled={followLoading}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                following
                  ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  : 'bg-amber-600 text-white hover:bg-amber-500'
              }`}
            >
              {following ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Next concert */}
        {stable.next_concert_at && (
          <div className="mt-3 flex items-center gap-2 bg-amber-950/20 border border-amber-800/40 rounded-xl px-3 py-2">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <div>
              <p className="text-xs font-semibold text-amber-300">
                Virtual Concert — {new Date(stable.next_concert_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {stable.concert_stream_url && (
                <a href={stable.concert_stream_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                  Watch stream <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-stone-800">
        {TABS.map(({ id, label, icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === id
                ? 'text-amber-400 bg-amber-950/30'
                : 'text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            {icon}{label}
            {count !== undefined && count > 0 && (
              <span className="ml-0.5 text-xs bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded-full">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-4 space-y-4">

        {/* ── About ── */}
        {tab === 'about' && (
          <div className="space-y-4">
            {stable.bio && (
              <div className="bg-stone-900 border border-stone-700 rounded-xl p-4">
                <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-line">{stable.bio}</p>
              </div>
            )}
            {!stable.bio && !is_manager && (
              <p className="text-sm text-stone-600 text-center py-6">No bio yet.</p>
            )}
            {!stable.bio && is_manager && (
              <div className="text-center py-6">
                <p className="text-sm text-stone-600 mb-2">Add a bio to tell fans about your music.</p>
                <button onClick={() => setShowEdit(true)} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
                  Edit Stable →
                </button>
              </div>
            )}

            {/* Social links */}
            {(stable.instagram_url || stable.twitter_url || stable.tiktok_url ||
              stable.spotify_url || stable.youtube_url || stable.website_url) && (
              <div className="bg-stone-900 border border-stone-700 rounded-xl p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Find Us</p>
                <div className="flex flex-wrap gap-2">
                  {stable.instagram_url && (
                    <a href={stable.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-stone-300 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors">
                      <Instagram className="w-3.5 h-3.5" /> Instagram
                    </a>
                  )}
                  {stable.twitter_url && (
                    <a href={stable.twitter_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-stone-300 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Twitter / X
                    </a>
                  )}
                  {stable.tiktok_url && (
                    <a href={stable.tiktok_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-stone-300 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> TikTok
                    </a>
                  )}
                  {stable.spotify_url && (
                    <a href={stable.spotify_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-stone-300 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors">
                      <Music className="w-3.5 h-3.5" /> Spotify
                    </a>
                  )}
                  {stable.youtube_url && (
                    <a href={stable.youtube_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-stone-300 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors">
                      <Youtube className="w-3.5 h-3.5" /> YouTube
                    </a>
                  )}
                  {stable.website_url && (
                    <a href={stable.website_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-stone-300 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors">
                      <Globe className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs text-stone-700 text-center">
              Joined {new Date(stable.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        )}

        {/* ── Songs ── */}
        {tab === 'songs' && (
          <div className="space-y-3">
            {is_manager && (
              <button type="button" onClick={() => setShowAddSong(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 border border-dashed border-stone-700 rounded-xl text-sm text-stone-400 hover:text-amber-400 hover:border-amber-700 transition-colors">
                <Plus className="w-4 h-4" /> Add Song to Catalog
              </button>
            )}
            {songs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="w-10 h-10 text-stone-700 mb-2" />
                <p className="text-stone-500 text-sm">No songs in catalog yet</p>
              </div>
            )}
            {songs.map((song) => (
              <div key={song.id} className="flex items-center gap-3 bg-stone-900 border border-stone-800 rounded-xl p-3 group">
                {song.cover_url ? (
                  <img src={song.cover_url} alt={song.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5 text-stone-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                  <p className="text-xs text-stone-500 truncate">
                    {song.artist}{song.album ? ` · ${song.album}` : ''}{song.release_year ? ` (${song.release_year})` : ''}
                  </p>
                  <div className="mt-1">
                    <StarRating
                      rating={song.avg_rating}
                      myRating={song.my_rating}
                      count={song.rating_count}
                      onRate={!is_manager ? (r) => handleRate(song.id, r) : undefined}
                      disabled={is_manager}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {song.spotify_url && (
                    <a href={song.spotify_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-stone-600 hover:text-green-400 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {is_manager && (
                    <button type="button" onClick={() => handleDeleteSong(song.id)}
                      className="p-1.5 text-stone-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Posts ── */}
        {tab === 'posts' && (
          <div className="space-y-4">
            {is_manager && (
              <CreatePostForm slug={slug} onCreated={(post) => setData((d) => d ? { ...d, posts: [post, ...d.posts] } : d)} />
            )}
            {posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-10 h-10 text-stone-700 mb-2" />
                <p className="text-stone-500 text-sm">No posts yet</p>
              </div>
            )}
            {posts.map((post) => (
              <div key={post.id} className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3 group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-stone-200 leading-relaxed whitespace-pre-line flex-1">{post.content}</p>
                  {is_manager && (
                    <button type="button" onClick={() => handleDeletePost(post.id)}
                      className="shrink-0 p-1 text-stone-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {post.media_url && post.media_type === 'image' && (
                  <img src={post.media_url} alt="" className="w-full rounded-lg object-cover max-h-64" />
                )}
                {post.media_url && post.media_type === 'video' && (
                  <video src={post.media_url} controls className="w-full rounded-lg max-h-64" />
                )}
                <p className="text-xs text-stone-600">{timeAgo(post.created_at)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Merch ── */}
        {tab === 'merch' && (
          <div className="space-y-3">
            {is_manager && (
              <button type="button" onClick={() => setShowAddMerch(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 border border-dashed border-stone-700 rounded-xl text-sm text-stone-400 hover:text-amber-400 hover:border-amber-700 transition-colors">
                <Plus className="w-4 h-4" /> Add Merch Item
              </button>
            )}
            {merch.filter((m) => is_manager || m.is_available).length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-10 h-10 text-stone-700 mb-2" />
                <p className="text-stone-500 text-sm">No merch available</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {merch.filter((m) => is_manager || m.is_available).map((item) => (
                <div key={item.id} className={`bg-stone-900 border rounded-xl overflow-hidden group ${
                  item.is_available ? 'border-stone-800' : 'border-stone-800 opacity-60'
                }`}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-stone-800 flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-stone-600" />
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-stone-500 capitalize">{item.category}</p>
                    {item.sizes && item.sizes.length > 0 && (
                      <p className="text-xs text-stone-600">{item.sizes.join(' · ')}</p>
                    )}
                    <p className="text-sm font-bold text-amber-400">${(item.price_cents / 100).toFixed(2)}</p>
                    {!item.is_available && <p className="text-xs text-stone-600">Unavailable</p>}
                    {is_manager && (
                      <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handleToggleMerch(item)}
                          className="text-xs text-stone-400 hover:text-amber-400 transition-colors">
                          {item.is_available ? 'Mark unavailable' : 'Mark available'}
                        </button>
                        <span className="text-stone-700">·</span>
                        <button type="button" onClick={() => handleDeleteMerch(item.id)}
                          className="text-xs text-stone-400 hover:text-red-400 transition-colors">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Circuits ── */}
        {tab === 'circuits' && (
          <div className="space-y-3">
            {circuit_history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Swords className="w-10 h-10 text-stone-700 mb-2" />
                <p className="text-stone-500 text-sm">Not participating in any circuits yet</p>
                {is_manager && (
                  <a href="/circuits" className="text-sm text-amber-400 hover:text-amber-300 mt-2 transition-colors">
                    Browse circuits →
                  </a>
                )}
              </div>
            )}
            {circuit_history.map((entry) => entry.circuit && (
              <a
                key={entry.participant_id}
                href={`/circuits/${entry.circuit.id}`}
                className="flex items-center gap-3 bg-stone-900 border border-stone-800 rounded-xl p-4 hover:border-amber-700/40 transition-colors group"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  entry.circuit.status === 'voting' ? 'bg-green-400 animate-pulse' :
                  entry.circuit.status === 'open' ? 'bg-amber-400' :
                  entry.circuit.status === 'completed' ? 'bg-stone-500' : 'bg-yellow-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                    {entry.circuit.name}
                  </p>
                  <p className="text-xs text-stone-500 capitalize">{entry.circuit.status} · {entry.song_uses ?? 0} song use{entry.song_uses !== 1 ? 's' : ''}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-stone-600 group-hover:text-amber-400 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        )}

      </div>

      {/* Modals */}
      {showAddSong && (
        <AddSongModal
          slug={slug}
          onAdded={(song) => { setData((d) => d ? { ...d, songs: [song, ...d.songs] } : d); setShowAddSong(false) }}
          onClose={() => setShowAddSong(false)}
        />
      )}
      {showAddMerch && (
        <AddMerchModal
          slug={slug}
          onAdded={(item) => { setData((d) => d ? { ...d, merch: [item, ...d.merch] } : d); setShowAddMerch(false) }}
          onClose={() => setShowAddMerch(false)}
        />
      )}
      {showEdit && data && (
        <EditStableModal
          stable={data.stable}
          onSaved={(s) => { setData((d) => d ? { ...d, stable: s } : d); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
