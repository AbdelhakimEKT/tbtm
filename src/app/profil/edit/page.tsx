import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSpotifyProfile,
  hasSpotifyCredentials,
} from "@/lib/spotify";

import { ProfileForm } from "./_form";
import { SpotifyConnectCard } from "./_spotify-card";

type SearchParams = Promise<{ spotify?: string; msg?: string }>;

export default async function ProfilEditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/profil/edit");
  }

  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      pseudo: true,
      email: true,
      poidsKg: true,
      tailleCm: true,
      age: true,
      sexe: true,
      niveauActivite: true,
      objectif: true,
      ville: true,
      spotifyAccessToken: true,
    },
  });
  if (!user) redirect("/");

  const spotifyConfigured = hasSpotifyCredentials();
  const spotifyConnected = !!user.spotifyAccessToken;
  let spotifyProfile: { displayName: string; productPremium: boolean } | null =
    null;
  if (spotifyConnected) {
    spotifyProfile = await getSpotifyProfile(session.user.id);
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/profil"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Modifier mon profil</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Le poids, la taille, l&apos;âge et le sexe servent au calcul du TDEE (besoins caloriques) et de la catégorie de force.
      </p>

      <div className="mt-6">
        <ProfileForm
          initial={{
            pseudo: user.pseudo,
            email: user.email,
            poidsKg: user.poidsKg,
            tailleCm: user.tailleCm,
            age: user.age,
            sexe: user.sexe,
            niveauActivite: user.niveauActivite,
            objectif: user.objectif,
            ville: user.ville,
          }}
        />
      </div>

      <div className="mt-8">
        <SpotifyConnectCard
          configured={spotifyConfigured}
          connected={spotifyConnected}
          profile={spotifyProfile}
          flashStatus={params.spotify}
          flashMessage={params.msg}
        />
      </div>
    </div>
  );
}
