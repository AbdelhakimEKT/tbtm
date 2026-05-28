"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, ScanLine, Search, Trash2, X } from "lucide-react";

import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberPicker } from "@/components/ui/number-picker";
import { cn } from "@/lib/cn";
import { macrosFromGrammes } from "@/lib/nutrition";
import type { OFFProduct } from "@/lib/openfoodfacts";
import { BarcodeScanner } from "@/components/barcode-scanner";

import {
  addIngredientToRecette,
  removeIngredientFromRecette,
  updateRecetteIngredient,
} from "../../_actions";
import {
  createIngredient,
  lookupBarcode,
  searchFood,
} from "@/app/nutrition/_actions";

type Ingredient = {
  id: string;
  nom: string;
  photo: string | null;
  caloriesP100: number;
  proteinesP100: number;
  glucidesP100: number;
  lipidesP100: number;
};

type RecetteIngredient = {
  id: string;
  grammes: number;
  ingredient: Ingredient;
};

export function IngredientsManager({
  recetteId,
  portions,
  initialIngredients,
  recents,
}: {
  recetteId: string;
  portions: number;
  initialIngredients: RecetteIngredient[];
  recents: Ingredient[];
}) {
  const [items, setItems] = useState<RecetteIngredient[]>(initialIngredients);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => {
    return items.reduce(
      (acc, ri) => {
        const m = macrosFromGrammes({
          grammes: ri.grammes,
          caloriesP100: ri.ingredient.caloriesP100,
          proteinesP100: ri.ingredient.proteinesP100,
          glucidesP100: ri.ingredient.glucidesP100,
          lipidesP100: ri.ingredient.lipidesP100,
        });
        acc.calories += m.calories;
        acc.proteines += m.proteines;
        acc.glucides += m.glucides;
        acc.lipides += m.lipides;
        return acc;
      },
      { calories: 0, proteines: 0, glucides: 0, lipides: 0 },
    );
  }, [items]);

  const perPortion = {
    calories: total.calories / portions,
    proteines: total.proteines / portions,
    glucides: total.glucides / portions,
    lipides: total.lipides / portions,
  };

  function handleLocalUpdate(updated: RecetteIngredient) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }
  function handleLocalRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function handleLocalAdd(item: RecetteIngredient) {
    setItems((prev) => [...prev, item]);
    setShowPicker(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Macros totales */}
      <Card highlighted className="grid grid-cols-4 gap-2 text-center text-[11px]">
        <Macro label="kcal" value={Math.round(total.calories)} hint={`${Math.round(perPortion.calories)}/p`} />
        <Macro label="prot" value={`${Math.round(total.proteines)}g`} hint={`${Math.round(perPortion.proteines)}/p`} />
        <Macro label="gluc" value={`${Math.round(total.glucides)}g`} hint={`${Math.round(perPortion.glucides)}/p`} />
        <Macro label="lip" value={`${Math.round(total.lipides)}g`} hint={`${Math.round(perPortion.lipides)}/p`} />
      </Card>

      {/* Liste des ingrédients */}
      {items.length === 0 ? (
        <Card className="py-6 text-center text-xs text-muted-strong">
          Aucun ingrédient. Ajoute le premier ci-dessous.
        </Card>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((ri) => (
            <li key={ri.id}>
              <IngredientRow
                row={ri}
                onUpdate={handleLocalUpdate}
                onRemove={handleLocalRemove}
              />
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {/* Picker */}
      {showPicker ? (
        <IngredientPicker
          recetteId={recetteId}
          recents={recents}
          onCancel={() => setShowPicker(false)}
          onAdded={handleLocalAdd}
          onError={setError}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => setShowPicker(true)}
          className="w-full"
        >
          <Plus className="size-4" /> Ajouter un ingrédient
        </Button>
      )}

      <DonePanel recetteId={recetteId} />
    </div>
  );
}

function DonePanel({ recetteId }: { recetteId: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      size="md"
      onClick={() => router.push(`/recettes/${recetteId}`)}
      className="w-full"
    >
      Retour à la recette
    </Button>
  );
}

function Macro({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-fg">{value}</p>
      <p className="text-[9px] text-muted">{label}</p>
      <p className="text-[8px] text-muted-strong">{hint}</p>
    </div>
  );
}

function IngredientRow({
  row,
  onUpdate,
  onRemove,
}: {
  row: RecetteIngredient;
  onUpdate: (updated: RecetteIngredient) => void;
  onRemove: (id: string) => void;
}) {
  const [grammes, setGrammes] = useState(String(row.grammes));
  const [savedGrammes, setSavedGrammes] = useState(row.grammes);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Auto-save debounce (700ms)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const num = Number(grammes);
    if (!Number.isFinite(num) || num <= 0 || num === savedGrammes) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await updateRecetteIngredient(row.id, num);
        if (res.ok) {
          setSavedGrammes(num);
          onUpdate({ ...row, grammes: num });
        }
      });
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grammes]);

  const macros = macrosFromGrammes({
    grammes: Number(grammes) || 0,
    caloriesP100: row.ingredient.caloriesP100,
    proteinesP100: row.ingredient.proteinesP100,
    glucidesP100: row.ingredient.glucidesP100,
    lipidesP100: row.ingredient.lipidesP100,
  });

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3500);
      return;
    }
    startTransition(async () => {
      const res = await removeIngredientFromRecette(row.id);
      if (res.ok) onRemove(row.id);
    });
  }

  const isDirty = Number(grammes) !== savedGrammes;

  return (
    <Card
      className={cn(
        "flex items-center gap-3 transition-opacity",
        pending && "opacity-60",
      )}
    >
      {row.ingredient.photo ? (
        <img
          src={row.ingredient.photo}
          alt=""
          className="size-10 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-bg text-sm font-medium text-accent-soft">
          {row.ingredient.nom.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.ingredient.nom}</p>
        <p className="text-[10px] text-muted">
          {Math.round(macros.calories)} kcal · P{Math.round(macros.proteines)} G
          {Math.round(macros.glucides)} L{Math.round(macros.lipides)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NumberPicker
          variant="compact"
          value={grammes}
          onChange={setGrammes}
          step={10}
          unit="g"
          min={1}
          max={5000}
          className="w-28"
        />
        {isDirty && pending && (
          <Save className="size-3.5 animate-pulse text-accent-soft" />
        )}
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label="Supprimer"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full",
          confirmingDelete
            ? "bg-danger text-white"
            : "text-muted hover:text-danger",
        )}
      >
        <Trash2 className="size-3.5" />
      </button>
    </Card>
  );
}

