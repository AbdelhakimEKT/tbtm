"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  FileEdit,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { StatutSeance } from "@prisma/client";

import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { deleteSeances } from "@/app/seance/_actions";

export type SeanceHistoriqueItem = {
  id: string;
  dateISO: string;
  statut: StatutSeance;
  manuelle: boolean;
  volumeKg: number;
  nbSets: number;
  programmeNom: string | null;
};

type Group = {
  key: string;
  label: string;
  seances: SeanceHistoriqueItem[];
};

export function HistoriqueListe({
  seances,
}: {
  seances: SeanceHistoriqueItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // Group par mois
  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of seances) {
      const d = new Date(s.dateISO);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
      if (!map.has(key)) map.set(key, { key, label, seances: [] });
      map.get(key)!.seances.push(s);
    }
    return Array.from(map.values());
  }, [seances]);

  function enterSelect() {
    setSelecting(true);
    setSelected(new Set());
  }

  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
    setConfirming(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInGroup(group: Group) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = group.seances.every((s) => next.has(s.id));
      if (allSelected) {
        for (const s of group.seances) next.delete(s.id);
      } else {
        for (const s of group.seances) next.add(s.id);
      }
      return next;
    });
  }

  function handleDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await deleteSeances(ids);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${res.deletedCount} séance${res.deletedCount > 1 ? "s" : ""} supprimée${res.deletedCount > 1 ? "s" : ""}` +
          (res.prsRemoved > 0
            ? ` · ${res.prsRemoved} PR${res.prsRemoved > 1 ? "s" : ""} retiré${res.prsRemoved > 1 ? "s" : ""}`
            : ""),
      );
      exitSelect();
      router.refresh();
    });
  }

  if (seances.length === 0) {
    return null;
  }

  return (
    <>
      {/* Toolbar mode sélection vs normal */}
      <div className="mb-3 flex items-center justify-between">
        {selecting ? (
          <>
            <button
              type="button"
              onClick={exitSelect}
              className="inline-flex items-center gap-1 text-[11px] text-muted-strong hover:text-fg"
            >
              <X className="size-3.5" /> Annuler
            </button>
            <span className="text-[11px] text-muted-strong">
              {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <>
            <span className="text-[11px] text-muted" />
            <button
              type="button"
              onClick={enterSelect}
              className="inline-flex items-center gap-1 text-[11px] text-accent-soft hover:underline"
            >
              Sélectionner
            </button>
          </>
        )}
      </div>

      <div className={cn("space-y-5", selecting && "pb-24")}>
        {groups.map((group) => {
          const allInGroupSelected =
            selecting &&
            group.seances.length > 0 &&
            group.seances.every((s) => selected.has(s.id));
          return (
            <section key={group.key}>
              <div className="mb-2 flex items-center justify-between px-1">
                <CardLabel>{group.label}</CardLabel>
                {selecting && (
                  <button
                    type="button"
                    onClick={() => selectAllInGroup(group)}
                    className="text-[10px] text-accent-soft hover:underline"
                  >
                    {allInGroupSelected ? "tout désél." : "tout sélec."}
                  </button>
                )}
              </div>
              <Card className="flex flex-col gap-1.5">
                {group.seances.map((s) => (
                  <SeanceRow
                    key={s.id}
                    item={s}
                    selecting={selecting}
                    selected={selected.has(s.id)}
                    onToggle={() => toggle(s.id)}
                  />
                ))}
              </Card>
            </section>
          );
        })}
      </div>

      {/* Sticky bottom bar en mode sélection */}
      {selecting && (
        <div className="fixed bottom-[68px] left-0 right-0 z-30 mx-auto max-w-md px-4 pb-2 safe-area-bottom">
          <Card highlighted className="flex items-center gap-2 border-danger/40 bg-danger/5">
            {!confirming ? (
              <>
                <p className="flex-1 text-xs">
                  {selected.size === 0
                    ? "Coche une ou plusieurs séances pour les supprimer"
                    : `${selected.size} séance${selected.size > 1 ? "s" : ""} à supprimer (PRs liés inclus)`}
                </p>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirming(true)}
                  disabled={selected.size === 0 || pending}
                >
                  <Trash2 className="size-3" /> Supprimer
                </Button>
              </>
            ) : (
              <>
                <p className="flex-1 text-xs">
                  Confirmer la suppression de {selected.size} séance
                  {selected.size > 1 ? "s" : ""} ?
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  Non
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={pending}
                >
                  {pending ? "..." : "Oui"}
                </Button>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function SeanceRow({
  item,
  selecting,
  selected,
  onToggle,
}: {
  item: SeanceHistoriqueItem;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const date = new Date(item.dateISO);
  const dateLabel = date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const statusIcon =
    item.statut === "ANNULEE" ? (
      <XCircle className="size-3.5 shrink-0 text-danger" />
    ) : item.manuelle ? (
      <FileEdit className="size-3.5 shrink-0 text-muted-strong" />
    ) : (
      <CheckCircle2 className="size-3.5 shrink-0 text-success" />
    );

  const content = (
    <>
      {selecting ? (
        <span
          aria-hidden
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-md border transition-colors",
            selected
              ? "border-accent bg-accent text-white"
              : "border-card-border bg-bg",
          )}
        >
          {selected && <span className="text-[10px] leading-none">✓</span>}
        </span>
      ) : (
        statusIcon
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">
          {item.programmeNom ?? "Séance libre"}
          {item.manuelle && (
            <span className="ml-1 text-[9px] font-normal text-muted">
              (passée)
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted">
          {dateLabel}
          {item.statut === "TERMINEE" && item.nbSets > 0 && (
            <>
              {" · "}
              {item.nbSets} série{item.nbSets > 1 ? "s" : ""}
              {item.volumeKg > 0 && (
                <> · {(item.volumeKg / 1000).toFixed(1)}t</>
              )}
            </>
          )}
          {item.statut === "ANNULEE" && " · abandonnée"}
        </p>
      </div>
      {!selecting && (
        <ChevronRight className="size-3.5 shrink-0 text-muted" />
      )}
    </>
  );

  if (selecting) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
          selected ? "bg-accent-bg" : "bg-bg hover:bg-bg/60",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={`/seance/${item.id}`}
      className="flex items-center gap-2 rounded-lg bg-bg px-2.5 py-2 transition-colors hover:bg-bg/60"
    >
      {content}
    </Link>
  );
}
