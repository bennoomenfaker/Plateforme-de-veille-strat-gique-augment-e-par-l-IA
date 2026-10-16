# VeilleAI — Plateforme de veille stratégique augmentée par l'IA

Plateforme web de **veille stratégique augmentée par l'Intelligence Artificielle**. Elle permet à un utilisateur (individuel ou au sein d'une organisation) de cadrer une recherche de veille, d'en **collecter automatiquement les données** depuis des sources variées (RSS, web, PDF, API), de les **enrichir par IA** (résumé, entités, thématiques, sentiment, pertinence, impact sur hypothèses) puis d'en **tirer des insights** (tendances, signaux faibles, anomalies, évaluation d'hypothèses) à travers des tableaux de bord et des rapports.

> **Nom de l'application** : `VeilleAI`
> **Type** : Projet de fin d'études (PFE) — monorepo frontend + backend.

---

## Table des matières

- [1. Objectif fonctionnel](#1-objectif-fonctionnel)
- [2. Fonctionnalités](#2-fonctionnalités)
- [3. Architecture globale](#3-architecture-globale)
- [4. Stack technique](#4-stack-technique)
- [5. Le pipeline de veille](#5-le-pipeline-de-veille)
- [6. Structure du dépôt](#6-structure-du-dépôt)
- [7. Démarrage rapide](#7-démarrage-rapide)
- [8. Variables d'environnement](#8-variables-denvironnement)
- [9. Modèle de données (aperçu)](#9-modèle-de-données-aperçu)
- [10. API (aperçu)](#10-api-aperçu)
- [11. Sécurité](#11-sécurité)
- [12. Tests](#12-tests)
- [13. Documentation détaillée](#13-documentation-détaillée)
- [14. Limites connues & pistes d'amélioration](#14-limites-connues--pistes-damélioration)

---

## 1. Objectif fonctionnel

La plateforme industrialise la **démarche de veille** en 5 temps :

1. **Cadrer** — créer un projet de veille avec une problématique, un type de veille, des objectifs stratégiques, des axes d'analyse, des hypothèses et des périmètres (géographiques / sectoriels).
2. **Collecter** — définir des plans de collecte (sources + mots-clés) et laisser le moteur aller chercher automatiquement les contenus (articles, flux RSS, PDF, API).
3. **Traiter** — nettoyer et normaliser les contenus bruts (extraction du texte, détection de langue, déduplication).
4. **Enrichir par IA** — résumer, extraire les entités et thématiques, classer le sentiment, noter la pertinence et l'impact de chaque contenu sur les hypothèses.
5. **Décider** — visualiser les résultats (dashboards, graphes, Kanban d'hypothèses), détecter tendances / signaux faibles / anomalies, recevoir des alertes et générer des rapports.

---

## 2. Fonctionnalités

### Gestion du cadrage
- **Assistant de création de projet en 8 étapes** (Projet → Objectifs → Axes → Hypothèses → Périmètres → Plans de collecte → Parties prenantes → Révision), état conservé en `sessionStorage`.
- Hiérarchie **Projet → Objectif (max 5) → Axe (max 5) → Hypothèse**.
- **22 types de veille** (stratégique, concurrentielle, technologique, réglementaire, géopolitique, cybersécurité, économie, réputation, etc.).
- Périmètres **géographiques** et **sectoriels**, rattachables aux hypothèses.
- Parties prenantes d'un projet d'organisation (décideur / analyste / observateur).
- Cycle de vie projet : **clôture, réouverture, archivage, duplication complète, suppression**.

### Collecte de données
- Sources **RSS**, **web (scraping d'articles)**, **PDF** (téléchargement + upload manuel) et **API REST (JSON)**.
- **Planification** des plans de collecte (à la demande, quotidienne, hebdomadaire, mensuelle) via un cron horaire.
- Mots-clés d'**inclusion / exclusion / principaux**, déduplication par empreinte SHA-256.
- Suivi des **jobs de collecte** (`PENDING → RUNNING → DONE/FAILED`) avec progression temps réel.
- Upload manuel de documents PDF dans un plan.

### Traitement & Enrichissement IA
- Nettoyage HTML (Cheerio), détection de langue, extraction d'extraits, statistiques de contenu.
- **Enrichissement automatique multi-fournisseur** avec chaîne de repli : **Mistral → Groq → Ollama (local)**.
- Par contenu : `answer`, `summary`, `entities[]`, `topics[]`, `sentiment`, `relevance_score`, `hypothesis_impact`, `confidence_score`.
- **Évaluation automatique des hypothèses** (`OPEN`, `PARTIALLY_SUPPORTED`, `SUPPORTED`, `CONTRADICTED`, `NEEDS_MORE_RESEARCH`).
- **Copilote IA** de conception : suggestions, réécriture de questions/hypothèses, génération/correction automatique d'un projet.

### Analyse & Insights
- **Dashboards** : KPI, camemberts de sentiment, barres d'impact, widgets configurables (persistés en `localStorage`).
- **Graphe ReactFlow** : arbre `Projet → Objectif → Axe → Hypothèse (+ périmètre)` et réseau d'entités.
- **Moteur d'insights** (heuristique, sans LLM) : détection de **tendances**, **signaux faibles**, **anomalies** (pic de volume, changement de sentiment, explosion de volume) et analyse d'hypothèses.
- **Kanban des hypothèses** par statut.
- **Alertes** (score élevé, hypothèse contredite, contenu pertinent) avec notification par email.
- **Export** : rapport HTML téléchargeable, export CSV des données enrichies.

### Collaboration & administration
- Utilisateurs **individuels** ou **organisations**.
- Rôles d'organisation : **Propriétaire, Manager, Équipe veille, Lecteur** (le lecteur est en lecture seule).
- **Invitations par email** (token), **codes de jonction** équipe / lecteur, régénérables.
- **Espace super-administrateur** : supervision des utilisateurs, organisations, logs et du pipeline.

### Comptes & sécurité
- Authentification **JWT** (access token + refresh token avec rotation).
- **Mot de passe oublié / réinitialisation** (token à durée limitée).
- Modification de profil et **upload d'avatar**.

---

## 3. Architecture globale

```
                        ┌──────────────────────────────┐
                        │           Frontend           │
                        │   React 19 + Vite 8 + TW 4   │
                        │   servi par Nginx (port 80)  │
                        └──────────────┬───────────────┘
                                       │  /api/*  (proxy)
                        ┌──────────────▼───────────────┐
                        │           Backend            │
                        │      NestJS 10 + Prisma 6     │
                        │        (port 3000)            │
                        └───┬───────────────┬───────────┘
                            │               │
              ┌─────────────▼──┐      ┌─────▼──────────────┐
              │  PostgreSQL 15 │      │  Fournisseurs LLM  │
              │  (Prisma ORM)  │      │ Mistral / Groq /   │
              └────────────────┘      │ Ollama (local)     │
                                      └────────────────────┘
                            ┌───────────────┐
                            │   SMTP (mail) │
                            └───────────────┘
```

- Le **frontend** (SPA React) est compilé par Vite puis servi par **Nginx**, qui est aussi le reverse-proxy `/api/* → backend:3000`.
- Le **backend** expose une API REST sécurisée qui orchestre la base **PostgreSQL** (via Prisma) et les moteurs de collecte, de traitement, d'enrichissement IA et d'insights.
- Le tout est orchestré par **Docker Compose** (services `db`, `ollama`, `api`, `frontend`).

---

## 4. Stack technique

| Couche | Technologie |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7 |
| UI / data-viz | Recharts (graphiques), ReactFlow (graphes), TanStack Query 5 (données), Axios |
| **Backend** | NestJS 10, TypeScript, Prisma ORM 6 |
| Base de données | PostgreSQL 15 |
| IA / LLM | Ollama (Mistral en local) + Mistral API + Groq API (chaîne de repli) |
| Collecte | rss-parser, Cheerio, Axios |
| Auth | JWT (access + refresh), Passport, bcrypt, @nestjs/throttler |
| Email | Nodemailer (SMTP) |
| Planification | @nestjs/schedule (cron) |
| Conteneurisation | Docker, Docker Compose, Nginx |

---

## 5. Le pipeline de veille

Le cœur métier est une chaîne de traitement de contenus, matérialisée par trois entités chaînées : **`RawItem` → `ProcessedItem` → `EnrichedItem`**.

```
              ┌────────────────────────────── CRON horaire ──────────────────────────────┐
              ▼                                                                          │
  CollectionPlan ──► CollectionManager.runCollectionPlan                                 │
                          │  (connecteurs RSS / WEB / PDF / API, filtrage mots-clés)       │
                          ▼                                                                │
                     RawItem  (hash SHA-256 unique → déduplication)                        │
                          │                                                                │
                          ▼   POST /projects/:id/process            (déclenchement manuel) │
                     ProcessedItem  (nettoyage HTML, langue, extrait, stats)               │
                          │                                                                │
                          ▼   POST /projects/:projectId/enrich     (déclenchement manuel) │
        EnrichedItem + HypothesisEvaluation  (LLM : résumé, entités, sentiment, impact)   │
                          │                                                                │
                          ▼   POST /insight-engine/generate/:projectId                     │
        Insight  (+ WeakSignal, TrendPoint)  (tendances, signaux faibles, anomalies)       │
                          │                                                                │
                          ▼   CRON horaire                                                 │
                     Alert  (+ email) ─────────────────────────────────────────────────┘
```

- **Automatisé** : la **collecte** (cron horaire du `SchedulerService`) et les **alertes** (cron horaire du `AlertesService`).
- **Manuel (via API)** : le traitement, l'enrichissement IA et la génération d'insights sont déclenchés par l'utilisateur depuis l'interface (boutons « Traiter », « Enrichir », « Générer les insights »).

> Détails complets du pipeline : voir [`backend/README.md`](./backend/README.md#6-le-pipeline-de-données).

---

## 6. Structure du dépôt

```
veille/
├── docker-compose.yml          # Orchestration : db, ollama, api, frontend
├── .env                        # Variables Docker (db)
├── README.md                   # ← ce fichier (vue globale)
│
├── backend/                    # API NestJS + Prisma
│   ├── README.md               # Doc technique backend
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma       # Modèle de données
│   │   └── migrations/         # 10 migrations
│   └── src/                    # 25 modules NestJS (voir README backend)
│
├── frontend/                   # SPA React (Vite)
│   ├── README.md               # Doc technique frontend
│   ├── Dockerfile
│   ├── nginx.conf              # Sert la SPA + proxy /api
│   └── src/                    # pages, composants, services (voir README frontend)
│
└── uploads/                    # Fichiers uploadés (avatars, PDF)
```

---

## 7. Démarrage rapide

### Prérequis
- **Docker** & **Docker Compose**
- **Node.js 20+** (uniquement pour le développement sans Docker)

### A. Avec Docker (recommandé)

```bash
# 1. Créer le réseau externe (une seule fois)
docker network create veille_net

# 2. Créer les fichiers de variables (voir section 8)
cp backend/.env.dev.example backend/.env
# éditer backend/.env (DATABASE_URL, clés LLM, SMTP...)

# 3. Créer le fichier racine .env pour la base
echo "DATABASE_USER=eya" > .env
echo "DATABASE_PASSWORD=change_me" >> .env

# 4. Lancer la stack
docker compose up -d --build

# 5. Télécharger le modèle LLM local (facultatif si Mistral/Groq configurés)
docker exec veille-ollama-1 ollama pull mistral
```

Accès :
- **Frontend** : http://localhost:8080
- **API** : http://localhost:3000

### B. Sans Docker (développement)

```bash
# 1. Base de données PostgreSQL
docker run -d --name veille-db \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=root -e POSTGRES_DB=veille_db \
  -p 5432:5432 postgres:15

# 2. Ollama (si vous n'utilisez pas Mistral/Groq)
docker run -d --name veille-ollama -p 11434:11434 ollama/ollama:latest
docker exec veille-ollama ollama pull mistral

# 3. Backend
cd backend
cp .env.dev.example .env.dev      # configurer les variables
npm install
npx prisma migrate dev            # applique les migrations
npm run start:dev                 # → http://localhost:3000

# 4. Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev                       # → http://localhost:5173
```

> En dev, Vite redirige `/api` vers `http://localhost:3000` (variable `VITE_API_PROXY_TARGET`).

---

## 8. Variables d'environnement

### Racine `.env` (Docker Compose — base de données)
| Variable | Rôle |
|---|---|
| `DATABASE_USER` | Utilisateur PostgreSQL |
| `DATABASE_PASSWORD` | Mot de passe PostgreSQL |

### `backend/.env` (API)
| Variable | Rôle | Exemple |
|---|---|---|
| `DATABASE_URL` | URL de connexion Prisma | `postgresql://user:pass@db:5432/veille_db` |
| `PORT` | Port HTTP de l'API | `3000` |
| `JWT_SECRET` | Clé de signature des JWT | *(secret)* |
| `FRONTEND_URL` | Base utilisée dans les liens d'email | `http://localhost:8080` |
| `OLLAMA_URL` | URL du serveur Ollama | `http://ollama:11434` |
| `OLLAMA_MODEL` | Modèle local | `mistral` |
| `LLM_DELAY_MS` | Pause entre deux appels LLM | `600` |
| `MISTRAL_API_KEY` / `MISTRAL_MODEL` | Fournisseur IA cloud n°1 | `mistral-large-latest` |
| `GROQ_API_KEY` / `GROQ_MODEL` | Fournisseur IA cloud n°2 (repli) | `llama-3.3-70b-versatile` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Envoi d'emails | — |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Compte super-administrateur | — |
| `UPLOAD_AVATAR_DIR` | Dossier des avatars | `./uploads/avatars` |

### `frontend/.env.development`
| Variable | Rôle |
|---|---|
| `VITE_API_PROXY_TARGET` | Cible du proxy `/api` en dev | `http://localhost:3000` |

> ⚠️ **Ne jamais commiter** les fichiers `.env` / `.env.dev` (ils sont dans `.gitignore`). Utilisez `.env.dev.example` comme modèle.

---

## 9. Modèle de données (aperçu)

```
User ─┬─ Organisation ─── MembreOrganisation ─── User
      │                └─ InvitationOrganisation
      ├─ Folder ──── Project
      └─ Project (individuel)

Project
 ├─ ProjectObjective (max 5) ─ ProjectAxis (max 5) ─ ProjectHypothesis
 │                                                       ├─ CollectionPlan
 │                                                       │    ├─ CollectionPlanSource
 │                                                       │    ├─ CollectionPlanKeyword
 │                                                       │    └─ CollectionJob
 │                                                       └─ HypothesisPerimeter ─ ProjectPerimeter
 ├─ ProjectPerimeter (GEOGRAPHIC / SECTORAL)
 ├─ Source ─ RawData ─ WatchResult            (pipeline hérité)
 ├─ RawItem ─ ProcessedItem ─ EnrichedItem    (pipeline actuel)
 ├─ ProjectStakeholder / Alert / Report
 └─ WeakSignal / TrendPoint / Insight / HypothesisEvaluation

Comptes & sécurité : RefreshToken, PasswordResetToken, UserActivityLog
```

Le schéma complet (678 lignes, ~31 modèles + 11 enums) est dans [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma).

---

## 10. API (aperçu)

L'API REST est servie sous `/api` (via Nginx) et directement sur `:3000`. Principaux groupes de routes :

| Préfixe | Domaine |
|---|---|
| `/auth` | Authentification, profil, invitations, mot de passe |
| `/organisations` | Organisations, membres, invitations, codes |
| `/projects` | Projets, graph, archivage, CSV |
| `/projects/:id/{objectives,axes,hypotheses,perimeters,stakeholders}` | Cadrage |
| `/collection-plans`, `/hypotheses/:id/collection-plans` | Plans de collecte |
| `/collection-plans/:id/run`, `/collection-jobs/:id` | Collecte |
| `/projects/:id/process`, `/processed-items/:id` | Traitement |
| `/projects/:id/enrich`, `/enrichment-jobs/:id` | Enrichissement IA |
| `/insight-engine` | Tendances, signaux faibles, anomalies, insights |
| `/analyse` | Statistiques et dashboards |
| `/alertes` | Alertes |
| `/reports` | Rapports HTML |
| `/uploads` | Upload PDF |
| `/ai-copilot` | Assistant IA |
| `/admin` | Back-office super-admin |

> Liste détaillée des endpoints : voir [`backend/README.md`](./backend/README.md#8-api).

---

## 11. Sécurité

- **JWT** : access token (1 jour) + refresh token (7 jours, rotation à chaque rafraîchissement), hash de mot de passe **bcrypt** (10 rounds).
- **Isolation multi-tenant** : un utilisateur n'accède qu'à ses projets individuels et aux projets des organisations dont il est membre actif (contrôlé par `OrgAccessService`).
- **Rôles d'organisation** : écrire = Propriétaire / Manager / Équipe veille ; lire = Lecteur.
- **Rate limiting** (`@nestjs/throttler`) : 20 req/min global, 5/min sur le login, 3/min sur « mot de passe oublié ».
- **Super-admin** protégé par un guard dédié.
- **Journalisation** des actions utilisateur (`UserActivityLog`).

> Des points de durcissement restent à traiter (voir [section 14](#14-limites-connues--pistes-damélioration)).

---

## 12. Tests

```bash
cd backend
npm run test        # tests unitaires (Jest)
npm run test:cov    # couverture
npm run test:e2e    # tests end-to-end
```

Le frontend ne dispose pas encore de tests automatisés.

---

## 13. Documentation détaillée

- **[`backend/README.md`](./backend/README.md)** — architecture modulaire, pipeline de données, connecteurs, moteurs IA, sécurité, modèle de données, API, configuration.
- **[`frontend/README.md`](./frontend/README.md)** — stack, routes/pages, authentification client, client API, composants IA, design system, état & données.

---

## 14. Limites connues & pistes d'amélioration

**Orchestration**
- Le pipeline n'est pas chaîné automatiquement : traitement → enrichissement → insights doivent être lancés manuellement. Piste : enchaîner les étapes après chaque collecte ou via un cron dédié.

**Qualité / bugs connus**
- Le champ `EnrichedItem.hypothesis_id` n'est jamais renseigné → les évaluations d'hypothèses restent bloquées sur `OPEN` et les filtres par hypothèse ne retournent rien.
- L'extraction de texte PDF dépend du paquet `pdf-parse`, non déclaré dans `package.json`.
- L'upload de PDF n'utilise pas de `diskStorage` (contrairement à l'avatar), ce qui peut casser la lecture du fichier.
- Le secret JWT est en partie codé en dur dans la stratégie d'authentification (source unique à rétablir).

**Sécurité**
- Plusieurs endpoints (sources, analyse, upload, collecte héritée) n'appliquent pas le contrôle d'accès organisation.
- Le guard de rôles `RolesGuard` n'est pas branché (autorisation gérée manuellement dans les services).

**Maintenance**
- Coexistence d'un pipeline hérité (`Source`/`RawData`/`WatchResult`) et du pipeline actuel (`RawItem`/`ProcessedItem`/`EnrichedItem`).
- Fichiers résiduels : `src/collection-engine/filters_` (vide), `prisma.config.ts.bak`, `frontend/src/App.css` (non importé).

---

*VeilleAI — projet de veille stratégique augmentée par l'IA.*
