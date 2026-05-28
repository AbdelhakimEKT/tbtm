import { prisma } from "@/lib/prisma";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";
const SPOTIFY_AUTH = "https://accounts.spotify.com/authorize";

// Scopes nécessaires : voir current playback + le contrôler.
export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

export function hasSpotifyCredentials(): boolean {
  return (
    !!process.env.SPOTIFY_CLIENT_ID &&
    !!process.env.SPOTIFY_CLIENT_SECRET
  );
}

/**
 * L'origin (`https://localhost:3000` ou `https://192.168.1.96:3000`) doit être
 * passée explicitement par la route — déterminée depuis le request entrant,
 * pour que le callback Spotify revienne sur le bon host. Doit matcher EXACTEMENT
 * un des Redirect URIs configurés dans le dashboard Spotify Developer.
 */
export function getSpotifyRedirectUri(origin: string): string {
  return `${origin}/api/spotify/callback`;
}

export function buildSpotifyAuthUrl(args: {
  state: string;
  origin: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID ?? "",
    scope: SPOTIFY_SCOPES,
    redirect_uri: getSpotifyRedirectUri(args.origin),
    state: args.state,
    show_dialog: "false",
  });
  return `${SPOTIFY_AUTH}?${params.toString()}`;
}

// ----------------------------------------------------------------------------
// Token exchange + refresh
// ----------------------------------------------------------------------------

type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

function basicAuthHeader(): string {
  const id = process.env.SPOTIFY_CLIENT_ID ?? "";
  const secret = process.env.SPOTIFY_CLIENT_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function exchangeCodeForTokens(
  code: string,
  origin: string,
): Promise<TokenResponse | null> {
  if (!hasSpotifyCredentials()) return null;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getSpotifyRedirectUri(origin),
  });
  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("Spotify token exchange failed", await res.text());
    return null;
  }
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse | null> {
  if (!hasSpotifyCredentials()) return null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("Spotify refresh failed", await res.text());
    return null;
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Persiste les tokens Spotify pour un user.
 */
export async function saveSpotifyTokens(args: {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSec: number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + args.expiresInSec * 1000);
  await prisma.user.update({
    where: { id: args.userId },
    data: {
      spotifyAccessToken: args.accessToken,
      spotifyExpiresAt: expiresAt,
      ...(args.refreshToken
        ? { spotifyRefreshToken: args.refreshToken }
        : {}),
    },
  });
}

export async function disconnectSpotify(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessToken: null,
      spotifyRefreshToken: null,
      spotifyExpiresAt: null,
    },
  });
}

/**
 * Récupère un access token valide pour le user. Refresh automatiquement
 * s'il a expiré (ou est sur le point d'expirer dans les 60s).
 *
 * Retourne null si l'user n'est pas connecté à Spotify ou si le refresh a
 * échoué (probablement révoqué côté Spotify).
 */
export async function getValidAccessToken(
  userId: string,
): Promise<string | null> {
  if (!hasSpotifyCredentials()) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      spotifyAccessToken: true,
      spotifyRefreshToken: true,
      spotifyExpiresAt: true,
    },
  });
  if (!user?.spotifyAccessToken || !user.spotifyRefreshToken) {
    return null;
  }

  const expiresSoon =
    !user.spotifyExpiresAt ||
    user.spotifyExpiresAt.getTime() - Date.now() < 60_000;

  if (!expiresSoon) {
    return user.spotifyAccessToken;
  }

  // Refresh
  const refreshed = await refreshAccessToken(user.spotifyRefreshToken);
  if (!refreshed) {
    // Probable révocation : on déconnecte le user pour éviter de re-tenter
    await disconnectSpotify(userId);
    return null;
  }

  await saveSpotifyTokens({
    userId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? null,
    expiresInSec: refreshed.expires_in,
  });
  return refreshed.access_token;
}

// ----------------------------------------------------------------------------
// API helpers (currently playing + control)
// ----------------------------------------------------------------------------

export type CurrentTrack = {
  isPlaying: boolean;
  title: string;
  artists: string[];
  albumCover: string | null;
  durationMs: number;
  progressMs: number;
  url: string | null; // open.spotify.com/...
};

export async function getCurrentlyPlaying(
  userId: string,
): Promise<CurrentTrack | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 204 || res.status === 202) {
    // Rien en lecture
    return null;
  }
  if (!res.ok) {
    return null;
  }
  type SpotifyTrack = {
    is_playing: boolean;
    progress_ms: number;
    item: {
      name: string;
      duration_ms: number;
      external_urls?: { spotify?: string };
      artists: { name: string }[];
      album: { images: { url: string; height: number; width: number }[] };
    } | null;
  };
  const data = (await res.json()) as SpotifyTrack;
  if (!data?.item) return null;
  const cover = data.item.album.images?.[0]?.url ?? null;
  return {
    isPlaying: data.is_playing,
    title: data.item.name,
    artists: data.item.artists.map((a) => a.name),
    albumCover: cover,
    durationMs: data.item.duration_ms,
    progressMs: data.progress_ms,
    url: data.item.external_urls?.spotify ?? null,
  };
}

export type SpotifyAction = "play" | "pause" | "next" | "previous";

export async function controlPlayback(
  userId: string,
  action: SpotifyAction,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const token = await getValidAccessToken(userId);
  if (!token) return { ok: false, error: "Pas connecté à Spotify" };

  let url: string;
  let method: "PUT" | "POST";
  switch (action) {
    case "play":
      url = `${SPOTIFY_API}/me/player/play`;
      method = "PUT";
      break;
    case "pause":
      url = `${SPOTIFY_API}/me/player/pause`;
      method = "PUT";
      break;
    case "next":
      url = `${SPOTIFY_API}/me/player/next`;
      method = "POST";
      break;
    case "previous":
      url = `${SPOTIFY_API}/me/player/previous`;
      method = "POST";
      break;
  }

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 403) {
    return {
      ok: false,
      error: "Spotify Premium requis pour contrôler la lecture",
      status: 403,
    };
  }
  if (res.status === 404) {
    return {
      ok: false,
      error: "Aucun appareil Spotify actif — lance la musique d'abord",
      status: 404,
    };
  }
  if (!res.ok && res.status !== 204) {
    return { ok: false, error: `Spotify a renvoyé ${res.status}` };
  }
  return { ok: true };
}

/**
 * Récupère le pseudo Spotify de l'utilisateur connecté (display name),
 * utilisé pour afficher "Connecté en tant que X" dans le settings.
 */
export async function getSpotifyProfile(userId: string): Promise<{
  displayName: string;
  productPremium: boolean;
} | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  const res = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    display_name: string | null;
    id: string;
    product?: string; // "premium" | "free" | "open"
  };
  return {
    displayName: data.display_name ?? data.id,
    productPremium: data.product === "premium",
  };
}
