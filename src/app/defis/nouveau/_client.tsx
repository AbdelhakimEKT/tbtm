"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, Users2, Zap } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import { createDefi } from "../_actions";

type Programme = {
  id: string;
  nom: string;
  _count: { exercices: number };
};

type Ami = {
  id: string;
  pseudo: string;
  avatar: string | null;
  niveau: number;
};

export function NouveauDefiClient({
  programmes,
  amis,
  defaultProgrammeId,
  defaultAmiId,
}: {
  programmes: Programme[];
  amis: Ami[];
  defaultProgrammeId?: string;
  defaultAmiId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [programmeId, setProgrammeId] = useState<string>(() => {
    if (defaultProgrammeId && programmes.some((p) => p.id === defaultProgrammeId)) {
      return defaultProgrammeId;
    }
    return programmes[0]?.id ?? "";
  });

  const [selectedAmis, setSelectedAmis] = useState<Set<string>>(() => {
    const init = new Set<string>();
    if (defaultAmiId && amis.some((a) => a.id === defaultAmiId)) {
      init.add(defaultAmiId);
    }
    return init;
  });

  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");

  function toggleAmi(id: string) {
    setSelectedAmis((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!programmeId) {
      setError("Choisis un programme");
      return;
    }
    if (selectedAmis.size === 0) {
      setError("Sélectionne au moins un pote");
      return;
    }

    const fd = new FormData();
    fd.set("programmeId", programmeId);
    selectedAmis.forEach((id) => fd.append("friendIds", id));
    if (titre.trim()) fd.set("titre", titre.trim());
    if (message.trim()) fd.set("message", message.trim());

    startTransition(async () => {
      const res = await createDefi(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/defis/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <section>
        <CardLabel className="mb-2 px-1">Programme à faire</CardLabel>
        <div className="flex flex-col gap-1.5">
          {programmes.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
                programmeId === p.id
                  ? "border-accent-border bg-accent-bg"
                  : "border-card-border",
              )}
            >
              <input
                type="radio"
                name="programme"
                value={p.id}
                checked={programmeId === p.id}
                onChange={() => setProgrammeId(p.id)}
                className="sr-only"
              />
              <Zap
                className={cn(
                  "size-4",
                  programmeId === p.id ? "text-accent-soft" : "text-muted",
                )}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{p.nom}</p>
                <p className="text-[10px] text-muted">
                  {p._count.exercices} exercice
                  {p._count.exercices > 1 ? "s" : ""}
                </p>
              </div>
              <span
                className={cn(
                  "size-4 rounded-full border-2",
                  programmeId === p.id
                    ? "border-accent bg-accent"
                    : "border-card-border-strong",
                )}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <CardLabel className="inline-flex items-center gap-1">
            <Users2 className="size-3" />
            Potes à défier
          </CardLabel>
          <span className="text-[10px] text-muted">
            {selectedAmis.size} sélectionné{selectedAmis.size > 1 ? "s" : ""}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {amis.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAmi(a.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                selectedAmis.has(a.id)
                  ? "border-accent-border bg-accent-bg"
                  : "border-card-border bg-card",
              )}
            >
              <div className="relative">
                <Avatar name={a.pseudo} src={a.avatar} size={32} />
                {selectedAmis.has(a.id) && (
                  <div className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-2.5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{a.pseudo}</p>
                <p className="text-[9px] text-muted">Niv. {a.niveau}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <CardLabel className="mb-1.5 px-1">
          Titre <span className="text-muted">(optionnel)</span>
        </CardLabel>
        <input
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={80}
          placeholder="ex. Push Day battle, Defi du dimanche"
          className="h-11 w-full rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        />
      </section>

      <section>
        <CardLabel className="mb-1.5 px-1">
          Message de chambrage <span className="text-muted">(optionnel)</span>
        </CardLabel>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Vasy gros essaye de me battre"
          className="min-h-20 w-full rounded-lg border border-card-border bg-card p-3 text-sm leading-relaxed outline-none focus:border-accent"
        />
      </section>

      {error && (
        <Card className="border-danger/40 bg-danger/10 text-xs text-danger">
          {error}
        </Card>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Envoi…" : `Pinger ${selectedAmis.size || "..."} pote${selectedAmis.size > 1 ? "s" : ""}`}
      </Button>
    </form>
  );
}
