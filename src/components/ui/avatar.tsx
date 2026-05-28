import Image from "next/image";

import { cn } from "@/lib/cn";

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size / 2.4 }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-bg font-medium text-accent-soft",
        className,
      )}
    >
      {initials}
    </div>
  );
}
