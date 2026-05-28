import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Pencil, Shield, Trophy, UserPlus, Users, Zap } from "lucide-react";

import { auth, signOut } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const OBJECTIF_LABELS: Record<string, string> = {
  PRISE_DE_MASSE: "Prise de masse",
  SECHE: "Sèche",
  FORCE: "Force",
  FORME_GENERALE: "Forme générale",
};

const CATEGORIE_LABELS: Record<string, string> = {
  NOVICE: "Novice",
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  AVANCE: "Avancé",
  EXPERT: "Expert",
};

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/profil");

  const user = await safeGetUser(session.user.id);
  const pseudo = user?.pseudo ?? session.user.pseudo ?? "Toi";

  // Stats sociales
  const social = await safeGetSocialCounts(session.user.id);

  return (
    <div className="px-4 pt-5 pb-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Profil</h1>
        <ThemeToggle />
      </header>

      <Card highlighted className="flex items-center gap-4">
        <Avatar name={pseudo} src={user?.avatar} size={64} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-base font-medium">{pseudo}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted">{session.user.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-2 py-0.5 text-[10px] font-medium text-accent-soft">
              <Trophy className="size-3" />
              {CATEGORIE_LABELS[user?.categorie ?? "NOVICE"]}
            </span>
            {isAdmin(session) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
                <Shield className="size-3" />
                Admin
              </span>
            )}
          </div>
        </div>
        <Link
          href="/profil/edit"
          aria-label="Modifier le profil"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <Pencil className="size-4" />
        </Link>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>Niveau</CardLabel>
          <p className="text-xl font-medium">{user?.niveau ?? 1}</p>
        </Card>
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>XP</CardLabel>
          <p className="text-xl font-medium">{user?.xp ?? 0}</p>
        </Card>
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>Streak</CardLabel>
          <p className="text-xl font-medium">
            {user?.streakActuel ?? 0}
            <span className="ml-0.5 text-xs text-muted">j</span>
          </p>
        </Card>
      </div>

      <section className="mt-5 space-y-2">
        <CardLabel className="px-1">Mes infos</CardLabel>
        <Card className="divide-y divide-card-border">
          <Row label="Objectif" value={OBJECTIF_LABELS[user?.objectif ?? "FORME_GENERALE"]} />
          <Row
            label="Poids de corps"
            value={user?.poidsKg ? `${user.poidsKg} kg` : "Non renseigné"}
          />
          <Row label="Ville" value={user?.ville ?? "—"} />
        </Card>
      </section>

      <section className="mt-5 space-y-2">
        <div className="flex items-center justify-between px-1">
          <CardLabel>Social</CardLabel>
          <Link
            href="/amis"
            className="inline-flex items-center gap-1 text-[10px] text-accent-soft hover:underline"
          >
            <UserPlus className="size-3" /> Ajouter un pote
          </Link>
        </div>
        <Link href="/amis">
          <Card className="flex items-center gap-3 py-3 transition-colors hover:border-accent-border">
            <Users className="size-6 text-accent-soft" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {social.amisCount === 0
                  ? "Aucun pote pour l'instant"
                  : `${social.amisCount} pote${social.amisCount > 1 ? "s" : ""}`}
              </p>
              <p className="text-[11px] text-muted-strong">
                {social.amisCount === 0
                  ? "Tape un pseudo pour envoyer ta première demande"
                  : "Tap pour gérer ou défier"}
              </p>
            </div>
            {social.recuesCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">
                {social.recuesCount} demande{social.recuesCount > 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[10px] text-muted">→</span>
          </Card>
        </Link>
        <Link href="/defis">
          <Card className="flex items-center gap-3 py-3 transition-colors hover:border-accent-border">
            <Zap className="size-6 text-accent-soft" />
            <div className="flex-1">
              <p className="text-sm font-medium">Mes défis</p>
              <p className="text-[11px] text-muted-strong">
                Défie tes potes, chambre, gagne
              </p>
            </div>
            {social.defisRecusCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">
                {social.defisRecusCount} ping
                {social.defisRecusCount > 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[10px] text-muted">→</span>
          </Card>
        </Link>
        <Link href="/leaderboard">
          <Card className="flex items-center gap-3 py-3 transition-colors hover:border-accent-border">
            <Trophy className="size-6 text-gold" />
            <div className="flex-1">
              <p className="text-sm font-medium">Classement du mois</p>
              <p className="text-[11px] text-muted-strong">
                Volume soulevé · top 3 + complet
              </p>
            </div>
            <span className="text-[10px] text-muted">→</span>
          </Card>
        </Link>
      </section>

      <section className="mt-5 space-y-2">
        <CardLabel className="px-1">Compte</CardLabel>
        <Card className="divide-y divide-card-border p-0">
          <Link
            href="/profil/edit"
            className="flex items-center justify-between px-3 py-3 text-sm hover:bg-bg/40"
          >
            <span>Modifier mes infos</span>
            <Pencil className="size-4 text-muted" />
          </Link>
          <Link
            href="/badges"
            className="flex items-center justify-between px-3 py-3 text-sm hover:bg-bg/40"
          >
            <span>Mes badges</span>
            <Trophy className="size-4 text-muted" />
          </Link>
          {isAdmin(session) && (
            <Link
              href="/admin"
              className="flex items-center justify-between px-3 py-3 text-sm hover:bg-bg/40"
            >
              <span className="text-gold">Espace admin</span>
              <Shield className="size-4 text-gold" />
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-between px-3 py-3 text-sm text-danger"
            >
              Se déconnecter <LogOut className="size-4" />
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-3 text-sm">
      <span className="text-muted-strong">{label}</span>
      <span>{value}</span>
    </div>
  );
}

async function safeGetUser(id: string) {
  try {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        pseudo: true,
        avatar: true,
        niveau: true,
        xp: true,
        streakActuel: true,
        objectif: true,
        categorie: true,
        poidsKg: true,
        ville: true,
      },
    });
  } catch {
    return null;
  }
}

async function safeGetSocialCounts(userId: string) {
  try {
    const [amisCount, recuesCount, defisRecusCount] = await Promise.all([
      prisma.amitie.count({
        where: {
          statut: "ACCEPTEE",
          OR: [{ deId: userId }, { aId: userId }],
        },
      }),
      prisma.amitie.count({
        where: { aId: userId, statut: "EN_ATTENTE" },
      }),
      prisma.defiParticipant.count({
        where: {
          userId,
          statut: "EN_ATTENTE",
          defi: { statut: "EN_COURS" },
        },
      }),
    ]);
    return { amisCount, recuesCount, defisRecusCount };
  } catch {
    return { amisCount: 0, recuesCount: 0, defisRecusCount: 0 };
  }
}
