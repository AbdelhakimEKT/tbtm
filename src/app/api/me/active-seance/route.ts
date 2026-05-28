import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ active: false });
  }

  try {
    const seance = await prisma.seance.findFirst({
      where: { userId: session.user.id, statut: "EN_COURS" },
      orderBy: { date: "desc" },
      select: { id: true, date: true },
    });
    if (!seance) return NextResponse.json({ active: false });
    return NextResponse.json({
      active: true,
      id: seance.id,
      startedAt: seance.date.toISOString(),
    });
  } catch {
    return NextResponse.json({ active: false });
  }
}
