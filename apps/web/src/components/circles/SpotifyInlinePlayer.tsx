'use client'

import { useState } from 'react'
import { Play, X } from 'lucide-react'

// Renders an Apple Music embed for a song URL like:
//   https://music.apple.com/us/album/title/albumId?i=songId
// The embed is produced by replacing the hostname with embed.music.apple.com.

export default function SpotifyInlinePlayer({ url }: { url: string }) {
  const [open, setOpen] = useState(false)

  let embedUrl: string
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('music.apple.com')) return null
    parsed.hostname = 'embed.music.apple.com'
    embedUrl = parsed.toString()
  } catch {
    return null
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 transition-colors"
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
            title="Apple Music player"
            src={embedUrl}
            width="100%"
            height="175"
            frameBorder="0"
            allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
            sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
            className="rounded-xl overflow-hidden"
          />
        </div>
      )}
    </div>
  )
}
