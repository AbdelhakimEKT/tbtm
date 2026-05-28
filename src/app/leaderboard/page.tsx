import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";

import { auth } from "@/lib/auth";
import {
  buildLeaderboard,
  getFriendIdsIncludingMe,
  type LeaderboardBundle,
} from "@/lib/leaderboard";
import { Card } from "@/components/ui/card";

import { LeaderboardTabs } from "./_client";

type SearchParams = Promise<{ tab?: string }>;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/leaderboard");
  }

  const params = await searchParams;
  const tab: "amis" | "global" = params.tab === "global" ? "global" : "amis";

  let amis: LeaderboardBundle | null = null;
  let global: LeaderboardBundle | null = null;
  let dbError = false;

  try {
    const friendIds = await getFriendIdsIncludingMe(session.user.id);
    [amis, global] = await Promise.all([
      buildLeaderboard({ meId: session.user.id, userIds: friendIds, limit: 50 }),
      buildLeaderboard({ meId: session.user.id, limit: 50 }),
    ]);
  } catch {
    dbError = true;
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
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-3 py-1 text-[10px] font-medium text-accent-soft">
          <Trophy className="size-3" />
          Classement
        </span>
      </header>

      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Classé par volume soulevé ce mois-ci. {amis?.monthLabel ? `· ${capitalize(amis.monthLabel)}` : ""}
      </p>

      <div className="mt-5">
        {dbError ? (
          <Card className="border-danger/30 bg-danger/5 text-xs text-danger">
            Impossible de charger le classement. Vérifie la connexion BDD.
          </Card>
        ) : (
          <LeaderboardTabs initialTab={tab} amis={amis!} global={global!} />
        )}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
