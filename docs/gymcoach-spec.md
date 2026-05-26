# GymCoach - Spécifications de développement

> **Document destiné à Claude Code** : développer une PWA personnelle de suivi d'entraînement de musculation avec coach IA intégré.

---

## 1. Vue d'ensemble

### Objectif

Application web personnelle (PWA installable sur Android) permettant à un utilisateur unique de :
- Suivre ses séances d'entraînement de musculation en temps réel
- Enregistrer charges, répétitions et RIR par série
- Bénéficier d'un chronomètre automatique entre les séries
- Visualiser la progression dans le temps via graphiques
- Recevoir un débrief hebdomadaire et des ajustements de programme générés par Claude (API Anthropic)

### Utilisateur cible

**Un seul utilisateur** (l'auteur). Pas de gestion multi-comptes, pas de fonctionnalités sociales. Authentification simple JWT (1 user en base).

### Contexte d'usage critique

L'application est utilisée **dans une salle de sport (Basic Fit)** :
- Réseau parfois mauvais en sous-sol → **offline-first obligatoire**
- Mains poudreuses/moites → **boutons larges (min 64×64px)**
- Entre deux séries (30-150s) → **lecture rapide, validation en 1 tap**
- Téléphone qui se verrouille → **Wake Lock API obligatoire pendant séance**
- Vestiaires sombres → **mode sombre par défaut**

---

## 2. Stack technique

### Frontend (PWA)

```
- Next.js 14 (App Router)
- TypeScript strict
- Tailwind CSS
- Shadcn/UI (composants)
- next-pwa (transformation PWA)
- IndexedDB via Dexie.js (cache offline)
- Recharts (graphiques)
- React Hook Form + Zod (formulaires)
- Lucide React (icônes)
```

### Backend

```
- Next.js API Routes (même projet, monorepo)
- Prisma ORM
- PostgreSQL 16
- jose (JWT signing)
- bcrypt (hash mot de passe)
- @anthropic-ai/sdk (intégration Claude)
```

### Déploiement

```
- Docker + Docker Compose
- Nginx reverse proxy (déjà en place sur VPS)
- Certbot pour HTTPS (Let's Encrypt)
- GitHub Actions pour CI/CD (optionnel lot final)
```

### Variables d'environnement requises

```env
# .env
DATABASE_URL=postgresql://gymcoach:PASSWORD@db:5432/gymcoach
JWT_SECRET=<générer 64 chars random>
ANTHROPIC_API_KEY=<clé API user>
ANTHROPIC_MODEL=claude-sonnet-4-20250514
NEXTAUTH_URL=https://gymcoach.<domaine>.com
USER_EMAIL=<email pour login unique>
USER_PASSWORD_HASH=<hash bcrypt à générer au setup>
```

---

## 3. Architecture des dossiers

```
gymcoach/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # Layout principal avec navbar
│   │   ├── page.tsx                # Dashboard accueil
│   │   ├── programs/
│   │   │   ├── page.tsx            # Liste programmes
│   │   │   ├── [id]/page.tsx       # Détail programme
│   │   │   └── new/page.tsx        # Création programme
│   │   ├── session/
│   │   │   ├── new/page.tsx        # Sélection séance à démarrer
│   │   │   └── [id]/page.tsx       # SÉANCE EN COURS (écran clé)
│   │   ├── history/
│   │   │   ├── page.tsx            # Historique séances
│   │   │   └── [id]/page.tsx       # Détail séance passée
│   │   ├── progress/page.tsx       # Graphiques progression
│   │   └── coach/page.tsx          # Coach Claude (debrief hebdo)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── logout/route.ts
│   │   ├── programs/
│   │   │   ├── route.ts            # GET, POST
│   │   │   └── [id]/route.ts       # GET, PUT, DELETE
│   │   ├── sessions/
│   │   │   ├── route.ts            # GET historique, POST nouvelle
│   │   │   └── [id]/
│   │   │       ├── route.ts        # GET, PUT (clôturer)
│   │   │       └── sets/route.ts   # POST série
│   │   ├── exercises/
│   │   │   └── route.ts            # GET catalogue d'exercices
│   │   └── coach/
│   │       └── route.ts            # POST → appelle Claude API
│   ├── layout.tsx                  # Root layout + PWA metadata
│   └── globals.css
├── components/
│   ├── ui/                         # Shadcn components
│   ├── session/
│   │   ├── ExerciseCard.tsx        # Carte exercice en cours
│   │   ├── SetInput.tsx            # Saisie reps/charge/RIR
│   │   ├── RestTimer.tsx           # Chrono entre séries
│   │   ├── PreviousPerformance.tsx # Affichage performance précédente
│   │   └── SessionSummary.tsx      # Résumé fin de séance
│   ├── progress/
│   │   ├── ExerciseChart.tsx       # Graphique progression exo
│   │   └── VolumeChart.tsx         # Volume hebdo par muscle
│   └── shared/
│       ├── Navbar.tsx
│       └── OfflineIndicator.tsx
├── lib/
│   ├── db.ts                       # Prisma client
│   ├── auth.ts                     # Helpers JWT
│   ├── anthropic.ts                # Client Anthropic SDK
│   ├── indexeddb.ts                # Wrapper Dexie
│   ├── progression.ts              # Algo double progression
│   ├── wake-lock.ts                # Wake Lock API helper
│   └── prompts/
│       └── coach-system-prompt.ts  # Prompt système Claude
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                     # Seed données initiales (programme actuel)
│   └── migrations/
├── public/
│   ├── icons/                      # Icônes PWA (192, 512, etc.)
│   ├── manifest.json
│   └── sw.js                       # Service worker (généré par next-pwa)
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── package.json
```

---

## 4. Schéma de base de données (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  createdAt    DateTime   @default(now())
  programs     Program[]
  sessions     Session[]
  exercises    Exercise[]
}

