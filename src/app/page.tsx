import Link from "next/link";
import { Flame, TrendingUp, Trophy } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLabel } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

import { LandingHero } from "./_landing";
import { RotationCard, type ProgrammeForRotation } from "./_rotation-card";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <LandingHero />;
  }

  // Requêtes en parallèle (Promise.all) au lieu de séquentiel : moitié de la
  // latence cross-region Vercel→Supabase.
  const [user, programmesPourRotation] = await Promise.all([
    safeGetUser(session.user.id),
    safeGetProgrammesForRotation(session.user.id),
  ]);
  const userPseudo = user?.pseudo ?? session.user.pseudo ?? "Toi";
  const niveau = user?.niveau ?? 1;
  const streak = user?.streakActuel ?? 0;
  const xpPct = computeXpProgress(user?.xp ?? 0, niveau);

  // Phase 5+ : ces données seront branchées
  const volumeCeMois = 0;
  const volumeDeltaPct = null as null | number;
  const seancesCeMois = 0;
  const seancesDelta = null as null | number;
  const semaineVolumes: number[] = [0, 0, 0, 0, 0, 0, 0];
  const derniersPrs: { exercice: string; poids: string; delta?: string }[] = [];

  return (
    <div className="px-4 pt-5 pb-6">
      <header className="mb-1 flex items-center justify-between">
        <div>
          <p className="text-base font-medium">Salut, {userPseudo} 👋</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Niveau {niveau} · Streak {streak}j {streak > 0 && "🔥"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/profil" aria-label="Profil">
            <Avatar name={userPseudo} size={36} />
          </Link>
        </div>
      </header>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-bar-idle">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${xpPct}%` }}
        />
      </div>

      <section className="mt-4 space-y-3">
        <RotationCard programmes={programmesPourRotation} />

        <div className="grid grid-cols-2 gap-2">
          <Card className="flex flex-col gap-1">
            <CardLabel>Volume ce mois</CardLabel>
            <p className="text-xl font-medium">
              {formatTons(volumeCeMois)}
              <span className="ml-0.5 text-sm text-muted">t</span>
            </p>
            <DeltaBadge delta={volumeDeltaPct} suffix="%" />
          </Card>
          <Card className="flex flex-col gap-1">
            <CardLabel>Séances</CardLabel>
            <p className="text-xl font-medium">{seancesCeMois}</p>
            <DeltaBadge
              delta={seancesDelta}
              suffix={seancesDelta != null ? " vs mois dernier" : ""}
            />
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>Cette semaine</CardLabel>
            <span className="text-[10px] text-muted">
              <TrendingUp className="-mt-0.5 mr-0.5 inline size-3" />
              {semaineVolumes.reduce((a, b) => a + b, 0)} kg
            </span>
          </div>
          <div className="mt-2 flex h-10 items-end gap-1">
            {semaineVolumes.map((v, i) => {
              const max = Math.max(1, ...semaineVolumes);
              const heightPct = Math.max(8, (v / max) * 100);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-[height]"
                  style={{
                    height: `${heightPct}%`,
                    background: v === 0 ? "var(--color-bar-idle)" : barColor(v, max),
                    opacity: v === 0 ? 0.4 : 1,
                  }}
                  aria-label={`${DAYS[i]} : ${v} kg`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] text-muted">
            {DAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </Card>

        <div className="mt-4">
          <CardLabel className="mb-2 px-1">Derniers PRs</CardLabel>
          {derniersPrs.length === 0 ? (
            <Card className="flex items-center gap-3 py-4">
              <Trophy className="size-6 text-muted" />
              <p className="flex-1 text-xs text-muted-strong">
                Aucun PR pour l&apos;instant. Lance une séance, monstre.
              </p>
            </Card>
          ) : (
            <Card className="flex flex-col gap-1.5">
              {derniersPrs.map((pr, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-bg px-2.5 py-2"
                >
                  <span className="text-xs">{pr.exercice}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-gold">{pr.poids}</span>
                    {pr.delta && (
                      <span className="text-[10px] text-success">{pr.delta}</span>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>

      {streak > 0 && (
        <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-muted">
          <Flame className="size-3 text-accent" />
          GG, t&apos;as tenu ta streak aujourd&apos;hui.
        </div>
      )}
    </div>
  );
}

async function safeGetUser(id: string) {
  try {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        pseudo: true,
        niveau: true,
        xp: true,
        streakActuel: true,
      },
    });
  } catch {
    return null;
  }
}

async function safeGetProgrammesForRotation(
  userId: string,
): Promise<ProgrammeForRotation[]> {
  try {
    const rows = await prisma.programme.findMany({
      where: { createdById: userId },
      orderBy: [{ estProgrammeActif: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        nom: true,
        estProgrammeActif: true,
        _count: { select: { exercices: true } },
        exercices: {
          select: { seriesCibles: true, tempsRecupSec: true },
        },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      nom: p.nom,
      nbExos: p._count.exercices,
      dureeMin: estimerDuree(p.exercices),
      estActif: p.estProgrammeActif,
    }));
  } catch {
    return [];
  }
}

function estimerDuree(
  exos: { seriesCibles: number; tempsRecupSec: number }[],
): number {
  if (exos.length === 0) return 0;
  const seconds = exos.reduce(
    (acc, e) => acc + e.seriesCibles * (45 + e.tempsRecupSec),
    0,
  );
  return Math.max(5, Math.round(seconds / 60));
}

function computeXpProgress(xp: number, niveau: number) {
  // Palier simple : progression à l'intérieur du niveau actuel
  const xpDebutNiveau = 100 * (niveau - 1) * niveau / 2;
  const cible = 100 * niveau;
  const dansPalier = xp - xpDebutNiveau;
  return Math.max(0, Math.min(100, (dansPalier / cible) * 100));
}

function formatTons(kg: number) {
  if (kg === 0) return "0";
  return (kg / 1000).toFixed(kg < 10000 ? 1 : 0);
}

function barColor(v: number, max: number) {
  const ratio = v / max;
  if (ratio > 0.85) return "var(--color-bar-4)";
  if (ratio > 0.6) return "var(--color-bar-3)";
  if (ratio > 0.35) return "var(--color-bar-2)";
  return "var(--color-bar-1)";
}

function DeltaBadge({ delta, suffix = "" }: { delta: number | null; suffix?: string }) {
  if (delta == null) return <span className="text-[10px] text-muted">—</span>;
  const sign = delta >= 0 ? "+" : "";
  const color = delta >= 0 ? "text-success" : "text-danger";
  return (
    <span className={`text-[10px] ${color}`}>
      {sign}
      {delta}
      {suffix}
    </span>
  );
}
