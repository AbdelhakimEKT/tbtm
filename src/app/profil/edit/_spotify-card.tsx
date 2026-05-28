"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Music, Plug, Unplug, XCircle } from "lucide-react";

import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function SpotifyConnectCard({
  configured,
  connected,
  profile,
  flashStatus,
  flashMessage,
}: {
  configured: boolean;
  connected: boolean;
  profile: { displayName: string; productPremium: boolean } | null;
  flashStatus?: string;
  flashMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleDisconnect() {
    startTransition(async () => {
      await fetch("/api/spotify/disconnect", { method: "POST" });
      router.refresh();
    });
  }

  // Cas 1 : pas configuré côté env → on l'indique sans permettre la connexion
  if (!configured) {
    return (
      <Card className="flex flex-col gap-2">
        <CardLabel className="inline-flex items-center gap-1">
          <Music className="size-3 text-accent-soft" />
          Spotify
        </CardLabel>
        <p className="text-xs text-muted-strong">
          Le mini-player Spotify n&apos;est pas activé sur ce serveur — il manque
          les vars d&apos;env <code className="font-mono text-accent-soft">SPOTIFY_CLIENT_ID</code>{" "}
          et <code className="font-mono text-accent-soft">SPOTIFY_CLIENT_SECRET</code>.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardLabel className="inline-flex items-center gap-1">
        <Music className="size-3 text-accent-soft" />
        Spotify
      </CardLabel>

      {flashStatus === "ok" && (
        <div className="flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[11px] text-success">
          <CheckCircle2 className="size-3" />
          Spotify connecté ✓
        </div>
      )}
      {flashStatus === "error" && (
        <div className="flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] text-danger">
          <XCircle className="size-3" />
          Connexion échouée{flashMessage ? ` — ${flashMessage}` : ""}
        </div>
      )}

      {connected && profile ? (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-card-border bg-bg/40 px-3 py-2">
            <div className="grid size-8 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                Connecté en tant que {profile.displayName}
              </p>
              <p className="text-[10px] text-muted">
                {profile.productPremium
                  ? "Compte Premium · contrôle de lecture dispo"
                  : "Compte Free · lecture seule (contrôle = Premium uniquement)"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={pending}
            className="self-start text-danger"
          >
            <Unplug className="size-3.5" />
            {pending ? "..." : "Déconnecter Spotify"}
          </Button>
        </>
      ) : connected && !profile ? (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
            <Unplug className="size-4 text-warning" />
            <p className="flex-1 text-xs text-warning">
              Le token Spotify est invalide ou a été révoqué. Reconnecte-toi.
            </p>
          </div>
          <a
            href="/api/spotify/connect"
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm shadow-accent/30",
            )}
          >
            <Plug className="size-4" />
            Reconnecter Spotify
          </a>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-strong">
            Branche ton compte Spotify pour avoir le mini-player (titre +
            play/pause/skip) en mode séance live. Tu peux le déconnecter à tout
            moment, pas de partage de données autre que la lecture en cours.
          </p>
          <a
            href="/api/spotify/connect"
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm shadow-accent/30",
            )}
          >
            <Plug className="size-4" />
            Connecter Spotify
          </a>
        </>
      )}
    </Card>
  );
}
