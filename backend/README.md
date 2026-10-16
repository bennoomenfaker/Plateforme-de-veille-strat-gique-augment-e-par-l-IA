# VeilleAI — Backend (API)

API REST du projet **VeilleAI**, plateforme de veille stratégique augmentée par l'IA. Le backend
orchestre le cadrage de veille, la **collecte** de données depuis des sources multiples, le
**traitement**, l'**enrichissement par LLM** et la **génération d'insights**.

> **Stack** : NestJS 10 · TypeScript · Prisma 6 · PostgreSQL 15 · JWT · Nodemailer · Ollama / Mistral / Groq
> **Point d'entrée** : `src/main.ts` (@nestjs) — port `3000` par défaut.

---

## Table des matières

- [1. Démarrage](#1-démarrage)
- [2. Scripts npm](#2-scripts-npm)
- [3. Configuration (variables d'environnement)](#3-configuration-variables-denvironnement)
- [4. Architecture modulaire](#4-architecture-modulaire)
- [5. Arborescence de `src/`](#5-arborescence-de-src)
- [6. Le pipeline de données](#6-le-pipeline-de-données)
- [7. Connecteurs de collecte](#7-connecteurs-de-collecte)
- [8. API](#8-api)
- [9. IA : LLM, prompts, copilote et moteur d'insights](#9-ia--llm-prompts-copilote-et-moteur-dinsights)
- [10. Sécurité & authentification](#10-sécurité--authentification)
- [11. Modèle de données](#11-modèle-de-données)
- [12. Docker & déploiement](#12-docker--déploiement)
- [13. Tests](#13-tests)
- [14. Dette technique & points d'attention](#14-dette-technique--points-dattention)

---

## 1. Démarrage

### Prérequis
- Node.js **20+**
- Une base **PostgreSQL 15**
- (Optionnel) un serveur **Ollama**, ou des clés **Mistral** / **Groq**

### Installation locale

```bash
npm install

# Variables d'environnement : copier le modèle
cp .env.dev.example .env.dev
# puis éditer DATABASE_URL, JWT_SECRET, clés LLM, SMTP...

# Appliquer les migrations Prisma
npx prisma migrate dev

# Lancer en mode watch (charge .env.dev via dotenv-cli)
npm run start:dev
```

L'API écoute sur **http://localhost:3000**. Les fichiers uploadés sont servis statiquement sur
**`/uploads/`** (`main.ts` monte `uploads/` en `useStaticAssets`).

> Le client Prisma est généré dans `generated/prisma` (dossier gitignoré) grâce au
> `generator client { output = "../generated/prisma" }` du schéma.

---

## 2. Scripts npm

| Script | Commande | Usage |
|---|---|---|
| `build` | `nest build` | Compile vers `dist/` |
| `start` | `dotenv -e .env.dev -- nest start` | Démarrage simple |
| `start:dev` | `dotenv -e .env.dev -- nest start --watch` | Développement (watch) |
| `start:debug` | `dotenv -e .env.dev -- nest start --debug --watch` | Debug |
| `start:prod` | `node dist/main` | Production |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | Lint + fix |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | Formatage |
| `test` / `test:watch` / `test:cov` | `jest` | Tests unitaires |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | Tests e2e |

---

## 3. Configuration (variables d'environnement)

Fichier de référence : **`.env.dev.example`**. En développement, les scripts chargent **`.env.dev`**.

| Variable | Défaut | Rôle |
|---|---|---|
| `DATABASE_URL` | — | Connexion PostgreSQL (Prisma) |
| `PORT` | `3000` | Port HTTP |
| `JWT_SECRET` | `SECRET_KEY_SUPER_FORTE` | Clé de signature JWT |
| `FRONTEND_URL` | `http://localhost:5173` | Base des liens d'email |
| `OLLAMA_URL` | `http://localhost:11434` | Serveur Ollama |
| `OLLAMA_MODEL` | `mistral` | Modèle local |
| `LLM_DELAY_MS` | `600` | Pause avant chaque appel LLM (ms) |
| `MISTRAL_API_KEY` / `MISTRAL_MODEL` | — / `mistral-large-latest` | Fournisseur cloud n°1 |
| `GROQ_API_KEY` / `GROQ_MODEL` | — / `llama-3.3-70b-versatile` | Fournisseur cloud n°2 (repli) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | — | Envoi d'emails |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | *(codé en dur)* | Compte super-admin |
| `UPLOAD_AVATAR_DIR` | `./uploads/avatars` | Dossier des avatars |

> 🚫 **Ne jamais commiter** `.env` / `.env.dev` (dans `.gitignore`).

---

## 4. Architecture modulaire

Le backend est composé de **25 modules NestJS** déclarés dans `src/app.module.ts`.

| Module | Rôle |
|---|---|
| `CommonModule` | Module **global** : `PrismaService` + `OrgAccessService` (contrôle d'accès multi-tenant). |
| `AuthModule` | Inscription (individuel / organisation / invitation), login, JWT access+refresh, profil, reset de mot de passe, avatar. |
| `AuthMailModule` | `MailService` (Nodemailer) : bienvenue, invitation, alerte, reset. |
| `OrganisationsModule` | Organisations, membres, invitations, codes de jonction, rôles. |
| `ProjectsModule` | CRUD projets, clôture/archivage/suppression, duplication complète, export CSV, graphe. |
| `ObjectivesModule` | Objectifs d'un projet (max 5), réordonnancement. |
| `AxesModule` | Axes d'un objectif (max 5), réordonnancement / réaffectation. |
| `HypothesesModule` | Hypothèses d'un axe, CRUD + réordonnancement. |
| `PerimetersModule` | Périmètres projet (géographique/sectoriel) et liaison hypothèse↔périmètre. |
| `CollectionPlansModule` | Plans de collecte, sources de plan, mots-clés (INCLUDE/EXCLUDE/PRINCIPAL). |
| `StakeholdersModule` | Parties prenantes d'un projet d'organisation. |
| `SchedulerModule` | Cron horaire déclenchant les plans de collecte échus. |
| `CollectionEngineModule` | Moteur de collecte : `CollectionManager`, connecteurs RSS/WEB/PDF/API, `KeywordFilter`. |
| `SourcesModule` | CRUD des `Source` « héritées » (RSS/web) rattachées à un projet. |
| `EtlModule` | ETL historique (`Source → RawData`), cron désactivé. |
| `ProcessingModule` | Traitement `RawItem → ProcessedItem` (nettoyage, langue, extraits). |
| `AiEnrichmentModule` | Enrichissement LLM `ProcessedItem → EnrichedItem` + évaluation des hypothèses. |
| `AiCopilotModule` | Assistant IA de conception (suggestions, réécriture, génération/correction de projet). |
| `InsightEngineModule` | Insights : tendances, signaux faibles, anomalies, analyse d'hypothèses. |
| `AnalyseModule` | Statistiques / dashboards (sentiments, entités, word cloud, réseau). |
| `AlertesModule` | Alertes utilisateur + cron horaire + email. |
| `ReportsModule` | Génération de rapport HTML. |
| `UploadModule` | Upload manuel de PDF dans un plan. |
| `FoldersModule` | dossiers rangeant les projets. |
| `AdminModule` | Back-office super-admin (utilisateurs, organisations, logs, pipeline, quotas). |

> `main.ts` active un **`ValidationPipe` global** (`whitelist`, `forbidNonWhitelisted`, `transform`) et le **`CORS`**.

---

## 5. Arborescence de `src/`

```
src/
├── main.ts                     # Bootstrap, ValidationPipe, CORS, static /uploads
├── app.module.ts               # Agrégation des 25 modules
│
├── auth/                       # JWT, guards, login/register/profil/reset
├── auth-mail/                  # Service email (Nodemailer)
├── organisations/              # Organisations, membres, invitations
├── projects/                   # Projets
├── objectives/ axes/ hypotheses/ perimeters/ stakeholders/  # Cadrage
├── collection-plans/           # Plans de collecte
├── collection-engine/          # Moteur de collecte
│   ├── collection.manager.ts
│   ├── connectors/ (rss.service.ts, web.service.ts, pdf-scraper.service.ts)
│   └── filters/ (keyword.filter.ts)
├── scheduler/                  # Cron de déclenchement des plans
├── processing/                 # RawItem → ProcessedItem
├── ai-enrichment/              # Enrichissement LLM
│   ├── llm-provider.service.ts
│   └── prompt-templates/enrichment.prompt.ts
├── ai-copilot/                 # Assistant IA de conception
├── insight-engine/             # Insights (tendances, signaux faibles, anomalies)
├── analyse/                    # Statistiques / dashboards
├── alertes/                    # Alertes + cron
├── reports/                    # Rapports HTML
├── upload/                     # Upload PDF
├── sources/ etl/               # Pipeline hérité
├── folders/                    # Dossiers
├── admin/                      # Back-office super-admin
├── common/                     # PrismaService, OrgAccessService
└── prisma/                     # PrismaService
```

---

## 6. Le pipeline de données

Trois entités chaînées : **`RawItem` → `ProcessedItem` → `EnrichedItem`** (chacune reliée par une
relation `@unique` 1-1), plus `Insight` et `HypothesisEvaluation` en aval. **La collecte et les
alertes sont automatisées ; les autres étapes se déclenchent via l'API.**

### Étape 1 — Collecte (automatisée par cron)

- **`SchedulerService.handleCron()`** (`@Cron(CronExpression.EVERY_HOUR)`) sélectionne les
  `CollectionPlan` `is_active = true`, `frequency != ON_DEMAND` et `next_run_at <= now`, remonte la
  hiérarchie `hypothesis → axis → objective → project → organisation` pour trouver un propriétaire,
  puis appelle `CollectionManager.runCollectionPlan(planId, ownerId, 'SCHEDULED')`.
- **`CollectionManager.runCollectionPlan()`** :
  1. contrôle d'accès via `OrgAccessService` ;
  2. crée un `CollectionJob` `PENDING` → `RUNNING` (progression stockée dans `logs`) ;
  3. construit les mots-clés (mots-clés projet + périmètres + mots de l'objectif, fusionnés avec les
     mots-clés `INCLUDE`/`PRINCIPAL` du plan, et une liste `EXCLUDE`) ;
  4. pour chaque `CollectionPlanSource`, route vers le bon connecteur selon `source_type`
     (`RSS` / `WEB` / `PDF` / `API`) ;
  5. filtre via `KeywordFilter`, écrit chaque `RawItem` avec un `hash` SHA-256 **unique**
     (les doublons sont comptés) ;
  6. passe le job à `DONE`, calcule `next_run_at` (`+1 j` / `+7 j` / `+1 mois`) et met à jour
     `last_run_at`. Un échec global passe le job à `FAILED`.

**Enums** : `JobStatus { PENDING, RUNNING, DONE, FAILED }`, `TriggerType { MANUAL, SCHEDULED }`,
`Frequency { ON_DEMAND, DAILY, WEEKLY, MONTHLY }`.

### Étape 2 — Traitement (`ProcessingService`)

Déclenché par `POST /projects/:id/process` ou `POST /collection-plans/:id/process`.

- Parcourt les `RawItem` **non encore traités** (lots de 200 au niveau projet, 100 au niveau plan)
  et crée un `ProcessedItem` pour chacun :
  - `cleanHtml()` (Cheerio : suppression `script/style/nav/footer/header/aside/iframe`, repli regex) ;
  - contenu trop court → `processing_status: 'SKIPPED'` (`content_too_short`) ;
  - `detectLanguage()` heuristique (fr/en/es/de/ar, sinon `und`) ;
  - `extractExcerpt()` (≈500 caractères), `word_count`, `char_count`, `content_clean` (≤ 50 000) ;
  - toute exception → `processing_status: 'FAILED'` + `error_message`.
- Suit l'avancement via un `ProcessingJob` avec compteurs (`total/processed/skipped/failed`).

**Enum** : `ProcessingStatus { PENDING, RUNNING, DONE, FAILED, SKIPPED, CANCELLED }`.

### Étape 3 — Enrichissement IA (`AiEnrichmentService`)

Déclenché par `POST /projects/:projectId/enrich?force=true` ou `POST /collection-plans/:planId/enrich`.

- `onModuleInit()` : les jobs restés `RUNNING` sont marqués `FAILED` (« serveur redémarré »).
- Traitement **par lots de 5**, avec reconstruction du contexte (question du plan, contenu de
  l'hypothèse, périmètres du projet), construction du prompt (`buildEnrichmentPrompt`), appel du LLM
  (`LlmProviderService.generate`), parsing JSON, puis `upsert` d'un `EnrichedItem`.
- **Champs produits** : `answer`, `summary`, `entities`, `topics`, `sentiment`,
  `relevance_score`, `hypothesis_impact`, `confidence_score`, `model_used`, `prompt_version`.
- Met ensuite à jour la `HypothesisEvaluation` associée (ratio support/contre → statut).
- Autres opérations : liste filtrée, jobs, annulation (`CANCELLED`), statistiques.

**Enum** : `HypothesisImpact { OPEN, PARTIALLY_SUPPORTED, SUPPORTED, CONTRADICTED, NEEDS_MORE_RESEARCH }`.

### Étape 4 — Insights (`InsightGeneratorService`)

`POST /insight-engine/generate/:projectId` agrège quatre analyses et persiste des lignes `Insight` :
`TrendDetectionService` (tendances), `AnomalyDetectionService` (anomalies), `WeakSignalService`
(signaux faibles), `HypothesisInsightService` (hypothèses). Voir la [section 9](#9-ia--llm-prompts-copilote-et-moteur-dinsights).

---

## 7. Connecteurs de collecte

| Connecteur | Fichier | Fonctionnement |
|---|---|---|
| **RSS** | `connectors/rss.service.ts` | `rss-parser` (timeout 15 s) ; nettoyage HTML ; si le contenu est trop court, tentative de scraping de l'article par sélecteurs ; `hash = SHA-256(title + link)`. |
| **Web** | `connectors/web.service.ts` | Axios + détection des liens d'articles par sélecteurs, filtrage de la navigation, dédoublonnage, max **20** articles, délai de 500 ms entre chaque ; `hash = SHA-256(title + url)`. |
| **PDF** | `connectors/pdf-scraper.service.ts` | Extrait les liens `.pdf` d'une page, les télécharge dans `uploads/pdfs/`, `hash = SHA-256(title + pdfUrl)`. |
| **API** | `CollectionManager.fetchApiSource()` | Axios GET ; détection automatique du tableau utile (`payload`, `.items`, `.data`). |
| **Filtrage** | `filters/keyword.filter.ts` | `filterInclude` / `filterExclude` (insensible à la casse). |

Le **retry** d'un connecteur est tenté une fois après 3 s en cas d'échec.

---

## 8. API

La plupart des contrôleurs de domaine sont protégés par `@UseGuards(JwtAuthGuard)`.

| Préfixe | Domaine / endpoints notables |
|---|---|
| `GET /` | Santé (`Hello World`) |
| `/auth` | `register`, `register/organisation`, `register/invitation`, `invitation/:token/verify`, `invitation/:token/accept`, `login`, `admin/login`, `me`, `profile`, `change-password`, `profile/avatar`, `refresh`, `logout`, `forgot-password`, `reset-password` |
| `/organisations` | CRUD, `me`, `:id/membres` (+ rôle/statut), `:id/invite`, `:id/invitations`, `:id/regenerate-codes` |
| `/projects` | `POST /`, `POST /organisation/:orgId`, `GET /`, `/graph`, `/archived`, `:id/export-csv`, `:id`, `PUT :id`, `PATCH :id/{close,reopen,archive}`, `DELETE :id`, `POST :id/duplicate` |
| `/projects/:projectId/objectives` | `POST`, `GET`, `PUT reorder`, `PUT :objectiveId`, `DELETE :objectiveId` |
| `/objectives/:objectiveId/axes` | idem (max 5 axes) |
| `/axes/:axisId/hypotheses` | idem |
| `/projects/:projectId/perimeters`, `/perimeters/*` | Périmètres + assignation aux hypothèses |
| `/projects/:projectId/stakeholders` | Parties prenantes |
| `/sources` | Sources héritées |
| `/etl` | Collecte héritée (`Source → RawData`) |
| `/collection-plans`, `/hypotheses/:id/collection-plans` | Plans de collecte, sources, mots-clés, réordonnancement |
| `/collection-plans/:planId/run`, `/collection-jobs/:jobId`, `/projects/:projectId/raw-items` | Moteur de collecte |
| `/projects/:id/process`, `/projects/:id/processed-items`, `/projects/:id/processing-stats` | Traitement |
| `/projects/:projectId/enrich`, `/projects/:projectId/enriched-items`, `/projects/:projectId/enrichment-jobs`, `/enrichment-jobs/:jobId/cancel`, `/projects/:projectId/enrichment-stats`, `/projects/:projectId/hypothesis-evaluations` | Enrichissement IA |
| `/insight-engine` | `generate/:projectId`, `insights/:projectId`, `insights/:projectId/stats`, `insights/:id/{read,dismiss}`, `trends/detect/:projectId`, `trends/:projectId`, `weak-signals/detect/:projectId`, `weak-signals/:projectId`, `anomalies/detect/:projectId` |
| `/analyse` | `project/:id`, `results/:id`, `stats/:id`, `dashboard/:id`, `user-dashboard` |
| `/alertes` | `check`, `POST`, `GET`, `unread`, `project/:projectId`, `:id/read`, `read-all`, `DELETE :id` |
| `/reports` | `GET project/:projectId/html`, `project/:projectId/download` |
| `/uploads` | `POST pdf`, `GET plan/:planId`, `DELETE raw-item/:rawItemId` |
| `/folders` | CRUD dossiers |
| `/ai-copilot` | `POST suggest`, `refine`, `project` |
| `/admin` | `dashboard`, `users`, `users/:id/suspend`, `organisations`, `logs`, `projects`, `pipeline`, `quotas` |

---

## 9. IA : LLM, prompts, copilote et moteur d'insights

### Chaîne de fournisseurs LLM — `LlmProviderService`

Tentatives **dans cet ordre** : **① Mistral → ② Groq → ③ Ollama**.

- Mistral : `https://api.mistral.ai/v1/chat/completions`
- Groq : `https://api.groq.com/openai/v1/chat/completions`
- Ollama : `POST {OLLAMA_URL}/api/generate`

Paramètres communs : `temperature: 0.3`, max ≈ 1000 tokens, timeout 120 s. Reprise automatique
(`callWithRetry`, 3 tentatives) avec back-off spécifique sur HTTP 429 (header `retry-after`) et 5xx.
En cas d'échec de tous les fournisseurs → erreur `LLM unavailable`. `isAvailable()` teste une clé
cloud ou, à défaut, un ping d'Ollama.

> ℹ️ Le commentaire du `.env.dev.example` annonce « Ollama → Mistral → Groq » ; l'ordre réellement
> implémenté dans le code est **Mistral → Groq → Ollama**.

### Prompts — `prompt-templates/enrichment.prompt.ts`

Prompt en français exigeant une **réponse JSON stricte** à partir de la question de recherche, de
l'hypothèse, des périmètres, du titre et du contenu (≤ 3 000 caractères). Champs attendus :
`answer`, `summary`, `entities[]`, `topics[]`, `sentiment` (POSITIF/NEGATIF/NEUTRE),
`relevance_score` (0-1), `hypothesis_impact`, `confidence_score` (0-1).

### Copilote — `AiCopilotModule`

Délègue au `LlmProviderService` et expose :

- `POST /ai-copilot/suggest` — suggestions brutes.
- `POST /ai-copilot/refine` — réécriture d'hypothèses et de questions.
- `POST /ai-copilot/project` — mode `generate` (créer un projet complet : nom, problématique,
  objectifs, axes, hypothèses, questions), `correct` (détecter les problèmes graves de cohérence) et
  `chat` (modifier un projet selon une instruction).

### Moteur d'insights — `InsightEngineModule` (100 % heuristique, sans LLM)

| Service | Algorithme |
|---|---|
| `WeakSignalService` | Compare une fenêtre de 14 j à une fenêtre de référence (14-60 j) sur 90 j. Score pondéré de 4 sous-scores : nouveauté (0.30), croissance (0.30), multi-sources (0.25), fréquence (0.15). Retient les signaux ≥ 0.30 et persiste les 20 meilleurs. |
| `TrendDetectionService` | Compare 30 j vs 30 j précédents par thème/entité : variation, `variationPercent`, `isEmerging`. Classe tendances montantes (>+20 %), descendantes (<-20 %), émergentes. Persiste des `TrendPoint`. |
| `AnomalyDetectionService` | Trois détecteurs : `VOLUME_SPIKE` (volume 7 j vs moyenne 60 j, > 1.5×), `SENTIMENT_SHIFT` (part de NEGATIF 14 j vs 14-60 j, écart > 0.2), `VOLUME_EXPLOSION` (aujourd'hui > 3× hier). Sévérité LOW/MEDIUM/HIGH. |
| `HypothesisInsightService` | Croise les `HypothesisEvaluation` et les `EnrichedItem` récents (7 j) pour produire un commentaire confirmant/contredisant chaque hypothèse. |
| `InsightGeneratorService` | Orchestre les quatre, persiste des `Insight` (types `TREND`, `ANOMALY`, `WEAK_SIGNAL`, `HYPOTHESIS`) et gère lecture / rejet / statistiques. |

---

## 10. Sécurité & authentification

- **JWT access + refresh** (`auth/auth.service.ts`) :
  - `login()` : vérifie le statut du compte (SUSPENDU/INACTIF rejeté), `bcrypt.compare`, émet un
    **access token** (1 jour) et un **refresh token** (64 octets, stocké en base, 7 jours).
  - `refreshToken()` : vérifie l'existence/expiration puis **rotation** (l'ancien est supprimé).
  - `logout()` : supprime les refresh tokens de l'utilisateur.
  - `logActivity(...)` journalise l'action dans `UserActivityLog`.
- **Guards** : `JwtAuthGuard` (global sur les contrôleurs), `SuperAdminGuard` (back-office).
  Le `RolesGuard` existe mais n'est pas branché (l'autorisation fine passe par `OrgAccessService`).
- **Isolation multi-tenant** — `common/org-access.service.ts` :
  `getProjectWithAccess`, `assertProjectRead`, `assertProjectWrite`, `canWrite`, `isOwner`,
  `getOrgMemberRole`, `assertOrgOwner`. Rôles pouvant écrire : Propriétaire, Manager, Équipe veille.
- **Rôle `OrgRole`** : `PROPRIETAIRE`, `MANAGER`, `EQUIPE_VEILLE`, `LECTEUR`.
- **Rate limiting** (`@nestjs/throttler`) : `20 req/min` global ; `login` 5/min,
  `forgot-password` 3/min, `reset-password` 5/min.
- **bcrypt** : 10 rounds ; mot de passe aléatoire généré si absent.
- **Invitations** : token aléatoire (32 octets), expiration 7 jours, envoi par email ; rôle
  `PROPRIETAIRE` interdit en invitation.
- **Mot de passe oublié** : token aléatoire dont seul le **hash SHA-256** est stocké, expiration 1 h,
  usage unique (`used_at`).
- **Avatar** : `FileInterceptor` + `diskStorage` (`uploads/avatars`), filtre `image/*`, max 5 Mo.
- **Codes de jonction** : `join_code_equipe` / `join_code_lecteur` (hexadécimal), régénérables.

---

## 11. Modèle de données

Schéma complet : [`prisma/schema.prisma`](./prisma/schema.prisma) — **~31 modèles**, **11 enums**,
**10 migrations**.

### Enums principaux

- `UserType { INDIVIDUEL, ORGANISATION }`, `UserStatut { ACTIF, INACTIF, SUSPENDU }`
- `OrgRole { PROPRIETAIRE, MANAGER, EQUIPE_VEILLE, LECTEUR }`, `MembreStatut`, `InvitationStatus`
- `Frequency { ON_DEMAND, DAILY, WEEKLY, MONTHLY }`, `PerimeterType { GEOGRAPHIC, SECTORAL }`
- `StakeholderRole { DECIDEUR, ANALYSTE, OBSERVATEUR }`
- `MonitoringType` — **22 valeurs** (STRATEGIC, COMPETITIVE, SECTORAL, TECHNOLOGICAL,
  REGULATORY_LEGAL, GEOPOLITICAL, CYBERSECURITY, …)
- `SourceType { RSS, WEB, API, DOCUMENT }`
- `JobStatus { PENDING, RUNNING, DONE, FAILED }`, `TriggerType { MANUAL, SCHEDULED }`
- `ProcessingStatus { PENDING, RUNNING, DONE, FAILED, SKIPPED, CANCELLED }`
- `HypothesisImpact { OPEN, PARTIALLY_SUPPORTED, SUPPORTED, CONTRADICTED, NEEDS_MORE_RESEARCH }`

### Hiérarchie métier

```
User ─┬─ Organisation ─── MembreOrganisation ─── User
      │                ├─ InvitationOrganisation
      │                └─ Folder
      ├─ Folder ──── Project
      └─ Project (individuel)

Project (monitoring_type, keywords[], frequency, problematique, is_deleted)
 ├─ ProjectObjective (max 5) ─ ProjectAxis (max 5) ─ ProjectHypothesis
 │      └─ CollectionPlan ─┬─ CollectionPlanSource (source_type, source_label, source_url, metadata)
 │                          ├─ CollectionPlanKeyword (PRINCIPAL/INCLUDE/EXCLUDE)
 │                          └─ CollectionJob (status, trigger_type, logs)
 │      └─ HypothesisPerimeter ─ ProjectPerimeter
 ├─ ProjectPerimeter (GEOGRAPHIC/SECTORAL) + Scope
 ├─ Source ─ RawData ─ WatchResult            (pipeline hérité)
 ├─ RawItem ─ ProcessedItem ─ EnrichedItem    (pipeline actuel)
 ├─ ProjectStakeholder / Alert / Report
 └─ WeakSignal / TrendPoint / Insight / HypothesisEvaluation

Comptes & sécurité : RefreshToken, PasswordResetToken, UserActivityLog
```

### Migrations

`init_sprint_3`, `rbac_profile_org_codes`, `make_project_perimeter_value_nullable`,
`add_password_reset_token`, `add_source_frequency`, `add_plan_priority`, `add_insight_engine`,
`add_cancelled_status`, `add_problematique`, `add_monitoring_types`.

---

## 12. Docker & déploiement

**`Dockerfile`** (`node:20-alpine`) : `npm install` → copie `prisma/` → `npx prisma generate` →
`npm run build` → `EXPOSE 3000` → `CMD npx prisma migrate deploy && node dist/main`.

Au niveau du dépôt, `docker-compose.yml` définit le service `api` :

```yaml
api:
  build: ./backend
  depends_on: [db, ollama]
  env_file: [./backend/.env]
  ports: ["3000:3000"]
  networks: [veille_net]
```

Les migrations sont appliquées automatiquement au démarrage du conteneur.

---

## 13. Tests

- **Framework** : Jest + ts-jest (`rootDir: src`, `testRegex: .*\.spec\.ts$`).
- Specs présents : `src/app.controller.spec.ts`, `src/scheduler/scheduler.service.spec.ts`.
- Tests e2e : `test/app.e2e-spec.ts` (`test/jest-e2e.json`).

```bash
npm run test        # unitaires
npm run test:cov    # couverture
npm run test:e2e    # e2e
```

---

## 14. Dette technique & points d'attention

1. **`EnrichedItem.hypothesis_id` toujours `null`** → les `HypothesisEvaluation` restent bloquées sur
   `OPEN` et les filtres par hypothèse ne renvoient rien (bug fonctionnel majeur).
2. **`pdf-parse` non déclaré** dans `package.json` alors que `upload.service.ts` l'appelle →
   extraction de texte PDF en échec silencieux.
3. **Upload PDF sans `diskStorage`** → `file.path` peut être indéfini côté service.
4. **Secret JWT partiellement codé en dur** dans `jwt.strategy.ts` (cohérence liée à `JWT_SECRET`).
5. **Endpoints non protégés / sans contrôle d'accès** : `/etl/collect/project/:id` (sans guard) ;
   sources, analyse, processing, upload, folders, stakeholders (contrôle d'accès incomplet → risque d'IDOR).
6. **`RolesGuard` non utilisé** (aucun `@Roles()`), et `RolesGuard`/`SetMetadata` absents.
7. **Orchestration manuelle** des étapes traitement → enrichissement → insights.
8. **Coexistence de deux pipelines** (`Source/RawData/WatchResult` hérité vs
   `RawItem/ProcessedItem/EnrichedItem` actuel).
9. **Fichiers résiduels** : `src/collection-engine/filters_` (vide), `prisma.config.ts.bak`.
10. **Legacy `AnalyseService`** : heuristiques non utilisées par les dashboards actuels.
11. **Typage faible** : nombreux `as any`, `strictNullChecks`/`noImplicitAny` désactivés.
12. **`dist/` et `generated/` présents** sur le disque.

---

*VeilleAI — Backend · détail global du projet : [`../README.md`](../README.md).*
