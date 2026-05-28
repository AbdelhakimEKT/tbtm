import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { exchangeCodeForTokens, saveSpotifyTokens } from "@/lib/spotify";

function realOrigin(req: NextRequest): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const origin = realOrigin(req);
  const failBack = (msg: string) =>
    NextResponse.redirect(
      `${origin}/profil/edit?spotify=error&msg=${encodeURIComponent(msg)}`,
    );

  const session = await auth();
  if (!session?.user?.id) return failBack("Pas connecté");

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateFromUrl = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return failBack(error);
  if (!code || !stateFromUrl) return failBack("Code manquant");

  const cookieValue = req.cookies.get("spotify_oauth_state")?.value;
  if (!cookieValue) return failBack("State manquant");
  const [stateFromCookie, originFromCookie] = cookieValue.split("|");
  if (!stateFromCookie || stateFromCookie !== stateFromUrl) {
    return failBack("State CSRF invalide");
  }
  // L'origin DOIT être identique à celle envoyée à Spotify au /authorize,
  // sinon le token exchange échoue (mismatch redirect_uri).
  const exchangeOrigin = originFromCookie || origin;

  const tokens = await exchangeCodeForTokens(code, exchangeOrigin);
  if (!tokens) return failBack("Échec échange du code");

  await saveSpotifyTokens({
    userId: session.user.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresInSec: tokens.expires_in,
  });

  const response = NextResponse.redirect(`${origin}/profil/edit?spotify=ok`);
  response.cookies.delete("spotify_oauth_state");
  return response;
}
