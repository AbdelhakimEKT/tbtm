"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/cn";

const TABS = [
  { key: "mois", label: "Mois" },
  { key: "3mois", label: "3 mois" },
  { key: "annee", label: "Année" },
] as const;

export function PeriodTabs() {
  const params = useSearchParams();
  const current = params.get("period") ?? "mois";

  return (
    <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/stats?period=${t.key}`}
          scroll={false}
          className={cn(
            "flex-1 rounded-md py-1.5 text-center text-[11px] font-medium transition-colors",
            current === t.key
              ? "bg-accent text-white shadow-sm shadow-accent/30"
              : "text-muted-strong hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
