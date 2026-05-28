"use client";

import { useState, useTransition, useMemo, useDeferredValue, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import type { Materiel, Muscle } from "@prisma/client";

import {
  MATERIEL_LABEL,
  MUSCLE_GROUP_ORDER,
  MUSCLE_LABEL,
} from "@/lib/labels";
import { cn } from "@/lib/cn";

type Props = {
  initialQ: string;
  initialMuscles: Muscle[];
  initialMateriels: Materiel[];
};

export function ExerciceFilters({
  initialQ,
  initialMuscles,
  initialMateriels,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showFilters, setShowFilters] = useState(
    initialMuscles.length > 0 || initialMateriels.length > 0,
  );

  const [q, setQ] = useState(initialQ);
  const deferredQ = useDeferredValue(q);

  const muscles = useMemo(() => new Set(initialMuscles), [initialMuscles]);
  const materiels = useMemo(() => new Set(initialMateriels), [initialMateriels]);

  function buildUrl(next: {
    q?: string;
    muscles?: Set<Muscle>;
    materiels?: Set<Materiel>;
  }) {
    const params = new URLSearchParams();
    const newQ = next.q ?? q;
    const newMuscles = next.muscles ?? muscles;
    const newMateriels = next.materiels ?? materiels;

    if (newQ) params.set("q", newQ);
    for (const m of newMuscles) params.append("muscle", m.toLowerCase());
    for (const m of newMateriels) params.append("materiel", m.toLowerCase());

    const qs = params.toString();
    return qs ? `/exercices?${qs}` : "/exercices";
  }

  // Debounce search via deferred value + transition
  useEffect(() => {
    if (deferredQ === initialQ) return;
    startTransition(() => {
      router.replace(buildUrl({ q: deferredQ }), { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQ]);

  function toggleMuscle(m: Muscle) {
    const next = new Set(muscles);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    startTransition(() => {
      router.replace(buildUrl({ muscles: next }), { scroll: false });
    });
  }

  function toggleMateriel(m: Materiel) {
    const next = new Set(materiels);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    startTransition(() => {
      router.replace(buildUrl({ materiels: next }), { scroll: false });
    });
  }

  function reset() {
    setQ("");
    startTransition(() => {
      router.replace("/exercices", { scroll: false });
    });
  }

  const hasFilters = muscles.size > 0 || materiels.size > 0 || q.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-card-border bg-card px-3 focus-within:border-accent">
          <Search className="size-4 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un exercice…"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {q && (
            <button
              type="button"
              aria-label="Effacer"
              onClick={() => setQ("")}
              className="text-muted hover:text-fg"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          aria-pressed={showFilters}
          className={cn(
            "inline-flex h-10 items-center gap-1 rounded-lg border px-3 text-xs transition-colors",
            showFilters || muscles.size > 0 || materiels.size > 0
              ? "border-accent-border bg-accent-bg text-accent-soft"
              : "border-card-border bg-card text-muted-strong",
          )}
        >
          <Filter className="size-4" />
          {muscles.size + materiels.size > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">
              {muscles.size + materiels.size}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-card-border bg-card p-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">
            Muscles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUP_ORDER.map((m) => (
              <Chip
                key={m}
                label={MUSCLE_LABEL[m]}
                active={muscles.has(m)}
                onClick={() => toggleMuscle(m)}
              />
            ))}
          </div>
          <p className="mt-3 mb-1.5 text-[10px] uppercase tracking-wide text-muted">
            Matériel
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MATERIEL_LABEL) as Materiel[]).map((m) => (
              <Chip
                key={m}
                label={MATERIEL_LABEL[m]}
                active={materiels.has(m)}
                onClick={() => toggleMateriel(m)}
              />
            ))}
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="mt-3 text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Tout réinitialiser
            </button>
          )}
        </div>
      )}

      {isPending && (
        <div className="text-center text-[10px] text-muted">…</div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-accent-border bg-accent-bg text-accent-soft"
          : "border-card-border bg-bg text-muted-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
