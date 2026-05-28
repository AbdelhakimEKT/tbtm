"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, BarChart3, Plus, Apple, User } from "lucide-react";

import { cn } from "@/lib/cn";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
};

const items: Item[] = [
  { href: "/", label: "Accueil", icon: Home, match: (p) => p === "/" },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/seance/nouvelle", label: "Séance", icon: Plus },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const [activeSeance, setActiveSeance] = useState<{
    id: string;
  } | null>(null);

  // Check séance en cours : à chaque navigation + quand on revient sur l'onglet.
  // (Pas de polling permanent, ça spam la BDD pour rien.)
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/me/active-seance");
        if (cancelled) return;
        const data = await res.json();
        setActiveSeance(data.active ? { id: data.id } : null);
      } catch {
        // silencieux
      }
    }
    check();
    function onFocus() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname]);

  // On masque la nav sur les pages d'auth et de séance en direct (immersif)
  if (
    pathname.startsWith("/auth") ||
    /^\/seance\/[^/]+\/live/.test(pathname)
  ) {
    return null;
  }

  return (
    <nav className="sticky bottom-0 z-30 border-t border-card-border bg-bg/95 backdrop-blur-sm">
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 py-2 safe-area-bottom">
        {items.map((it) => {
          const Active = it.match ? it.match(pathname) : pathname.startsWith(it.href);
          const Icon = it.icon;
          const isCenter = it.label === "Séance";
          // Si séance en cours, le bouton central devient un raccourci direct
          // vers la séance et pulse pour signaler l'activité.
          const centerHref =
            isCenter && activeSeance ? `/seance/${activeSeance.id}/live` : it.href;
          const centerActive = isCenter && !!activeSeance;
          return (
            <li key={it.href}>
              <Link
                href={isCenter ? centerHref : it.href}
                aria-label={
                  isCenter && centerActive ? "Séance en cours" : it.label
                }
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] transition-colors",
                  Active
                    ? "text-accent-soft"
                    : "text-muted hover:text-muted-strong",
                  isCenter &&
                    "relative -mt-5 rounded-full bg-accent px-3 py-3 text-white shadow-lg shadow-accent/40 hover:bg-accent",
                  centerActive && "animate-pulse-accent",
                )}
              >
                <Icon className={cn(isCenter ? "size-5" : "size-5")} />
                {!isCenter && <span>{it.label}</span>}
                {centerActive && (
                  <span className="absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-success ring-2 ring-bg">
                    <span className="size-1.5 rounded-full bg-bg" />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
