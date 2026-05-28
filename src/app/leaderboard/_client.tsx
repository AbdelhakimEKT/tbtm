"use client";

import Link from "next/link";
import { useState } from "react";
import { Crown, Medal, Trophy, Users2 } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _Link = Link; // garde l'import pour l'empty state CTA

import { Avatar } from "@/components/ui/avatar";
import { Card, CardLabel } from "@/components/ui/card";
import { CATEGORIE_FORCE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { LeaderboardBundle, LeaderboardEntry } from "@/lib/leaderboard";

type Tab = "amis" | "global";

export function LeaderboardTabs({
  initialTab,
  amis,
  global,
}: {
  initialTab: Tab;
  amis: LeaderboardBundle;
  global: LeaderboardBundle;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const current = tab === "amis" ? amis : global;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
        <TabBtn
          active={tab === "amis"}
          onClick={() => setTab("amis")}
          label="Mes potes"
          count={amis.entries.length}
        />
        <TabBtn
          active={tab === "global"}
          onClick={() => setTab("global")}
          label="Global"
          count={global.entries.length}
        />
        <TabBtn disabled label="Défis" hint="9.3" />
      </div>

      <LeaderboardView bundle={current} tab={tab} />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
  disabled,
  hint,
}: {
  active?: boolean;
  onClick?: () => void;
  label: string;
  count?: number;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors",
        active && "bg-accent text-white shadow-sm shadow-accent/30",
        !active && !disabled && "text-muted-strong",
        disabled && "cursor-not-allowed text-muted opacity-50",
      )}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[9px]",
            active ? "bg-bg/30" : "bg-card-border",
          )}
        >
          {count}
        </span>
      )}
      {hint && (
        <span className="rounded-full bg-card-border px-1.5 text-[9px]">
          {hint}
        </span>
      )}
    </button>
  );
}

function LeaderboardView({
  bundle,
  tab,
}: {
  bundle: LeaderboardBundle;
  tab: Tab;
}) {
  if (bundle.entries.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <Users2 className="size-7 text-muted" />
        <p className="text-sm">
          {tab === "amis"
            ? "Personne dans tes potes ce mois-ci"
            : "Personne n'a logué de séance ce mois-ci"}
        </p>
        <p className="text-[11px] text-muted-strong">
          {tab === "amis"
            ? "Ajoute des potes (ou attends qu'ils s'entraînent) pour voir un classement."
            : "Sois le premier — lance une séance et reviens ici."}
        </p>
        {tab === "amis" && (
          <Link
            href="/amis"
            className="mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
          >
            Voir mes potes
          </Link>
        )}
      </Card>
    );
  }

  const top3 = bundle.entries.slice(0, 3);
  const rest = bundle.entries.slice(3);

  return (
    <div className="flex flex-col gap-4">
      <Podium top3={top3} />
      {rest.length > 0 && (
        <section>
          <CardLabel className="mb-2 px-1">Classement complet</CardLabel>
          <ul className="flex flex-col gap-1.5">
            {rest.map((e) => (
              <li key={e.user.id}>
                <RankRow entry={e} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {bundle.myEntry && !bundle.entries.some((e) => e.isMe) && (
        <section>
          <CardLabel className="mb-2 px-1">Toi</CardLabel>
          <RankRow entry={bundle.myEntry} />
        </section>
      )}
      {!bundle.myEntry && (
        <Card className="border-card-border bg-card/40 py-3 text-center">
          <p className="text-[11px] text-muted-strong">
            Tu figures pas encore — lance une séance ce mois pour entrer dans
            la course.
          </p>
        </Card>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Podium
// ----------------------------------------------------------------------------

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  // Ordre d'affichage : 2 - 1 - 3 (pour que le 1er soit au centre)
  const e1 = top3[0];
  const e2 = top3[1];
  const e3 = top3[2];

  return (
    <Card highlighted className="flex flex-col gap-3">
      <CardLabel className="text-accent-soft/80">Top 3 du mois</CardLabel>
      <div className="flex items-end justify-center gap-2 pt-2">
        {e2 && <PodiumColumn entry={e2} variant="silver" height="h-20" />}
        {e1 && <PodiumColumn entry={e1} variant="gold" height="h-28" />}
        {e3 && <PodiumColumn entry={e3} variant="bronze" height="h-16" />}
      </div>
    </Card>
  );
}

function PodiumColumn({
  entry,
  variant,
  height,
}: {
  entry: LeaderboardEntry;
  variant: "gold" | "silver" | "bronze";
  height: string;
}) {
  const colors = {
    gold: { text: "text-gold", bg: "bg-gold/15", border: "border-gold/50" },
    silver: { text: "text-silver", bg: "bg-silver/15", border: "border-silver/50" },
    bronze: { text: "text-bronze", bg: "bg-bronze/15", border: "border-bronze/50" },
  }[variant];

  const Icon = variant === "gold" ? Crown : Trophy;

  return (
    <div className="flex w-20 flex-col items-center gap-1">
      <Icon className={cn("size-4", colors.text)} />
      <Avatar
        name={entry.user.pseudo}
        src={entry.user.avatar}
        size={44}
        className={cn("ring-2", colors.border.replace("border-", "ring-"))}
      />
      <p
        className={cn(
          "max-w-full truncate text-center text-[11px] font-medium",
          entry.isMe && "text-accent-soft",
        )}
      >
        {entry.user.pseudo}
        {entry.isMe && <span className="ml-0.5 text-muted">(toi)</span>}
      </p>
      <div
        className={cn(
          "flex w-full flex-col items-center justify-end rounded-t-md border-t-2 px-1 pt-1.5 transition-all",
          colors.bg,
          colors.border,
          height,
        )}
      >
        <p className={cn("text-base font-bold leading-none", colors.text)}>
          {entry.rank}
        </p>
        <p className="mt-1 text-[10px] text-fg">
          {formatVolume(entry.volumeKg)}
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Rank row (4+)
// ----------------------------------------------------------------------------

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <Card
      highlighted={entry.isMe}
      className={cn(
        "flex items-center gap-3",
        entry.isMe && "ring-1 ring-accent/40",
      )}
    >
      <div className="grid w-7 shrink-0 place-items-center">
        <RankBadge rank={entry.rank} />
      </div>
      <Avatar name={entry.user.pseudo} src={entry.user.avatar} size={36} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            entry.isMe && "text-accent-soft",
          )}
        >
          {entry.user.pseudo}
          {entry.isMe && (
            <span className="ml-1 text-[10px] font-normal text-muted">
              (toi)
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted">
          Niveau {entry.user.niveau} ·{" "}
          {CATEGORIE_FORCE_LABEL[entry.user.categorie]} ·{" "}
          {entry.seancesCount} séance{entry.seancesCount > 1 ? "s" : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">{formatVolume(entry.volumeKg)}</p>
      </div>
    </Card>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="size-4 text-gold" />;
  if (rank === 2) return <Medal className="size-4 text-silver" />;
  if (rank === 3) return <Medal className="size-4 text-bronze" />;
  return (
    <span className="text-xs font-semibold text-muted-strong">{rank}</span>
  );
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}
