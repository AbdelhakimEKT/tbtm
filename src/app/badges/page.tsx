import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ChefHat,
  Crown,
  Dumbbell,
  Flame,
  HelpCircle,
  Lock,
  Star,
  Trophy,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeRarete } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import { BADGE_RARETE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy,
  Flame,
  Dumbbell,
  Weight,
  Zap,
  Crown,
  ChefHat,
  Star,
  HelpCircle,
};

const RARETE_ORDER: BadgeRarete[] = [
  "COMMUN",
  "RARE",
  "EPIQUE",
  "LEGENDAIRE",
  "MYSTERE",
];

const RARETE_GRADIENT: Record<BadgeRarete, string> = {
  COMMUN: "from-muted/30 to-muted/10",
  RARE: "from-success/30 to-success/10",
  EPIQUE: "from-accent/40 to-accent/10",
  LEGENDAIRE: "from-gold/40 to-gold/10",
  MYSTERE: "from-danger/40 to-danger/10",
};

const RARETE_TEXT: Record<BadgeRarete, string> = {
  COMMUN: "text-muted-strong",
  RARE: "text-success",
  EPIQUE: "text-accent-soft",
  LEGENDAIRE: "text-gold",
  MYSTERE: "text-danger",
};

export default async function BadgesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/badges");
  }

  const [badges, userBadges] = await Promise.all([
    prisma.badge.findMany({ orderBy: [{ rarete: "asc" }, { ordre: "asc" }] }),
    prisma.userBadge.findMany({
      where: { userId: session.user.id },
      select: { badgeId: true, debloqueAt: true },
    }),
  ]);

  const unlockedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub.debloqueAt]));
  const totalUnlocked = userBadges.length;
  const totalBadges = badges.length;

  // Group by rareté
  const grouped = new Map<BadgeRarete, typeof badges>();
  for (const b of badges) {
    const arr = grouped.get(b.rarete) ?? [];
    arr.push(b);
    grouped.set(b.rarete, arr);
  }

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
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-3 py-1 text-[11px] font-medium text-accent-soft">
          <Trophy className="size-3" />
          {totalUnlocked} / {totalBadges}
        </span>
      </header>

      <h1 className="text-2xl font-semibold">Badges</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Achievements à débloquer. Les badges verrouillés sont grisés — pas de
        spoil sur leur condition de drop.
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-bar-idle">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{
            width: `${totalBadges > 0 ? (totalUnlocked / totalBadges) * 100 : 0}%`,
          }}
        />
      </div>

      {RARETE_ORDER.map((rarete) => {
        const list = grouped.get(rarete);
        if (!list || list.length === 0) return null;
        const unlockedInGroup = list.filter((b) => unlockedMap.has(b.id)).length;
        return (
          <section key={rarete} className="mt-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <CardLabel className={RARETE_TEXT[rarete]}>
                {BADGE_RARETE_LABEL[rarete]}
              </CardLabel>
              <span className="text-[10px] text-muted">
                {unlockedInGroup}/{list.length}
              </span>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {list.map((b) => {
                const debloqueAt = unlockedMap.get(b.id);
                const isUnlocked = !!debloqueAt;
                const isMystere = b.rarete === "MYSTERE";
                const Icon =
                  isUnlocked || !isMystere ? ICON_MAP[b.icone] ?? Trophy : HelpCircle;

                return (
                  <li key={b.id}>
                    <BadgeCard
                      title={isMystere && !isUnlocked ? "???" : b.nom}
                      description={
                        isMystere && !isUnlocked
                          ? "Secret"
                          : b.description
                      }
                      icon={Icon}
                      rarete={b.rarete}
                      isUnlocked={isUnlocked}
                      debloqueAt={debloqueAt}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function BadgeCard({
  title,
  description,
  icon: Icon,
  rarete,
  isUnlocked,
  debloqueAt,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  rarete: BadgeRarete;
  isUnlocked: boolean;
  debloqueAt: Date | undefined;
}) {
  return (
    <div
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border p-2 text-center",
        isUnlocked
          ? `border-card-border-strong bg-gradient-to-br ${RARETE_GRADIENT[rarete]}`
          : "border-card-border bg-card opacity-50",
      )}
      title={description}
    >
      {!isUnlocked && (
        <div className="absolute right-1.5 top-1.5">
          <Lock className="size-3 text-muted" />
        </div>
      )}
      <Icon
        className={cn(
          "size-6",
          isUnlocked ? RARETE_TEXT[rarete] : "text-muted",
        )}
      />
      <p
        className={cn(
          "line-clamp-2 text-[10px] font-medium leading-tight",
          isUnlocked ? "text-fg" : "text-muted",
        )}
      >
        {title}
      </p>
      {isUnlocked && debloqueAt && (
        <p className="absolute bottom-1 text-[8px] text-muted">
          {debloqueAt.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
          })}
        </p>
      )}
    </div>
  );
}
