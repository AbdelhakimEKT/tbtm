import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  pseudo: z
    .string()
    .min(3, "3 caractères minimum")
    .max(24, "24 caractères max")
    .regex(/^[a-zA-Z0-9_-]+$/, "Lettres, chiffres, _ et - uniquement"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const { pseudo, email, password } = parsed.data;
  const emailNormalized = email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: emailNormalized }, { pseudo }] },
    select: { email: true, pseudo: true },
  });
  if (existing) {
    const taken = existing.email === emailNormalized ? "email" : "pseudo";
    return NextResponse.json(
      { error: `Ce ${taken} est déjà pris` },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      pseudo,
      email: emailNormalized,
      passwordHash,
    },
    select: { id: true, pseudo: true, email: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
