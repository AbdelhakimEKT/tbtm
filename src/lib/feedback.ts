/**
 * Helpers feedback utilisateur — vibration, sons synthétisés, confetti.
 * Tout est best-effort : si l'API n'est pas dispo (iOS Safari vibrate, etc.)
 * on no-op silencieusement.
 *
 * Aucune dépendance externe : sons via Web Audio, confetti via DOM brut.
 */

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (audioCtx) return audioCtx;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Vibre brièvement (mobile uniquement, iOS ignore silencieusement). */
export function haptic(pattern: number | number[] = 15) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

/** Petit "tic" satisfaisant pour valider une série. */
export function playValidateBeep() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
}

/** Fanfare courte pour célébrer un PR. */
export function playPrFanfare() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * 0.1 + 0.4,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.45);
    });
  } catch {
    // ignore
  }
}

/**
 * Confetti CSS-only : crée des div absolus avec animation,
 * les supprime après l'animation. Pas de lib externe.
 */
export function fireConfetti(count = 60) {
  if (typeof document === "undefined") return;
  const colors = [
    "#7c3aed", // accent
    "#a78bfa", // accent-soft
    "#ef9f27", // gold
    "#5dcaa5", // success
    "#ffffff",
  ];
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = 2.5 + Math.random() * 1.5;
    const color = colors[i % colors.length];
    piece.style.cssText = `
      position:absolute;
      top:-20px;
      left:${left}%;
      width:${size}px;
      height:${size * 0.4}px;
      background:${color};
      border-radius:2px;
      animation:confetti-fall ${duration}s ease-in ${delay}s forwards;
    `;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 5000);
}

/** Combo full pour valider une série : haptic + son discret. */
export function feedbackValidateSet() {
  haptic(15);
  playValidateBeep();
}

/** Combo full pour célébrer un PR : haptic long + fanfare + confetti. */
export function feedbackPR() {
  haptic([60, 50, 60, 50, 100]);
  playPrFanfare();
  fireConfetti(80);
}

/** Combo full pour fin de séance sans PR : juste haptic. */
export function feedbackEndSeance() {
  haptic([100, 80, 100]);
}
