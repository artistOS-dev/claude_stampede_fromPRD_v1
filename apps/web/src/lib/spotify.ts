// Shared Spotify Client Credentials helpers.
// Module-level token cache survives across requests in the same server instance.

export interface SpotifyArtistResult {
  id: string
  name: string
  image_url: string | null
  spotify_url: string
  genres: string[]
  followers: number
  popularity: number
}

export interface SpotifyTrackResult {
  id: string
  title: string
  artist: string
  album: string
  cover_url: string | null
  spotify_url: string
  duration_ms: number
}

export interface SpotifyAlbumResult {
  id: string
  name: string
  artist: string
  cover_url: string | null
  spotify_url: string
  total_tracks: number
  release_date: string
}

export interface SpotifyAlbumWithTracks extends SpotifyAlbumResult {
  tracks: SpotifyTrackResult[]
}

let tokenCache: { token: string; expiresAt: number } | null = null

export async function getSpotifyToken(): Promise<string | null> {
  const clientId     = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json()
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return tokenCache.token
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSpotifyArtist(a: any): SpotifyArtistResult {
  return {
    id: a.id as string,
    name: a.name as string,
    image_url: (a.images?.[0]?.url as string) ?? null,
    spotify_url: (a.external_urls?.spotify as string) ?? `https://open.spotify.com/artist/${a.id}`,
    genres: (a.genres as string[]) ?? [],
    followers: (a.followers?.total as number) ?? 0,
    popularity: (a.popularity as number) ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSpotifyTrack(t: any, albumImageUrl?: string): SpotifyTrackResult {
  const cover = albumImageUrl ?? (t.album?.images?.[0]?.url as string | undefined) ?? null
  const artistNames = (t.artists as { name: string }[])?.map((a) => a.name).join(', ') ?? ''
  return {
    id: t.id as string,
    title: t.name as string,
    artist: artistNames,
    album: (t.album?.name as string) ?? '',
    cover_url: cover,
    spotify_url: (t.external_urls?.spotify as string) ?? `https://open.spotify.com/track/${t.id}`,
    duration_ms: (t.duration_ms as number) ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSpotifyAlbum(a: any): SpotifyAlbumResult {
  const artistNames = (a.artists as { name: string }[])?.map((ar) => ar.name).join(', ') ?? ''
  return {
    id: a.id as string,
    name: a.name as string,
    artist: artistNames,
    cover_url: (a.images?.[0]?.url as string) ?? null,
    spotify_url: (a.external_urls?.spotify as string) ?? `https://open.spotify.com/album/${a.id}`,
    total_tracks: (a.total_tracks as number) ?? 0,
    release_date: (a.release_date as string) ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSpotifyAlbumFull(a: any): SpotifyAlbumWithTracks {
  const album = mapSpotifyAlbum(a)
  const coverUrl = album.cover_url
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks: SpotifyTrackResult[] = ((a.tracks?.items ?? []) as any[]).map((t) =>
    mapSpotifyTrack(t, coverUrl ?? undefined)
  )
  return { ...album, tracks }
}
