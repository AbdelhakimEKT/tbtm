# T'es bon tu montes — Cahier des charges complet

## Contexte du projet

App fitness PWA (Progressive Web App) créée par et pour Abdelhakim, étudiant en alternance à l'INSEE à Orléans. L'app est pensée pour lui et ses amis qui s'entraînent ensemble — certains en salle avec matériel (haltères, banc, barre de traction, barre de dips), d'autres uniquement en poids de corps lestés. L'ambiance est décontractée, entre potes, avec des références gaming/culture geek (League of Legends, Valorant principalement). Pas une app ultra-sérieuse, pas de citations motivationnelles — juste un outil efficace avec de la personnalité.

Le projet s'inspire directement d'un dashboard Clash of Clans existant (Next.js + BDD + API Supercell) que Abdelhakim a déjà construit — il est donc à l'aise avec cette stack.

---

## Nom & identité

- **Nom** : T'es bon tu montes (TBTM sur l'icône/raccourci)
- **Thème visuel** : sombre avec accent violet (#7c3aed / #a78bfa)
- **Dark mode / Light mode** avec toggle
- **Ton de l'app** : naturel, entre potes, références gaming
  - PR battu → "T'es bon tu montes 📈"
  - Fin de séance → "GG EZ" ou "Nice Tutorial"
  - Absent depuis X jours → "T'as FF15 ou FF8 là ?" / "{user} a été déconnecté"
  - Défi reçu → "T'as été ping"
  - Badge débloqué → "Achievement unlocked"
  - Nouveau PR → "Monstre" / "Double monstre" / "Triple monstre"
- **Pas de** : phrases d'accueil le matin, citations motivationnelles, ton de coach sportif

---

## Stack technique

- **Framework** : Next.js 14 (App Router, full-stack)
- **BDD** : PostgreSQL + Prisma ORM
- **Auth** : NextAuth.js (email/password + OAuth Google)
- **UI** : Tailwind CSS
- **Graphes** : Recharts
- **PWA** : next-pwa (manifest + service worker, installable depuis le navigateur)
- **Nutrition** : API OpenFoodFacts (scan code barre + recherche)
- **Musique** : Spotify Web API (OAuth, lecture en cours, contrôle playback)
- **Hébergement** : Vercel (recommandé) + Supabase ou Railway pour PostgreSQL

---

## Fonctionnalités détaillées

### 1. Authentification & profil

- Inscription / connexion (email + password, OAuth Google)
- Profil utilisateur :
  - Pseudo, avatar (initiales si pas de photo)
  - Poids de corps (pour calcul Wilks et poids de corps sur les exos)
  - Objectif : prise de masse / sèche / force / forme générale
- Niveau XP (voir section gamification)
- Liste d'amis avec bouton "Défier" direct
- Ajout d'ami par pseudo ou lien

---

### 2. Exercices — bibliothèque

Chaque exercice contient :
- Nom
- Muscles ciblés (tags : pectoraux, dos, épaules, biceps, triceps, jambes, abdos...)
- Type de matériel (haltères, barre de traction, barre de dips, poids de corps, élastique, lest)
- **Prise** (pronation, supination, neutre, prise large, prise serrée...)
- **Dynamisme** (explosif, contrôlé, isométrique)
- **Tempo** au format 4 chiffres : excentrique-pause bas-concentrique-pause haut (ex: 3-1-1-0)
- Guide d'exécution step by step (texte)
- Historique personnel (courbe de progression 1RM estimé, liste des séances avec poids/reps)

La bibliothèque est partagée entre tous les users. N'importe qui peut créer un exercice.

---

### 3. Programmes

- Créer un programme (nom, description, tags muscles)
- Ajouter des exercices au programme avec pour chaque exercice :
  - Nombre de séries cibles
  - Reps cibles par série
  - Poids cible par série (ou "poids de corps + X kg" pour les exos lestés)
  - Temps de récupération par exercice
- Réordonner les exercices (drag & drop)
- Dupliquer un programme
- Partager un programme (lien public ou envoi à un ami)
- Importer le programme d'un ami
- **3 onglets** : Mes créations / Communauté / Partagés avec moi

Le **programme actif** est mis en avant sur l'écran "Mes programmes" avec :
- Progression de la semaine (X séances / objectif hebdo)
- Dernière séance
- Durée moyenne
- Suggestion automatique de la prochaine séance

---

### 4. Mode séance en direct ⚡

C'est le cœur de l'app — doit être ultra fluide sur mobile.

**Flow** :
1. Depuis "Mes programmes" → tap sur un programme → "Lancer la séance"
2. L'app pré-remplit tous les exercices, séries, poids (basés sur la dernière séance + progression suggérée)
3. En live : l'user valide ou ajuste chaque série

**Interface** :
- Barre de progression (exercice X sur Y)
- Tableau des sets : série / poids / reps / RIR (Reps in Reserve)
  - Série active surlignée
  - Séries validées cochées
  - Poids suggéré automatiquement (+2.5kg si la dernière fois les reps cibles ont été atteintes)
- Timer de récupération configurable avec alerte sonore
  - Bouton "Terminer récup" et "+30s"
  - Barre de progression du timer
- Bouton "Ajouter une série" (bonus si l'user a encore de l'énergie)
- Note de forme du jour (1 à 5 étoiles) saisie en début de séance
- **Mini player Spotify** intégré : titre en cours, play/pause/skip, sans quitter l'app
- Stats en temps réel : durée de la séance + volume total soulevé (kg)
- Gros bouton "Série suivante" bien visible

---

### 5. Fin de séance

Écran récap affiché automatiquement à la fin :
- Durée totale, volume total, nombre de séries, reps totales
- **PR détectés automatiquement** : liste des nouveaux records avec ancien PR vs nouveau
- **XP gagné** : détail (séance complétée + bonus PR + bonus streak)
- Barre de progression XP vers le niveau suivant
- Liste des exercices avec trophée sur les PR
- Bouton "Partager" (image générée avec les stats)
- Bouton "Retour accueil"

---

### 6. Statistiques & progression

**Période** : Mois / 3 mois / Année

- 4 cartes résumé : séances, volume total, durée moyenne, streak actuel
- Courbe de progression par exercice (1RM estimé, sélectionnable)
- **Heatmap** style GitHub (carrés colorés en violet selon l'intensité de la séance)
- **PR par exercice** (liste avec trophée or/argent/bronze)
- **Répartition musculaire** : % de volume par groupe musculaire ce mois — utile pour voir les déséquilibres
- Corrélation note de forme / performance (si données suffisantes)

---

### 7. Nutrition

**Philosophie** : pas de pesée obligatoire, système de portions approximatives. L'objectif c'est d'avoir une idée globale, pas d'être chirurgical.

**Portions disponibles (après fait un truc bien pck la dcp ca fait bcp d'option voit un truc pour pas que ca fasse mal a la tête quand on voit)** :
- 1 cuillère à café (~5g)
- 1 cuillère à soupe (~15g)
- 1 poignée (~30g)
- 1 bol (~250ml)
- 1 assiette normale (~300g)
- Grammage précis (optionnel)

**Log du jour** :
- Organisé par repas : petit-déjeuner / déjeuner / dîner / collation
- Cercle de calories du jour avec barres macros (protéines / glucides / lipides)
- Objectif calorique calculé automatiquement (TDEE selon profil + activité)
- Recettes suggérées le soir selon les macros restantes à atteindre

**Scan d'aliments** :
- Scan code barre via caméra → OpenFoodFacts → macros auto
- Recherche texte dans la base OpenFoodFacts
- Sélection de la portion → macros calculées

**Recettes** :
- Création de recette : nom, photo, description, portions, temps de prep, catégorie
- Ajout d'ingrédients depuis la base OpenFoodFacts ou créés manuellement
- Macros calculées automatiquement en temps réel
- **Visibilité** : Communauté / Amis seulement / Privé
- Bibliothèque communautaire avec notes (étoiles)
- Les ingrédients créés manuellement sont partagés avec tous les users

---

### 8. Gamification

**XP & niveaux** :
- Séance complétée : +100 XP
- Nouveau PR : +75 XP par PR
- Streak bonus : +5 XP × nombre de jours de streak
- Défi accepté et complété : +50 XP
- Recette publiée : +30 XP

**Badges** (non exhaustif, prendre des initiatives) :
- Premier PR
- Streak 7j / 30j / 100j (après la aussi fais une certaine logique pck on va pas s'entrainer 7j/7 ca parais logique donc essaye d'implémenter une logique pour la streak, la j'ai pas didée moi j'avoue)
- 10 / 50 / 100 / 500 séances
- Volume 10t / 50t / 100t / 1000t soulevé total
- Premier défi lancé / Premier défi gagné
- Première recette publiée
- Niveau 5 / 10 / 20
- Badge mystère "???" — à débloquer de façon cachée (easter egg)

Les badges verrouillés sont visibles en grisé avec un cadenas — ça donne envie de les débloquer.

**Niveaux** (catégories de force calculées automatiquement) :
- Novice → Débutant → Intermédiaire → Avancé → Expert
- Basé sur les standards de force relatifs au poids de corps (développé couché 1x poids de corps = intermédiaire, etc.)

---

### 9. Calculateurs intégrés

- **1RM** : formules Epley, Brzycki, Lombardi (au choix)
- **Charge optimale** selon objectif : force (85%+ 1RM), hypertrophie (65-80%), endurance (< 65%)
- **RIR** (Reps in Reserve) : aide à calibrer l'effort
- **TDEE** (dépense énergétique totale) : selon profil + niveau d'activité
- **Wilks/DOTS score** : pour comparer les forces entre users de poids différents

---

### 10. Social — défis & leaderboard

**Leaderboard** :
- 3 onglets : Amis / Global / Défis
- Classement par volume mensuel soulevé
- Podium top 3 mis en avant visuellement
- Classement complet en dessous

**Défis** :
- Lancer un défi depuis n'importe quel programme (1v1 ou groupe)
- Les challengés reçoivent une notif "T'as été ping"
- Délai libre — chacun fait la séance quand il veut
- Résultat : stats côte à côte (volume, durée, reps) — pas de gagnant officiel, juste les chiffres
- Fil de commentaires/réactions sur chaque défi (pour chambrer)
- Bouton "Refuser" ou "Accepter le défi"

---

### 11. Spotify

- Connexion compte Spotify via OAuth (optionnel, pas obligatoire)
- Mini player dans le mode séance en direct :
  - Titre + artiste en cours
  - Play / Pause / Skip
  - Lancer une playlist depuis l'app
- Suggestion de playlists selon le type de séance (optionnel, initiative libre)

---

## Structure des écrans (voir dossier /mockups)

```
/mockups
  ├── 01_accueil.html
  ├── 02_mes_programmes.html
  ├── 03_detail_programme.html
  ├── 04_mode_seance.html
  ├── 05_fin_seance.html
  ├── 06_stats.html
  ├── 07_nutrition.html
  ├── 08_creation_recette.html
  ├── 09_profil_badges.html
  └── 10_leaderboard_defis.html
  └── 11_detail_exercice.html
```

Chaque fichier HTML est un mockup visuel statique du thème sombre violet. **Reproduire fidèlement ces designs** en implémentation appart si y'a une coquille ou si tu penses pouvoir faire quelques chose de mieux.

---

## Schéma BDD, apres ici aussi si tu penses qu'il y a des coquilles hésite pas a modifier des trucs c pas fixe du tous

```
User
  ├── id, pseudo, email, password, avatar
  ├── poids, objectif, ville
  ├── xp, niveau, categorie
  ├── createdAt
  ├── → Seances[]
  ├── → Programmes[]
  ├── → PRs[]
  ├── → NutritionLogs[]
  ├── → Badges[]
  ├── → Amis[] (relation many-to-many)
  └── → Defis[]

Programme
  ├── id, nom, description, tags, visibilite
  ├── createdBy → User
  └── → ProgrammeExercices[]

ProgrammeExercice
  ├── ordre, seriesCibles, repsCibles, poidsCible, tempsRecup
  ├── → Exercice
  └── → Programme

Exercice
  ├── id, nom, muscles[], materiel, prise, dynamisme, tempo
  ├── guideExecution (text)
  └── createdBy → User

Seance
  ├── id, date, duree, volumeTotal, noteDeFormeDuJour
  ├── → User
  ├── → Programme
  └── → SeanceSets[]

SeanceSet
  ├── ordre, poids, reps, rir, isBonus
  ├── → Seance
  └── → Exercice

PR (Personal Record)
  ├── poids, reps, date
  ├── → User
  └── → Exercice

NutritionLog
  ├── date, repas (enum), calories, proteines, glucides, lipides
  ├── quantite, portionType
  ├── → User
  └── → Recette ou Ingredient

Recette
  ├── nom, description, photo, portions, tempsPrep, categorie, visibilite
  ├── note (moyenne), nbVotes
  ├── createdBy → User
  └── → RecetteIngredients[]

RecetteIngredient
  ├── grammes
  ├── → Recette
  └── → Ingredient

Ingredient
  ├── nom, photo, calories, proteines, glucides, lipides (par 100g)
  ├── openFoodFactsId (nullable)
  └── createdBy → User

Badge
  ├── slug, nom, description, icone
  ├── → UserBadges[]

Defi
  ├── id, statut, createdAt
  ├── lancePar → User
  ├── → Programme
  ├── → DefiParticipants[]
  └── → DefiCommentaires[]

DefiParticipant
  ├── statut (en_attente / accepte / complete / refuse)
  ├── volumeTotal, duree, repsTotal
  ├── → User
  └── → Defi
```

---

## Notes importantes pour Claude Code

### Prendre des initiatives

Ce projet est fait par et pour Abdelhakim — **hésite pas à ajouter des fonctionnalités qui n'ont pas été explicitement demandées** si tu penses que c'est pertinent. Exemples de trucs qui pourraient être biens :

- Un mode "séance rapide" sans programme pré-défini (log libre)
- Des notifications push PWA (rappel si pas de séance depuis X jours, "T'as FF8 là ?")
- Un historique de toutes les séances avec recherche/filtre
- Une page "explorer" pour découvrir des programmes et recettes de la communauté
- Un système de commentaires sur les programmes de la communauté
- La génération automatique d'une image de partage stylée après une PR (og:image dynamique)
- Un mode hors-ligne (service worker + cache des données essentielles)
- Des animations sur les PRs et achievements (confettis, etc.)
- Un onboarding pour les nouveaux users (objectif, poids, premier programme suggéré)
- Des raccourcis clavier pour le mode séance sur desktop

### Priorités de développement suggérées

1. Auth + profil de base
2. Bibliothèque d'exercices + création
3. Programmes + gestion
4. Mode séance en direct (c'est le cœur)
5. Fin de séance + PR detection
6. Stats + heatmap
7. Gamification (XP, badges, niveaux)
8. Nutrition + scan OpenFoodFacts
9. Social (amis, défis, leaderboard)
10. Spotify integration
11. Notifications push PWA
12. Polish UI + animations

### Contraintes importantes

- **PWA first** : tout doit être fluide sur mobile, installable, avec icône sur l'écran d'accueil
- **Pas d'app store** : distribution uniquement via navigateur (lien direct)
- **Offline capable** : les séances en cours doivent fonctionner sans connexion (sync au retour)
- **Performance** : le mode séance doit être instantané, pas de lag entre les séries
- **Accessibilité** : contrastes corrects, tailles de texte lisibles

### Variables d'environnement nécessaires

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

---

## Ce que l'app n'est PAS

- Pas une app ultra-sérieuse de compétition
- Pas de citations motivationnelles ou ton de coach sportif
- Pas de monétisation prévue (usage perso + amis)
- Pas besoin de support multi-langue (français uniquement)
