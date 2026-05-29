"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  History,
  PauseOctagon,
  Plus,
  Star,
  Timer as TimerIcon,
  X,
  StickyNote,
} from "lucide-react";
import type { Muscle } from "@prisma/client";

import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberPicker } from "@/components/ui/number-picker";
import { SpotifyMiniPlayer } from "@/components/spotify-mini-player";
import { SwipePanels } from "@/components/swipe-panels";
import { MUSCLE_LABEL } from "@/lib/labels";
import {
  feedbackEndSeance,
  feedbackPR,
  feedbackValidateSet,
} from "@/lib/feedback";
import { formatDuree, formatDureeMMSS, type Suggestion } from "@/lib/seance";
import { cn } from "@/lib/cn";

import {
  abortSeance,
  finishSeance,
  unvalidateSet,
  updateNoteDeForme,
  updateSetNote,
  validateSet,
} from "@/app/seance/_actions";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type HistorySet = {
  poidsKg: number;
  bwPlusKg: number | null;
  reps: number;
  rir: number | null;
};

export type HistorySession = {
  seanceId: string;
  dateISO: string;
  sets: HistorySet[];
};

export type LiveExerciceData = {
  id: string; // programmeExercice.id
  ordre: number;
  seriesCibles: number;
  repsCibles: number;
  poidsCible: number | null;
  bwPlusKg: number | null;
  tempsRecupSec: number;
  notes: string | null;
  exercice: {
    id: string;
    nom: string;
    muscles: Muscle[];
    isLeste: boolean;
  };
  suggestion: Suggestion;
  history: HistorySession[];
  validatedSets: ValidatedSet[];
};

type ValidatedSet = {
  id: string;
  ordre: number;
  poidsKg: number;
  bwPlusKg: number | null;
  reps: number;
  rir: number | null;
  isBonus: boolean;
  notes: string | null;
};

type Props = {
  seanceId: string;
  programmeNom: string;
  startedAt: string;
  noteDeFormeDuJour: number | null;
  exercices: LiveExerciceData[];
};

// ----------------------------------------------------------------------------
// Composant principal
// ----------------------------------------------------------------------------

