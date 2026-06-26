# Portflow AI

Portflow AI est un monorepo dédié à la gestion opérationnelle des déchargements de vrac sur site portuaire. Le produit aide une organisation à préparer une décharge, exécuter les shifts, suivre les rotations camions, valider les données terrain et produire des rapports immuables.

Le dépôt contient aujourd'hui principalement le backend API du produit. Le frontend fait partie de l'architecture cible du MVP, mais n'est pas encore présent dans ce workspace.

## Vue d'ensemble

Le domaine métier est centré sur les opérations de `Discharge`, c'est-à-dire le déchargement d'un navire vers des entrepôts via des docks, des zones de pesée, des portes d'entrepôt, des shifts et des rotations camion.

Le MVP couvre notamment :

- l'authentification par session cookie ;
- l'administration des utilisateurs et de leurs rôles ;
- l'administration des référentiels du site ;
- la préparation des déchargements ;
- une partie du flux d'exécution opérationnelle ;
- la base documentaire du domaine et de l'architecture.

Le produit cible un seul opérateur sur un seul site. Il n'y a pas d'isolation multi-tenant dans le MVP.

## État actuel du dépôt

Le dépôt est un monorepo PNPM avec une application active :

- `apps/api` : API AdonisJS 7 en TypeScript.

L'architecture cible documentée dans le MVP mentionne aussi une future application web `apps/web`, mais elle n'est pas encore présente dans ce dépôt.

## Fonctionnalités métier déjà cadrées

Le domaine et le périmètre du MVP sont décrits dans :

