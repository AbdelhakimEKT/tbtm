"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ExoProgression } from "@/lib/stats";
import { Card, CardLabel } from "@/components/ui/card";

export function ProgressionChart({
  exos,
}: {
  exos: ExoProgression[];
}) {
  const [selectedId, setSelectedId] = useState<string>(() => exos[0]?.exerciceId ?? "");

  if (exos.length === 0) {
    return (
      <Card className="py-8 text-center text-xs text-muted-strong">
        Pas encore assez de données. Termine quelques séances pour voir tes
        progressions ici.
      </Card>
    );
  }

  const selected = exos.find((e) => e.exerciceId === selectedId) ?? exos[0];
  const data = selected.points.map((p) => ({
    ...p,
    label: formatShortDate(p.date),
  }));

  // Si une seule donnée, on duplique pour pouvoir tracer une ligne
  if (data.length === 1) data.push({ ...data[0] });

  const maxOneRm = Math.max(...data.map((d) => d.oneRm));
  const minOneRm = Math.min(...data.map((d) => d.oneRm));
  const yDomain: [number, number] = [
    Math.floor(minOneRm * 0.92),
    Math.ceil(maxOneRm * 1.08),
  ];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <CardLabel>Progression 1RM estimé</CardLabel>
        <select
          value={selected.exerciceId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="max-w-[55%] truncate rounded-md border border-card-border bg-bg px-2 py-1 text-[11px] outline-none focus:border-accent"
        >
          {exos.map((e) => (
            <option key={e.exerciceId} value={e.exerciceId}>
              {e.exerciceNom}
            </option>
          ))}
        </select>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-bar-idle)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--color-muted)"
              tick={{ fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              stroke="var(--color-muted)"
              tick={{ fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              domain={yDomain}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-card-border-strong)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              labelStyle={{ color: "var(--color-muted)" }}
              formatter={(value) => [`${value} kg`, "1RM"]}
            />
            <Line
              type="monotone"
              dataKey="oneRm"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-accent)" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted">
          {data.length} séance{data.length > 1 ? "s" : ""} loggée{data.length > 1 ? "s" : ""}
        </span>
        <span className="text-fg">
          Best :{" "}
          <span className="font-semibold text-gold">
            {Math.round(maxOneRm)} kg
          </span>
        </span>
      </div>
    </Card>
  );
}

function formatShortDate(yyyymmdd: string): string {
  const [, m, d] = yyyymmdd.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
