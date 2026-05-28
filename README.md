# T'es bon tu montes (TBTM)

PWA fitness perso : programmes, séances live, PRs, nutrition, défis entre potes.

Stack : Next.js 16 (App Router) · PostgreSQL + Prisma · NextAuth v5 · Tailwind 4 · TypeScript

Voir [`CAHIER_DES_CHARGES.md`](./CAHIER_DES_CHARGES.md) pour la vision complète.

## Démarrage rapide

```bash
# 1. Copie l'env d'exemple et remplis-le
cp .env.example .env.local

# 2. Si tu utilises Supabase : récupère ta connection string Postgres
#    et colle-la dans DATABASE_URL + DIRECT_URL dans .env.local
#    (port 6543 pour DATABASE_URL = pooler, port 5432 pour DIRECT_URL = migrations)

# 3. Crée le secret NextAuth
openssl rand -base64 32   # colle le résultat dans NEXTAUTH_SECRET

# 4. Pousse le schéma en BDD
npm run db:push   # ou `db:migrate` pour créer une migration nommée

# 5. Lance le serveur de dev
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## Scripts

| Commande            | Action                                          |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Serveur de dev (port 3000)                      |
| `npm run build`     | Build de prod                                   |
| `npm run start`     | Lance le build de prod                          |
| `npm run lint`      | ESLint                                          |
| `npm run db:push`   | Sync le schéma Prisma vers la BDD (sans migration) |
| `npm run db:migrate`| Crée une migration nommée + l'applique          |
| `npm run db:studio` | UI Prisma pour explorer la BDD                  |

## Structure

```
src/
  app/                # routes App Router
    auth/login        # connexion email/password
    auth/signup       # inscription
    profil            # page profil
    api/auth/         # routes NextAuth
  components/         # composants partagés
    ui/               # primitives (Card, Button, Avatar)
  lib/                # prisma, auth, helpers
prisma/
  schema.prisma       # schéma de la BDD
public/               # icons, manifest assets
mockups/              # mockups HTML d'origine (référence design)
```

## Phases de développement

Voir le cahier des charges pour le détail. Implémenté à ce stade :

- [x] Phase 1 — Init + auth + profil de base + PWA manifest
- [ ] Phase 2 — Bibliothèque d'exercices
- [ ] Phase 3 — Programmes
- [ ] Phase 4 — Mode séance live (le cœur)
- [ ] Phase 5 — Fin de séance + PR auto-detect
- [ ] Phase 6 — Stats (heatmap, courbes)
- [ ] Phase 7 — Gamification (XP, badges)
- [ ] Phase 8 — Nutrition (OpenFoodFacts)
- [ ] Phase 9 — Social (amis, défis, leaderboard)
- [ ] Phase 10 — Spotify
- [ ] Phase 11 — Notifications push PWA
