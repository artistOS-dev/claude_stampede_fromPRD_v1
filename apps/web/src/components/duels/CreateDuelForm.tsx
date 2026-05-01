'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

interface SongResult {
  id: string
  title: string
  artist: string
  album: string | null
  circles: { name: string } | null
}

function SongPicker({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: SongResult | null
  onSelect: (s: SongResult | null) => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SongResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}&limit=8`)
        if (!res.ok) return
        const json: { songs: SongResult[] } = await res.json()
        setResults(json.songs ?? [])
        setOpen(true)
      } finally { setLoading(false) }
    }, 300)
  }, [])

  const pick = (s: SongResult) => {
    onSelect(s)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{label}</p>
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-950/20 border border-amber-700">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{selected.title}</p>
            <p className="text-xs text-stone-500 truncate">{selected.artist}{selected.circles ? ` · ${selected.circles.name}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 text-stone-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder="Search songs…"
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          )}
          {open && results.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-xl overflow-hidden">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={() => pick(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-amber-950/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-white truncate">{s.title}</p>
                    <p className="text-xs text-stone-500 truncate">{s.artist}{s.circles ? ` · ${s.circles.name}` : ''}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function CreateDuelForm({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen]           = useState(false)
  const [songLeft, setSongLeft]   = useState<SongResult | null>(null)
  const [songRight, setSongRight] = useState<SongResult | null>(null)
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [endDate, setEndDate]     = useState('')
  const [status, setStatus]       = useState<'draft' | 'active'>('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  const minDate = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!songLeft || !songRight) { setError('Select both songs'); return }
    if (songLeft.id === songRight.id) { setError('Songs must differ'); return }
    if (!endDate || new Date(endDate).getTime() <= Date.now()) {
      setError('End date must be in the future'); return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || `${songLeft.title} vs ${songRight.title}`,
          description: description.trim() || null,
          song_left_id: songLeft.id,
          song_right_id: songRight.id,
          end_date: new Date(endDate).toISOString(),
          status,
        }),
      })
      const json: { error?: string } = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create duel')
      setSuccess(true)
      setSongLeft(null); setSongRight(null)
      setTitle(''); setDesc(''); setEndDate('')
      setStatus('active')
      setTimeout(() => setSuccess(false), 3000)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create duel')
    } finally { setSubmitting(false) }
  }, [songLeft, songRight, title, description, endDate, status, onCreated])

  return (
    <div className="border border-stone-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-stone-950 text-left"
      >
        <span className="text-sm font-semibold text-amber-300">+ Start a New Duel</span>
        <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="p-4 space-y-4 bg-stone-900/50">
          <SongPicker label="Left Song" selected={songLeft} onSelect={setSongLeft} />
          <SongPicker label="Right Song" selected={songRight} onSelect={setSongRight} />

          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Title (optional)</p>
            <input
              type="text"
              placeholder={songLeft && songRight ? `${songLeft.title} vs ${songRight.title}` : 'Auto-generated from song names'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Description (optional)</p>
            <textarea
              placeholder="Add context for voters…"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm placeholder:text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Voting ends</p>
              <input
                type="datetime-local"
                required
                min={minDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Publish as</p>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="active">Active (notify users)</option>
                <option value="draft">Draft (hidden)</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-400 bg-green-950/30 border border-green-800 rounded-lg px-3 py-2">Duel created!</p>
          )}

          <button
            type="submit"
            disabled={submitting || !songLeft || !songRight || !endDate}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            {submitting ? 'Creating…' : 'Create Duel'}
          </button>
        </form>
      )}
    </div>
  )
}
