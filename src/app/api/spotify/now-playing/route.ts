import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getCurrentlyPlaying } from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ track: null, connected: false });
  }
  const track = await getCurrentlyPlaying(session.user.id);
  // track null peut signifier : pas connecté OU rien en cours.
  // On distingue : si pas de token sur le user, "connected: false".
  return NextResponse.json({ track, connected: track !== null });
}
