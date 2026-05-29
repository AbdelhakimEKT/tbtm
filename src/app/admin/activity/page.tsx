import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Dumbbell,
  FileText,
  Library,
  ShieldCheck,
  Trash2,
  Utensils,
} from "lucide-react";
import type { AuditAction, AuditEntityType } from "@prisma/client";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

const ENTITY_LABEL: Record<AuditEntityType, string> = {
  USER: "user",
  SEANCE: "séance",
  EXERCICE: "exercice",
  PROGRAMME: "programme",
  RECETTE: "recette",
  INGREDIENT: "ingrédient",
  NUTRITION_LOG: "log nutrition",
  BADGE: "badge",
  DEFI: "défi",
};

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "a créé",
  UPDATE: "a modifié",
  DELETE: "a supprimé",
};

type Feed =
  | {
      kind: "audit";
      id: string;
      date: Date;
      actor: { pseudo: string };
      action: AuditAction;
      entityType: AuditEntityType;
      entityId: string;
      metadata: unknown;
    }
  | {
      kind: "create";
      id: string;
      date: Date;
      actor: { pseudo: string };
      entityType: AuditEntityType;
      entityNom: string;
    };

export default async function AdminActivityPage() {
  await requireAdmin();

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [audits, programmes, exercices, recettes, seances] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        actor: { select: { pseudo: true } },
      },
    }),
    prisma.programme.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        nom: true,
        createdAt: true,
        createdBy: { select: { pseudo: true } },
      },
    }),
    prisma.exercice.findMany({
      where: { createdAt: { gte: since }, createdById: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        nom: true,
        createdAt: true,
        createdBy: { select: { pseudo: true } },
      },
    }),
    prisma.recette.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        nom: true,
        createdAt: true,
        createdBy: { select: { pseudo: true } },
      },
    }),
    prisma.seance.findMany({
      where: { date: { gte: since }, statut: "TERMINEE" },
      orderBy: { date: "desc" },
      take: 30,
      select: {
        id: true,
        date: true,
        manuelle: true,
        user: { select: { pseudo: true } },
      },
    }),
  ]);

  const feed: Feed[] = [
    ...audits.map((a) => ({
      kind: "audit" as const,
      id: a.id,
      date: a.createdAt,
      actor: a.actor,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      metadata: a.metadata,
    })),
    ...programmes.map((p) => ({
      kind: "create" as const,
      id: `prog-${p.id}`,
      date: p.createdAt,
      actor: p.createdBy,
      entityType: "PROGRAMME" as const,
      entityNom: p.nom,
    })),
    ...exercices.map((e) => ({
      kind: "create" as const,
      id: `exo-${e.id}`,
      date: e.createdAt,
      actor: e.createdBy ?? { pseudo: "système" },
      entityType: "EXERCICE" as const,
      entityNom: e.nom,
    })),
    ...recettes.map((r) => ({
      kind: "create" as const,
      id: `rec-${r.id}`,
      date: r.createdAt,
      actor: r.createdBy,
      entityType: "RECETTE" as const,
      entityNom: r.nom,
    })),
    ...seances.map((s) => ({
      kind: "create" as const,
      id: `sea-${s.id}`,
      date: s.date,
      actor: s.user,
      entityType: "SEANCE" as const,
      entityNom: s.manuelle ? "séance (manuelle)" : "séance",
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/admin"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-[10px] font-medium text-gold">
          <ShieldCheck className="size-3" /> Admin
        </span>
      </header>

      <h1 className="text-2xl font-semibold">Activité</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Audit log (suppressions tracées) + créations dans les 14 derniers jours.
      </p>

      <ul className="mt-5 flex flex-col gap-1.5">
        {feed.length === 0 && (
          <Card className="flex items-center gap-3 py-6">
            <Activity className="size-5 text-muted" />
            <p className="flex-1 text-xs text-muted-strong">
              Aucune activité récente.
            </p>
          </Card>
        )}
        {feed.map((item) => (
          <li key={item.id}>
            <FeedRow item={item} />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-[10px] text-muted">
        Les suppressions ne sont tracées que pour les actions instrumentées (séances).
        Pour étendre, appelle <code className="font-mono">logAudit()</code> dans les autres actions.
      </p>
    </div>
  );
}

function FeedRow({ item }: { item: Feed }) {
  const dateLabel = item.date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (item.kind === "audit") {
    const meta =
      item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : null;
    return (
      <Card className="flex items-start gap-3">
        <ActionIcon action={item.action} entityType={item.entityType} />
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className="font-medium">{item.actor.pseudo}</span>{" "}
            <span className="text-muted-strong">{ACTION_LABEL[item.action]}</span>{" "}
            <span className="font-medium">
              {ENTITY_LABEL[item.entityType]}
            </span>{" "}
            <span className="font-mono text-[10px] text-muted">
              {item.entityId.slice(0, 8)}
            </span>
          </p>
          {meta && (
            <p className="mt-0.5 text-[10px] text-muted">
              {Object.entries(meta)
                .filter(([, v]) => v != null)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(" · ")}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-muted">{dateLabel}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex items-start gap-3">
      <ActionIcon action="CREATE" entityType={item.entityType} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-medium">{item.actor.pseudo}</span>{" "}
          <span className="text-muted-strong">a créé</span>{" "}
          <span className="font-medium">
            {ENTITY_LABEL[item.entityType]}
          </span>{" "}
          <span className="text-muted">·</span>{" "}
          <span>{item.entityNom}</span>
        </p>
        <p className="mt-0.5 text-[10px] text-muted">{dateLabel}</p>
      </div>
    </Card>
  );
}

function ActionIcon({
  action,
  entityType,
}: {
  action: AuditAction;
  entityType: AuditEntityType;
}) {
  if (action === "DELETE") {
    return (
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
        <Trash2 className="size-3.5" />
      </div>
    );
  }
  const Icon =
    entityType === "RECETTE"
      ? Utensils
      : entityType === "PROGRAMME"
        ? Library
        : entityType === "EXERCICE" || entityType === "SEANCE"
          ? Dumbbell
          : FileText;
  return (
    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-bg text-accent-soft">
      <Icon className="size-3.5" />
    </div>
  );
}
