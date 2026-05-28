"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Flag,
  XCircle,
  Zap,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { acceptDefi, refuseDefi } from "./_actions";
import type { DefiPageItem } from "./page";

type Tab = "recus" | "en-cours" | "termines";

export function DefiTabs({
  initialTab,
  recus,
  enCours,
  termines,
  meId,
}: {
  initialTab: Tab;
  recus: DefiPageItem[];
  enCours: DefiPageItem[];
  termines: DefiPageItem[];
  meId: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
        <TabBtn
          active={tab === "recus"}
          onClick={() => setTab("recus")}
          label="Reçus"
          count={recus.length}
          highlight={recus.length > 0}
        />
        <TabBtn
          active={tab === "en-cours"}
          onClick={() => setTab("en-cours")}
          label="En cours"
          count={enCours.length}
        />
        <TabBtn
          active={tab === "termines"}
          onClick={() => setTab("termines")}
          label="Terminés"
          count={termines.length}
        />
      </div>

      {tab === "recus" && (
        <RecusList items={recus} meId={meId} />
      )}
      {tab === "en-cours" && <EnCoursList items={enCours} meId={meId} />}
      {tab === "termines" && <TerminesList items={termines} meId={meId} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors",
        active
          ? "bg-accent text-white shadow-sm shadow-accent/30"
          : "text-muted-strong",
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[9px]",
            active
              ? "bg-bg/30"
              : highlight
                ? "bg-accent text-white"
                : "bg-card-border",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Reçus : en attente de ma réponse
// ----------------------------------------------------------------------------

function RecusList({
  items,
  meId,
}: {
  items: DefiPageItem[];
  meId: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="py-8 text-center">
        <p className="text-sm">Pas de défi en attente</p>
        <p className="mt-1 text-[11px] text-muted-strong">
          Quand un pote te ping, ça apparaît ici.
        </p>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => (
        <li key={p.id}>
          <RecuCard item={p} meId={meId} />
        </li>
      ))}
    </ul>
  );
}

function RecuCard({ item, meId }: { item: DefiPageItem; meId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptDefi(item.id);
      if (res.ok) {
        router.push(`/defis/${item.defi.id}`);
        router.refresh();
      }
    });
  }
  function handleRefuse() {
    startTransition(async () => {
      const res = await refuseDefi(item.id);
      if (res.ok) router.refresh();
    });
  }

  const others = item.defi.participants.filter((p) => p.userId !== meId);

  return (
    <Card highlighted className={cn("flex flex-col gap-2", pending && "opacity-50")}>
      <div className="flex items-center gap-3">
        <Avatar
          name={item.defi.lancePar.pseudo}
          src={item.defi.lancePar.avatar}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            <span className="text-accent-soft">
              {item.defi.lancePar.pseudo}
            </span>{" "}
            t&apos;a ping
          </p>
          <p className="truncate text-[10px] text-muted">
            sur « {item.defi.programme.nom} »
            {others.length > 1 && ` · ${others.length} potes inclus`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-medium text-accent-soft">
          {humanDate(item.defi.createdAt)}
        </span>
      </div>
      {item.defi.message && (
        <p className="rounded-md bg-bg px-2.5 py-1.5 text-[11px] italic text-muted-strong">
          « {item.defi.message} »
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={handleRefuse}
          disabled={pending}
        >
          <XCircle className="size-3.5" />
          Refuser
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={handleAccept}
          disabled={pending}
        >
          <CheckCircle2 className="size-3.5" />
          Accepter
        </Button>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// En cours
// ----------------------------------------------------------------------------

function EnCoursList({
  items,
  meId,
}: {
  items: DefiPageItem[];
  meId: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="py-8 text-center">
        <p className="text-sm">Aucun défi en cours</p>
        <p className="mt-1 text-[11px] text-muted-strong">
          Accepte une demande ou lance un nouveau défi.
        </p>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => (
        <li key={p.id}>
          <DefiCard item={p} meId={meId} />
        </li>
      ))}
    </ul>
  );
}

function TerminesList({
  items,
  meId,
}: {
  items: DefiPageItem[];
  meId: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="py-8 text-center">
        <p className="text-sm">Aucun défi terminé</p>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => (
        <li key={p.id}>
          <DefiCard item={p} meId={meId} />
        </li>
      ))}
    </ul>
  );
}

function DefiCard({ item, meId }: { item: DefiPageItem; meId: string }) {
  const others = item.defi.participants.filter((p) => p.userId !== meId);
  const completedCount = item.defi.participants.filter((p) => p.statut === "COMPLETE").length;
  const totalCount = item.defi.participants.length;
  const isCreator = item.defi.lanceParId === meId;
  const isCompleted = item.defi.statut === "TERMINE";

  return (
    <Link href={`/defis/${item.defi.id}`}>
      <Card className="flex flex-col gap-2 transition-colors hover:border-accent-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isCreator && <Crown className="size-3.5 shrink-0 text-gold" />}
            <p className="truncate text-sm font-medium">
              {item.defi.titre ?? item.defi.programme.nom}
            </p>
          </div>
          <StatusBadge
            myStatus={item.statut}
            defiStatus={item.defi.statut}
          />
        </div>

        {item.defi.titre && (
          <p className="text-[10px] text-muted">
            sur « {item.defi.programme.nom} »
          </p>
        )}

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {item.defi.participants.slice(0, 4).map((p) => (
              <Avatar
                key={p.id}
                name={p.user.pseudo}
                src={p.user.avatar}
                size={24}
                className="ring-2 ring-card"
              />
            ))}
            {item.defi.participants.length > 4 && (
              <div className="grid size-6 place-items-center rounded-full bg-bar-idle text-[8px] text-muted ring-2 ring-card">
                +{item.defi.participants.length - 4}
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-strong">
            {others.length === 1
              ? others[0].user.pseudo
              : `${totalCount} potes`}
          </span>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted">
            <Flag className="size-3" />
            {completedCount}/{totalCount}
          </div>
          <ChevronRight className="size-4 text-muted" />
        </div>

        {!isCompleted && item.statut === "ACCEPTE" && (
          <p className="text-[10px] text-accent-soft">
            ⚡ À toi de jouer — tap pour lancer ta séance
          </p>
        )}
      </Card>
    </Link>
  );
}

function StatusBadge({
  myStatus,
  defiStatus,
}: {
  myStatus: DefiPageItem["statut"];
  defiStatus: DefiPageItem["defi"]["statut"];
}) {
  if (defiStatus === "TERMINE" || myStatus === "COMPLETE") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-medium text-success">
        <CheckCircle2 className="size-2.5" /> Fait
      </span>
    );
  }
  if (myStatus === "REFUSE") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-danger/15 px-2 py-0.5 text-[9px] font-medium text-danger">
        <XCircle className="size-2.5" /> Refusé
      </span>
    );
  }
  if (myStatus === "ACCEPTE") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-bg px-2 py-0.5 text-[9px] font-medium text-accent-soft">
        <Zap className="size-2.5" /> À faire
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-medium text-warning">
      <Clock className="size-2.5" /> En attente
    </span>
  );
}

function humanDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