model Exercise {
  id              String          @id @default(cuid())
  userId          String
  user            User            @relation(fields: [userId], references: [id])
  name            String          // ex: "Développé couché barre plat"
  muscleGroup     MuscleGroup     // enum
  category        ExerciseCategory // composé / isolation
  defaultRestSec  Int             @default(90)
  notes           String?         // technique, mind-muscle cue
  createdAt       DateTime        @default(now())
  programExercises ProgramExercise[]
  sets             Set[]

  @@unique([userId, name])
}

enum MuscleGroup {
  CHEST
  BACK_WIDTH
  BACK_THICKNESS
  SHOULDERS_FRONT
  SHOULDERS_LATERAL
  SHOULDERS_REAR
  BICEPS
  TRICEPS
  FOREARMS
  QUADS
  HAMSTRINGS
  GLUTES
  CALVES
  ABS
  LOWER_BACK
}

enum ExerciseCategory {
  COMPOUND
  ISOLATION
}

model Program {
  id              String           @id @default(cuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id])
  name            String           // ex: "PPL Hypertrophie 2026"
  description     String?
  phase           String           // ex: "Hypertrophie", "Force", "Stress métabolique"
  isActive        Boolean          @default(false)
  startDate       DateTime         @default(now())
  endDate         DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  workouts        Workout[]
  sessions        Session[]
}

model Workout {
  id              String            @id @default(cuid())
  programId       String
  program         Program           @relation(fields: [programId], references: [id], onDelete: Cascade)
  name            String            // ex: "Upper Lourd", "Lower", "Full Body"
  dayOfWeek       Int?              // 1=lundi, 2=mardi, etc. (null = flexible)
  order           Int               // ordre dans la semaine
  exercises       ProgramExercise[]
  sessions        Session[]
}

model ProgramExercise {
  id              String        @id @default(cuid())
  workoutId       String
  workout         Workout       @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  exerciseId      String
  exercise        Exercise      @relation(fields: [exerciseId], references: [id])
  order           Int           // ordre dans la séance
  targetSets      Int           // ex: 4
  targetRepsMin   Int           // ex: 6
  targetRepsMax   Int           // ex: 10
  targetRIR       Int           // ex: 2
  restSec         Int           // repos en secondes
  tempo           String?       // ex: "3-1-1-0"
  notes           String?       // consignes spécifiques
}

