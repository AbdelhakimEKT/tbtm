import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Crée ou met à jour un compte admin. Idempotent — on peut le re-run sans
 * casser quoi que ce soit. Usage :
 *   npx tsx scripts/create-admin.ts <pseudo> <email> <password>
 * ou :
 *   npm run create-admin -- <pseudo> <email> <password>
 *
 * Tu peux aussi définir ADMIN_PSEUDO / ADMIN_EMAIL / ADMIN_PASSWORD dans
 * .env.local pour éviter de retaper à chaque fois.
 */

async function main() {
  const [, , argPseudo, argEmail, argPassword] = process.argv;

  const pseudo = argPseudo ?? process.env.ADMIN_PSEUDO;
  const emailRaw = argEmail ?? process.env.ADMIN_EMAIL;
  const password = argPassword ?? process.env.ADMIN_PASSWORD;

  if (!pseudo || !emailRaw || !password) {
    console.error("❌ Args manquants.");
    console.error("   Usage : npm run create-admin -- <pseudo> <email> <password>");
    console.error("   Ou définis ADMIN_PSEUDO / ADMIN_EMAIL / ADMIN_PASSWORD dans .env.local");
    process.exit(1);
  }

  const email = emailRaw.toLowerCase();

  if (password.length < 8) {
    throw new Error("Password trop court (min 8 chars)");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      pseudo,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      pseudo,
      email,
      passwordHash,
      role: "ADMIN",
    },
    select: { id: true, pseudo: true, email: true, role: true, createdAt: true },
  });

  console.log(`✅ Admin upserted :`);
  console.log(`   pseudo : ${user.pseudo}`);
  console.log(`   email  : ${user.email}`);
  console.log(`   role   : ${user.role}`);
  console.log(`   id     : ${user.id}`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
