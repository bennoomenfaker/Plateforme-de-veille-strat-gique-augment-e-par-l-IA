# Veille — Plateforme de veille stratégique

Plateforme complète de **veille stratégique** (technologique, concurrentielle, réglementaire, etc.) permettant de définir des objectifs, axes et hypothèses, collecter des données depuis des sources variées (RSS, web, API, documents), les enrichir via IA (Ollama) et visualiser les insights.

## Architecture

```
                    ┌──────────────┐
                    │   Frontend   │  React 19 + Vite + Tailwind
                    │   port 8080  │  Servi par Nginx
                    └──────┬───────┘
                           │ /api/*
                    ┌──────▼───────┐
                    │   Backend    │  NestJS 10 + Prisma
                    │   port 3000  │
                    └──────┬───────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐  ┌──────────────┐  ┌──────────┐
   │ PostgreSQL │  │   Ollama     │  │  SMTP    │
   │    port    │  │ Mistral LLM  │  │ (mail)   │
   │   5432     │  │   port 11434 │  │          │
   └────────────┘  └──────────────┘  └──────────┘
```

### Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Backend | NestJS 10, TypeScript, Prisma ORM |
| Base de données | PostgreSQL 15 |
| LLM | Ollama (Mistral) + Mistral API + Groq API (fallback chain) |
| Auth | JWT (access + refresh tokens) |
| Email | Nodemailer (SMTP Gmail) |
| Conteneurisation | Docker Compose |

## Fonctionnalités

### Gestion des projets
- Création de projet avec assistant pas-à-pas (8 étapes)
- Définition d'objectifs stratégiques (max 5)
- Définition d'axes d'analyse par objectif (max 5)
- Définition d'hypothèses par axe
- Périmètres géographiques et sectoriels
- Plans de collecte avec sources (RSS, Web, API, PDF)
- Clôture, réouverture et archivage des projets
- Duplication complète d'un projet avec toute sa hiérarchie
- Suppression définitive d'un projet
- Vue liste avec onglets Actifs / Clôturés-Archivés

### Collecte de données
- Sources RSS, Web scraping, API REST, upload PDF
- Planification automatique (quotidien, hebdomadaire, mensuel)
- Mots-clés d'inclusion/exclusion
- Jobs de collecte avec statuts (PENDING → RUNNING → DONE/FAILED)

### Traitement & Enrichissement IA
- Nettoyage des données brutes (extraction contenu, détection langue)
- Enrichissement automatique avec fallback multi-provider :
  - **Ollama** (local, Mistral)
  - **Mistral API** (`mistral-large-latest`)
  - **Groq API** (`llama-3.3-70b-versatile`)
  - Résumé automatique, analyse de sentiment, extraction d'entités/topics
  - Score de pertinence et confiance, impact sur les hypothèses
- Évaluation des hypothèses basée sur les preuves collectées
- Pipeline multi-modèle avec fallback automatique

### Visualisation & Analyse
- Dashboard avec graphiques (lignes, camemberts, barres)
- Vue arborescente ReactFlow (Projet → Objectifs → Axes → Hypothèses)
- Analyse stratégique avec scores par objectif/axe/hypothèse
- Export de rapport HTML et CSV des données enrichies
- Vue Kanban des hypothèses par statut (OPEN → SUPPORTED/CONTRADICTED)

### Collaboration
- Utilisateurs individuels ou en organisation
- Rôles : Propriétaire, Manager, Équipe veille, Lecteur
- Invitations par email avec token
- Gestion des membres

## Démarrage rapide

### Prérequis
- Docker & Docker Compose
- Node.js 18+ (pour développement sans Docker)

### Avec Docker

```bash
# Créer le réseau (une seule fois)
docker network create veille_net

# Lancer tous les services
docker compose up -d

# Voir les logs
docker compose logs -f
```

Accès :
- Frontend : http://localhost:8080
- API : http://localhost:3000

### Sans Docker (développement)

```bash
# 1. Base de données
docker run -d --name veille-db -e POSTGRES_USER=root -e POSTGRES_PASSWORD=root -e POSTGRES_DB=veille_db -p 5432:5432 postgres:15

# 2. Ollama (si pas déjà installé)
docker run -d --name veille-ollama -p 11434:11434 ollama/ollama:latest
docker exec veille-ollama ollama pull mistral

# 3. Backend
cd backend
cp .env.example .env  # configurer les variables
npm install
npx prisma migrate dev
npm run start:dev

# 4. Frontend
cd frontend
npm install
npm run dev
```

Accès :
- Frontend : http://localhost:5173
- API : http://localhost:3000

## Structure du projet

```
veille/
├── .env                          # Variables Docker
├── docker-compose.yml            # Orchestration 4 services
├── backend/
│   ├── .env                      # Config API
│   ├── Dockerfile
│   ├── prisma/
│   │   └── schema.prisma         # 31 modèles de données
│   └── src/
│       ├── auth/                 # Authentification JWT
│       ├── projects/             # Gestion des projets
│       ├── objectives/           # Objectifs stratégiques
│       ├── axes/                 # Axes d'analyse
│       ├── hypotheses/           # Hypothèses
│       ├── perimeters/           # Périmètres
│       ├── collection-plans/     # Plans de collecte
│       ├── ai-enrichment/        # Enrichissement IA (Ollama)
│       ├── analyse/              # Analyse stratégique
│       ├── reports/              # Génération de rapports
│       └── common/               # Services partagés
└── frontend/
    ├── .env.development
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── pages/
        │   ├── projects/         # Pages projets (liste, détail, données)
        │   ├── wizard/           # Assistant de création
        │   ├── analyse/          # Analyse stratégique
        │   └── graph/            # Visualisation arborescente
        └── services/
            └── api.ts            # Client API centralisé
```

## API - Principaux endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/auth/login` | Connexion |
| `POST` | `/auth/register` | Inscription |
| `GET` | `/projects` | Liste des projets actifs |
| `GET` | `/projects/archived` | Projets clôturés/archivés |
| `POST` | `/projects` | Créer un projet |
| `GET` | `/projects/:id` | Détail d'un projet |
| `PUT` | `/projects/:id` | Modifier un projet |
| `PATCH` | `/projects/:id/close` | Clôturer un projet |
| `PATCH` | `/projects/:id/archive` | Archiver un projet |
| `DELETE` | `/projects/:id` | Supprimer un projet |
| `POST` | `/projects/:id/duplicate` | Dupliquer un projet |
| `PATCH` | `/projects/:id/reopen` | Rouvrir un projet clôturé |
| `GET` | `/projects/:id/export-csv` | Export CSV des données enrichies |
| `GET` | `/projects/:id/hypothesis-evaluations` | Évaluations des hypothèses |
| `POST` | `/projects/:id/objectives` | Ajouter un objectif |
| `POST` | `/objectives/:id/axes` | Ajouter un axe |
| `POST` | `/axes/:id/hypotheses` | Ajouter une hypothèse |
| `POST` | `/hypotheses/:id/collection-plans` | Créer un plan de collecte |
| `GET` | `/collection-plans/:id` | Détail d'un plan |
| `POST` | `/projects/:id/process` | Lancer le processing |
| `POST` | `/projects/:id/enrich` | Lancer l'enrichissement IA |

## Modèle de données (hiérarchie)

```
Projet
 └── Objectif (max 5)
      └── Axe (max 5)
           └── Hypothèse
                ├── Plan de collecte
                │    ├── Source (RSS / Web / API / Document)
                │    └── Mot-clé (inclusion/exclusion)
                └── Évaluation d'hypothèse
Périmètre (géographique / sectoriel)
```
