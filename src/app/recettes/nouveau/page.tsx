import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { RecetteForm } from "../_form";

export default async function NouvelleRecettePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/recettes/nouveau");
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/recettes"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Nouvelle recette</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Tu pourras ajouter les ingrédients après la création.
      </p>

      <div className="mt-6">
        <RecetteForm mode="create" />
      </div>
    </div>
  );
}
