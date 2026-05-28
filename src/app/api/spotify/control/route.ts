import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { controlPlayback, type SpotifyAction } from "@/lib/spotify";

const VALID_ACTIONS: SpotifyAction[] = ["play", "pause", "next", "previous"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const action = (body as { action?: string })?.action;
  if (!action || !VALID_ACTIONS.includes(action as SpotifyAction)) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  const res = await controlPlayback(session.user.id, action as SpotifyAction);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status ?? 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
