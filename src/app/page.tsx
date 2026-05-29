import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FileEdit,
  Flame,
  Plus,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildHomeDashboard, type HomeDashboard } from "@/lib/stats";
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
  const [user, programmesPourRotation, dashboard] = await Promise.all([
    safeGetUser(session.user.id),
    safeGetProgrammesForRotation(session.user.id),
    safeGetHomeDashboard(session.user.id),
  ]);
  const userPseudo = user?.pseudo ?? session.user.pseudo ?? "Toi";
  const niveau = user?.niveau ?? 1;
  const streak = user?.streakActuel ?? 0;
  const xpPct = computeXpProgress(user?.xp ?? 0, niveau);

  const volumeCeMois = dashboard.volumeKgMonth;
  const volumeDeltaPct = dashboard.volumeDeltaPct;
  const seancesCeMois = dashboard.seancesMonth;
  const seancesDelta = dashboard.seancesDelta;
  const semaineVolumes = dashboard.weekVolumesKg;
  const derniersPrs = dashboard.recentPRs;

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
              {Math.round(semaineVolumes.reduce((a, b) => a + b, 0))} kg
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
          <div className="mb-2 flex items-center justify-between px-1">
            <CardLabel>Mes séances</CardLabel>
            <div className="flex items-center gap-2">
              <Link
                href="/seance/manuelle"
                className="inline-flex items-center gap-0.5 text-[11px] text-accent-soft hover:underline"
              >
                <Plus className="size-3" /> passée
              </Link>
              {dashboard.recentSeances.length > 0 && (
                <Link
                  href="/seance/historique"
                  className="inline-flex items-center gap-0.5 text-[11px] text-muted-strong hover:text-fg"
                >
                  Tout <ChevronRight className="size-3" />
                </Link>
              )}
            </div>
          </div>
          {dashboard.recentSeances.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-5 text-center">
              <p className="text-xs text-muted-strong">
                Pas encore de séance loggée.
              </p>
              <Link
                href="/seance/manuelle"
                className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-bg px-3 text-[11px] font-medium text-accent-soft hover:bg-accent-bg/70"
              >
                <Plus className="size-3" /> Ajouter une séance passée
              </Link>
            </Card>
          ) : (
            <Card className="flex flex-col gap-1.5">
              {dashboard.recentSeances.map((s) => (
                <Link
                  key={s.id}
                  href={`/seance/${s.id}`}
                  className="flex items-center gap-2 rounded-lg bg-bg px-2.5 py-2 transition-colors hover:bg-bg/60"
                >
                  {s.statut === "ANNULEE" ? (
                    <XCircle className="size-3.5 shrink-0 text-danger" />
                  ) : s.manuelle ? (
                    <FileEdit className="size-3.5 shrink-0 text-muted-strong" />
                  ) : (
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {s.programmeNom ?? "Séance libre"}
                      {s.manuelle && (
                        <span className="ml-1 text-[9px] font-normal text-muted">
                          (passée)
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted">
                      {s.date.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                      {s.statut === "TERMINEE" && s.nbSets > 0 && (
                        <>
                          {" · "}
                          {s.nbSets} série{s.nbSets > 1 ? "s" : ""}
                          {s.volumeKg > 0 && (
                            <> · {(s.volumeKg / 1000).toFixed(1)}t</>
                          )}
                        </>
                      )}
                      {s.statut === "ANNULEE" && " · abandonnée"}
                    </p>
                  </div>
                  <ChevronRight className="size-3.5 shrink-0 text-muted" />
                </Link>
              ))}
            </Card>
          )}
        </div>

        <div className="mt-4">
          <CardLabel className="mb-2 px-1">Derniers PRs</CardLabel>
          {derniersPrs.length === 0 ? (
            <Card className="flex items-center gap-3 py-4">
              <Trophy className="size-6 text-muted" />
              <p className="flex-1 text-xs text-muted-strong">
                Aucun PR pour l&apos;instant. Lance une séance pour en battre un.
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

async function safeGetHomeDashboard(userId: string): Promise<HomeDashboard> {
  try {
    return await buildHomeDashboard(userId);
  } catch {
    return {
      volumeKgMonth: 0,
      volumeDeltaPct: null,
      seancesMonth: 0,
      seancesDelta: null,
      weekVolumesKg: [0, 0, 0, 0, 0, 0, 0],
      recentPRs: [],
      recentSeances: [],
    };
  }
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
