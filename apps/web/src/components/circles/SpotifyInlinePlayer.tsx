'use client'

import { useState } from 'react'
import { Play, X } from 'lucide-react'

export default function SpotifyInlinePlayer({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  const trackId = url.match(/track\/([A-Za-z0-9]+)/)?.[1]
  if (!trackId) return null

  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Play preview
        </button>
      ) : (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-400 transition-colors"
          >
            <X className="w-3 h-3" /> Close player
          </button>
          <iframe
            title="Spotify player"
            src={embedUrl}
            width="100%"
            height="152"
            frameBorder="0"
            // eslint-disable-next-line react/no-unknown-property
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            className="rounded-xl"
          />
        </div>
      )}
    </div>
  )
}
