import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SignupForm } from "./_form";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  return (
    <div className="flex min-h-svh flex-col px-5 pt-10 pb-8">
      <Link href="/" className="text-xs text-muted hover:text-fg">
        ← Retour
      </Link>

      <div className="mt-10">
        <h1 className="text-2xl font-semibold">Crée ton compte</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Choisis un pseudo pour que tes potes te ping.
        </p>
      </div>

      <div className="mt-8">
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-xs text-muted-strong">
        Déjà un compte ?{" "}
        <Link href="/auth/login" className="text-accent-soft underline-offset-2 hover:underline">
          Connecte-toi
        </Link>
      </p>
    </div>
  );
}
