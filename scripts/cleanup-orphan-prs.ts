import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Supprime les PRs orphelins d'un user — ceux dont la séance liée a été
 * supprimée AVANT le fix qui cascade les PRs. Identifiés par `seanceId IS NULL`.
 *
 * Usage :
 *   npx tsx scripts/cleanup-orphan-prs.ts <pseudo-ou-email>
 *   npx tsx scripts/cleanup-orphan-prs.ts --all
 *
 * Exemple :
 *   npx tsx scripts/cleanup-orphan-prs.ts Popi
 *   npx tsx scripts/cleanup-orphan-prs.ts --all   # tous les users
 */

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "❌ Usage : npx tsx scripts/cleanup-orphan-prs.ts <pseudo-ou-email>",
    );
    console.error("   ou : npx tsx scripts/cleanup-orphan-prs.ts --all");
    process.exit(1);
  }

  if (arg === "--all") {
    return cleanupAll();
  }

  const isEmail = arg.includes("@");
  const user = await prisma.user.findFirst({
    where: isEmail ? { email: arg.toLowerCase() } : { pseudo: arg },
    select: { id: true, pseudo: true, email: true },
  });
  if (!user) {
    console.error(`❌ Aucun user trouvé pour "${arg}"`);
    process.exit(1);
  }

  console.log(`🎯 Cleanup PRs orphelins pour ${user.pseudo} <${user.email}>`);

  const orphans = await prisma.pR.findMany({
    where: { userId: user.id, seanceId: null },
    orderBy: { date: "desc" },
    select: {
      id: true,
      poidsKg: true,
      bwPlusKg: true,
      reps: true,
      oneRmKg: true,
      date: true,
      exercice: { select: { nom: true, isLeste: true } },
    },
  });

  if (orphans.length === 0) {
    console.log("✅ Aucun PR orphelin. Rien à faire.");
    return;
  }

  console.log(`📋 ${orphans.length} PR${orphans.length > 1 ? "s" : ""} orphelin${orphans.length > 1 ? "s" : ""} :`);
  for (const pr of orphans) {
    const charge = pr.exercice.isLeste
      ? pr.bwPlusKg != null
        ? `BW+${pr.bwPlusKg}kg`
        : "BW"
      : `${pr.poidsKg}kg`;
    console.log(
      `   · ${pr.exercice.nom} — ${charge} × ${pr.reps} (1RM ${Math.round(pr.oneRmKg * 10) / 10}kg, ${pr.date.toLocaleDateString("fr-FR")})`,
    );
  }

  const del = await prisma.pR.deleteMany({
    where: { userId: user.id, seanceId: null },
  });

  console.log(`✅ ${del.count} PR${del.count > 1 ? "s" : ""} supprimé${del.count > 1 ? "s" : ""}.`);
}

async function cleanupAll() {
  console.log("🌍 Cleanup PRs orphelins pour TOUS les users");

  const orphans = await prisma.pR.findMany({
    where: { seanceId: null },
    select: {
      userId: true,
      user: { select: { pseudo: true } },
    },
  });

  if (orphans.length === 0) {
    console.log("✅ Aucun PR orphelin global. Rien à faire.");
    return;
  }

  const byUser = new Map<string, { pseudo: string; count: number }>();
  for (const o of orphans) {
    const existing = byUser.get(o.userId);
    if (existing) existing.count += 1;
    else byUser.set(o.userId, { pseudo: o.user.pseudo, count: 1 });
  }

  console.log(`📋 ${orphans.length} PR orphelins répartis sur ${byUser.size} user(s) :`);
  for (const { pseudo, count } of byUser.values()) {
    console.log(`   · ${pseudo} : ${count}`);
  }

  const del = await prisma.pR.deleteMany({ where: { seanceId: null } });
  console.log(`✅ ${del.count} PR${del.count > 1 ? "s" : ""} supprimé${del.count > 1 ? "s" : ""}.`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
