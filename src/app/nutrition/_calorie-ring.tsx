export function CalorieRing({
  consommees,
  cible,
  size = 140,
}: {
  consommees: number;
  cible: number;
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = cible > 0 ? Math.min(1.2, consommees / cible) : 0;
  const dashOffset = circumference * (1 - Math.min(1, pct));
  const restant = Math.max(0, cible - consommees);
  const over = consommees > cible;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bar-idle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? "var(--color-warning)" : "var(--color-accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">{Math.round(consommees)}</span>
        <span className="text-[10px] text-muted">/ {Math.round(cible)} kcal</span>
        <span
          className={
            over
              ? "mt-1 text-[10px] font-medium text-warning"
              : "mt-1 text-[10px] text-muted-strong"
          }
        >
          {over
            ? `+${Math.round(consommees - cible)} kcal`
            : `${Math.round(restant)} kcal restants`}
        </span>
      </div>
    </div>
  );
}

export function MacroBar({
  label,
  consommees,
  cible,
  unit = "g",
  color,
}: {
  label: string;
  consommees: number;
  cible: number;
  unit?: string;
  color: string;
}) {
  const pct = cible > 0 ? Math.min(1, consommees / cible) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-[10px]">
        <span className="font-medium text-fg">{label}</span>
        <span className="text-muted-strong">
          {Math.round(consommees)}
          <span className="text-muted">/{Math.round(cible)}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bar-idle">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
