import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === "ADMIN";
}

/**
 * À utiliser dans les pages/routes admin. Redirige vers /auth/login si non
 * connecté, ou vers / si connecté mais pas admin.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");
  return session;
}
