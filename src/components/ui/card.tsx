import { cn } from "@/lib/cn";

export function Card({
  className,
  highlighted = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { highlighted?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border bg-card p-3",
        highlighted ? "border-accent-border" : "border-card-border",
        className,
      )}
      {...props}
    />
  );
}

export function CardLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-[10px] uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}