- [CONTEXT.md](./CONTEXT.md) pour le vocabulaire métier ;
- les issues `epic` du [GitHub Issues](https://github.com/whazzark/portflow-ai/issues) pour le périmètre produit détaillé ;
- le [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5) pour l'ordre de livraison (README du project et descriptions des milestones) ;
- [docs/adr](./docs/adr) et [apps/api/docs/adr](./apps/api/docs/adr) pour les décisions d'architecture.

À ce stade, l'API couvre déjà des briques importantes :

- authentification et utilisateur courant ;
- invitation, activation, réactivation et gestion d'utilisateurs ;
- gestion des Customers ;
- gestion des Transport Companies ;
- gestion des Trucks ;
- gestion des Docks ;
- gestion des Weighing Areas ;
- gestion des Warehouses ;
- gestion des Warehouse Doors ;
- création et consultation initiale des Discharges ;
- planification initiale des ressources de déchargement.

Le détail exact du statut de livraison est piloté par [GitHub Issues](https://github.com/whazzark/portflow-ai/issues) et le [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5).

## Stack technique

- Node.js
- PNPM workspaces
- TypeScript
- AdonisJS 7
- PostgreSQL
- Japa pour les tests
- Tuyau pour le contrat API côté architecture cible

L'architecture MVP prévoit aussi, à terme :

- un frontend TanStack Start ;
- Redis pour les traitements asynchrones ;
- un stockage S3-compatible pour les PDF ;
- du Server-Sent Events pour le dashboard temps réel.

Ces éléments sont documentés, mais pas tous implémentés dans ce dépôt aujourd'hui.

## Structure du dépôt

```text
.
├── apps/
│   └── api/                # API AdonisJS
├── docker/
│   └── docker-compose.yml  # PostgreSQL local
├── docs/
│   └── adr/                # ADRs racine
├── CONTEXT.md              # Glossaire métier
├── AGENTS.md               # Conventions agentiques du repo
├── package.json
└── pnpm-workspace.yaml
```

## Prérequis

- Node.js 22 recommandé
- PNPM 10
- Docker et Docker Compose pour lancer PostgreSQL localement

## Installation

Cloner le dépôt, puis installer les dépendances :

```bash
pnpm install
```

## Configuration de l'environnement

L'application API utilise un fichier d'environnement local dans `apps/api`.

Créer le fichier :

```bash
cp apps/api/.env.example apps/api/.env
```

Variables principales :

- `PORT` : port HTTP de l'API ;
- `HOST` : interface d'écoute ;
- `APP_KEY` : clé d'application AdonisJS ;
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` : connexion PostgreSQL ;
- `SESSION_DRIVER` : driver de session ;
- `WEB_ORIGIN` : origine du frontend autorisée.

Exemple de configuration locale :

```env
TZ=UTC
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
APP_KEY=your-app-key
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=portflow

SESSION_DRIVER=cookie
WEB_ORIGIN=http://localhost:3000
```

## Base de données locale

Le dépôt fournit un `docker-compose` minimal pour PostgreSQL :

```bash
docker compose -f docker/docker-compose.yml up -d
```

Par défaut :

- le conteneur expose PostgreSQL sur `${DB_PORT:-5433}` côté hôte ;
- PostgreSQL écoute sur `5432` dans le conteneur.

Point important : le `docker-compose` expose `5433` par défaut sur la machine hôte, tandis que `apps/api/.env.example` utilise `5432`. Il faut donc soit :

- définir `DB_PORT=5433` dans `apps/api/.env`, soit
- lancer Docker avec `DB_PORT=5432` dans l'environnement de la commande.

Une fois PostgreSQL lancé, exécuter les migrations :

```bash
pnpm --dir apps/api migrate
```

## Lancer l'application

Depuis la racine du monorepo :

```bash
pnpm api:dev
```

Cela démarre l'API AdonisJS en mode watch.

L'API écoute ensuite sur le port configuré, par défaut `3333`.

## Commandes utiles

Depuis la racine :

```bash
pnpm api:dev
pnpm api:test
pnpm api:typecheck
```

Depuis `apps/api` :

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm migrate
pnpm rollback
pnpm build
pnpm start
```

## Tests

Les tests sont organisés principalement en deux niveaux :

- `apps/api/tests/unit` pour les use cases et règles métier ;
- `apps/api/tests/integration` pour les endpoints et flux applicatifs.

Lancer toute la suite API :

```bash
pnpm api:test
```

Vérifier le typage :

```bash
pnpm api:typecheck
```

## Architecture applicative

L'API suit une structure par domaines métier et cas d'usage. On retrouve notamment :

- des `controllers` pour la couche HTTP ;
- des `use_case.ts` pour la logique applicative ;
- des `validator.ts` pour les contrats d'entrée ;
- des `repositories` pour l'accès aux données ;
- des `policies` pour l'autorisation ;
- des `transformers` pour les réponses ;
- des `exceptions` métier explicites.

Le dépôt applique aussi plusieurs conventions importantes :

- architecture en vertical slices ;
- séparation claire entre cas d'usage et accès aux données ;
- archivage métier à la place de la suppression ;
- normalisation des transformations d'entrée dans les use cases ou helpers de domaine ;
- historique métier conservé pour les actions importantes.

Pour le détail, voir :

- [docs/agents/domain.md](./docs/agents/domain.md)
- [apps/api/docs/adr/0007-vertical-slice-api-architecture.md](./apps/api/docs/adr/0007-vertical-slice-api-architecture.md)
- [apps/api/docs/adr/0013-use-case-and-repository-boundaries.md](./apps/api/docs/adr/0013-use-case-and-repository-boundaries.md)

## Authentification et rôles

Le MVP utilise une authentification par session cookie.

Les rôles métier documentés sont :

- `OBSERVER`
- `OPERATIONS_LEAD`
- `OPERATIONS_ADMIN`
- `ORGANIZATION_ADMIN`

La hiérarchie des permissions est décrite dans [CONTEXT.md](./CONTEXT.md) et dans les issues `epic` liées aux utilisateurs sur [GitHub Issues](https://github.com/whazzark/portflow-ai/issues).

## Documentation produit et architecture

Pour naviguer dans le projet :

- [CONTEXT.md](./CONTEXT.md) : glossaire métier canonique ;
- [GitHub Issues](https://github.com/whazzark/portflow-ai/issues) : périmètre fonctionnel détaillé (issues `epic`) ;
- [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5) : plan de livraison ;
- [docs/adr](./docs/adr) : ADRs racine ;
- [apps/api/docs/adr](./apps/api/docs/adr) : ADRs spécifiques à l'API ;
- [docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md) : fonctionnement du tracker (GitHub Issues).

## Workflow projet

La source canonique de planification est GitHub :

- [GitHub Issues](https://github.com/whazzark/portflow-ai/issues) : specs (issues `epic`) et issues d'implémentation ;
- [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5) : statut, priorité et découpage en sprints.

Les idées non encore spécifiées restent sous [`.tracker/ideas/`](./.tracker/ideas/).

Les conventions de contribution et de delivery agentique sont décrites dans :

- [AGENTS.md](./AGENTS.md)

## Limitations connues de l'état actuel

- le README documente une architecture cible plus large que le code actuellement présent ;
- `apps/web` n'est pas encore dans le dépôt ;
- Redis, SSE et le stockage S3-compatible sont cadrés au niveau produit, mais pas visibles comme applications livrées ici ;
- l'envoi réel d'emails est explicitement hors du livrable utilisateur déjà mentionné dans la roadmap.

## Vision de livraison

La roadmap vise, dans cet ordre :

1. sécuriser l'administration des utilisateurs ;
2. livrer les référentiels métier ;
3. livrer la préparation des discharges ;
4. couvrir l'exécution opérationnelle nominale ;
5. gérer les changements de ressources en cours d'opération ;
6. finaliser validation, clôture et rapports immuables ;
7. terminer le dashboard temps réel.

La première cible démontrable métier est la préparation complète d'une `Discharge`.