function IngredientPicker({
  recetteId,
  recents,
  onCancel,
  onAdded,
  onError,
}: {
  recetteId: string;
  recents: Ingredient[];
  onCancel: () => void;
  onAdded: (item: RecetteIngredient) => void;
  onError: (err: string) => void;
}) {
  const [q, setQ] = useState("");
  const [offResults, setOffResults] = useState<OFFProduct[]>([]);
  const [searched, setSearched] = useState(false);
  const [pendingSearch, startSearch] = useTransition();
  const [picked, setPicked] = useState<{
    ingredientId: string;
    nom: string;
    photo: string | null;
    macros: {
      caloriesP100: number;
      proteinesP100: number;
      glucidesP100: number;
      lipidesP100: number;
    };
  } | null>(null);
  const [grammes, setGrammes] = useState("100");
  const [pendingAdd, startAdd] = useTransition();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);

  // Debounce search (200ms = plus vif)
  useEffect(() => {
    if (q.trim().length < 2) {
      setOffResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(() => {
      startSearch(async () => {
        const data = await searchFood(q);
        setOffResults(data);
        setSearched(true);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function handleBarcode(code: string) {
    setScannerOpen(false);
    setScanning(true);
    setScanNotFound(null);
    const product = await lookupBarcode(code);
    setScanning(false);
    if (!product) {
      setScanNotFound(code);
      return;
    }
    navigator.vibrate?.([100, 50, 100]);
    // Crée (ou réutilise) l'ingrédient pour cette OFF entry, puis sélectionne
    const fd = new FormData();
    fd.set("nom", product.nom);
    fd.set("caloriesP100", String(product.caloriesP100));
    fd.set("proteinesP100", String(product.proteinesP100));
    fd.set("glucidesP100", String(product.glucidesP100));
    fd.set("lipidesP100", String(product.lipidesP100));
    fd.set("openFoodFactsId", product.code);
    if (product.photo) fd.set("photo", product.photo);
    const res = await createIngredient(fd);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    setPicked({
      ingredientId: res.id,
      nom: product.nom,
      photo: product.photo,
      macros: {
        caloriesP100: product.caloriesP100,
        proteinesP100: product.proteinesP100,
        glucidesP100: product.glucidesP100,
        lipidesP100: product.lipidesP100,
      },
    });
  }

  async function handlePickLocal(ing: Ingredient) {
    setPicked({
      ingredientId: ing.id,
      nom: ing.nom,
      photo: ing.photo,
      macros: {
        caloriesP100: ing.caloriesP100,
        proteinesP100: ing.proteinesP100,
        glucidesP100: ing.glucidesP100,
        lipidesP100: ing.lipidesP100,
      },
    });
  }

  async function handlePickOFF(p: OFFProduct) {
    // Crée (ou réutilise) l'ingrédient
    const fd = new FormData();
    fd.set("nom", p.nom);
    fd.set("caloriesP100", String(p.caloriesP100));
    fd.set("proteinesP100", String(p.proteinesP100));
    fd.set("glucidesP100", String(p.glucidesP100));
    fd.set("lipidesP100", String(p.lipidesP100));
    fd.set("openFoodFactsId", p.code);
    if (p.photo) fd.set("photo", p.photo);
    const res = await createIngredient(fd);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    setPicked({
      ingredientId: res.id,
      nom: p.nom,
      photo: p.photo,
      macros: {
        caloriesP100: p.caloriesP100,
        proteinesP100: p.proteinesP100,
        glucidesP100: p.glucidesP100,
        lipidesP100: p.lipidesP100,
      },
    });
  }

  async function handleAdd() {
    if (!picked) return;
    const num = Number(grammes);
    if (!Number.isFinite(num) || num <= 0) {
      onError("Grammage invalide");
      return;
    }
    const fd = new FormData();
    fd.set("ingredientId", picked.ingredientId);
    fd.set("grammes", String(num));
    startAdd(async () => {
      const res = await addIngredientToRecette(recetteId, fd);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onAdded({
        id: res.id,
        grammes: num,
        ingredient: {
          id: picked.ingredientId,
          nom: picked.nom,
          photo: picked.photo,
          ...picked.macros,
        },
      });
    });
  }

  if (picked) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardLabel>Quantité</CardLabel>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="text-[11px] text-muted-strong hover:text-fg"
          >
            ← changer
          </button>
        </div>
        <div className="flex items-center gap-3">
          {picked.photo ? (
            <img
              src={picked.photo}
              alt=""
              className="size-10 rounded-md object-cover"
            />
          ) : (
            <div className="grid size-10 place-items-center rounded-md bg-accent-bg text-sm text-accent-soft">
              {picked.nom.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="flex-1 text-sm font-medium">{picked.nom}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={5000}
            step="any"
            value={grammes}
            onChange={(e) => setGrammes(e.target.value)}
            placeholder="100"
            autoFocus
            className="h-11 w-24 rounded-md border border-card-border bg-bg px-3 text-sm outline-none focus:border-accent"
          />
          <span className="text-xs text-muted-strong">grammes</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => setPicked(null)}
            disabled={pendingAdd}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleAdd}
            disabled={pendingAdd}
          >
            {pendingAdd ? "Ajout…" : "Ajouter"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      {scannerOpen && (
        <BarcodeScanner
          onDetect={handleBarcode}
          onClose={() => setScannerOpen(false)}
        />
      )}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardLabel>Ajouter un ingrédient</CardLabel>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scan button comme CTA principal */}
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-accent/30"
        >
          <ScanLine className="size-4" />
          Scanner un code-barre
        </button>

        {scanning && (
          <div className="flex items-center justify-center gap-2 rounded-md border border-card-border bg-card py-2 text-[11px] text-muted-strong">
            <Loader2 className="size-3 animate-spin text-accent" />
            Recherche du code…
          </div>
        )}

        {scanNotFound && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
            Code {scanNotFound} introuvable. Crée l&apos;aliment à la main depuis{" "}
            <a href="/nutrition/ajouter" className="underline">
              /nutrition/ajouter
            </a>
            .
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-card-border" />
          <span>ou</span>
          <span className="h-px flex-1 bg-card-border" />
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-card-border bg-bg px-3 focus-within:border-accent">
          <Search className="size-4 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher dans OpenFoodFacts…"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {pendingSearch && (
            <Loader2 className="size-3 animate-spin text-muted" />
          )}
        </label>

      {q.trim().length < 2 && recents.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">
            Récents
          </p>
          <ul className="flex flex-col gap-1">
            {recents.slice(0, 6).map((ing) => (
              <li key={ing.id}>
                <button
                  type="button"
                  onClick={() => handlePickLocal(ing)}
                  className="flex w-full items-center gap-2 rounded-md bg-bg px-2 py-1.5 text-left hover:bg-bg/60"
                >
                  {ing.photo ? (
                    <img
                      src={ing.photo}
                      alt=""
                      className="size-7 rounded object-cover"
                    />
                  ) : (
                    <div className="grid size-7 place-items-center rounded bg-accent-bg text-[10px] text-accent-soft">
                      {ing.nom.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate text-xs">{ing.nom}</span>
                  <span className="text-[10px] text-muted">
                    {Math.round(ing.caloriesP100)} kcal/100g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!pendingSearch && q.trim().length >= 2 && offResults.length > 0 && (
        <ul className="flex flex-col gap-1">
          {offResults.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                onClick={() => handlePickOFF(p)}
                className="flex w-full items-center gap-2 rounded-md bg-bg px-2 py-1.5 text-left hover:bg-bg/60"
              >
                {p.photo ? (
                  <img
                    src={p.photo}
                    alt=""
                    className="size-7 rounded object-cover"
                  />
                ) : (
                  <div className="grid size-7 place-items-center rounded bg-accent-bg text-[10px] text-accent-soft">
                    {p.nom.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{p.nom}</p>
                  {p.marque && (
                    <p className="truncate text-[9px] text-muted">{p.marque}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted">
                  {Math.round(p.caloriesP100)} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!pendingSearch && searched && offResults.length === 0 && (
        <p className="text-center text-[11px] text-muted-strong">
          Aucun résultat. Crée d&apos;abord l&apos;ingrédient depuis{" "}
          <a href="/nutrition/ajouter" className="text-accent-soft underline">
            /nutrition/ajouter
          </a>
          .
        </p>
      )}
      </Card>
    </>
  );
}
