import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const exoCount = await prisma.exercice.count();
  const badgeCount = await prisma.badge.count();
  const userCount = await prisma.user.count();
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  const someExos = await prisma.exercice.findMany({
    take: 5,
    select: { nom: true, muscles: true },
    orderBy: { nom: "asc" },
  });
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { pseudo: true, email: true, createdAt: true },
  });

  console.log(`📊 Exercices : ${exoCount}`);
  console.log(`🏆 Badges : ${badgeCount}`);
  console.log(`👤 Users : ${userCount} (dont ${adminCount} admin)`);
  console.log(`\n📝 Échantillon d'exercices :`);
  someExos.forEach((e) => console.log(`  • ${e.nom} (${e.muscles.join(", ")})`));
  if (admins.length > 0) {
    console.log(`\n🛡️  Admins :`);
    admins.forEach((a) => console.log(`  • ${a.pseudo} <${a.email}>`));
  }
}

main().finally(() => prisma.$disconnect());