model Session {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  programId   String?
  program     Program?  @relation(fields: [programId], references: [id])
  workoutId   String?
  workout     Workout?  @relation(fields: [workoutId], references: [id])
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  notes       String?   // notes globales de la séance
  sets        Set[]

  @@index([userId, startedAt])
}

model Set {
  id            String    @id @default(cuid())
  sessionId     String
  session       Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  exerciseId    String
  exercise      Exercise  @relation(fields: [exerciseId], references: [id])
  setNumber     Int       // 1, 2, 3, 4...
  weight        Float     // kg
  reps          Int
  rir           Int?      // 0-5, null si pas reporté
  notes         String?   // ex: "douleur poignet", "drop set"
  isWarmup      Boolean   @default(false)
  isDropSet     Boolean   @default(false)
  completedAt   DateTime  @default(now())

  @@index([exerciseId, completedAt])
}

model CoachSession {
  id           String    @id @default(cuid())
  userId       String
  weekStart    DateTime  // début de semaine analysée
  weekEnd      DateTime
  prompt       String    @db.Text // prompt envoyé à Claude
  response     String    @db.Text // réponse de Claude
  appliedAt    DateTime? // si l'utilisateur a appliqué les ajustements
  createdAt    DateTime  @default(now())
}
```

---

## 5. Découpage en lots d'implémentation

> **Important** : développer lot par lot, faire valider à l'utilisateur à la fin de chaque lot avant de passer au suivant.

### LOT 1 — Setup projet & infrastructure (1 jour)

**Objectif** : projet qui tourne en local + déploiement Docker fonctionnel.

- [ ] Init projet Next.js 14 TypeScript App Router
- [ ] Installation Tailwind, Shadcn/UI, Prisma
- [ ] Schéma Prisma + migrations
- [ ] Docker Compose (Next.js + Postgres)
- [ ] Setup `.env.example`
- [ ] README avec instructions setup
- [ ] Configuration ESLint + Prettier
- [ ] Page d'accueil minimale "Hello World" qui prouve que ça tourne

**Critère d'acceptation** : `docker compose up` lance l'app sur localhost:3000, Postgres accessible.

---

### LOT 2 — Authentification simple (0.5 jour)

**Objectif** : login JWT pour utilisateur unique.

- [ ] Page `/login` avec formulaire email + password
- [ ] API route `POST /api/auth/login` (vérif bcrypt + JWT signed)
- [ ] Middleware Next.js pour protéger les routes `(app)/*`
- [ ] Cookie httpOnly avec JWT
- [ ] Logout
- [ ] Script de seed avec user unique (variables env)

**Critère d'acceptation** : login fonctionnel, redirection vers `/` si authentifié, retour `/login` sinon.

---

### LOT 3 — CRUD Exercices et Programmes (1 jour)

**Objectif** : créer/éditer programmes via l'interface.

- [ ] Page `/programs` (liste)
- [ ] Page `/programs/new` (création)
- [ ] Page `/programs/[id]` (détail + édition)
- [ ] API routes CRUD complètes
- [ ] Composants Shadcn pour formulaires
- [ ] Gestion des `Workout` (séances) au sein d'un programme
- [ ] Gestion des `ProgramExercise` (exercices au sein d'une séance)
- [ ] Catalogue d'exercices (CRUD séparé)
- [ ] Activation d'un programme (un seul actif à la fois)

**Critère d'acceptation** : possibilité de créer entièrement le programme actuel de l'utilisateur (Upper/Lower/FullBody avec tous les exos).

---

### LOT 4 — Seed du programme initial (0.25 jour)

**Objectif** : avoir le programme actuel pré-chargé.

- [ ] Script `prisma/seed.ts` qui crée :
  - Le user
  - Le catalogue de 30+ exercices avec muscleGroup et category
  - Le programme "Hypertrophie 2026 - Phase 1" complet
  - Les 3 workouts (Upper, Lower, Full Body)
  - Tous les ProgramExercise avec targetSets/Reps/RIR/restSec corrects

**Données à seeder** : reproduire fidèlement le programme du document Excel fourni en référence (cf. fichier programme initial fourni séparément).

**Critère d'acceptation** : après `npm run seed`, l'utilisateur voit son programme complet.

---

### LOT 5 — Écran "Séance en cours" (2 jours, écran le plus critique)

**Objectif** : L'écran clé. Permettre de mener une séance complète depuis le téléphone.

#### 5.1 — Sélection de séance

- [ ] Page `/session/new` : liste des workouts du programme actif
- [ ] Bouton "Démarrer cette séance" → crée une `Session` en DB → redirige vers `/session/[id]`

#### 5.2 — Écran principal séance

**UX critique** (boutons larges, lecture rapide, mode sombre par défaut) :

- [ ] Header sticky : nom de l'exercice en cours + numéro (ex: "3/10 - Pec deck")
- [ ] Barre de progression de séance (% exercices terminés)
- [ ] **Card exercice actuel** affichant :
  - Nom exercice + groupe musculaire (badge)
  - Cible : "4 séries × 8-12 reps · RIR 2 · Repos 90s"
  - Notes/cue (collapsable)
  - **Performance précédente** sur cet exo (charge × reps de la dernière séance)
  - **Suggestion de charge** (algo double progression, cf. lot 7)
- [ ] **Liste des séries** (déjà faites + en cours + à venir)
  - Série faite : grisée, charge × reps × RIR affichés
  - Série en cours : en évidence, formulaire de saisie
  - Série à venir : placeholder
- [ ] **Formulaire saisie série** (gros boutons) :
  - Stepper charge (− / + 2.5kg pour composés, 1kg pour iso) avec saisie manuelle possible
  - Stepper reps (− / + 1)
  - Sélecteur RIR : boutons 0/1/2/3 (gros)
  - Toggle "Drop set" / "Échauffement" (rare)
  - Champ note rapide (optionnel)
  - **Bouton "Valider" géant en bas (h-20, full width)**
- [ ] **À la validation** :
  - Sauvegarde en local (IndexedDB) immédiatement
  - Sync API si réseau OK
  - Démarre automatiquement le **chrono de repos**
  - Vibration courte (50ms)
- [ ] **Chrono de repos** :
  - Affichage massif (text-7xl)
  - Compte à rebours du temps configuré (ex: 90s)
  - Vibration longue (300ms) à 0
  - Son optionnel (toggle dans settings)
  - Bouton "Skip" et "+30s"
- [ ] Navigation : "Exercice précédent" / "Exercice suivant"
- [ ] Bouton "Terminer la séance" → écran résumé

#### 5.3 — Wake Lock

- [ ] Activation Wake Lock API au début de la séance
- [ ] Désactivation à la fin / au passage en arrière-plan
- [ ] Fallback gracieux si non supporté

#### 5.4 — Résumé fin de séance

- [ ] Page résumé : durée, volume total (séries × reps × charge), exercices faits
- [ ] Champ note de séance globale
- [ ] Bouton "Clôturer la séance" → marque `finishedAt`

**Critère d'acceptation** : faire une séance complète de A à Z avec le téléphone, les chronos qui tournent, les performances précédentes affichées, et tout ça même sans réseau (sync au retour de la connexion).

---

### LOT 6 — Mode offline (1 jour)

**Objectif** : l'app fonctionne en sous-sol Basic Fit.

- [ ] Setup `next-pwa` + manifest
- [ ] Service worker qui cache les pages et l'API GET
- [ ] IndexedDB via Dexie pour les Sets non-syncés
- [ ] Queue de sync : quand le réseau revient, push les sets à l'API
- [ ] Indicateur visuel de statut (online/offline/syncing)
- [ ] Toast "X séries en attente de sync" si offline
- [ ] Génération des icônes PWA (192px, 512px, maskable)

**Critère d'acceptation** : couper le wifi pendant une séance, finir la séance, racheter du wifi → tous les sets remontent en DB.

---

### LOT 7 — Algorithme de suggestion de charge (0.5 jour)

**Objectif** : afficher la charge suggérée pour la série suivante (double progression).

- [ ] Fonction `suggestNextWeight(exerciseId, targetReps)` :
  - Récupère la dernière séance pour cet exercice
  - Si toutes les séries de la dernière séance ont atteint le haut de la fourchette de reps → suggère charge actuelle + 2.5kg (composé) ou +1kg (isolation)
  - Sinon → suggère même charge (pour battre la performance en reps)
- [ ] Affichage dans l'écran de séance : "Suggestion : 73kg" avec icône d'aide expliquant la logique
- [ ] L'utilisateur peut ignorer la suggestion (saisie manuelle)

**Critère d'acceptation** : la suggestion correspond à la logique de double progression telle que définie dans le programme initial.

---

### LOT 8 — Historique et graphiques de progression (1 jour)

**Objectif** : visualiser les progrès dans le temps.

#### 8.1 — Historique séances

- [ ] Page `/history` : liste des séances passées (date, durée, programme, volume)
- [ ] Page `/history/[id]` : détail d'une séance (exos, séries)
- [ ] Filtres par programme, par mois

#### 8.2 — Graphiques de progression

- [ ] Page `/progress` avec :
  - Sélection d'un exercice → graphique charge max × date (Recharts)
  - Volume hebdomadaire par groupe musculaire (bar chart empilé)
  - 1RM estimé par exercice (formule Epley : `weight × (1 + reps/30)`)
- [ ] Tableau récapitulatif progression sur les 4-12 dernières semaines

**Critère d'acceptation** : voir clairement si on progresse ou stagne sur chaque exercice.

---

### LOT 9 — Coach Claude intégré (1.5 jour)

**Objectif** : debrief hebdomadaire automatique généré par Claude.

#### 9.1 — Backend : endpoint `/api/coach`

- [ ] Récupère les séances de la semaine en cours et précédente
- [ ] Construit un payload structuré (programme actif + données séances)
- [ ] Appelle l'API Anthropic avec :
  - **Modèle** : claude-sonnet-4-20250514
  - **System prompt** : `lib/prompts/coach-system-prompt.ts` (cf. ci-dessous)
  - **Messages** : payload utilisateur structuré
- [ ] Stocke la `CoachSession` en DB
- [ ] Retourne la réponse markdown au front

#### 9.2 — Prompt système

Contenu de `coach-system-prompt.ts` :

```
Tu es un coach en sciences du sport spécialisé en hypertrophie basée sur les preuves.
Tu reçois les données d'entraînement hebdomadaires d'un utilisateur avec son programme actif.
Le profil de l'utilisateur (sexe, taille, poids, objectif, fréquence) est fourni dans le payload quand il est renseigné.

Pour chaque debrief, tu produis :
1. **Récap performances** : exercices avec progression vs précédent
2. **Stagnations détectées** : exos sans progression depuis 3+ semaines
3. **Signaux de fatigue** : RIR qui se détériore, charges en baisse
4. **Suggestions semaine suivante** : charges à viser, ajustements de volume
5. **Points d'attention** : douleurs notées, technique, désequilibres

Tu es concis (max 600 mots), actionnable, factuel. Tu cites les études quand pertinent
(Schoenfeld, Helms, Israetel). Tu n'inventes pas de données qui ne sont pas dans le payload.

Format de sortie : markdown avec sections claires.
```

#### 9.3 — Frontend : page `/coach`

- [ ] Bouton "Demander un debrief de la semaine"
- [ ] Loader pendant l'appel API (peut prendre 10-20s)
- [ ] Affichage de la réponse markdown (avec `react-markdown`)
- [ ] Historique des debriefs précédents
- [ ] Bouton "Appliquer les ajustements" qui propose la mise à jour du programme (cf. lot 10)

**Critère d'acceptation** : appel à `/api/coach` retourne une analyse cohérente basée sur les vraies données de l'utilisateur.

---

### LOT 10 — Ajustement programme assisté (1 jour)

**Objectif** : appliquer les suggestions du coach au programme actuel.

- [ ] À la fin du debrief Claude, parser les suggestions de charge
- [ ] Page de validation : tableau "Exercice / Charge actuelle / Charge suggérée / ✓ Appliquer"
- [ ] Possibilité de modifier manuellement chaque suggestion
- [ ] Bouton "Appliquer" qui met à jour les `ProgramExercise` correspondants
- [ ] Marque la `CoachSession` comme `appliedAt`

**Critère d'acceptation** : un cycle complet semaine N → debrief → ajustements → semaine N+1 fonctionne.

---

### LOT 11 — Polish UX et déploiement production (1 jour)

**Objectif** : app prête pour usage quotidien.

- [ ] Mode sombre par défaut + toggle clair
- [ ] Animations Framer Motion (transitions entre exos, validation série)
- [ ] Empty states (pas de programme, pas de séance, etc.)
- [ ] Toasts pour feedbacks (sync OK, erreurs, etc.)
- [ ] Page settings : nom utilisateur, son chrono on/off, vibration on/off
- [ ] Backup/Export JSON de toutes les données
- [ ] Import JSON (utile en cas de reset)
- [ ] Déploiement (Docker, reverse proxy) :
  - Dockerfile production-ready
  - Docker Compose avec restart policies
  - Nginx config (déjà en place sur VPS)
  - Certbot HTTPS
  - GitHub Actions pour deploy auto sur push main (optionnel)

**Critère d'acceptation** : l'app est accessible publiquement sur `gymcoach.<domaine>.com`, installable en PWA sur Android, et l'utilisateur peut l'utiliser au quotidien.

---

## 6. Spécifications UX détaillées (écran "Séance en cours")

C'est l'écran le plus utilisé, il doit être parfait. Voici le wireframe en ASCII :

```
┌─────────────────────────────────────┐
│ ← Upper Lourd · Exo 3/10            │  ← Header sticky
│ ▓▓▓▓▓░░░░░ 30%                      │  ← Progress bar
├─────────────────────────────────────┤
│                                     │
│  PEC DECK                           │  ← Nom exo (text-2xl font-bold)
│  🔵 Pectoraux · Isolation           │
│                                     │
│  4 séries × 10-12 reps              │  ← Cible
│  RIR 1 · Repos 75s                  │
│                                     │
│  💡 Dernière séance : 73kg × 12     │  ← Performance précédente
│  💪 Suggestion : 75kg               │  ← Suggestion auto
│                                     │
│  ▼ Notes / Mind-muscle              │  ← Collapsable
│                                     │
├─────────────────────────────────────┤
│  Série 1 : ✅ 73kg × 12 · RIR 1     │  ← Série faite
│  Série 2 : ✅ 73kg × 11 · RIR 1     │
│  Série 3 : ◉ EN COURS              │  ← Série actuelle
│  Série 4 : ⚪ À venir               │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  CHARGE                             │
│  ┌──┐  ┌────────┐  ┌──┐            │
│  │ −│  │  75 kg │  │ +│            │  ← Stepper
│  └──┘  └────────┘  └──┘            │
│                                     │
│  REPS                               │
│  ┌──┐  ┌────────┐  ┌──┐            │
│  │ −│  │   10   │  │ +│            │
│  └──┘  └────────┘  └──┘            │
│                                     │
│  RIR                                │
│  ┌─┐ ┌─┐ ┌─┐ ┌─┐                  │
│  │0│ │1│ │2│ │3│                  │  ← Boutons
│  └─┘ └─┘ └─┘ └─┘                  │
│                                     │
│  □ Drop set  □ Échauffement         │
│  ┌─────────────────────────────┐   │
│  │ Note (optionnel)            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │      ✓ VALIDER SÉRIE         │   │  ← Bouton géant (h-20)
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Après validation, vue "repos"** :

```
┌─────────────────────────────────────┐
│ Pec deck · Série 3 ✅               │
├─────────────────────────────────────┤
│                                     │
│         REPOS                       │
│                                     │
│         ┌─────┐                     │
│         │ 75s │                     │  ← Compte à rebours géant
│         └─────┘                     │
│                                     │
│  ┌──────────┐    ┌──────────┐      │
│  │  +30s    │    │   Skip   │      │
│  └──────────┘    └──────────┘      │
│                                     │
│  Prochaine : Série 4                │
│  Suggestion : 75kg × 10             │
│                                     │
└─────────────────────────────────────┘
```

---

## 7. Spécifications API

### POST /api/auth/login
```json
Request: { "email": "...", "password": "..." }
Response: 200 { "ok": true } + cookie httpOnly
```

### GET /api/programs
Liste les programmes. `?active=true` pour le programme actif.

### POST /api/sessions
Crée une nouvelle séance.
```json
Request: { "workoutId": "..." }
Response: { "id": "...", "startedAt": "...", "exercises": [...] }
```

### POST /api/sessions/:id/sets
Enregistre une série.
```json
Request: {
  "exerciseId": "...",
  "setNumber": 3,
  "weight": 75,
  "reps": 10,
  "rir": 1,
  "isDropSet": false,
  "notes": null
}
```

### POST /api/coach
Déclenche le debrief Claude. Retourne markdown.
```json
Request: { "weekStart": "2026-04-27" }
Response: { "id": "...", "response": "## Récap...", "createdAt": "..." }
```

---

## 8. Contraintes techniques importantes

### Wake Lock API

```typescript
// lib/wake-lock.ts
let wakeLock: WakeLockSentinel | null = null;

export async function acquireWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn('Wake Lock failed:', err);
    }
  }
}

export function releaseWakeLock() {
  wakeLock?.release();
  wakeLock = null;
}
```

À appeler au début d'une séance, à libérer à la fin.

### Vibration

```typescript
function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}
// Validation série : vibrate(50)
// Fin de chrono : vibrate([300, 100, 300])
```

### IndexedDB sync queue

Schéma Dexie minimal :

```typescript
class GymCoachDB extends Dexie {
  pendingSets!: Dexie.Table<PendingSet, string>;

  constructor() {
    super('GymCoachDB');
    this.version(1).stores({
      pendingSets: 'localId, sessionId, createdAt, syncedAt'
    });
  }
}
```

Quand l'app démarre OU revient online → flush la queue vers l'API.

### PWA manifest minimal

```json
{
  "name": "GymCoach",
  "short_name": "GymCoach",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## 9. Critères d'acceptation globaux

À la fin du développement, l'utilisateur doit pouvoir :

1. ✅ Se connecter sur son téléphone via la PWA installée
2. ✅ Démarrer une séance en 2 taps
3. ✅ Saisir une série en 3 taps (charge, reps, RIR validé)
4. ✅ Voir le chrono démarrer automatiquement avec vibration de fin
5. ✅ Voir sa performance précédente sur chaque exercice
6. ✅ Suivre une séance complète sans réseau (sync au retour)
7. ✅ Consulter ses graphiques de progression sur 12 semaines
8. ✅ Recevoir un debrief Claude hebdomadaire actionnable
9. ✅ Appliquer les suggestions du coach en 1 clic
10. ✅ Exporter ses données en JSON pour backup

---

## 10. Notes finales pour Claude Code

- **Utiliser TypeScript strict partout** (no `any`)
- **Composants Shadcn/UI préférés** aux composants custom quand possible
- **Tests** : optionnels pour le MVP, mais les fonctions critiques (algo de progression, sync) méritent des tests unitaires
- **Commits** : un commit par sous-tâche (ex: "feat(session): add rest timer with vibration")
- **Branches** : une branche par lot (ex: `feat/lot-5-session-screen`)
- **Demander à l'utilisateur** de valider chaque lot avant de passer au suivant
- **Documenter** les choix non-évidents dans le code
- **Migrations Prisma** : créer une migration nommée par lot pour traçabilité

---

**Bonne implémentation ! 🏋️**
