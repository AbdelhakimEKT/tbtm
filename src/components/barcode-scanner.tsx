"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DetectedBarcode = { rawValue: string; format: string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (image: ImageBitmapSource | HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

// Formats pour produits alimentaires uniquement. On vire QR / code_128 / code_39
// qui ne servent à rien ici et ralentissent la détection native.
const FOOD_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

// Crop ROI : largeur de la zone centrale par rapport à la frame vidéo (en %).
// 0.85 = on garde 85% en largeur centré, 3:2 ratio comme le visuel.
const ROI_WIDTH_RATIO = 0.85;
const ROI_ASPECT = 3 / 2;

// Throttle détection : 80ms entre 2 essais (~12 FPS). RAF brut à 60 FPS surcharge
// le CPU mobile, on en garde rien de plus parce qu'une frame floue ne donnera
// jamais un code valide même en la regardant 60×/s.
const DETECT_INTERVAL_MS = 80;

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
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const trackRef = useRef<MediaStreamTrack | null>(null);

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
        // Haute résolution : sur mobile, 1080p donne assez de pixels au code
        // pour que la détection native soit quasi instantanée. `ideal` plutôt
        // que `min` pour qu'un device modeste retombe sur sa max naturelle.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("ready");

        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        // Autofocus continu + détection capabilities. Pas standard partout,
        // donc try/catch silencieux. Sur Android Chrome / iOS Safari 17+ c'est
        // souvent dispo et change tout pour la fiabilité.
        try {
          const caps = (
            track.getCapabilities?.() as MediaTrackCapabilities & {
              focusMode?: string[];
              torch?: boolean;
            }
          ) ?? {};
          const advanced: MediaTrackConstraintSet[] = [];
          if (caps.focusMode?.includes("continuous")) {
            advanced.push({
              focusMode: "continuous",
            } as MediaTrackConstraintSet);
          }
          if (advanced.length > 0) {
            await track.applyConstraints({ advanced }).catch(() => {});
          }
          if (caps.torch) setTorchAvailable(true);
        } catch {
          // tant pis
        }

        const HasNative = (
          window as Window & { BarcodeDetector?: BarcodeDetectorCtor }
        ).BarcodeDetector;
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
      const detector = new Ctor({ formats: FOOD_FORMATS });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let stopped = false;
      let lastTick = 0;
      let lastSeenCode: string | null = null;
      let lastSeenAt = 0;
      let raf = 0;

      const tick = async (t: number) => {
        if (stopped || !videoRef.current) return;
        if (t - lastTick < DETECT_INTERVAL_MS) {
          raf = window.requestAnimationFrame(tick);
          return;
        }
        lastTick = t;

        const video = videoRef.current;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw === 0 || vh === 0 || !ctx) {
          raf = window.requestAnimationFrame(tick);
          return;
        }

        // Crop la zone centrale (le rectangle viseur) avant de détecter. Plus
        // petit que la frame complète → analyse + rapide + moins de faux
        // positifs sur un texte ou logo qui traînerait au bord.
        const roiW = vw * ROI_WIDTH_RATIO;
        const roiH = roiW / ROI_ASPECT;
        const roiX = (vw - roiW) / 2;
        const roiY = (vh - roiH) / 2;
        canvas.width = Math.floor(roiW);
        canvas.height = Math.floor(roiH);
        ctx.drawImage(
          video,
          roiX,
          roiY,
          roiW,
          roiH,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        try {
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code && isValidFoodBarcode(code)) {
              // Double-confirmation : on attend de voir le même code 2 fois
              // (et dans la fenêtre 1s) pour valider. Évite les faux positifs
              // d'un OCR moisi. Si on revoit le même code dans la fenêtre on
              // accepte ; sinon on reset.
              const now = Date.now();
              if (lastSeenCode === code && now - lastSeenAt < 1000) {
                navigator.vibrate?.(100);
                stopped = true;
                handleDetected(code);
                return;
              }
              lastSeenCode = code;
              lastSeenAt = now;
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
      let lastSeenCode: string | null = null;
      let lastSeenAt = 0;

      const controls = await reader.decodeFromVideoElement(
        videoRef.current!,
        (result, _err, ctrls) => {
          if (stopped) return;
          if (result) {
            const code = result.getText();
            if (code && isValidFoodBarcode(code)) {
              const now = Date.now();
              if (lastSeenCode === code && now - lastSeenAt < 1000) {
                navigator.vibrate?.(100);
                stopped = true;
                ctrls.stop();
                handleDetected(code);
                return;
              }
              lastSeenCode = code;
              lastSeenAt = now;
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
      trackRef.current = null;
    };
  }, [handleDetected]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // Ignore — le device a probablement perdu le support entre temps.
    }
  }

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
        {torchAvailable ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label={torchOn ? "Éteindre le flash" : "Allumer le flash"}
            aria-pressed={torchOn}
            className={`grid size-9 place-items-center rounded-full border ${
              torchOn
                ? "border-gold bg-gold/15 text-gold"
                : "border-card-border text-fg"
            }`}
          >
            <Zap className="size-4" />
          </button>
        ) : (
          <div className="size-9" />
        )}
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

// ----------------------------------------------------------------------------
// Validation : on n'accepte que des codes alimentaires (EAN-13, EAN-8, UPC-A,
// UPC-E) avec checksum correct. Les autres formats numériques (Code 128, etc.)
// peuvent matcher \d{6,} mais ne sont pas pertinents pour la nutrition.
// ----------------------------------------------------------------------------

function isValidFoodBarcode(code: string): boolean {
  if (code.length === 13) return isValidEan13(code);
  if (code.length === 12) return isValidUpcA(code);
  if (code.length === 8) return isValidEan8(code);
  return false;
}

function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

function isValidEan8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[7];
}

function isValidUpcA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[11];
}
