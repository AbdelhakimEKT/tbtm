"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Search,
  Send,
  UserMinus,
  UserPlus,
  UserX,
  X,
  Zap,
} from "lucide-react";
import type { CategorieForce } from "@prisma/client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { CATEGORIE_FORCE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";

import {
  acceptFriendRequest,
  cancelSentRequest,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "./_actions";

type UserCard = {
  id: string;
  pseudo: string;
  avatar: string | null;
  categorie: CategorieForce;
  niveau: number;
};

type AmiItem = UserCard & { amitieId: string };
type RequestItem = { id: string; createdAt: Date };
type RecueItem = RequestItem & { de: UserCard };
type EnvoyeeItem = RequestItem & { a: UserCard };

type Tab = "amis" | "recues" | "envoyees";

export function AmisClient({
  initialTab,
  amis,
  recues,
  envoyees,
}: {
  initialTab: Tab;
  amis: AmiItem[];
  recues: RecueItem[];
  envoyees: EnvoyeeItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pseudo, setPseudo] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; msg: string }
    | { kind: "error"; msg: string }
    | null
  >(null);

  function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!pseudo.trim()) return;
    setFeedback(null);

    const fd = new FormData();
    fd.set("pseudo", pseudo.trim());

    startTransition(async () => {
      const res = await sendFriendRequest(fd);
      if (!res.ok) {
        setFeedback({ kind: "error", msg: res.error });
        return;
      }
      setPseudo("");
      setFeedback({
        kind: "ok",
        msg:
          res.kind === "accepted-instant"
            ? "Demande mutuelle ! Vous êtes amis 🎉"
            : "Demande envoyée — il/elle reçoit le ping",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Form ajout d'ami (toujours visible, en premier) */}
      <Card highlighted className="flex flex-col gap-2">
        <CardLabel className="inline-flex items-center gap-1">
          <UserPlus className="size-3" />
          Ajouter un pote
        </CardLabel>
        <form onSubmit={handleSendRequest} className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-card-border bg-bg px-3 focus-within:border-accent">
            <Search className="size-3.5 text-muted" />
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Pseudo de ton pote"
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          <Button type="submit" size="md" disabled={pending || !pseudo.trim()}>
            <Send className="size-3.5" />
            Envoyer
          </Button>
        </form>
        {feedback && (
          <p
            className={cn(
              "rounded-md px-2 py-1 text-[11px]",
              feedback.kind === "ok"
                ? "border border-success/40 bg-success/10 text-success"
                : "border border-danger/40 bg-danger/10 text-danger",
            )}
          >
            {feedback.msg}
          </p>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
        <TabButton
          active={tab === "amis"}
          onClick={() => setTab("amis")}
          label="Mes potes"
          count={amis.length}
        />
        <TabButton
          active={tab === "recues"}
          onClick={() => setTab("recues")}
          label="Reçues"
          count={recues.length}
          highlight={recues.length > 0}
        />
        <TabButton
          active={tab === "envoyees"}
          onClick={() => setTab("envoyees")}
          label="Envoyées"
          count={envoyees.length}
        />
      </div>

      {/* Content */}
      {tab === "amis" && <AmisTab amis={amis} />}
      {tab === "recues" && <RecuesTab items={recues} />}
      {tab === "envoyees" && <EnvoyeesTab items={envoyees} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors",
        active
          ? "bg-accent text-white shadow-sm shadow-accent/30"
          : "text-muted-strong",
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[9px]",
            active
              ? "bg-bg/30"
              : highlight
                ? "bg-accent text-white"
                : "bg-card-border",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Mes amis tab
// ----------------------------------------------------------------------------

function AmisTab({ amis }: { amis: AmiItem[] }) {
  if (amis.length === 0) {
    return (
      <Card className="py-8 text-center">
        <p className="text-sm">Aucun pote pour l&apos;instant</p>
        <p className="mt-1 text-[11px] text-muted-strong">
          Tape un pseudo en haut pour envoyer ta première demande.
        </p>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {amis.map((u) => (
        <li key={u.amitieId}>
          <AmiCard ami={u} />
        </li>
      ))}
    </ul>
  );
}

function AmiCard({ ami }: { ami: AmiItem }) {
  const [pending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const router = useRouter();

  function handleRemove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      setTimeout(() => setConfirmingRemove(false), 3500);
      return;
    }
    startTransition(async () => {
      const res = await removeFriend(ami.id);
      if (res.ok) {
        setShowMenu(false);
        router.refresh();
      }
    });
  }

  return (
    <Card className={cn("flex items-center gap-3", pending && "opacity-50")}>
      <Avatar name={ami.pseudo} src={ami.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{ami.pseudo}</p>
        <p className="text-[10px] text-muted">
          Niveau {ami.niveau} · {CATEGORIE_FORCE_LABEL[ami.categorie]}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <a
          href={`/defis/nouveau?ami=${ami.id}`}
          aria-label="Défier"
          className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-[10px] font-medium text-white shadow-sm shadow-accent/30"
        >
          <Zap className="size-3" />
          Défier
        </a>
        <button
          type="button"
          aria-label="Plus d'actions"
          onClick={() => setShowMenu((v) => !v)}
          className="grid size-8 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <UserMinus className="size-3.5" />
        </button>
      </div>
      {showMenu && (
        <div className="absolute right-4 mt-12 w-44 rounded-lg border border-card-border bg-card p-1 shadow-lg">
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs",
              confirmingRemove
                ? "bg-danger text-white"
                : "text-danger hover:bg-danger/10",
            )}
          >
            <UserX className="size-3.5" />
            {confirmingRemove ? "Confirmer ?" : "Retirer de mes potes"}
          </button>
        </div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Reçues tab
// ----------------------------------------------------------------------------

function RecuesTab({ items }: { items: RecueItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="py-8 text-center">
        <p className="text-sm">Aucune demande</p>
        <p className="mt-1 text-[11px] text-muted-strong">
          Quand quelqu&apos;un t&apos;ajoute, ça apparaît ici. Tu peux accepter ou refuser.
        </p>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((r) => (
        <li key={r.id}>
          <RecueCard item={r} />
        </li>
      ))}
    </ul>
  );
}

function RecueCard({ item }: { item: RecueItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptFriendRequest(item.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }
  function handleReject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectFriendRequest(item.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card highlighted className={cn("flex flex-col gap-2", pending && "opacity-50")}>
      <div className="flex items-center gap-3">
        <Avatar name={item.de.pseudo} src={item.de.avatar} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.de.pseudo}</p>
          <p className="text-[10px] text-muted">
            T&apos;a ping · {item.createdAt.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            })}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={handleReject}
          disabled={pending}
        >
          <X className="size-3.5" />
          Refuser
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={handleAccept}
          disabled={pending}
        >
          <Check className="size-3.5" />
          Accepter
        </Button>
      </div>
      {error && (
        <p className="text-[10px] text-danger">{error}</p>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Envoyées tab
// ----------------------------------------------------------------------------

function EnvoyeesTab({ items }: { items: EnvoyeeItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="py-8 text-center">
        <p className="text-sm">Aucune demande envoyée</p>
        <p className="mt-1 text-[11px] text-muted-strong">
          Les demandes que tu envoies apparaissent ici en attendant qu&apos;on te
          réponde.
        </p>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((r) => (
        <li key={r.id}>
          <EnvoyeeCard item={r} />
        </li>
      ))}
    </ul>
  );
}

function EnvoyeeCard({ item }: { item: EnvoyeeItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelSentRequest(item.id);
      if (res.ok) router.refresh();
    });
  }

  return (
    <Card className={cn("flex items-center gap-3", pending && "opacity-50")}>
      <Avatar name={item.a.pseudo} src={item.a.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.a.pseudo}</p>
        <p className="text-[10px] text-muted">En attente de sa réponse</p>
      </div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-card-border px-3 text-[10px] text-muted-strong hover:text-fg"
      >
        Annuler
      </button>
    </Card>
  );
}
