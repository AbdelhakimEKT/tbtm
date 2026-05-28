"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DetectedBarcode = { rawValue: string; format: string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (image: ImageBitmapSource | HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

const SUPPORTED_FORMATS = [
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "upc_a",
  "upc_e",
  "qr_code",
];

type Status =
  | "loading"
  | "ready"
  | "no-camera"
  | "denied"
  | "https-required"
  | "error";

export function BarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [strategy, setStrategy] = useState<"native" | "zxing" | "none">("none");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualCode, setManualCode] = useState("");

  const handleDetected = useCallback(
    (code: string) => {
      onDetect(code);
    },
    [onDetect],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("no-camera");
      return;
    }

    // Détecte HTTPS requis (iOS Safari : pas de caméra en HTTP sauf localhost)
    const isHttps = window.location.protocol === "https:";
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isHttps && !isLocalhost) {
      setStatus("https-required");
      return;
    }

    let stream: MediaStream | null = null;
    let stopDetection: (() => void) | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("ready");

        const HasNative = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor })
          .BarcodeDetector;
        if (HasNative) {
          setStrategy("native");
          stopDetection = startNativeDetection(HasNative);
        } else {
          setStrategy("zxing");
          stopDetection = await startZxingDetection();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("notallowed")
        ) {
          setStatus("denied");
        } else if (
          msg.toLowerCase().includes("secure") ||
          msg.toLowerCase().includes("https")
        ) {
          setStatus("https-required");
        } else {
          setStatus("error");
          setErrorMsg(msg);
        }
      }
    }

    function startNativeDetection(Ctor: BarcodeDetectorCtor): () => void {
      const detector = new Ctor({ formats: SUPPORTED_FORMATS });
      let raf = 0;
      let stopped = false;
      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code && /^\d{6,}$/.test(code)) {
              navigator.vibrate?.(100);
              stopped = true;
              handleDetected(code);
              return;
            }
          }
        } catch {
          // tolérance détection
        }
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
      return () => {
        stopped = true;
        if (raf) window.cancelAnimationFrame(raf);
      };
    }

    async function startZxingDetection(): Promise<() => void> {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      let stopped = false;

      const controls = await reader.decodeFromVideoElement(
        videoRef.current!,
        (result, _err, ctrls) => {
          if (stopped) return;
          if (result) {
            const code = result.getText();
            if (code && /^\d{6,}$/.test(code)) {
              navigator.vibrate?.(100);
              stopped = true;
              ctrls.stop();
              handleDetected(code);
            }
          }
        },
      );
      return () => {
        stopped = true;
        controls.stop();
      };
    }

    start();
    return () => {
      cancelled = true;
      stopDetection?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [handleDetected]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!/^\d{6,}$/.test(code)) {
      setErrorMsg("Le code doit contenir au moins 6 chiffres");
      return;
    }
    handleDetected(code);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <header className="flex items-center justify-between bg-bg/90 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid size-9 place-items-center rounded-full border border-card-border text-fg"
        >
          <X className="size-4" />
        </button>
        <span className="text-sm font-medium text-fg">
          Scanner un code-barre
        </span>
        <div className="size-9" />
      </header>

      <div className="relative flex-1 overflow-hidden bg-black">
        {(status === "loading" || status === "ready") && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative aspect-[3/2] w-3/4 max-w-xs">
                <div className="absolute -inset-x-1 -inset-y-1 rounded-xl border-2 border-accent shadow-[0_0_0_2000px_rgba(0,0,0,0.55)]" />
                <div className="absolute inset-x-0 top-1/2 h-px animate-pulse bg-accent" />
              </div>
            </div>
            {status === "loading" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <div className="flex flex-col items-center gap-2 text-white">
                  <Loader2 className="size-6 animate-spin" />
                  <p className="text-xs">Démarrage caméra…</p>
                </div>
              </div>
            )}
            {status === "ready" && strategy === "zxing" && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/80 px-2 py-1 text-[10px] text-muted-strong">
                Détection JS · vise droit, lumière OK
              </div>
            )}
          </>
        )}

        {status === "no-camera" && (
          <div className="grid h-full place-items-center px-6">
            <Card className="max-w-sm text-center">
              <Camera className="mx-auto size-8 text-muted" />
              <p className="mt-2 text-sm font-medium">Caméra inaccessible</p>
              <p className="mt-1 text-[11px] text-muted-strong">
                Ton navigateur ne donne pas accès à la caméra. Rentre le code
                à la main ci-dessous.
              </p>
            </Card>
          </div>
        )}

        {status === "https-required" && (
          <div className="grid h-full place-items-center px-6">
            <Card className="max-w-sm border-warning/40 bg-warning/5 text-center">
              <Camera className="mx-auto size-8 text-warning" />
              <p className="mt-2 text-sm font-medium">HTTPS requis</p>
              <p className="mt-1 text-[11px] text-muted-strong">
                Sur iOS Safari, la caméra ne marche qu&apos;en HTTPS. Connecte-toi
                via <code className="font-mono text-accent-soft">https://</code>
                {" "}au lieu de http. Le serveur de dev doit être démarré avec{" "}
                <code className="font-mono text-accent-soft">npm run dev:https</code>.
                <br />
                <br />
                En attendant, tu peux taper le code à la main ci-dessous.
              </p>
            </Card>
          </div>
        )}

        {status === "denied" && (
          <div className="grid h-full place-items-center px-6">
            <Card className="max-w-sm text-center">
              <Camera className="mx-auto size-8 text-warning" />
              <p className="mt-2 text-sm font-medium">Accès caméra refusé</p>
              <p className="mt-1 text-[11px] text-muted-strong">
                Autorise l&apos;app à utiliser ta caméra dans les paramètres du
                navigateur, ou rentre le code à la main ci-dessous.
              </p>
            </Card>
          </div>
        )}

        {status === "error" && (
          <div className="grid h-full place-items-center px-6">
            <Card className="max-w-sm border-danger/40 bg-danger/10 text-center text-danger">
              <p className="text-sm font-medium">Caméra inaccessible</p>
              <p className="mt-1 text-[11px]">{errorMsg}</p>
            </Card>
          </div>
        )}
      </div>

      <form
        onSubmit={handleManualSubmit}
        className="border-t border-card-border bg-bg/95 px-4 py-3 backdrop-blur-sm"
      >
        <label className="text-[10px] uppercase tracking-wide text-muted">
          Ou saisis le code à la main
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            value={manualCode}
            onChange={(e) =>
              setManualCode(e.target.value.replace(/\D/g, ""))
            }
            placeholder="ex. 3017620422003"
            className="h-10 flex-1 rounded-md border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
          <Button
            type="submit"
            size="md"
            disabled={!/^\d{6,}$/.test(manualCode)}
          >
            Valider
          </Button>
        </div>
      </form>
    </div>
  );
}
