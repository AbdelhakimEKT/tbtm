import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { AuditAction, AuditEntityType, Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

/**
 * Enregistre un événement dans l'audit log. À appeler depuis les server actions
 * pour les opérations destructives (delete) ou les actions modérables.
 * Best-effort : on swallow l'erreur pour ne jamais bloquer l'action utilisateur.
 */
export async function logAudit(args: {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: args.actorId,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId,
        metadata: args.metadata,
      },
    });
  } catch (err) {
    console.error("[audit] écriture échouée", err);
  }
}
