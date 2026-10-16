# VeilleAI — Frontend (SPA React)

Interface utilisateur de **VeilleAI**, la plateforme de veille stratégique augmentée par l'IA.
C'est une **Single Page Application** React qui consomme l'API du backend NestJS.

> **Stack** : React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · React Router 7 · TanStack Query 5 · Recharts · ReactFlow · Axios
> **Nom du package** : `app` · **Titre** : `VeilleAI`

---

## Table des matières

- [1. Démarrage](#1-démarrage)
- [2. Scripts npm](#2-scripts-npm)
- [3. Build, serveur & proxy](#3-build-serveur--proxy)
- [4. Architecture de `src/`](#4-architecture-de-src)
- [5. Routes & pages](#5-routes--pages)
- [6. Authentification côté client](#6-authentification-côté-client)
- [7. Client API](#7-client-api)
- [8. Composants IA](#8-composants-ia)
- [9. Design system & UI](#9-design-system--ui)
- [10. État, données & visualisation](#10-état-données--visualisation)
- [11. Dette technique & points d'attention](#11-dette-technique--points-dattention)

---

## 1. Démarrage

### Prérequis
- Node.js **20+**
- Le **backend** VeilleAI accessible (par défaut `http://localhost:3000`)

### Installation

```bash
npm install
npm run dev
```

L'application est accessible sur **http://localhost:5173**. Elle redirige `/api` vers le backend
(variable `VITE_API_PROXY_TARGET`, défaut `http://localhost:3000`) et sert aussi le proxy `/uploads`.

Fichier de dev : **`.env.development`**

```env
VITE_API_PROXY_TARGET=http://localhost:3000
```

---

## 2. Scripts npm

| Script | Commande | Usage |
|---|---|---|
| `dev` | `vite` | Serveur de développement (HMR) |
| `build` | `tsc -b && vite build` | Vérification TS + build de production dans `dist/` |
| `lint` | `eslint .` | Lint |
| `preview` | `vite preview` | Prévisualisation du build |

---

## 3. Build, serveur & proxy

### `vite.config.ts`
- Serveur de dev : port **5173**, host `0.0.0.0`.
- Proxy `/api` → `VITE_API_PROXY_TARGET` avec **rewrite** retirant le préfixe `/api`.
- Proxy additionnel `/uploads`.

### `nginx.conf` (production / Docker)
- Écoute sur le port **80**, `root /usr/share/nginx/html`.
- `location /api/` → `http://api:3000/` (le slash final retire le préfixe `/api`), timeouts `600s`.
- **Fallback SPA** : `try_files $uri $uri/ /index.html`.

### `Dockerfile`
Build **multi-étapes** : `node:20-alpine` (build) → `nginx:alpine` (service). Copie `dist` +
`nginx.conf` dans `/etc/nginx/conf.d/default.conf`, `EXPOSE 80`.

### TypeScript
- `tsconfig.app.json` : target ES2023, `strict`, `jsx: react-jsx`,
  `noUnusedLocals`/`noUnusedParameters` **désactivés**.
- `tsconfig.node.json` : `noUnusedLocals`/`noUnusedParameters` **activés**.

---

## 4. Architecture de `src/`

```
src/
├── main.tsx                 # Bootstrap React + QueryClientProvider
├── App.tsx                  # Routeur + gardes PrivateRoute / PublicRoute / HomeRedirect
├── index.css                # @import "tailwindcss" + animation .animate-fade-in
├── App.css                  # CSS résiduel du template Vite (non importé)
├── assets/                  # hero.png, react.svg, vite.svg (non utilisés)
├── context/AuthContext.tsx  # Contexte d'authentification (tokens + user)
├── hooks/useOrgRole.ts      # Rôle d'organisation courant (canWrite...)
├── services/api.ts          # Client Axios + intercepteurs JWT + tous les services
├── types/index.ts           # Types et enums TypeScript
├── components/
│   ├── layout/Layout.tsx    # Coquille applicative (sidebar + topbar + alertes)
│   ├── Toast.tsx            # Notifications
│   └── ai/                  # ProjectCopilot, SuggestionPanel, RefineButton
└── pages/
    ├── auth/                # Login, Register, RegisterOrg, Invitation, ForgotPassword, ResetPassword
    ├── dashboard/           # DashboardPage
    ├── analyse/             # AnalysePage
    ├── graph/               # GraphPage
    ├── wizard/              # CreateProjectWizard (8 étapes)
    ├── projects/            # Projects, ProjectDetail, Raw, Processed, Enriched, Insight, CollectionPlanDetail
    ├── admin/               # AdminPage
    ├── organisation/        # OrganisationPage
    ├── profile/             # ProfilePage
    └── alertes/             # AlertesPage
```

---

## 5. Routes & pages

Définition centrale : [`src/App.tsx`](./src/App.tsx).

### Routes publiques (`PublicRoute` → redirige vers `/home` si connecté)
| Route | Page | Rôle |
|---|---|---|
| `/login` | `LoginPage` | Connexion |
| `/register` | `RegisterPage` | Inscription individuelle |
| `/register/organisation` | `RegisterOrgPage` | Inscription d'une organisation |

### Routes non gardées
| Route | Page | Rôle |
|---|---|---|
| `/invitation/:token` | `InvitationPage` | Acceptation d'une invitation |
| `/forgot-password` | `ForgotPasswordPage` | Demande de réinitialisation |
| `/reset-password/:token` | `ResetPasswordPage` | Réinitialisation du mot de passe |
| `/admin` | `AdminPage` | Espace super-admin (login via `POST /auth/admin/login`, token `admin_token` séparé) |

### Racine
| Route | Comportement |
|---|---|
| `/home` | `HomeRedirect` : non connecté → `/login` ; organisation → `/organisation` ; sinon → `/dashboard` |
| `/` et `*` | Redirection vers `/home` |

### Routes privées (`PrivateRoute`)
| Route | Page | Fonction |
|---|---|---|
| `/dashboard` | `DashboardPage` | Tableau de bord + réseau d'entités + widgets configurables |
| `/profile` | `ProfilePage` | Profil (nom, avatar, mot de passe) |
| `/projects` | `ProjectsPage` | Liste des projets (onglets Actifs / Archivés) |
| `/projects/new` | `CreateProjectWizard` | Assistant de création (8 étapes) |
| `/projects/:id` | `ProjectDetailPage` | Détail projet + copilote IA + onglets cadrage / veille / suivi |
| `/projects/:id/raw-items` | `ProjectRawItemsPage` | Contenus bruts |
| `/projects/:projectId/plans/:planId` | `CollectionPlanDetailPage` | Détail d'un plan de collecte (jobs, données, upload, collecte) |
| `/projects/:id/processed` | `ProjectProcessedItemsPage` | Contenus traités |
| `/projects/:id/enriched` | `ProjectEnrichedItemsPage` | Contenus enrichis (job + annulation) |
| `/projects/:id/insights` | `ProjectInsightDashboardPage` | Tableau de bord des insights du projet |
| `/graph` | `GraphPage` | Graphe `Projet → Objectif → Axe → Hypothèse (+ périmètre)` |
| `/organisation` | `OrganisationPage` | Membres, invitations, codes de jonction |
| `/analyse/:projectId` | `AnalysePage` | Analyse stratégique (KPI, graphiques, exports) |
| `/alertes` | `AlertesPage` | Journal des alertes |

### Assistant de création (`CreateProjectWizard`)
**8 étapes** : ① Projet (nom, type de veille, problématique) → ② Objectifs → ③ Axes → ④ Hypothèses →
⑤ Périmètres → ⑥ Plans de collecte → ⑦ Parties prenantes → ⑧ Révision. L'état est conservé dans
`sessionStorage` (clé `wizard_state`) pour survivre à un rafraîchissement.

---

## 6. Authentification côté client

### `context/AuthContext.tsx`
- Stocke `access_token`, `refresh_token` et `user` dans `localStorage`.
- Expose : `login()`, `logout()` (supprime aussi `admin_token`), `isAuthenticated`,
  `isOrganisation`, `isIndividuel`, `getRedirectPath`.
- Les routes sont protégées par `PrivateRoute` (redirige vers `/login` si non authentifié) et
  `PublicRoute` (redirige vers `/home` si déjà authentifié).

### `hooks/useOrgRole.ts`
- Récupère le rôle courant via `GET /organisations/me` (`my_role`).
- Expose `canWrite` = rôle ∈ { `PROPRIETAIRE`, `MANAGER`, `EQUIPE_VEILLE` }.
- Les pages combinent : `canCreateOrModify = (utilisateur individuel) || canWrite`.

### Espace admin
- Flux **séparé** : `AdminPage` gère son propre login (`POST /auth/admin/login`) et stocke un
  `admin_token` ; il n'utilise ni `AuthContext` ni `Layout`.

---

## 7. Client API

Fichier central : [`src/services/api.ts`](./src/services/api.ts).

- Instance **Axios** avec `baseURL: '/api'`.
- **Interceptor requête** : ajoute `Authorization: Bearer <access_token>` depuis `localStorage`.
- **Interceptor réponse** : sur `401` (garde anti-boucle `_retry`), appelle `POST /auth/refresh`
  avec le `refresh_token`, enregistre le nouvel `access_token` et **rejoue** la requête ; en cas
  d'échec, vide le token et redirige vers `/login`.
- Helper `formatApiError()` pour les messages d'erreur.

### Services exposés
`authService`, `projectsService`, `orgService`, `sourcesService`, `collectionPlansService`,
`collectionService`, `rawItemsService`, `processingService`, `uploadService`, `objectivesService`,
`axesService`, `hypothesesService`, `aiEnrichmentService`, `alertsService`, `analyseService`,
`adminService`, `reportsService`, `insightService`, `foldersService`, `aiCopilotService`.

---

## 8. Composants IA

Situés dans `src/components/ai/` :

| Composant | Rôle |
|---|---|
| `ProjectCopilot.tsx` | Copilote conversationnel intégré à la page projet (suggestions + correction). |
| `SuggestionPanel.tsx` | Panneau latéral affichant les suggestions générées. |
| `RefineButton.tsx` | Bouton de réécriture/raffinement (hypothèses, questions). |

Ils s'appuient sur `aiCopilotService` (`/ai-copilot/suggest`, `/refine`, `/project`) et sont
principalement utilisés dans `ProjectDetailPage` et `CollectionPlanDetailPage`.

---

## 9. Design system & UI

- **Thème sombre** appliqué essentiellement via **styles inline** (palette `#0f1117`, `#161b27`,
  `#1e2535`…) plutôt que par des variables CSS centralisées.
- **Tailwind CSS 4** chargé dans `index.css` via `@import "tailwindcss";` + une animation
  `.animate-fade-in`. Pas de configuration `dark:` ni de design tokens.
- **`Layout.tsx`** : coquille applicative (barre latérale de navigation + zone de contenu) et
  **polling des alertes non lues**.
- **`Toast.tsx`** : notifications utilisées par les pages d'authentification.
- ⚠️ **Incohérence** : `InvitationPage` utilise un thème **clair** (vert/teal) alors que le reste de
  l'application est sombre.

---

## 10. État, données & visualisation

- **TanStack Query** : `QueryClientProvider` dans `main.tsx` ; `useQuery` / `useMutation` /
  `useQueryClient` utilisés dans la majorité des pages (projets, plans, données brutes/traitées/enrichies,
  insights, analyse, dashboard, organisation, alertes, admin, layout).
- Quelques pages utilisent ponctuellement `axios` brut + `useState` au lieu de React Query.
- **Recharts** : `AnalysePage` (KPIs, camembert de sentiment, barres d'impact) et
  `ProjectInsightDashboardPage` (graphiques d'insights).
- **ReactFlow** : `GraphPage` (arbre du cadrage) et `DashboardPage` (réseau d'entités + widgets).
- **Persistance locale** :
  - `localStorage` : `access_token`, `refresh_token`, `user`, `admin_token`, `dashboard-widgets`.
  - `sessionStorage` : `wizard_state` (assistant de création).
- **Typage** : `src/types/index.ts` (interfaces TS de toutes les entités API).

---

## 11. Dette technique & points d'attention

1. **Code mort** : `src/App.css` non importé ; assets `hero.png`, `react.svg`, `vite.svg` inutilisés.
2. **Services dupliqués / alias** dans `api.ts` : `objectiveService` vs `objectivesService`,
   `axisService`/`axesService`, `hypothesisService`/`hypothesesService`,
   `collectionPlansService`/`collectionPlanService`.
3. **`uploadService.uploadPdf`** : signature surchargée (2 ou 3 arguments) — à clarifier.
4. **Valeurs codées en dur** : liste `SUGGESTED_RSS` dans `CollectionPlanDetailPage`, message
   « Démarrez le backend (port 3000) » dans `api.ts`.
5. **`console.error`** dans `CollectionPlanDetailPage.handleAddKeyword` — seul log de `src/`.
6. **`eslint-disable`** : `@typescript-eslint/no-explicit-any` en tête de `ProjectDetailPage.tsx` et
   dans `CollectionPlanDetailPage.tsx`.
7. **Incohérence de thème** : `InvitationPage` en clair vs thème sombre global.
8. **`AuthContext`** : état token initialisé une seule fois depuis `localStorage` (pas de synchro
   réactive).
9. **Aucun test automatisé** côté frontend.
10. **Styles inline massifs** au lieu d'un système de tokens / thème Tailwind structuré.

---

*VeilleAI — Frontend · détail global du projet : [`../README.md`](../README.md).*
