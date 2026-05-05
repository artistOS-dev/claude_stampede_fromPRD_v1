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
