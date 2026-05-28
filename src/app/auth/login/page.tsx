import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LoginForm } from "./_form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  return (
    <div className="flex min-h-svh flex-col px-5 pt-10 pb-8">
      <Link href="/" className="text-xs text-muted hover:text-fg">
        ← Retour
      </Link>

      <div className="mt-10">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Connecte-toi pour reprendre où t&apos;en étais.
        </p>
      </div>

      <div className="mt-8">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-xs text-muted-strong">
        Pas encore de compte ?{" "}
        <Link href="/auth/signup" className="text-accent-soft underline-offset-2 hover:underline">
          Crée-en un
        </Link>
      </p>
    </div>
  );
}
