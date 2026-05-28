"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { cn } from "@/lib/cn";

type CurrentTrack = {
  isPlaying: boolean;
  title: string;
  artists: string[];
  albumCover: string | null;
  durationMs: number;
  progressMs: number;
  url: string | null;
};

const POLL_INTERVAL_MS = 8000;

export function SpotifyMiniPlayer({
  className,
}: {
  className?: string;
}) {
  const [track, setTrack] = useState<CurrentTrack | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null); // null = unknown
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleRef = useRef(true);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        track: CurrentTrack | null;
        connected: boolean;
      };
      setConnected(data.connected || data.track !== null);
      setTrack(data.track);
    } catch {
      // ignore
    }
  }, []);

  // Poll régulier (pause si onglet en arrière-plan)
  useEffect(() => {
    fetchNowPlaying();
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval) return;
      interval = setInterval(() => {
        if (visibleRef.current) fetchNowPlaying();
      }, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (interval) clearInterval(interval);
      interval = null;
    }
    function onVisibility() {
      visibleRef.current = document.visibilityState === "visible";
      if (visibleRef.current) fetchNowPlaying();
    }

    startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchNowPlaying]);

  async function sendAction(action: "play" | "pause" | "next" | "previous") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur Spotify");
      }
      // Optimistic update : flip is_playing
      if (action === "play" || action === "pause") {
        setTrack((t) =>
          t ? { ...t, isPlaying: action === "play" } : t,
        );
      }
      // Re-fetch après une courte pause pour stabiliser
      setTimeout(fetchNowPlaying, 600);
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  // Pas connecté ou pas configuré → on n'affiche rien
  if (connected === false) return null;
  // Chargement initial : rien (évite un flash)
  if (connected === null && !track) return null;

  // Rien en lecture → mini-bandeau discret
  if (!track) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-card-border bg-card/80 px-3 py-1.5 text-[11px] text-muted-strong backdrop-blur-sm",
          className,
        )}
      >
        <Music className="size-3.5 text-accent-soft" />
        <span>Spotify connecté · rien en lecture</span>
      </div>
    );
  }

  const progressPct = track.durationMs > 0
    ? Math.min(100, (track.progressMs / track.durationMs) * 100)
    : 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-card-border bg-card/80 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        {track.albumCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.albumCover}
            alt=""
            className="size-9 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="grid size-9 shrink-0 place-items-center rounded bg-accent-bg text-accent-soft">
            <Music className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium leading-tight">
            {track.title}
          </p>
          <p className="truncate text-[9px] text-muted">
            {track.artists.join(", ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ControlBtn
            label="Précédent"
            onClick={() => sendAction("previous")}
            disabled={busy}
          >
            <SkipBack className="size-3.5" />
          </ControlBtn>
          <ControlBtn
            label={track.isPlaying ? "Pause" : "Lecture"}
            onClick={() => sendAction(track.isPlaying ? "pause" : "play")}
            disabled={busy}
            primary
          >
            {track.isPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </ControlBtn>
          <ControlBtn
            label="Suivant"
            onClick={() => sendAction("next")}
            disabled={busy}
          >
            <SkipForward className="size-3.5" />
          </ControlBtn>
        </div>
      </div>
      {/* Barre de progression discrète */}
      <div className="h-0.5 bg-bar-idle">
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      {error && (
        <p className="bg-danger/10 px-2 py-1 text-[9px] text-danger">{error}</p>
      )}
    </div>
  );
}

function ControlBtn({
  children,
  onClick,
  disabled,
  label,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid size-7 place-items-center rounded-full transition-transform active:scale-90 disabled:opacity-50",
        primary
          ? "bg-accent text-white shadow-sm shadow-accent/30"
          : "text-muted-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
