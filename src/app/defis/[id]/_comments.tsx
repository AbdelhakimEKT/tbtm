"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import { deleteDefiComment, postDefiComment } from "../_actions";

type Comment = {
  id: string;
  message: string;
  createdAt: Date;
  userId: string;
  user: { pseudo: string; avatar: string | null };
};

export function CommentsThread({
  defiId,
  meId,
  comments,
  canPost,
}: {
  defiId: string;
  meId: string;
  comments: Comment[];
  canPost: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);

    const fd = new FormData();
    fd.set("message", text.trim());

    startTransition(async () => {
      const res = await postDefiComment(defiId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <Card className="py-6 text-center text-xs text-muted-strong">
          {canPost
            ? "Lance le débat. Personne n'a encore parlé."
            : "Aucun commentaire."}
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id}>
              <CommentRow
                comment={c}
                isMe={c.userId === meId}
                onDeleted={() => router.refresh()}
              />
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <form onSubmit={handlePost} className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Balance ton message…"
            maxLength={500}
            rows={2}
            className="min-h-16 rounded-lg border border-card-border bg-card p-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">{text.length}/500</span>
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium",
                pending || !text.trim()
                  ? "bg-card text-muted"
                  : "bg-accent text-white shadow-sm shadow-accent/30",
              )}
            >
              <Send className="size-3" />
              {pending ? "Envoi…" : "Envoyer"}
            </button>
          </div>
          {error && (
            <p className="text-[10px] text-danger">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  isMe,
  onDeleted,
}: {
  comment: Comment;
  isMe: boolean;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      const res = await deleteDefiComment(comment.id);
      if (res.ok) onDeleted();
    });
  }

  return (
    <Card
      className={cn(
        "flex gap-2 py-2",
        isMe && "border-accent-border bg-accent-bg/30",
        pending && "opacity-50",
      )}
    >
      <Avatar
        name={comment.user.pseudo}
        src={comment.user.avatar}
        size={28}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-medium">
            {comment.user.pseudo}
            {isMe && <span className="ml-1 text-[9px] text-muted">(toi)</span>}
          </p>
          <span className="text-[9px] text-muted">
            {humanDate(comment.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed">
          {comment.message}
        </p>
      </div>
      {isMe && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Supprimer"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full",
            confirming
              ? "bg-danger text-white"
              : "text-muted hover:text-danger",
          )}
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </Card>
  );
}

function humanDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
