"use client";

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const DISMISS_KEY = "tbtm-pwa-install-dismissed";
const SHOW_AFTER_VISITS = 3;
const VISITS_KEY = "tbtm-visits";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Banner discret qui propose à l'user d'installer TBTM en PWA après
 * quelques visites. Cache automatiquement si :
 *   - l'app est déjà installée (display-mode: standalone)
 *   - l'user a dismissed la suggestion
 *   - moins de 3 visites
 *
 * Sur Android Chrome : bouton "Installer" qui appelle beforeinstallprompt.
 * Sur iOS Safari : montre les instructions "Partager → Ajouter à l'écran d'accueil".
 */
export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Déjà installé ? On masque.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true);
    if (isStandalone) return;

    // Dismissed ? On masque.
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Compteur de visites
    const visitsRaw = localStorage.getItem(VISITS_KEY);
    const visits = visitsRaw ? Number(visitsRaw) : 0;
    const nextVisits = visits + 1;
    localStorage.setItem(VISITS_KEY, String(nextVisits));

    if (nextVisits < SHOW_AFTER_VISITS) return;

    // Détecte iOS (Safari)
    const ua = window.navigator.userAgent;
    const iosDetected =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIos(iosDetected);

    // Listen beforeinstallprompt (Android Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Sur iOS, pas d'event → on affiche quand même les instructions
    if (iosDetected) {
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      dismiss();
    }
    setInstallEvent(null);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 sm:bottom-4">
      <Card
        className={cn(
          "flex items-center gap-3 border-accent-border bg-accent-bg/95 shadow-lg backdrop-blur-sm animate-fade-up",
        )}
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
          {isIos ? (
            <Share2 className="size-4" />
          ) : (
            <Download className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">Ajoute TBTM à ton écran</p>
          <p className="text-[10px] text-muted-strong">
            {isIos
              ? "Partager → Ajouter à l'écran d'accueil"
              : "Une icône comme une vraie app, fonctionne offline"}
          </p>
        </div>
        {!isIos && installEvent && (
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-full bg-accent px-3 py-1.5 text-[10px] font-medium text-white"
          >
            Installer
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </Card>
    </div>
  );
}
