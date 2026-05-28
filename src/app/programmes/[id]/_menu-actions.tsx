"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Flame,
  FlameKindling,
  MoreVertical,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/cn";

import {
  deleteProgramme,
  duplicateProgramme,
  setActiveProgramme,
} from "../_actions";

export function ProgrammeMenuActions({
  programmeId,
  canEdit,
  isOwner,
  isActive,
  isLoggedIn,
}: {
  programmeId: string;
  canEdit: boolean;
  isOwner: boolean;
  isActive: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function handleDuplicate() {
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    startTransition(async () => {
      const res = await duplicateProgramme(programmeId);
      setOpen(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/programmes/${res.id}`);
      router.refresh();
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const res = await setActiveProgramme(programmeId);
      setOpen(false);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3500);
      return;
    }
    startTransition(async () => {
      const res = await deleteProgramme(programmeId);
      if (res && !res.ok) {
        setError(res.error);
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Actions"
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full border border-card-border bg-card text-muted-strong hover:text-fg"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-xl border border-card-border bg-card shadow-lg">
          {isLoggedIn && (
            <MenuItem
              icon={Copy}
              label={isOwner ? "Dupliquer" : "Copier dans mes programmes"}
              onClick={handleDuplicate}
              disabled={pending}
            />
          )}
          {isOwner && (
            <MenuItem
              icon={isActive ? FlameKindling : Flame}
              label={isActive ? "Retirer de la rotation" : "Ajouter à ma rotation"}
              onClick={handleToggleActive}
              disabled={pending}
              highlight={!isActive}
            />
          )}
          {canEdit && (
            <MenuItem
              icon={Trash2}
              label={confirmingDelete ? "Confirmer la suppression ?" : "Supprimer"}
              onClick={handleDelete}
              disabled={pending}
              danger
            />
          )}
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-12 w-56 rounded-md border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50",
        danger
          ? "text-danger hover:bg-danger/10"
          : highlight
            ? "text-accent-soft hover:bg-accent-bg"
            : "text-fg hover:bg-bg/40",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </button>
  );
}
