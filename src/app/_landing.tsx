import Link from "next/link";
import { Dumbbell, Flame, Trophy, Users } from "lucide-react";

import { Card } from "@/components/ui/card";

export function LandingHero() {
  return (
    <div className="flex min-h-svh flex-col px-5 pt-10 pb-8">
      <div className="flex items-center gap-2">
        <div className="grid size-10 place-items-center rounded-xl bg-accent shadow-lg shadow-accent/30">
          <Dumbbell className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-none">T&apos;es bon tu montes</h1>
          <p className="mt-1 text-[11px] text-muted">TBTM · entre potes, c&apos;est tout</p>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-3xl font-semibold leading-tight">
          Suis tes séances.
          <br />
          Bats tes PRs.
          <br />
          <span className="text-accent-soft">Chambre tes potes.</span>
        </h2>
        <p className="mt-3 text-sm text-muted-strong">
          App fitness perso : programmes, séances en direct, stats, nutrition, défis 1v1.
          Pas de coach motivationnel. Juste un outil et de la personnalité.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2">
        <Card className="flex flex-col items-start gap-1.5">
          <Dumbbell className="size-4 text-accent-soft" />
          <p className="text-xs font-medium">Mode séance live</p>
          <p className="text-[10px] text-muted">Timer récup, suggestions auto, sets validés en 1 tap</p>
        </Card>
        <Card className="flex flex-col items-start gap-1.5">
          <Trophy className="size-4 text-gold" />
          <p className="text-xs font-medium">PR auto-détectés</p>
          <p className="text-[10px] text-muted">1RM estimé, comparaison automatique</p>
        </Card>
        <Card className="flex flex-col items-start gap-1.5">
          <Users className="size-4 text-accent-soft" />
          <p className="text-xs font-medium">Défis entre potes</p>
          <p className="text-[10px] text-muted">Le challengé reçoit un ping</p>
        </Card>
        <Card className="flex flex-col items-start gap-1.5">
          <Flame className="size-4 text-accent" />
          <p className="text-xs font-medium">Streak & XP</p>
          <p className="text-[10px] text-muted">Sans pression — t&apos;as le droit de FF15</p>
        </Card>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10">
        <Link
          href="/auth/signup"
          className="flex h-12 items-center justify-center rounded-xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/30"
        >
          Créer un compte
        </Link>
        <Link
          href="/auth/login"
          className="flex h-12 items-center justify-center rounded-xl border border-card-border-strong bg-card text-sm font-medium text-fg"
        >
          J&apos;ai déjà un compte
        </Link>
      </div>
    </div>
  );
}
