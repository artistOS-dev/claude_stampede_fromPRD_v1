// Apple Music API helpers — server-side only (uses Node.js crypto).
// Requires three env vars:
//   APPLE_MUSIC_TEAM_ID   — 10-char Apple Developer Team ID
//   APPLE_MUSIC_KEY_ID    — Key ID from the MusicKit key in Apple Developer portal
//   APPLE_MUSIC_PRIVATE_KEY — Full PEM contents of the .p8 file, with literal \n for newlines

import { createSign } from 'crypto'

export interface AppleMusicArtistResult {
  id: string
  name: string
  image_url: string | null
  apple_music_url: string
  genres: string[]
}

export interface AppleMusicTrackResult {
  id: string
  title: string
  artist: string
  album: string
  cover_url: string | null
  apple_music_url: string
  preview_url: string | null
  duration_ms: number
}

export interface AppleMusicAlbumResult {
  id: string
  name: string
  artist: string
  cover_url: string | null
  apple_music_url: string
  total_tracks: number
  release_date: string
}

export interface AppleMusicAlbumWithTracks extends AppleMusicAlbumResult {
  tracks: AppleMusicTrackResult[]
}

let tokenCache: { token: string; expiresAt: number } | null = null

export function getAppleMusicToken(): string | null {
  const teamId     = process.env.APPLE_MUSIC_TEAM_ID
  const keyId      = process.env.APPLE_MUSIC_KEY_ID
  const rawKey     = process.env.APPLE_MUSIC_PRIVATE_KEY
  if (!teamId || !keyId || !rawKey) return null

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token

  try {
    const privateKey = rawKey.replace(/\\n/g, '\n')
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 15_777_000 // Apple's max ~6 months

    const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now, exp })).toString('base64url')
    const sigInput = `${header}.${payload}`

    const signer = createSign('SHA256')
    signer.update(sigInput)
    const sig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64url')

    const token = `${sigInput}.${sig}`
    tokenCache = { token, expiresAt: exp * 1000 }
    return token
  } catch {
    return null
  }
}

const STOREFRONT = 'us'
export const AM_BASE = `https://api.music.apple.com/v1/catalog/${STOREFRONT}`

function artworkUrl(url: string | undefined, size = 600): string | null {
  if (!url) return null
  return url.replace('{w}', String(size)).replace('{h}', String(size))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAppleArtist(a: any): AppleMusicArtistResult {
  const attr = a.attributes ?? {}
  return {
    id:             a.id as string,
    name:           (attr.name as string) ?? '',
    image_url:      artworkUrl(attr.artwork?.url, 300),
    apple_music_url: (attr.url as string) ?? `https://music.apple.com/${STOREFRONT}/artist/${a.id}`,
    genres:         (attr.genreNames as string[]) ?? [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAppleTrack(t: any, albumName?: string, albumCoverUrl?: string | null): AppleMusicTrackResult {
  const attr = t.attributes ?? {}
  return {
    id:             t.id as string,
    title:          (attr.name as string) ?? '',
    artist:         (attr.artistName as string) ?? '',
    album:          albumName ?? (attr.albumName as string) ?? '',
    cover_url:      albumCoverUrl ?? artworkUrl(attr.artwork?.url, 600),
    apple_music_url: (attr.url as string) ?? '',
    preview_url:    (attr.previews as { url: string }[])?.[0]?.url ?? null,
    duration_ms:    (attr.durationInMillis as number) ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAppleAlbum(a: any): AppleMusicAlbumResult {
  const attr = a.attributes ?? {}
  return {
    id:             a.id as string,
    name:           (attr.name as string) ?? '',
    artist:         (attr.artistName as string) ?? '',
    cover_url:      artworkUrl(attr.artwork?.url, 600),
    apple_music_url: (attr.url as string) ?? `https://music.apple.com/${STOREFRONT}/album/${a.id}`,
    total_tracks:   (attr.trackCount as number) ?? 0,
    release_date:   (attr.releaseDate as string) ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAppleAlbumFull(a: any): AppleMusicAlbumWithTracks {
  const album    = mapAppleAlbum(a)
  const coverUrl = album.cover_url
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks: AppleMusicTrackResult[] = ((a.relationships?.tracks?.data ?? []) as any[]).map(
    (t) => mapAppleTrack(t, album.name, coverUrl),
  )
  return { ...album, tracks }
}
