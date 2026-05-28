import type { MuscleSlice } from "@/lib/stats";
import { MUSCLE_LABEL } from "@/lib/labels";

export function MuscleDistribution({ slices }: { slices: MuscleSlice[] }) {
  if (slices.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-strong">
        Pas encore de volume loggé sur la période.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {slices.map((s, i) => (
        <li key={s.muscle} className="flex items-center gap-2">
          <div className="w-20 shrink-0 text-[11px] text-fg">
            {MUSCLE_LABEL[s.muscle]}
          </div>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-bar-idle">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width]"
              style={{
                width: `${Math.max(2, s.pct)}%`,
                background: barColor(i),
              }}
            />
          </div>
          <div className="w-12 shrink-0 text-right text-[10px] text-muted-strong">
            {s.pct.toFixed(1)}%
          </div>
        </li>
      ))}
    </ul>
  );
}

function barColor(idx: number): string {
  // Dégradé violet selon l'ordre (plus c'est gros, plus c'est saturé)
  const stops = [
    "var(--color-bar-4)",
    "var(--color-bar-3)",
    "var(--color-bar-2)",
    "var(--color-bar-1)",
  ];
  return stops[idx] ?? stops[stops.length - 1];
}
