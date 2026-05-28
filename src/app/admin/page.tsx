import Link from "next/link";
import { ArrowLeft, BarChart3, Dumbbell, ShieldCheck, Users } from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";

export default async function AdminPage() {
  const session = await requireAdmin();

  const [userCount, exoCount, seanceCount, recetteCount] = await Promise.all([
    prisma.user.count(),
    prisma.exercice.count(),
    prisma.seance.count(),
    prisma.recette.count(),
  ]);

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/profil"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-[10px] font-medium text-gold">
          <ShieldCheck className="size-3" />
          Admin · {session.user.pseudo}
        </span>
      </header>

      <h1 className="text-2xl font-semibold">Espace admin</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Vue d&apos;ensemble + outils de modération.
      </p>

      <section className="mt-5 grid grid-cols-2 gap-2">
        <StatCard label="Users" value={userCount} icon={Users} />
        <StatCard label="Exercices" value={exoCount} icon={Dumbbell} />
        <StatCard label="Séances" value={seanceCount} icon={BarChart3} />
        <StatCard label="Recettes" value={recetteCount} icon={Dumbbell} />
      </section>

      <section className="mt-5 space-y-2">
        <CardLabel className="px-1">Outils</CardLabel>
        <Card className="divide-y divide-card-border p-0">
          <AdminLink href="/exercices" label="Gérer les exercices" />
          <AdminLink href="/admin/users" label="Liste des users (bientôt)" disabled />
          <AdminLink href="/admin/badges" label="Gérer les badges (bientôt)" disabled />
          <AdminLink href="/admin/recettes" label="Modérer les recettes (bientôt)" disabled />
        </Card>
      </section>

      <p className="mt-6 text-center text-[10px] text-muted">
        Les routes admin sont protégées par <code className="font-mono">requireAdmin()</code>.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex items-center gap-3 py-3">
      <div className="grid size-10 place-items-center rounded-xl bg-accent-bg text-accent-soft">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
        <p className="text-lg font-medium">{value}</p>
      </div>
    </Card>
  );
}

function AdminLink({
  href,
  label,
  disabled,
}: {
  href: string;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex items-center justify-between px-3 py-3 text-sm text-muted">
        <span>{label}</span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-3 py-3 text-sm hover:bg-bg/40"
    >
      <span>{label}</span>
      <span className="text-muted">→</span>
    </Link>
  );
}
