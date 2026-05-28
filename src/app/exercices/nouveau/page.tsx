import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { ExerciceForm } from "../_form";

export default async function NouvelExercicePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/exercices/nouveau");
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/exercices"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Nouvel exercice</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Visible par tout le monde une fois créé.
      </p>

      <div className="mt-6">
        <ExerciceForm mode="create" />
      </div>
    </div>
  );
}
