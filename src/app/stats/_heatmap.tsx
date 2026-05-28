"use client";

import { useState } from "react";

import type { HeatmapCell } from "@/lib/stats";
import { cn } from "@/lib/cn";

const INTENSITY_COLOR = [
  "var(--color-bar-idle)",
  "var(--color-bar-1)",
  "var(--color-bar-2)",
  "var(--color-bar-3)",
  "var(--color-bar-4)",
];

const JOURS_FR = ["L", "M", "M", "J", "V", "S", "D"];
const MOIS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

export function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  if (cells.length === 0) return null;

  // Construit une grille semaines × 7 jours.
  // On commence par décaler pour aligner le premier jour à sa position dans la semaine (L=0...D=6).
  const firstDate = new Date(cells[0].date);
  const firstDow = (firstDate.getDay() + 6) % 7; // 0=Lun
  const grid: (HeatmapCell | null)[] = Array(firstDow).fill(null);
  grid.push(...cells);
  // Pad la fin pour finir sur dimanche
  while (grid.length % 7 !== 0) grid.push(null);

  const weeks = grid.length / 7;
  const columns: (HeatmapCell | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: (HeatmapCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      col.push(grid[w * 7 + d]);
    }
    columns.push(col);
  }

  // Labels mois (afficher au-dessus de la première semaine de chaque mois)
  const monthLabels = columns.map((col, idx) => {
    const firstNonNull = col.find((c) => c) ?? null;
    if (!firstNonNull) return "";
    const date = new Date(firstNonNull.date);
    if (date.getDate() <= 7) return MOIS_FR[date.getMonth()];
    if (idx === 0) return MOIS_FR[date.getMonth()];
    return "";
  });

  return (
    <div>
      <div className="flex items-start gap-1.5">
        {/* Labels jours */}
        <div className="flex flex-col gap-[2px] pt-[14px]">
          {JOURS_FR.map((j, i) => (
            <div
              key={i}
              className="flex h-[10px] items-center text-[8px] text-muted"
            >
              {i % 2 === 0 ? j : ""}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex flex-col gap-1">
            {/* Mois */}
            <div className="flex gap-[2px]">
              {monthLabels.map((m, i) => (
                <div
                  key={i}
                  className="w-[10px] text-[8px] text-muted"
                >
                  {m}
                </div>
              ))}
            </div>
            {/* Cellules */}
            <div className="flex gap-[2px]">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[2px]">
                  {col.map((cell, di) => (
                    <button
                      key={`${ci}-${di}`}
                      type="button"
                      onMouseEnter={() => cell && setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => cell && setHovered(cell)}
                      disabled={!cell}
                      aria-label={
                        cell
                          ? `${formatDateFR(cell.date)} : ${cell.volumeKg} kg, ${cell.count} séance${cell.count > 1 ? "s" : ""}`
                          : "Hors période"
                      }
                      className={cn(
                        "size-[10px] rounded-[2px] border border-transparent transition-transform",
                        cell && "hover:scale-150 hover:border-fg/50",
                        !cell && "opacity-0",
                      )}
                      style={{
                        background: cell
                          ? INTENSITY_COLOR[cell.intensity]
                          : "transparent",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="min-h-[14px] flex-1 text-[10px] text-muted-strong">
          {hovered ? (
            <span>
              <span className="font-medium">{formatDateFR(hovered.date)}</span>
              {" — "}
              {hovered.count === 0
                ? "Repos"
                : `${hovered.count} séance${hovered.count > 1 ? "s" : ""} · ${(hovered.volumeKg / 1000).toFixed(1)}t`}
            </span>
          ) : (
            "Survole un carré pour voir le détail"
          )}
        </div>
        <div className="flex items-center gap-1 text-[9px] text-muted">
          <span>Repos</span>
          {INTENSITY_COLOR.map((c, i) => (
            <div
              key={i}
              className="size-[8px] rounded-[2px]"
              style={{ background: c }}
            />
          ))}
          <span>Intense</span>
        </div>
      </div>
    </div>
  );
}

function formatDateFR(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
