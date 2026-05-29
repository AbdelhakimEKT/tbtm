"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Apple,
  Camera,
  ChevronLeft,
  Loader2,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Star,
  Utensils,
} from "lucide-react";
import type { CategorieRecette, PortionType, Repas } from "@prisma/client";

import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CATEGORIE_RECETTE_LABEL,
  PORTION_LABEL,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
import { BarcodeScanner } from "@/components/barcode-scanner";

import {
  createIngredient,
  createNutritionLog,
  lookupBarcode,
  searchFood,
  toggleFavoriIngredient,
  toggleFavoriRecette,
} from "../_actions";
import type { OFFProduct } from "@/lib/openfoodfacts";

type LocalIngredient = {
  id: string;
  nom: string;
  photo: string | null;
  caloriesP100: number;
  proteinesP100: number;
  glucidesP100: number;
  lipidesP100: number;
};

type RecipeForLog = {
  id: string;
  nom: string;
  photo: string | null;
  portions: number;
  categorie: CategorieRecette;
  auteurPseudo: string;
  isMine: boolean;
  macrosParPortion: {
    calories: number;
    proteines: number;
    glucides: number;
    lipides: number;
  };
};

type PickedFood =
  | { kind: "local"; ingredient: LocalIngredient }
  | { kind: "off"; product: OFFProduct }
  | {
      kind: "custom";
      draft: {
        nom: string;
        caloriesP100: number;
        proteinesP100: number;
        glucidesP100: number;
        lipidesP100: number;
      };
    }
  | { kind: "recipe"; recipe: RecipeForLog };

const PORTION_ORDER: PortionType[] = [
  "ASSIETTE",
  "BOL",
  "POIGNEE",
  "CUILLERE_SOUPE",
  "CUILLERE_CAFE",
  "UNITE",
  "GRAMMES",
];

