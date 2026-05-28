"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";

const JOURS_COURT = ["L", "M", "M", "J", "V", "S", "D"];

export function DateNav({ currentDate }: { currentDate: string }) {
  const router = useRouter();
  const today = todayLocal();
  const todayIso = toIsoDate(today);

  const date = parseLocalIsoDate(currentDate);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  const isToday = sameDay(date, today);
  const canGoForward = !isToday && date < today;

  // Strip de 7 jours autour de la date courante (centré sur la date sélectionnée)
  const stripDays = useMemo(() => {
    const days: Date[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      days.push(addDays(date, offset));
    }
    return days;
  }, [date]);

  // Date picker natif
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [pickerValue, setPickerValue] = useState(currentDate);
  useEffect(() => setPickerValue(currentDate), [currentDate]);

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (!v) return;
    setPickerValue(v);
    router.push(`/nutrition?date=${v}`);
  }

  const label = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Ligne principale : flèches + date label cliquable */}
      <div className="flex items-center gap-2">
        <Link
          href={`/nutrition?date=${toIsoDate(prev)}`}
          aria-label="Jour précédent"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-card-border bg-card text-muted-strong active:scale-95"
        >
          <ChevronLeft className="size-4" />
        </Link>

        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker?.()}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-card-border bg-card px-3 py-2 text-sm font-medium capitalize active:scale-[0.98]"
        >
          {isToday && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white">
              Aujourd&apos;hui
            </span>
          )}
          <span>{label}</span>
          <CalendarDays className="size-3.5 text-muted" />
        </button>

        <ForwardButton
          href={`/nutrition?date=${toIsoDate(next)}`}
          disabled={!canGoForward}
        />
      </div>

      {/* Strip horizontal des 7 derniers jours autour de la date */}
      <div className="flex justify-between gap-1">
        {stripDays.map((d) => {
          const iso = toIsoDate(d);
          const isFuture = d > today;
          const isSelected = sameDay(d, date);
          const isStripToday = sameDay(d, today);
          const weekday = (d.getDay() + 6) % 7; // 0 = Lundi

          if (isFuture) {
            return (
              <div
                key={iso}
                className="flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 opacity-30"
              >
                <span className="text-[9px] uppercase text-muted">
                  {JOURS_COURT[weekday]}
                </span>
                <span className="text-xs text-muted">
                  {d.getDate()}
                </span>
              </div>
            );
          }
          return (
            <Link
              key={iso}
              href={`/nutrition?date=${iso}`}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors",
                isSelected
                  ? "bg-accent text-white shadow-sm shadow-accent/30"
                  : isStripToday
                    ? "border border-accent-border bg-accent-bg text-accent-soft"
                    : "text-muted-strong hover:bg-card",
              )}
            >
              <span
                className={cn(
                  "text-[9px] uppercase",
                  isSelected ? "text-white/80" : "text-muted",
                )}
              >
                {JOURS_COURT[weekday]}
              </span>
              <span className="text-sm font-medium">{d.getDate()}</span>
            </Link>
          );
        })}
      </div>

      {/* Bouton "revenir aujourd'hui" si pas sur aujourd'hui */}
      {!isToday && (
        <Link
          href={`/nutrition?date=${todayIso}`}
          className="self-center rounded-full bg-accent-bg px-3 py-1 text-[10px] font-medium text-accent-soft hover:bg-accent/20"
        >
          ← Revenir à aujourd&apos;hui
        </Link>
      )}

      {/* Input date natif caché, déclenché par tap sur le label */}
      <input
        ref={dateInputRef}
        type="date"
        value={pickerValue}
        max={todayIso}
        onChange={handlePickerChange}
        className="sr-only"
        aria-label="Choisir une date"
      />
    </div>
  );
}

function ForwardButton({
  href,
  disabled,
}: {
  href: string;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <div
        aria-disabled
        className="grid size-10 shrink-0 place-items-center rounded-full border border-card-border bg-bg/40 text-muted/40"
      >
        <ChevronRight className="size-4" />
      </div>
    );
  }
  return (
    <Link
      href={href}
      aria-label="Jour suivant"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-card-border bg-card text-muted-strong active:scale-95"
    >
      <ChevronRight className="size-4" />
    </Link>
  );
}

// ----------------------------------------------------------------------------
// Helpers date (LOCAL timezone — on évite UTC sinon shifts foireux en France)
// ----------------------------------------------------------------------------

function todayLocal(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function parseLocalIsoDate(iso: string): Date {
  // "YYYY-MM-DD" → Date locale à minuit
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return todayLocal();
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date): string {
  // Format YYYY-MM-DD en LOCAL (pas en UTC) pour éviter les shifts.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