export function LiveSeance({
  seanceId,
  programmeNom,
  startedAt,
  noteDeFormeDuJour: initialNote,
  exercices: initialExercices,
}: Props) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(() => {
    // Démarre sur le premier exo avec des séries non complétées
    const idx = initialExercices.findIndex(
      (e) => e.validatedSets.filter((s) => !s.isBonus).length < e.seriesCibles,
    );
    return idx === -1 ? 0 : idx;
  });

  // Sets validés (modifiable localement après validation/devalidation)
  const [exercices, setExercices] = useState(initialExercices);
  const [note, setNote] = useState<number | null>(initialNote);
  const [noteDismissed, setNoteDismissed] = useState(initialNote != null);
  const [error, setError] = useState<string | null>(null);

  // Timer durée séance (mm:ss)
  const startTime = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const dureeSec = useDurationCounter(startTime);

  // Timer récup
  const recup = useRecupTimer();

  // Wake lock pour empêcher l'écran de s'éteindre
  useWakeLock();

  // Confirmation modals
  const [confirmingAbort, setConfirmingAbort] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);

  const currentExo = exercices[currentIdx];

  const totalValidated = exercices.reduce(
    (acc, e) => acc + e.validatedSets.length,
    0,
  );
  const totalPlanned = exercices.reduce(
    (acc, e) => acc + e.seriesCibles,
    0,
  );
  const totalVolume = exercices.reduce((acc, e) => {
    return (
      acc +
      e.validatedSets.reduce(
        (a, s) => a + ((s.poidsKg ?? 0) + (s.bwPlusKg ?? 0)) * s.reps,
        0,
      )
    );
  }, 0);

  function goPrev() {
    setCurrentIdx((i) => Math.max(0, i - 1));
  }
  function goNext() {
    setCurrentIdx((i) => Math.min(exercices.length - 1, i + 1));
  }

  function updateLocalValidated(exoId: string, sets: ValidatedSet[]) {
    setExercices((prev) =>
      prev.map((e) =>
        e.exercice.id === exoId ? { ...e, validatedSets: sets } : e,
      ),
    );
  }

  async function handleValidate(args: {
    exerciceId: string;
    ordre: number;
    poidsKg: number;
    bwPlusKg: number | null;
    reps: number;
    rir: number | null;
    isBonus: boolean;
  }) {
    setError(null);
    // Optimistic : ajoute / met à jour localement
    const exo = exercices.find((e) => e.exercice.id === args.exerciceId);
    if (!exo) return;

    const optimisticId = `tmp-${args.exerciceId}-${args.ordre}-${args.isBonus}`;
    const optimistic: ValidatedSet = {
      id: optimisticId,
      ordre: args.ordre,
      poidsKg: args.poidsKg,
      bwPlusKg: args.bwPlusKg,
      reps: args.reps,
      rir: args.rir,
      isBonus: args.isBonus,
      notes: null,
    };

    // Remplace si déjà présent à ce (ordre, isBonus), sinon ajoute
    const filtered = exo.validatedSets.filter(
      (s) => !(s.ordre === args.ordre && s.isBonus === args.isBonus),
    );
    const newSets = [...filtered, optimistic].sort(
      (a, b) =>
        Number(a.isBonus) - Number(b.isBonus) || a.ordre - b.ordre,
    );
    updateLocalValidated(args.exerciceId, newSets);

    // Feedback satisfaction : haptic + son
    feedbackValidateSet();

    // Lance la récup
    recup.start(exo.tempsRecupSec);

    // Persistance serveur
    const res = await validateSet(seanceId, args);
    if (!res.ok) {
      setError(res.error);
      // revert
      updateLocalValidated(args.exerciceId, exo.validatedSets);
      recup.stop();
      return;
    }
    // Remplace l'id temporaire par l'id réel
    updateLocalValidated(
      args.exerciceId,
      newSets.map((s) => (s.id === optimisticId ? { ...s, id: res.setId } : s)),
    );
  }

  async function handleUnvalidate(exoId: string, setId: string) {
    setError(null);
    const exo = exercices.find((e) => e.exercice.id === exoId);
    if (!exo) return;
    const prevSets = exo.validatedSets;
    updateLocalValidated(exoId, prevSets.filter((s) => s.id !== setId));

    if (!setId.startsWith("tmp-")) {
      const res = await unvalidateSet(seanceId, setId);
      if (!res.ok) {
        setError(res.error);
        updateLocalValidated(exoId, prevSets);
      }
    }
  }

  async function handleNoteChange(n: number) {
    setNote(n);
    setNoteDismissed(true);
    await updateNoteDeForme(seanceId, n);
  }

  async function handleUpdateSetNote(
    exoId: string,
    setId: string,
    notes: string | null,
  ) {
    setError(null);
    const exo = exercices.find((e) => e.exercice.id === exoId);
    if (!exo) return;
    const prevSets = exo.validatedSets;
    const cleaned = notes && notes.trim().length > 0 ? notes.trim() : null;
    // Optimistic
    updateLocalValidated(
      exoId,
      prevSets.map((s) => (s.id === setId ? { ...s, notes: cleaned } : s)),
    );
    // Skip serveur pour les sets pas encore persistés (tmp-)
    if (setId.startsWith("tmp-")) return;
    const res = await updateSetNote(seanceId, setId, cleaned);
    if (!res.ok) {
      setError(res.error);
      updateLocalValidated(exoId, prevSets);
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <TopBar
        programmeNom={programmeNom}
        dureeSec={dureeSec}
        progress={totalValidated / Math.max(1, totalPlanned)}
        currentIdx={currentIdx}
        total={exercices.length}
        volumeKg={totalVolume}
        onAbort={() => setConfirmingAbort(true)}
      />

      <div className="flex flex-1 min-h-0 flex-col">
        <SwipePanels labels={["Séance", "🎵 Spotify"]}>
          <div className="px-4 py-3">
            {!noteDismissed && note == null && (
              <NoteDeFormeBanner
                onSelect={handleNoteChange}
                onDismiss={() => setNoteDismissed(true)}
              />
            )}

            {currentExo && (
              <ExerciceBloc
                exo={currentExo}
                onValidate={handleValidate}
                onUnvalidate={(setId) =>
                  handleUnvalidate(currentExo.exercice.id, setId)
                }
                onUpdateNote={(setId, notes) =>
                  handleUpdateSetNote(currentExo.exercice.id, setId, notes)
                }
                isLastExo={currentIdx === exercices.length - 1}
                onGoNext={
                  currentIdx < exercices.length - 1 ? goNext : undefined
                }
                onFinishSeance={() => setConfirmingFinish(true)}
              />
            )}

            {error && (
              <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}
          </div>

          <div className="px-4 py-3">
            <SpotifyPanel />
          </div>
        </SwipePanels>
      </div>

      {recup.active && (
        <RecupBar
          remaining={recup.remaining}
          total={recup.target}
          onAddTime={() => recup.add(30)}
          onSkip={() => recup.stop()}
        />
      )}

      <NavBar
        canPrev={currentIdx > 0}
        canNext={currentIdx < exercices.length - 1}
        isLast={currentIdx === exercices.length - 1}
        onPrev={goPrev}
        onNext={goNext}
        onFinish={() => setConfirmingFinish(true)}
      />

      {confirmingAbort && (
        <ConfirmAbort
          seanceId={seanceId}
          onCancel={() => setConfirmingAbort(false)}
        />
      )}
      {confirmingFinish && (
        <ConfirmFinish
          seanceId={seanceId}
          totalValidated={totalValidated}
          onCancel={() => setConfirmingFinish(false)}
          onDone={(id) => router.push(`/seance/${id}`)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Top bar
// ----------------------------------------------------------------------------

function TopBar({
  programmeNom,
  dureeSec,
  progress,
  currentIdx,
  total,
  volumeKg,
  onAbort,
}: {
  programmeNom: string;
  dureeSec: number;
  progress: number;
  currentIdx: number;
  total: number;
  volumeKg: number;
  onAbort: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-card-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAbort}
          aria-label="Abandonner"
          className="grid size-9 place-items-center rounded-full border border-card-border bg-card text-muted-strong hover:border-danger/40 hover:text-danger"
        >
          <X className="size-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-medium">{programmeNom}</p>
          <p className="text-[10px] text-muted">
            Exo {currentIdx + 1}/{total} · {formatDuree(dureeSec)} ·{" "}
            {volumeKg > 0 ? `${(volumeKg / 1000).toFixed(1)}t` : "0kg"}
          </p>
        </div>
        <div className="size-9" />
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bar-idle">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
    </header>
  );
}

// ----------------------------------------------------------------------------
// Bloc exercice (header + sets)
// ----------------------------------------------------------------------------

function ExerciceBloc({
  exo,
  onValidate,
  onUnvalidate,
  onUpdateNote,
  isLastExo,
  onGoNext,
  onFinishSeance,
}: {
  exo: LiveExerciceData;
  onValidate: (args: {
    exerciceId: string;
    ordre: number;
    poidsKg: number;
    bwPlusKg: number | null;
    reps: number;
    rir: number | null;
    isBonus: boolean;
  }) => Promise<void>;
  onUnvalidate: (setId: string) => void;
  onUpdateNote: (setId: string, notes: string | null) => void;
  isLastExo: boolean;
  onGoNext?: () => void;
  onFinishSeance: () => void;
}) {
  // Construire la liste des séries planifiées + bonus déjà ajoutés
  const validatedMap = useMemo(() => {
    const m = new Map<string, ValidatedSet>();
    exo.validatedSets.forEach((s) =>
      m.set(`${s.isBonus ? "b" : "p"}-${s.ordre}`, s),
    );
    return m;
  }, [exo.validatedSets]);

  // Lignes : ordre 1..seriesCibles (planifiées) + lignes bonus existantes
  const plannedRows = Array.from({ length: exo.seriesCibles }, (_, i) => ({
    ordre: i + 1,
    isBonus: false,
    done: validatedMap.get(`p-${i + 1}`),
  }));
  const bonusRows = exo.validatedSets
    .filter((s) => s.isBonus)
    .map((s) => ({ ordre: s.ordre, isBonus: true, done: s }));

  // Prochaine ligne active = première non-done planifiée. S'il n'y a pas, on
  // peut ajouter un bonus.
  const firstActive = plannedRows.find((r) => !r.done);

  return (
    <section>
      <h1 className="text-xl font-semibold leading-tight">{exo.exercice.nom}</h1>
      <div className="mt-1 flex flex-wrap gap-1">
        {exo.exercice.muscles.slice(0, 4).map((m) => (
          <span
            key={m}
            className="rounded-full bg-accent-bg px-2 py-0.5 text-[10px] text-accent-soft"
          >
            {MUSCLE_LABEL[m]}
          </span>
        ))}
        {exo.exercice.isLeste && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">
            Lestable
          </span>
        )}
      </div>

      {exo.notes && (
        <p className="mt-2 text-[11px] italic text-muted">{exo.notes}</p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <Card className="py-2">
          <CardLabel>Plan</CardLabel>
          <p className="text-sm font-medium">
            {exo.seriesCibles}×{exo.repsCibles}
          </p>
        </Card>
        <Card className="py-2">
          <CardLabel>Récup</CardLabel>
          <p className="text-sm font-medium">{formatDureeMMSS(exo.tempsRecupSec)}</p>
        </Card>
        <Card className="py-2">
          <CardLabel>Charge</CardLabel>
          <p className="text-sm font-medium">
            {formatPoidsSuggestion(exo)}
          </p>
        </Card>
      </div>

      {exo.suggestion.reason === "last-session" &&
        exo.suggestion.fromReps != null && (
          <p className="mt-2 text-[11px] text-muted-strong">
            ⏮ Dernière fois :{" "}
            <span className="font-semibold text-fg">
              {exo.exercice.isLeste
                ? exo.suggestion.fromBwPlusKg != null
                  ? `BW+${exo.suggestion.fromBwPlusKg}`
                  : "BW"
                : `${exo.suggestion.fromPoidsKg}kg`}{" "}
              × {exo.suggestion.fromReps}
            </span>
            {exo.suggestion.hitTargetLastTime && (
              <span className="ml-2 text-success">
                · t&apos;avais tenu, tente +2.5kg si tu sens
              </span>
            )}
          </p>
        )}

      {exo.history.length > 0 && (
        <HistoryPanel exo={exo} />
      )}

      <Card className="mt-3 p-0 overflow-hidden">
        <ul>
          {plannedRows.map((row) => (
            <SetRow
              key={`p-${row.ordre}`}
              exo={exo}
              ordre={row.ordre}
              isBonus={false}
              done={row.done}
              isActive={!row.done && row.ordre === firstActive?.ordre}
              onValidate={onValidate}
              onUnvalidate={onUnvalidate}
              onUpdateNote={onUpdateNote}
            />
          ))}
          {bonusRows.map((row) => (
            <SetRow
              key={`b-${row.ordre}`}
              exo={exo}
              ordre={row.ordre}
              isBonus
              done={row.done}
              isActive={false}
              onValidate={onValidate}
              onUnvalidate={onUnvalidate}
              onUpdateNote={onUpdateNote}
            />
          ))}
          {/* Ligne "Ajouter une série bonus" */}
          {!firstActive && (
            <AddBonusRow
              exo={exo}
              onValidate={onValidate}
              nextOrdre={
                (bonusRows[bonusRows.length - 1]?.ordre ?? exo.seriesCibles) + 1
              }
            />
          )}
        </ul>
      </Card>

      {!firstActive && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-center text-xs text-success">
            ✅ Tous les sets prévus sont faits
          </p>
          {isLastExo ? (
            <button
              type="button"
              onClick={onFinishSeance}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
            >
              <Flag className="size-4" /> Terminer la séance
            </button>
          ) : onGoNext ? (
            <button
              type="button"
              onClick={onGoNext}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
            >
              Exercice suivant <ChevronRight className="size-4" />
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Historique : panneau dépliable avec les N dernières séances sur cet exo
// ----------------------------------------------------------------------------

function HistoryPanel({ exo }: { exo: LiveExerciceData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-accent-soft hover:underline"
        aria-expanded={open}
      >
        <History className="size-3" />
        Historique ({exo.history.length})
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {exo.history.map((session) => {
            const d = new Date(session.dateISO);
            const dateLabel = d.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            });
            return (
              <li
                key={session.seanceId}
                className="rounded-lg bg-bg/60 px-2.5 py-2 text-[11px]"
              >
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">
                  {dateLabel}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {session.sets.map((s, i) => {
                    const charge = exo.exercice.isLeste
                      ? s.bwPlusKg != null
                        ? `BW+${s.bwPlusKg}`
                        : "BW"
                      : `${s.poidsKg}kg`;
                    return (
                      <span
                        key={i}
                        className="inline-flex items-baseline gap-0.5 rounded bg-card px-1.5 py-0.5"
                      >
                        <span className="font-medium text-fg">{charge}</span>
                        <span className="text-muted">×</span>
                        <span className="font-medium text-fg">{s.reps}</span>
                        {s.rir != null && (
                          <span className="ml-1 text-[9px] text-muted">
                            RIR {s.rir}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Spotify panel (swipe right depuis la séance)
// ----------------------------------------------------------------------------

function SpotifyPanel() {
  return (
    <div className="flex flex-col gap-3">
      <Card highlighted className="flex flex-col gap-2">
        <CardLabel className="text-accent-soft/80">🎵 Spotify</CardLabel>
        <p className="text-[11px] text-muted-strong">
          Contrôle ta musique sans quitter ta séance. Si t&apos;es pas connecté,
          va sur ton profil pour connecter Spotify.
        </p>
      </Card>
      <SpotifyMiniPlayer />
      <p className="mt-2 text-center text-[10px] text-muted">
        Swipe ← pour revenir à la séance
      </p>
    </div>
  );
}

function formatPoidsSuggestion(exo: LiveExerciceData): string {
  const s = exo.suggestion;
  if (exo.exercice.isLeste) {
    return s.bwPlusKg && s.bwPlusKg > 0 ? `BW+${s.bwPlusKg}` : "BW";
  }
  return s.poidsKg != null ? `${s.poidsKg}kg` : "—";
}

// ----------------------------------------------------------------------------
// SetRow : une ligne de série
// ----------------------------------------------------------------------------

function SetRow({
  exo,
  ordre,
  isBonus,
  done,
  isActive,
  onValidate,
  onUnvalidate,
  onUpdateNote,
}: {
  exo: LiveExerciceData;
  ordre: number;
  isBonus: boolean;
  done: ValidatedSet | undefined;
  isActive: boolean;
  onValidate: (args: {
    exerciceId: string;
    ordre: number;
    poidsKg: number;
    bwPlusKg: number | null;
    reps: number;
    rir: number | null;
    isBonus: boolean;
  }) => Promise<void>;
  onUnvalidate: (setId: string) => void;
  onUpdateNote: (setId: string, notes: string | null) => void;
}) {
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(done?.notes ?? "");

  // Resync draft si la note change ailleurs (ex: serveur, autre tab)
  useEffect(() => {
    if (!noteEditing) setNoteDraft(done?.notes ?? "");
  }, [done?.notes, noteEditing]);
  const defaultPoids = exo.exercice.isLeste
    ? String(exo.suggestion.bwPlusKg ?? exo.bwPlusKg ?? 0)
    : String(exo.suggestion.poidsKg ?? exo.poidsCible ?? 0);
  // Reps default = celles de la dernière séance si dispo, sinon plan
  const defaultReps = String(exo.suggestion.fromReps ?? exo.repsCibles);

  const [poids, setPoids] = useState(
    done
      ? String(exo.exercice.isLeste ? done.bwPlusKg ?? 0 : done.poidsKg)
      : defaultPoids,
  );
  const [reps, setReps] = useState(
    done ? String(done.reps) : defaultReps,
  );
  const [rir, setRir] = useState(done?.rir != null ? String(done.rir) : "");

  const [pending, startTransition] = useTransition();

  function handleValidate() {
    const poidsNum = Number(poids) || 0;
    const repsNum = Number(reps) || 0;
    const rirNum = rir === "" ? null : Number(rir);

    startTransition(async () => {
      await onValidate({
        exerciceId: exo.exercice.id,
        ordre,
        poidsKg: exo.exercice.isLeste ? 0 : poidsNum,
        bwPlusKg: exo.exercice.isLeste ? poidsNum : null,
        reps: repsNum,
        rir: rirNum,
        isBonus,
      });
    });
  }

  // Active row : layout dédié, gros, lisible
  if (isActive) {
    const isLeste = exo.exercice.isLeste;
    return (
      <li className="border-b border-card-border bg-accent-bg/30 px-3 py-3 last:border-b-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-soft">
            <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-white">
              {isBonus ? "B" : ordre}
            </span>
            Série en cours
          </span>
          <button
            type="button"
            aria-label="Valider cette série"
            onClick={handleValidate}
            disabled={pending}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white shadow-sm shadow-accent/30 active:scale-95",
              pending && "opacity-50",
            )}
          >
            <Check className="size-3.5" />
            Valider
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberPicker
            label="Poids"
            value={poids}
            onChange={setPoids}
            step={2.5}
            unit={isLeste ? "+kg" : "kg"}
          />
          <NumberPicker
            label="Reps"
            value={reps}
            onChange={setReps}
            step={1}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            RIR (optionnel)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={rir}
            onChange={(e) => setRir(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="—"
            className="h-8 w-12 rounded-md border border-card-border bg-bg/60 px-2 text-center text-sm outline-none focus:border-accent"
          />
          <span className="text-[9px] text-muted">
            (reps en réserve)
          </span>
        </div>
      </li>
    );
  }

  // Done & pending non-actives : grid compacte
  return (
    <li
      className={cn(
        "border-b border-card-border last:border-b-0 transition-colors",
        done && "bg-success/5",
      )}
    >
      <div
        className={cn(
          "grid items-center gap-2 px-3 py-2",
          done
            ? "grid-cols-[32px_1fr_1fr_50px_22px_32px]"
            : "grid-cols-[32px_1fr_1fr_50px_32px]",
        )}
      >
        <span className="text-xs font-medium text-muted">
          {isBonus ? "B" : ""}
          {ordre}
        </span>

        {done ? (
          <>
            <span className="text-sm">
              {exo.exercice.isLeste
                ? done.bwPlusKg != null
                  ? `BW+${done.bwPlusKg}`
                  : "BW"
                : `${done.poidsKg}kg`}
            </span>
            <span className="text-sm">{done.reps}</span>
            <span className="text-xs text-muted">
              {done.rir != null ? done.rir : "—"}
            </span>
            <button
              type="button"
              aria-label={done.notes ? "Voir/éditer la note" : "Ajouter une note"}
              onClick={() => setNoteEditing((o) => !o)}
              className="grid size-5 place-items-center justify-self-center rounded-full text-muted hover:text-fg"
            >
              <span
                className={cn(
                  "block size-1.5 rounded-full transition-colors",
                  done.notes
                    ? "bg-accent-soft"
                    : "bg-muted/40 group-hover:bg-muted",
                )}
              />
            </button>
            <button
              type="button"
              aria-label="Annuler cette série"
              onClick={() => onUnvalidate(done.id)}
              className="grid size-7 place-items-center justify-self-end rounded-full bg-success/20 text-success hover:bg-danger/20 hover:text-danger"
            >
              <Check className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <SetInput
              value={poids}
              onChange={setPoids}
              placeholder={defaultPoids}
              unit={exo.exercice.isLeste ? "+kg" : "kg"}
              active={false}
            />
            <SetInput
              value={reps}
              onChange={setReps}
              placeholder={String(exo.repsCibles)}
              active={false}
            />
            <SetInput
              value={rir}
              onChange={setRir}
              placeholder="—"
              small
              active={false}
            />
            <button
              type="button"
              aria-label="Valider cette série"
              onClick={handleValidate}
              disabled={pending}
              className={cn(
                "grid size-7 place-items-center justify-self-end rounded-full border border-card-border text-muted hover:border-accent-border hover:text-accent-soft transition-colors",
                pending && "opacity-50",
              )}
            >
              <Check className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Affichage note (collapsed) : tap pour éditer */}
      {done && done.notes && !noteEditing && (
        <button
          type="button"
          onClick={() => setNoteEditing(true)}
          className="block w-full px-3 pb-2 text-left text-[10px] italic text-muted-strong hover:text-fg"
        >
          {done.notes}
        </button>
      )}

      {/* Editor inline : input court + sauvegarde/annule */}
      {done && noteEditing && (
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <StickyNote className="size-3 shrink-0 text-muted" />
          <input
            type="text"
            autoFocus
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value.slice(0, 200))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onUpdateNote(done.id, noteDraft);
                setNoteEditing(false);
              } else if (e.key === "Escape") {
                setNoteDraft(done.notes ?? "");
                setNoteEditing(false);
              }
            }}
            placeholder="ex: 4 strict + 2 trichées"
            className="h-7 flex-1 rounded-md border border-card-border bg-bg/60 px-2 text-[11px] outline-none focus:border-accent"
          />
          <button
            type="button"
            aria-label="Enregistrer la note"
            onClick={() => {
              onUpdateNote(done.id, noteDraft);
              setNoteEditing(false);
            }}
            className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-white"
          >
            <Check className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Annuler"
            onClick={() => {
              setNoteDraft(done.notes ?? "");
              setNoteEditing(false);
            }}
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:text-fg"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </li>
  );
}

function SetInput({
  value,
  onChange,
  placeholder,
  unit,
  small,
  active,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  unit?: string;
  small?: boolean;
  active?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "h-8 w-full rounded-md border bg-bg/60 px-2 text-sm outline-none focus:border-accent",
          active ? "border-accent-border" : "border-card-border",
          small ? "pr-2" : unit ? "pr-7" : "pr-2",
        )}
      />
      {unit && (
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted">
          {unit}
        </span>
      )}
    </div>
  );
}

// NumberPicker importé depuis /components/ui/number-picker

type ValidateFn = (args: {
  exerciceId: string;
  ordre: number;
  poidsKg: number;
  bwPlusKg: number | null;
  reps: number;
  rir: number | null;
  isBonus: boolean;
}) => Promise<void>;

function AddBonusRow({
  exo,
  nextOrdre,
  onValidate,
}: {
  exo: LiveExerciceData;
  nextOrdre: number;
  onValidate: ValidateFn;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <li className="px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] text-accent-soft hover:underline"
        >
          <Plus className="size-3" /> Ajouter une série bonus
        </button>
      </li>
    );
  }
  return (
    <SetRow
      exo={exo}
      ordre={nextOrdre}
      isBonus
      done={undefined}
      isActive
      onValidate={async (args) => {
        await onValidate(args);
        setOpen(false);
      }}
      onUnvalidate={() => setOpen(false)}
      onUpdateNote={() => {}}
    />
  );
}

// ----------------------------------------------------------------------------
// Nav bar (prev / next / finish)
// ----------------------------------------------------------------------------

function NavBar({
  canPrev,
  canNext,
  isLast,
  onPrev,
  onNext,
  onFinish,
}: {
  canPrev: boolean;
  canNext: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-card-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Exercice précédent"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-card-border bg-card text-muted-strong disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        {isLast ? (
          <Button
            type="button"
            size="md"
            className="flex-1"
            onClick={onFinish}
          >
            <Flag className="size-4" /> Terminer la séance
          </Button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-white shadow-sm shadow-accent/30 disabled:opacity-30"
          >
            Exo suivant <ChevronRight className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onFinish}
          aria-label="Terminer la séance"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-card-border bg-card text-muted-strong hover:border-accent-border hover:text-accent-soft"
        >
          <Flag className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Timer récup
// ----------------------------------------------------------------------------

function useRecupTimer() {
  const [active, setActive] = useState(false);
  const [target, setTarget] = useState(0);
  const [remaining, setRemaining] = useState(0);
  // endTsRef = horodatage absolu de fin (ms). On évite les setInterval qui
  // décrémentent : iOS/Android suspendent les timers JS en background, donc
  // un compteur qui décrémente de 1/s gèle quand l'app sort. Avec un timestamp
  // de fin, on recalcule le restant à chaque tick et au retour au premier plan.
  const endTsRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playedRef = useRef(false);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    clearTick();
  }, [clearTick]);

  const start = useCallback(
    (seconds: number) => {
      if (seconds <= 0) {
        stop();
        setTarget(0);
        setRemaining(0);
        return;
      }
      endTsRef.current = Date.now() + seconds * 1000;
      setTarget(seconds);
      setRemaining(seconds);
      playedRef.current = false;
      setActive(true);
    },
    [stop],
  );

  const add = useCallback((seconds: number) => {
    endTsRef.current += seconds * 1000;
    setTarget((t) => t + seconds);
    setRemaining((r) => Math.max(0, r + seconds));
  }, []);

  useEffect(() => {
    if (!active) return;

    function tick() {
      const r = Math.max(
        0,
        Math.ceil((endTsRef.current - Date.now()) / 1000),
      );
      setRemaining(r);
      if (r === 0) {
        // On joue le beep / vibre seulement si on est au premier plan ET qu'on
        // n'a pas déjà joué : sinon on spamme au retour en background.
        if (!playedRef.current && document.visibilityState === "visible") {
          playedRef.current = true;
          playEndBeep();
          try {
            navigator.vibrate?.([200, 80, 200]);
          } catch {
            // ignore
          }
        } else {
          playedRef.current = true;
        }
        clearTick();
        setActive(false);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") tick();
    }

    tick();
    intervalRef.current = setInterval(tick, 500);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTick();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, clearTick]);

  return { active, target, remaining, start, stop, add };
}

function RecupBar({
  remaining,
  total,
  onAddTime,
  onSkip,
}: {
  remaining: number;
  total: number;
  onAddTime: () => void;
  onSkip: () => void;
}) {
  const pct = total > 0 ? (1 - remaining / total) * 100 : 0;
  return (
    <div className="sticky bottom-[68px] z-10 mx-3 mb-2 rounded-xl border border-accent-border bg-accent-bg/30 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimerIcon className="size-4 text-accent-soft" />
          <span className="font-mono text-lg font-semibold">
            {formatDureeMMSS(remaining)}
          </span>
          <span className="text-[10px] text-muted">
            / {formatDureeMMSS(total)}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onAddTime}
            className="rounded-full border border-card-border bg-card px-2.5 py-1 text-[11px] hover:border-accent-border"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-white"
          >
            Terminer
          </button>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bar-idle">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Note de forme banner
// ----------------------------------------------------------------------------

function NoteDeFormeBanner({
  onSelect,
  onDismiss,
}: {
  onSelect: (n: number) => void;
  onDismiss: () => void;
}) {
  return (
    <Card highlighted className="mb-4 flex items-center gap-2">
      <p className="flex-1 text-xs">Comment tu te sens aujourd&apos;hui ?</p>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n)}
            aria-label={`Note ${n}/5`}
            className="grid size-7 place-items-center rounded text-muted hover:text-gold"
          >
            <Star className="size-4" />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Plus tard"
        className="text-muted hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Confirm dialogs
// ----------------------------------------------------------------------------

function ConfirmAbort({
  seanceId,
  onCancel,
}: {
  seanceId: string;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Modal>
      <Card highlighted className="flex flex-col gap-3">
        <PauseOctagon className="mx-auto size-8 text-danger" />
        <h3 className="text-center text-base font-semibold">
          Abandonner la séance ?
        </h3>
        <p className="text-center text-xs text-muted-strong">
          Les séries validées seront gardées en historique, mais la séance ne
          comptera pas pour le streak.
        </p>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onCancel}
          >
            Continuer
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await abortSeance(seanceId);
              });
            }}
          >
            Abandonner
          </Button>
        </div>
      </Card>
    </Modal>
  );
}

function ConfirmFinish({
  seanceId,
  totalValidated,
  onCancel,
  onDone,
}: {
  seanceId: string;
  totalValidated: number;
  onCancel: () => void;
  onDone: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal>
      <Card highlighted className="flex flex-col gap-3">
        <Flag className="mx-auto size-8 text-accent-soft" />
        <h3 className="text-center text-base font-semibold">
          {totalValidated === 0 ? "Aucune série validée" : "On clôture ?"}
        </h3>
        <p className="text-center text-xs text-muted-strong">
          {totalValidated === 0
            ? "T'as rien fait sur cette séance. T'es sûr de vouloir la terminer ?"
            : `${totalValidated} série${totalValidated > 1 ? "s" : ""} validée${totalValidated > 1 ? "s" : ""}. On clôture ?`}
        </p>
        {error && <p className="text-center text-[11px] text-danger">{error}</p>}
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await finishSeance(seanceId);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                // Feedback différencié selon PRs
                if (res.newPrIds.length > 0) {
                  feedbackPR();
                } else {
                  feedbackEndSeance();
                }
                onDone(res.id);
              });
            }}
          >
            <Flag className="size-4" />
            Terminer
          </Button>
        </div>
      </Card>
    </Modal>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Hooks utilitaires
// ----------------------------------------------------------------------------

function useDurationCounter(startMs: number): number {
  const [now, setNow] = useState<number>(Date.now);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function tick() {
      setNow(Date.now());
    }
    function startTicking() {
      tick();
      if (id) clearInterval(id);
      id = setInterval(tick, 1000);
    }
    function stopTicking() {
      if (id) {
        clearInterval(id);
        id = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        startTicking();
      } else {
        // Pause le tick en background pour économiser, on resync au retour.
        stopTicking();
      }
    }

    startTicking();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopTicking();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return Math.max(0, Math.floor((now - startMs) / 1000));
}

function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const w = navigator as Navigator & {
          wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> };
        };
        const sentinel = await w.wakeLock.request("screen");
        if (!cancelled) lock = sentinel;
      } catch {
        // l'utilisateur n'a pas autorisé, on s'en fout
      }
    }

    acquire();
    function handleVisibility() {
      if (document.visibilityState === "visible") acquire();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      lock?.release().catch(() => {
        // ignore
      });
    };
  }, []);
}

// Web Audio beep court à la fin du timer (pas besoin d'asset)
function playEndBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // ignore
  }
}