export function AjouterClient({
  repas,
  date,
  recents,
  recettes,
  favoriIngredients,
  favoriIngredientIds,
  favoriRecetteIds,
}: {
  repas: Repas;
  date: string;
  recents: LocalIngredient[];
  recettes: RecipeForLog[];
  favoriIngredients: LocalIngredient[];
  favoriIngredientIds: string[];
  favoriRecetteIds: string[];
}) {
  const [picked, setPicked] = useState<PickedFood | null>(null);
  const [tab, setTab] = useState<"aliment" | "recette">("aliment");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [favIngSet, setFavIngSet] = useState(
    () => new Set(favoriIngredientIds),
  );
  const [favRecSet, setFavRecSet] = useState(
    () => new Set(favoriRecetteIds),
  );
  // Liste affichée dans la section Favoris ingrédient (mutée à la volée).
  const [favIngList, setFavIngList] = useState<LocalIngredient[]>(
    () => favoriIngredients,
  );

  async function handleToggleIngFavori(ing: LocalIngredient) {
    const wasFav = favIngSet.has(ing.id);
    // Optimistic update
    setFavIngSet((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(ing.id);
      else next.add(ing.id);
      return next;
    });
    setFavIngList((prev) =>
      wasFav
        ? prev.filter((i) => i.id !== ing.id)
        : prev.some((i) => i.id === ing.id)
          ? prev
          : [ing, ...prev],
    );
    const res = await toggleFavoriIngredient(ing.id);
    if (!res.ok) {
      // Revert
      setFavIngSet((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(ing.id);
        else next.delete(ing.id);
        return next;
      });
    }
  }

  async function handleToggleRecFavori(recetteId: string) {
    const wasFav = favRecSet.has(recetteId);
    setFavRecSet((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(recetteId);
      else next.add(recetteId);
      return next;
    });
    const res = await toggleFavoriRecette(recetteId);
    if (!res.ok) {
      setFavRecSet((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(recetteId);
        else next.delete(recetteId);
        return next;
      });
    }
  }

  if (picked) {
    return (
      <PickedStep
        picked={picked}
        repas={repas}
        date={date}
        onBack={() => setPicked(null)}
      />
    );
  }

  return (
    <>
      {scannerOpen && (
        <BarcodeFlow
          onClose={() => setScannerOpen(false)}
          onFound={(picked) => {
            setScannerOpen(false);
            setPicked(picked);
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab("aliment")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors",
              tab === "aliment"
                ? "bg-accent text-white shadow-sm shadow-accent/30"
                : "text-muted-strong",
            )}
          >
            <Apple className="size-3.5" /> Aliment
          </button>
          <button
            type="button"
            onClick={() => setTab("recette")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors",
              tab === "recette"
                ? "bg-accent text-white shadow-sm shadow-accent/30"
                : "text-muted-strong",
            )}
          >
            <Utensils className="size-3.5" /> Recette
            {recettes.length > 0 && (
              <span className="rounded-full bg-bg/40 px-1.5 text-[9px]">
                {recettes.length}
              </span>
            )}
          </button>
        </div>

        {tab === "aliment" ? (
          <AlimentTab
            recents={recents}
            favoris={favIngList}
            favoriIds={favIngSet}
            onToggleFavori={handleToggleIngFavori}
            onPick={setPicked}
            onOpenScanner={() => setScannerOpen(true)}
          />
        ) : (
          <RecetteTab
            recettes={recettes}
            favoriIds={favRecSet}
            onToggleFavori={handleToggleRecFavori}
            onPick={setPicked}
          />
        )}
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// TAB ALIMENT
// ----------------------------------------------------------------------------

function AlimentTab({
  recents,
  favoris,
  favoriIds,
  onToggleFavori,
  onPick,
  onOpenScanner,
}: {
  recents: LocalIngredient[];
  favoris: LocalIngredient[];
  favoriIds: Set<string>;
  onToggleFavori: (ing: LocalIngredient) => void;
  onPick: (food: PickedFood) => void;
  onOpenScanner: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<OFFProduct[]>([]);
  const [pending, startTransition] = useTransition();
  const [searched, setSearched] = useState(false);

  // Debounce 200ms (réduit pour ressenti plus vif)
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const data = await searchFood(q);
        setResults(data);
        setSearched(true);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      {/* CTA principal : scanner */}
      <button
        type="button"
        onClick={onOpenScanner}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-white shadow-lg shadow-accent/30 transition-transform active:scale-[0.98]"
      >
        <ScanLine className="size-5" />
        Scanner un code-barre
      </button>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-card-border" />
        <span>ou</span>
        <span className="h-px flex-1 bg-card-border" />
      </div>

      {/* Recherche */}
      <label className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 focus-within:border-accent">
        <Search className="size-4 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ex. yaourt grec, riz basmati…"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
        {pending && <Loader2 className="size-4 animate-spin text-muted" />}
      </label>

      {/* CTA secondaire : créer perso */}
      {q.trim().length >= 2 && (
        <button
          type="button"
          onClick={() =>
            onPick({
              kind: "custom",
              draft: {
                nom: q,
                caloriesP100: 0,
                proteinesP100: 0,
                glucidesP100: 0,
                lipidesP100: 0,
              },
            })
          }
          className="flex items-center gap-2 rounded-lg border border-dashed border-accent-border bg-accent-bg/30 px-3 py-2.5 text-left transition-colors hover:bg-accent-bg/50"
        >
          <Plus className="size-4 text-accent-soft" />
          <div className="flex-1">
            <p className="text-xs font-medium">Créer « {q} » à la main</p>
            <p className="text-[10px] text-muted">
              Si t&apos;as les macros par 100g
            </p>
          </div>
        </button>
      )}

      {/* Favoris */}
      {q.trim().length < 2 && favoris.length > 0 && (
        <section>
          <CardLabel className="mb-2 inline-flex items-center gap-1 px-1">
            <Star className="size-3 fill-gold text-gold" />
            Favoris
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {favoris.map((ing) => (
              <li key={ing.id}>
                <PickableFoodRow
                  ing={ing}
                  isFavori
                  onPick={() => onPick({ kind: "local", ingredient: ing })}
                  onToggleFavori={() => onToggleFavori(ing)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recents */}
      {q.trim().length < 2 && recents.length > 0 && (
        <section>
          <CardLabel className="mb-2 inline-flex items-center gap-1 px-1">
            <Sparkles className="size-3 text-accent-soft" />
            Récents
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {recents.map((ing) => (
              <li key={ing.id}>
                <PickableFoodRow
                  ing={ing}
                  isFavori={favoriIds.has(ing.id)}
                  onPick={() => onPick({ kind: "local", ingredient: ing })}
                  onToggleFavori={() => onToggleFavori(ing)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Résultats OFF */}
      {q.trim().length >= 2 && results.length > 0 && (
        <section>
          <CardLabel className="mb-2 px-1">
            OpenFoodFacts ({results.length})
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {results.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  onClick={() => onPick({ kind: "off", product: p })}
                  className="block w-full text-left"
                >
                  <FoodRow
                    nom={p.nom}
                    photo={p.photo}
                    calories={p.caloriesP100}
                    sub={p.marque ?? undefined}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!pending && searched && results.length === 0 && q.trim().length >= 2 && (
        <Card className="py-4 text-center text-xs text-muted-strong">
          Aucun résultat dans OpenFoodFacts.
          <br />
          <span className="text-[11px]">
            Crée-le à la main ↑ ou{" "}
            <button
              type="button"
              onClick={onOpenScanner}
              className="text-accent-soft underline"
            >
              scanne-le
            </button>
            .
          </span>
        </Card>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// TAB RECETTE
// ----------------------------------------------------------------------------

function RecetteTab({
  recettes,
  favoriIds,
  onToggleFavori,
  onPick,
}: {
  recettes: RecipeForLog[];
  favoriIds: Set<string>;
  onToggleFavori: (recetteId: string) => void;
  onPick: (food: PickedFood) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim().length < 2
    ? recettes
    : recettes.filter((r) =>
        r.nom.toLowerCase().includes(q.trim().toLowerCase()),
      );

  const favoris = filtered.filter((r) => favoriIds.has(r.id));
  const mine = filtered.filter((r) => r.isMine && !favoriIds.has(r.id));
  const others = filtered.filter((r) => !r.isMine && !favoriIds.has(r.id));

  if (recettes.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center">
        <Utensils className="size-6 text-muted" />
        <p className="text-sm">Pas encore de recette</p>
        <p className="text-[11px] text-muted-strong">
          Tu peux créer une recette pour la logger facilement à chaque fois.
        </p>
        <Link
          href="/recettes/nouveau"
          className="mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
        >
          <Plus className="size-4" /> Créer une recette
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {recettes.length > 5 && (
        <label className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 focus-within:border-accent">
          <Search className="size-4 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer mes recettes…"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
      )}

      {favoris.length > 0 && (
        <section>
          <CardLabel className="mb-2 inline-flex items-center gap-1 px-1">
            <Star className="size-3 fill-gold text-gold" />
            Favoris
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {favoris.map((r) => (
              <li key={r.id}>
                <PickableRecipeRow
                  recipe={r}
                  isFavori
                  onPick={() => onPick({ kind: "recipe", recipe: r })}
                  onToggleFavori={() => onToggleFavori(r.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <CardLabel className="mb-2 px-1">Mes recettes</CardLabel>
          <ul className="flex flex-col gap-1.5">
            {mine.map((r) => (
              <li key={r.id}>
                <PickableRecipeRow
                  recipe={r}
                  isFavori={false}
                  onPick={() => onPick({ kind: "recipe", recipe: r })}
                  onToggleFavori={() => onToggleFavori(r.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <CardLabel className="mb-2 px-1">Communauté</CardLabel>
          <ul className="flex flex-col gap-1.5">
            {others.map((r) => (
              <li key={r.id}>
                <PickableRecipeRow
                  recipe={r}
                  isFavori={false}
                  onPick={() => onPick({ kind: "recipe", recipe: r })}
                  onToggleFavori={() => onToggleFavori(r.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/recettes/nouveau"
        className="mt-2 inline-flex items-center justify-center gap-1 text-[11px] text-accent-soft hover:underline"
      >
        <Plus className="size-3" /> Créer une nouvelle recette
      </Link>
    </div>
  );
}

function PickableFoodRow({
  ing,
  isFavori,
  onPick,
  onToggleFavori,
}: {
  ing: LocalIngredient;
  isFavori: boolean;
  onPick: () => void;
  onToggleFavori: () => void;
}) {
  return (
    <Card className="flex items-stretch gap-0 overflow-hidden p-0 transition-colors hover:border-accent-border">
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
      >
        {ing.photo ? (
          <img
            src={ing.photo}
            alt=""
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-bg text-sm font-medium text-accent-soft">
            {ing.nom.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{ing.nom}</p>
        </div>
        <p className="shrink-0 text-right text-[11px] text-muted-strong">
          {Math.round(ing.caloriesP100)} kcal
          <br />
          <span className="text-[9px] text-muted">/ 100g</span>
        </p>
      </button>
      <FavoriStarButton active={isFavori} onClick={onToggleFavori} />
    </Card>
  );
}

function PickableRecipeRow({
  recipe,
  isFavori,
  onPick,
  onToggleFavori,
}: {
  recipe: RecipeForLog;
  isFavori: boolean;
  onPick: () => void;
  onToggleFavori: () => void;
}) {
  return (
    <Card className="flex items-stretch gap-0 overflow-hidden p-0 transition-colors hover:border-accent-border">
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
      >
        {recipe.photo ? (
          <img
            src={recipe.photo}
            alt=""
            className="size-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-md bg-accent-bg text-lg">
            🍽️
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{recipe.nom}</p>
          <p className="text-[10px] text-muted">
            {CATEGORIE_RECETTE_LABEL[recipe.categorie]} · {recipe.portions}{" "}
            portion{recipe.portions > 1 ? "s" : ""}
            {!recipe.isMine && ` · par ${recipe.auteurPseudo}`}
          </p>
        </div>
        <p className="shrink-0 text-right text-[11px]">
          <span className="font-medium">
            {recipe.macrosParPortion.calories}
          </span>
          <span className="text-[9px] text-muted"> kcal/p</span>
          <br />
          <span className="text-[9px] text-muted">
            P{recipe.macrosParPortion.proteines}
          </span>
        </p>
      </button>
      <FavoriStarButton active={isFavori} onClick={onToggleFavori} />
    </Card>
  );
}

function FavoriStarButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid w-10 shrink-0 place-items-center border-l border-card-border/60 transition-colors hover:bg-bg/40"
    >
      <Star
        className={cn(
          "size-4 transition-colors",
          active ? "fill-gold text-gold" : "text-muted hover:text-fg",
        )}
      />
    </button>
  );
}

function RecipeRow({ recipe }: { recipe: RecipeForLog }) {
  return (
    <Card className="flex items-center gap-3 transition-colors hover:border-accent-border">
      {recipe.photo ? (
        <img
          src={recipe.photo}
          alt=""
          className="size-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="grid size-12 shrink-0 place-items-center rounded-md bg-accent-bg text-lg">
          🍽️
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{recipe.nom}</p>
        <p className="text-[10px] text-muted">
          {CATEGORIE_RECETTE_LABEL[recipe.categorie]} · {recipe.portions} portion
          {recipe.portions > 1 ? "s" : ""}
          {!recipe.isMine && ` · par ${recipe.auteurPseudo}`}
        </p>
      </div>
      <p className="shrink-0 text-right text-[11px]">
        <span className="font-medium">{recipe.macrosParPortion.calories}</span>
        <span className="text-[9px] text-muted"> kcal/p</span>
        <br />
        <span className="text-[9px] text-muted">
          P{recipe.macrosParPortion.proteines}
        </span>
      </p>
    </Card>
  );
}

function FoodRow({
  nom,
  photo,
  calories,
  sub,
}: {
  nom: string;
  photo: string | null;
  calories: number;
  sub?: string;
}) {
  return (
    <Card className="flex items-center gap-3 transition-colors hover:border-accent-border">
      {photo ? (
        <img
          src={photo}
          alt=""
          className="size-10 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-bg text-sm font-medium text-accent-soft">
          {nom.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nom}</p>
        {sub && <p className="truncate text-[10px] text-muted">{sub}</p>}
      </div>
      <p className="shrink-0 text-[11px] text-muted-strong">
        {Math.round(calories)} kcal / 100g
      </p>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// BARCODE FLOW
// ----------------------------------------------------------------------------

function BarcodeFlow({
  onClose,
  onFound,
}: {
  onClose: () => void;
  onFound: (picked: PickedFood) => void;
}) {
  const [looking, setLooking] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function handleDetected(code: string) {
    setLooking(true);
    setLastCode(code);
    setNotFound(false);
    const product = await lookupBarcode(code);
    setLooking(false);
    if (!product) {
      setNotFound(true);
      return;
    }
    navigator.vibrate?.([100, 50, 100]);
    onFound({ kind: "off", product });
  }

  if (looking || notFound) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 px-6 py-6 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          className="self-start text-[11px] text-muted-strong hover:text-fg"
        >
          ← Fermer
        </button>
        <div className="grid flex-1 place-items-center">
          {looking ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-accent" />
              <p className="text-sm">Recherche du code {lastCode}…</p>
              <p className="text-[11px] text-muted">OpenFoodFacts</p>
            </div>
          ) : (
            <Card className="max-w-sm text-center">
              <Camera className="mx-auto size-8 text-warning" />
              <p className="mt-2 text-sm font-medium">
                Code {lastCode} pas trouvé
              </p>
              <p className="mt-1 text-[11px] text-muted-strong">
                Ce produit n&apos;est pas (encore) dans OpenFoodFacts. Tu peux
                le créer à la main avec ses macros.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setNotFound(false);
                    setLastCode(null);
                  }}
                >
                  Re-scanner
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() =>
                    onFound({
                      kind: "custom",
                      draft: {
                        nom: `Produit ${lastCode}`,
                        caloriesP100: 0,
                        proteinesP100: 0,
                        glucidesP100: 0,
                        lipidesP100: 0,
                      },
                    })
                  }
                >
                  Créer à la main
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return <BarcodeScanner onDetect={handleDetected} onClose={onClose} />;
}

// ----------------------------------------------------------------------------
// STEP : portion + log
// ----------------------------------------------------------------------------

function PickedStep({
  picked,
  repas,
  date,
  onBack,
}: {
  picked: PickedFood;
  repas: Repas;
  date: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Pour aliment : portion + quantité
  const [portionType, setPortionType] = useState<PortionType>("ASSIETTE");
  const [quantite, setQuantite] = useState("1");

  // Pour custom : macros à saisir
  const isCreatingCustom = picked.kind === "custom";
  const [customNom, setCustomNom] = useState(
    isCreatingCustom ? picked.draft.nom : "",
  );
  const [customCal, setCustomCal] = useState(
    isCreatingCustom && picked.draft.caloriesP100
      ? String(picked.draft.caloriesP100)
      : "",
  );
  const [customProt, setCustomProt] = useState("");
  const [customGluc, setCustomGluc] = useState("");
  const [customLip, setCustomLip] = useState("");

  // Pour recette : juste nb de portions
  const isRecipe = picked.kind === "recipe";
  const [portionsRecette, setPortionsRecette] = useState("1");

  const summary = getFoodSummary(picked);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let ingredientId: string | undefined;
      let recetteId: string | undefined;

      if (picked.kind === "local") {
        ingredientId = picked.ingredient.id;
      } else if (picked.kind === "off") {
        const fd = new FormData();
        fd.set("nom", picked.product.nom);
        fd.set("caloriesP100", String(picked.product.caloriesP100));
        fd.set("proteinesP100", String(picked.product.proteinesP100));
        fd.set("glucidesP100", String(picked.product.glucidesP100));
        fd.set("lipidesP100", String(picked.product.lipidesP100));
        fd.set("openFoodFactsId", picked.product.code);
        if (picked.product.photo) fd.set("photo", picked.product.photo);
        const res = await createIngredient(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        ingredientId = res.id;
      } else if (picked.kind === "custom") {
        const fd = new FormData();
        fd.set("nom", customNom);
        fd.set("caloriesP100", customCal || "0");
        fd.set("proteinesP100", customProt || "0");
        fd.set("glucidesP100", customGluc || "0");
        fd.set("lipidesP100", customLip || "0");
        const res = await createIngredient(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        ingredientId = res.id;
      } else if (picked.kind === "recipe") {
        recetteId = picked.recipe.id;
      }

      const [y, m, d] = date.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d, 12, 0, 0);

      const log = await createNutritionLog({
        date: dateObj,
        repas,
        portionType: isRecipe ? "UNITE" : portionType,
        quantite: Number(isRecipe ? portionsRecette : quantite) || 1,
        ingredientId,
        recetteId,
      });
      if (!log.ok) {
        setError(log.error);
        return;
      }
      router.push(`/nutrition?date=${date}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card highlighted className="flex items-center gap-3">
        {summary.photo ? (
          <img
            src={summary.photo}
            alt=""
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-bg text-sm font-medium text-accent-soft">
            {summary.icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {summary.nom || "Nouvel aliment"}
          </p>
          <p className="text-[10px] text-muted">{summary.source}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-strong hover:text-fg"
        >
          <ChevronLeft className="size-3" /> Changer
        </button>
      </Card>

      {isCreatingCustom && (
        <Card className="flex flex-col gap-3">
          <CardLabel>Macros par 100g</CardLabel>
          <input
            type="text"
            value={customNom}
            onChange={(e) => setCustomNom(e.target.value)}
            placeholder="Nom"
            required
            className="h-10 rounded-md border border-card-border bg-bg px-3 text-sm outline-none focus:border-accent"
          />
          <div className="grid grid-cols-2 gap-2">
            <MacroField
              label="kcal"
              value={customCal}
              onChange={setCustomCal}
              placeholder="120"
            />
            <MacroField
              label="Prot (g)"
              value={customProt}
              onChange={setCustomProt}
              placeholder="12"
            />
            <MacroField
              label="Gluc (g)"
              value={customGluc}
              onChange={setCustomGluc}
              placeholder="5"
            />
            <MacroField
              label="Lip (g)"
              value={customLip}
              onChange={setCustomLip}
              placeholder="3"
            />
          </div>
        </Card>
      )}

      {isRecipe ? (
        <Card className="flex flex-col gap-3">
          <CardLabel>Combien de portions ?</CardLabel>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.5}
              step="any"
              value={portionsRecette}
              onChange={(e) => setPortionsRecette(e.target.value)}
              className="h-11 w-24 rounded-md border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
            />
            <span className="text-xs text-muted-strong">
              portion{Number(portionsRecette) > 1 ? "s" : ""}
            </span>
          </div>
          {picked.kind === "recipe" && (
            <p className="text-[10px] text-muted">
              ≈ {Math.round(picked.recipe.macrosParPortion.calories * Number(portionsRecette))} kcal ·
              P{Math.round(picked.recipe.macrosParPortion.proteines * Number(portionsRecette))}
              G{Math.round(picked.recipe.macrosParPortion.glucides * Number(portionsRecette))}
              L{Math.round(picked.recipe.macrosParPortion.lipides * Number(portionsRecette))}
            </p>
          )}
        </Card>
      ) : (
        <>
          <div>
            <CardLabel className="mb-2 px-1">Portion</CardLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {PORTION_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPortionType(p)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    portionType === p
                      ? "border-accent-border bg-accent-bg text-accent-soft"
                      : "border-card-border bg-card text-muted-strong",
                  )}
                >
                  <p className="text-xs font-medium">{PORTION_LABEL[p]}</p>
                  <p className="text-[9px] text-muted">{portionLabel(p)}</p>
                </button>
              ))}
            </div>
          </div>

          <Card className="flex flex-col gap-1.5">
            <CardLabel>
              Combien de {PORTION_LABEL[portionType].toLowerCase()} ?
            </CardLabel>
            <input
              type="number"
              inputMode={portionType === "GRAMMES" ? "numeric" : "decimal"}
              min={0}
              // step="any" pour ne pas bloquer 150 quand step=10 et min>0
              // (HTML5 considère 150 invalide si valeurs valides = min, min+step, min+2*step...)
              step="any"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              className="h-11 w-32 rounded-md border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
            />
          </Card>
        </>
      )}

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter à mon repas"}
      </Button>
    </form>
  );
}

function MacroField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function getFoodSummary(picked: PickedFood) {
  if (picked.kind === "local") {
    return {
      nom: picked.ingredient.nom,
      photo: picked.ingredient.photo,
      icon: picked.ingredient.nom.charAt(0).toUpperCase(),
      source: "Ingrédient sauvegardé",
    };
  }
  if (picked.kind === "off") {
    return {
      nom: picked.product.nom,
      photo: picked.product.photo,
      icon: picked.product.nom.charAt(0).toUpperCase(),
      source: picked.product.marque
        ? `OpenFoodFacts · ${picked.product.marque}`
        : "OpenFoodFacts",
    };
  }
  if (picked.kind === "recipe") {
    return {
      nom: picked.recipe.nom,
      photo: picked.recipe.photo,
      icon: "🍽️",
      source: `${picked.recipe.portions} portion${picked.recipe.portions > 1 ? "s" : ""} · ${picked.recipe.macrosParPortion.calories} kcal/p`,
    };
  }
  return {
    nom: picked.draft.nom,
    photo: null,
    icon: "+",
    source: "Aliment perso",
  };
}

function portionLabel(p: PortionType): string {
  switch (p) {
    case "CUILLERE_CAFE":
      return "~5g";
    case "CUILLERE_SOUPE":
      return "~15g";
    case "POIGNEE":
      return "~30g";
    case "BOL":
      return "~250g";
    case "ASSIETTE":
      return "~300g";
    case "GRAMMES":
      return "précis";
    case "UNITE":
      return "~100g";
  }
}
