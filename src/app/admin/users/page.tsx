import Link from "next/link";
import { ArrowLeft, ShieldCheck, User as UserIcon } from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      pseudo: true,
      email: true,
      createdAt: true,
      dernierJourEntrain: true,
      niveau: true,
      xp: true,
      streakActuel: true,
      streakMax: true,
      role: true,
      _count: {
        select: {
          seances: true,
          programmes: true,
          exercicesCrees: true,
          recettesCreees: true,
          nutritionLogs: true,
        },
      },
    },
  });

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

      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-xs text-muted-strong">
        {users.length} compte{users.length > 1 ? "s" : ""} au total
      </p>

      <ul className="mt-5 flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id}>
            <Card className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Avatar name={u.pseudo} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {u.pseudo}
                    {u.role === "ADMIN" && (
                      <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] text-gold">
                        admin
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[10px] text-muted">{u.email}</p>
                </div>
                <div className="shrink-0 text-right text-[10px] text-muted">
                  <p>Niveau {u.niveau}</p>
                  <p>{u.xp} XP</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <Stat label="Séances" value={u._count.seances} />
                <Stat label="Programmes" value={u._count.programmes} />
                <Stat label="Recettes" value={u._count.recettesCreees} />
                <Stat label="Exos créés" value={u._count.exercicesCrees} />
                <Stat label="Logs nutri" value={u._count.nutritionLogs} />
                <Stat
                  label="Streak"
                  value={`${u.streakActuel}j (max ${u.streakMax})`}
                />
              </div>

              <p className="text-[10px] text-muted">
                Compte créé le{" "}
                {u.createdAt.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
                {u.dernierJourEntrain && (
                  <>
                    {" "}
                    · dernière séance le{" "}
                    {u.dernierJourEntrain.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </>
                )}
              </p>
            </Card>
          </li>
        ))}

        {users.length === 0 && (
          <Card className="flex items-center gap-3 py-6 text-center">
            <UserIcon className="size-5 text-muted" />
            <p className="flex-1 text-xs text-muted-strong">Aucun user.</p>
          </Card>
        )}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-bg/40 p-1.5">
      <CardLabel>{label}</CardLabel>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}
