"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Deux panels swipeables horizontalement avec scroll-snap.
 * Affiche des dots indicateurs en haut. L'utilisateur peut swiper gauche/droite
 * pour changer de panel, ou tap sur les dots pour naviguer directement.
 */
export function SwipePanels({
  labels,
  initialIndex = 0,
  children,
  onIndexChange,
}: {
  labels: string[];
  initialIndex?: number;
  children: React.ReactNode[];
  onIndexChange?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // Scrolle vers l'index initial au mount
  useEffect(() => {
    if (!containerRef.current) return;
    const panel = containerRef.current.children[initialIndex] as
      | HTMLElement
      | undefined;
    if (panel) {
      containerRef.current.scrollLeft = panel.offsetLeft;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Détecte le panel actif via scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollLeft, clientWidth } = containerRef.current;
    const newIndex = Math.round(scrollLeft / clientWidth);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < children.length) {
      setActiveIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  }, [activeIndex, children.length, onIndexChange]);

  function goToIndex(index: number) {
    if (!containerRef.current) return;
    const panel = containerRef.current.children[index] as
      | HTMLElement
      | undefined;
    if (panel) {
      containerRef.current.scrollTo({
        left: panel.offsetLeft,
        behavior: "smooth",
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Dots indicateurs en haut */}
      <div className="flex justify-center gap-1.5 py-1.5">
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToIndex(i)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-all",
              i === activeIndex
                ? "bg-accent text-white"
                : "text-muted hover:text-muted-strong",
            )}
            aria-label={`Aller à ${label}`}
            aria-current={i === activeIndex ? "page" : undefined}
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition-all",
                i === activeIndex ? "bg-white" : "bg-muted",
              )}
            />
            {label}
          </button>
        ))}
      </div>

      {/* Panels container avec scroll-snap */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children.map((panel, i) => (
          <div
            key={i}
            className="h-full w-full shrink-0 snap-start snap-always overflow-y-auto"
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}
