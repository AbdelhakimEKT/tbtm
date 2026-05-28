"use client";

import { useState, useTransition, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Save, Timer, Trash2, X } from "lucide-react";
import type { Muscle } from "@prisma/client";

import { MUSCLE_LABEL } from "@/lib/labels";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import {
  removeExerciceFromProgramme,
  reorderProgrammeExercices,
  updateProgrammeExercice,
} from "../_actions";

type Item = {
  id: string;
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
};

export function SortableExerciceList({
  programmeId,
  canEdit,
  items: initialItems,
}: {
  programmeId: string;
  canEdit: boolean;
  items: Item[];
}) {
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();
  const lastSentRef = useRef<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((it) => it.id === active.id);
      const newIndex = prev.findIndex((it) => it.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      const orderedIds = next.map((it) => it.id);
      const key = orderedIds.join("|");
      if (key !== lastSentRef.current) {
        lastSentRef.current = key;
        startTransition(async () => {
          await reorderProgrammeExercices(programmeId, orderedIds);
        });
      }
      return next;
    });
  }

  function handleLocalUpdate(updated: Item) {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  }

  function handleLocalDelete(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  if (!canEdit) {
    return (
      <ul className="flex flex-col gap-2">
        {items.map((it, idx) => (
          <ReadOnlyRow key={it.id} item={it} index={idx} />
        ))}
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((it) => it.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <SortableRow
              key={it.id}
              item={it}
              index={idx}
              onUpdate={handleLocalUpdate}
              onDelete={handleLocalDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function ReadOnlyRow({ item, index }: { item: Item; index: number }) {
  return (
    <li>
      <Card className="flex flex-col gap-1.5">
        <ItemHeader item={item} index={index} />
        <ItemStats item={item} />
        {item.notes && (
          <p className="text-[11px] italic text-muted">{item.notes}</p>
        )}
      </Card>
    </li>
  );
}

function SortableRow({
  item,
  index,
  onUpdate,
  onDelete,
}: {
  item: Item;
  index: number;
  onUpdate: (it: Item) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Card
        className={cn(
          "flex flex-col gap-2",
          isDragging && "ring-2 ring-accent",
        )}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-label="Glisser pour réordonner"
            {...attributes}
            {...listeners}
            className="touch-none rounded p-0.5 text-muted hover:text-fg active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          <div className="flex-1 min-w-0">
            <ItemHeader item={item} index={index} />
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={editing ? "Annuler" : "Éditer"}
              onClick={() => setEditing((v) => !v)}
              className="grid size-7 place-items-center rounded-full text-muted-strong hover:text-fg"
            >
              {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
            </button>
          </div>
        </div>

        {editing ? (
          <EditRowForm
            item={item}
            onSaved={(updated) => {
              onUpdate(updated);
              setEditing(false);
            }}
            onDeleted={() => {
              onDelete(item.id);
            }}
          />
        ) : (
          <>
            <ItemStats item={item} />
            {item.notes && (
              <p className="text-[11px] italic text-muted">{item.notes}</p>
            )}
          </>
        )}
      </Card>
    </li>
  );
}

function ItemHeader({ item, index }: { item: Item; index: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="grid size-5 place-items-center rounded-full bg-accent-bg text-[10px] font-medium text-accent-soft">
          {index + 1}
        </span>
        <p className="truncate text-sm font-medium">{item.exercice.nom}</p>
        {item.exercice.isLeste && (
          <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-gold">
            Lest.
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {item.exercice.muscles.slice(0, 3).map((m) => (
          <span
            key={m}
            className="rounded-full bg-bar-idle px-1.5 py-0.5 text-[9px] text-muted-strong"
          >
            {MUSCLE_LABEL[m]}
          </span>
        ))}
      </div>
    </div>
  );
}

function ItemStats({ item }: { item: Item }) {
  const poids = formatPoids(item);
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px]">
      <span className="text-fg">
        <span className="font-semibold">{item.seriesCibles}</span>
        <span className="mx-0.5 text-muted">×</span>
        <span className="font-semibold">{item.repsCibles}</span>
        <span className="ml-1 text-muted">reps</span>
      </span>
      {poids && (
        <span className="text-fg">
          <span className="font-semibold">{poids}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-0.5 text-muted">
        <Timer className="size-3" />
        {formatRecup(item.tempsRecupSec)}
      </span>
    </div>
  );
}

function formatPoids(item: Item): string | null {
  if (item.exercice.isLeste && item.bwPlusKg != null) {
    return `BW+${item.bwPlusKg}kg`;
  }
  if (item.poidsCible != null) return `${item.poidsCible}kg`;
  if (item.exercice.isLeste) return "BW";
  return null;
}

function formatRecup(sec: number): string {
  if (sec >= 60) {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return s === 0 ? `${min}min` : `${min}m${s}`;
  }
  return `${sec}s`;
}

function EditRowForm({
  item,
  onSaved,
  onDeleted,
}: {
  item: Item;
  onSaved: (it: Item) => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [series, setSeries] = useState(String(item.seriesCibles));
  const [reps, setReps] = useState(String(item.repsCibles));
  const [poids, setPoids] = useState(
    item.poidsCible != null ? String(item.poidsCible) : "",
  );
  const [bw, setBw] = useState(
    item.bwPlusKg != null ? String(item.bwPlusKg) : "",
  );
  const [recup, setRecup] = useState(String(item.tempsRecupSec));
  const [notes, setNotes] = useState(item.notes ?? "");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("seriesCibles", series);
    fd.set("repsCibles", reps);
    if (item.exercice.isLeste) {
      if (bw) fd.set("bwPlusKg", bw);
      if (poids) fd.set("poidsCible", poids);
    } else {
      if (poids) fd.set("poidsCible", poids);
    }
    fd.set("tempsRecupSec", recup);
    if (notes) fd.set("notes", notes);

    startTransition(async () => {
      const res = await updateProgrammeExercice(item.id, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved({
        ...item,
        seriesCibles: Number(series),
        repsCibles: Number(reps),
        poidsCible: poids ? Number(poids) : null,
        bwPlusKg: bw ? Number(bw) : null,
        tempsRecupSec: Number(recup),
        notes: notes || null,
      });
    });
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3500);
      return;
    }
    startDelete(async () => {
      const res = await removeExerciceFromProgramme(item.id);
      if (!res.ok) {
        setError(res.error);
        setConfirmingDelete(false);
        return;
      }
      onDeleted();
    });
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2 border-t border-card-border pt-2">
      <div className="grid grid-cols-2 gap-2">
        <SmallField label="Séries">
          <input
            type="number"
            min={1}
            max={20}
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="h-9 rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
          />
        </SmallField>
        <SmallField label="Reps">
          <input
            type="number"
            min={1}
            max={100}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-9 rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
          />
        </SmallField>
        {item.exercice.isLeste ? (
          <SmallField label="Lest (kg)" help="BW + ce poids">
            <input
              type="number"
              min={0}
              max={500}
              step="any"
              value={bw}
              onChange={(e) => setBw(e.target.value)}
              placeholder="0"
              className="h-9 rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
            />
          </SmallField>
        ) : (
          <SmallField label="Poids (kg)">
            <input
              type="number"
              min={0}
              max={1000}
              step="any"
              value={poids}
              onChange={(e) => setPoids(e.target.value)}
              placeholder="—"
              className="h-9 rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
            />
          </SmallField>
        )}
        <SmallField label="Récup (sec)">
          <input
            type="number"
            min={0}
            max={900}
            step="any"
            value={recup}
            onChange={(e) => setRecup(e.target.value)}
            className="h-9 rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
          />
        </SmallField>
      </div>

      <SmallField label="Notes (optionnel)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="ex. monter en pyramide"
          className="rounded-md border border-card-border bg-bg p-2 text-xs leading-relaxed outline-none focus:border-accent"
        />
      </SmallField>

      {error && (
        <p className="text-[11px] text-danger">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="flex-1"
        >
          <Save className="size-3.5" />
          {pending ? "..." : "Enregistrer"}
        </Button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs",
            confirmingDelete
              ? "bg-danger text-white"
              : "border border-danger/40 bg-danger/10 text-danger",
          )}
        >
          <Trash2 className="size-3.5" />
          {confirmingDelete ? "OK ?" : ""}
        </button>
      </div>
    </form>
  );
}

function SmallField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <CardLabel>{label}</CardLabel>
      {children}
      {help && <span className="text-[9px] text-muted">{help}</span>}
    </label>
  );
}
