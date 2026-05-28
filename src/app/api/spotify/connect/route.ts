import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";

import { auth } from "@/lib/auth";
import {
  buildSpotifyAuthUrl,
  hasSpotifyCredentials,
} from "@/lib/spotify";

/**
 * Récupère l'origin RÉELLE depuis les headers de la requête.
 *
 * `req.nextUrl.origin` est buggé en dev Next.js 16 : il retourne `localhost`
 * même quand le client a tapé `127.0.0.1` ou autre. On utilise donc directement
 * le header `host` (ou `x-forwarded-host` si proxy/tunnel).
 */
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

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${origin}/auth/login?callbackUrl=/profil/edit`);
  }
  if (!hasSpotifyCredentials()) {
    return NextResponse.json(
      { error: "Spotify pas configuré côté serveur (env vars manquantes)" },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const url = buildSpotifyAuthUrl({ state, origin });

  const response = NextResponse.redirect(url);
  // Cookie HTTP-only : state CSRF + origin originelle (le callback doit
  // utiliser la MÊME redirect_uri au token exchange).
  response.cookies.set("spotify_oauth_state", `${state}|${origin}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https:"),
    maxAge: 600,
    path: "/",
  });
  return response;
}
