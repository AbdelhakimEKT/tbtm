import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { disconnectSpotify } from "@/lib/spotify";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  await disconnectSpotify(session.user.id);
  return NextResponse.json({ ok: true });
}
