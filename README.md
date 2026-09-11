# Portflow AI

Portflow AI est un monorepo dédié à la gestion opérationnelle des déchargements de vrac sur site portuaire. Le produit aide une organisation à préparer une décharge, exécuter les shifts, suivre les rotations camions, valider les données terrain et produire des rapports immuables.

Le dépôt contient les deux applications du produit : l'API AdonisJS et le poste de travail web TanStack Start.

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

Le dépôt est un monorepo PNPM et Turbo avec deux applications actives :

- `apps/api` : API AdonisJS 7 en TypeScript ;
- `apps/web` : poste de travail web TanStack Start en React 19 et TypeScript.

Les deux applications partagent le contrat API via Tuyau : `apps/web` dépend de `apps/api` en `workspace:*` pour typer ses appels de bout en bout.

## Fonctionnalités métier déjà cadrées

Le domaine et le périmètre du MVP sont décrits dans :

- [CONTEXT.md](./CONTEXT.md) pour le vocabulaire métier ;
- les roadmaps et specs versionnées sous [`specs/`](./specs) pour le périmètre fonctionnel détaillé ;
- les [GitHub Issues](https://github.com/whazzark/portflow-ai/issues) pour l'intake, les discussions et la traçabilité ;
- le [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5) pour le Kanban continu, l'ordre de livraison et la maturité Spec Kit ;
- [docs/adr](./docs/adr) et [apps/api/docs/adr](./apps/api/docs/adr) pour les décisions d'architecture.

À ce stade, les briques suivantes sont couvertes de l'API jusqu'à l'écran :

- authentification, session, renouvellement de mot de passe et utilisateur courant ;
- invitation, activation, réactivation et gestion d'utilisateurs ;
- gestion des Customers ;
- gestion des Transport Companies ;
- gestion des Trucks ;
- gestion des Docks ;
- gestion des Weighing Areas ;
- gestion des Warehouses et de leurs emprises ;
- gestion des Warehouse Doors.

Le modèle de données des `Discharge`, `Shift`, `ProductLot` et de leurs affectations est déjà présent en migrations et en modèles Lucid, mais n'expose encore ni endpoint HTTP ni écran.

Le détail exact du statut de livraison est piloté par le [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5) avec les colonnes `Backlog`, `Ready`, `In Progress`, `Review`, `Blocked` et `Done`. Les specs canoniques restent versionnées sous [`specs/`](./specs).

## Stack technique

Socle commun :

- Node.js
- PNPM workspaces et Turbo
- TypeScript
- Biome pour le format et le lint
- Tuyau pour le contrat API typé entre `apps/api` et `apps/web`

`apps/api` :

- AdonisJS 7
- PostgreSQL
- Japa pour les tests

`apps/web` :

- TanStack Start, Router, Query, Form et Table
- React 19
- Tailwind CSS 4 et primitives shadcn
- MapLibre GL pour les cartes de ressources
- Vitest, Testing Library et MSW pour les tests

L'architecture MVP prévoit aussi, à terme :

- Redis pour les traitements asynchrones ;
- un stockage S3-compatible pour les PDF ;
- du Server-Sent Events pour le dashboard temps réel.

Ces éléments sont documentés, mais pas encore implémentés dans ce dépôt.

## Structure du dépôt

```text
.
├── apps/
│   ├── api/                # API AdonisJS
│   └── web/                # Poste de travail web TanStack Start
├── docker/
│   └── docker-compose.yml  # PostgreSQL local + profile `prod` (images api/web)
├── docs/
│   ├── adr/                # ADRs racine
│   ├── agents/             # Conventions de delivery et guides opératoires
│   └── architecture/       # Documentation d'architecture transverse
├── scripts/
│   └── worktree/           # Setup et teardown d'un worktree (base, ports, cookie)
├── specs/                  # Roadmaps et spécifications Spec Kit canoniques
├── .specify/               # Constitution, templates et workflows Spec Kit
├── CONTEXT.md              # Glossaire métier
├── AGENTS.md               # Conventions agentiques du repo
├── orca.yaml               # Hooks Orca de création et d'archivage des worktrees
├── package.json
└── pnpm-workspace.yaml
```

## Prérequis

- Node.js 25, version utilisée par la CI
- PNPM 10
- Docker et Docker Compose pour lancer PostgreSQL localement

## Installation

Cloner le dépôt, puis installer les dépendances :

```bash
pnpm install
```

## Configuration de l'environnement

Chaque application utilise son propre fichier d'environnement local.

Créer les fichiers :

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Variables principales de `apps/api` :

- `PORT` : port HTTP de l'API ;
- `HOST` : interface d'écoute ;
- `APP_KEY` : clé d'application AdonisJS ;
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` : connexion PostgreSQL ;
- `SESSION_DRIVER` : driver de session ;
- `SESSION_COOKIE_NAME` : nom du cookie de session, `adonis-session` par défaut ;
- `WEB_ORIGIN` : origine du frontend autorisée.

Variables principales de `apps/web` :

- `WEB_PORT` : port d'écoute du serveur de développement, `3000` par défaut ;
- `VITE_API_BASE_URL` : base de l'API appelée par le frontend ;
- `VITE_MAP_STYLE_LIGHT_URL` et `VITE_MAP_STYLE_DARK_URL` : styles de fond de carte MapLibre.

Le frontend utilise `http://localhost:3333` comme API locale par défaut et écoute sur
`http://localhost:3000`.

Exemple de configuration locale :

```env
TZ=UTC
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
APP_KEY=your-app-key
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=5433
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

L'API lancée sur l'hôte doit utiliser `DB_PORT=5433`. Si l'API est lancée dans Docker avec le profile `prod`, elle doit utiliser `DB_HOST=postgres` et `DB_PORT=5432`, correspondant au port interne du conteneur.

## Lancer la stack avec les images de production

Le même `docker-compose.yml` expose un profile `prod` qui construit et lance `apps/api` et `apps/web` à partir de leurs `Dockerfile` de production (celles utilisées par la CI), pour vérifier localement que les images se comportent comme en prod.

Ce profile lit un fichier d'environnement dédié par application. Les créer avant le premier lancement :

```bash
cp apps/api/.env.docker.example apps/api/.env.docker
cp apps/web/.env.docker.example apps/web/.env.docker
```

Renseigner `APP_KEY` dans `apps/api/.env.docker`, puis lancer la stack :

```bash
docker compose -f docker/docker-compose.yml --profile prod up --build
```

- API accessible sur `http://localhost:3333` (santé : `/health`) ;
- Web accessible sur `http://localhost:8081` ;
- `APP_KEY`, `WEB_ORIGIN` et la connexion PostgreSQL vue par l'API se configurent dans `apps/api/.env.docker` ;
- `DB_PORT`, `WEB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `VITE_API_BASE_URL` et les URLs de style de carte peuvent être surchargés via l'environnement ou un fichier `docker/.env`.

Ce profile ne lance pas les migrations automatiquement. Une fois les conteneurs démarrés, les exécuter avec :

```bash
docker compose -f docker/docker-compose.yml --profile prod exec api node ace.js migration:run --force
```

(`--force` est nécessaire car les conteneurs tournent en `NODE_ENV=production`, où AdonisJS demande une confirmation interactive par défaut.)

Une fois PostgreSQL lancé, exécuter les migrations :

```bash
pnpm --dir apps/api db:migrate
```

## Lancer l'application

Depuis la racine du monorepo :

```bash
pnpm dev
```

Turbo démarre les deux applications en mode watch :

- l'API AdonisJS sur le port configuré, par défaut `3333` ;
- le poste de travail web sur le port configuré, par défaut `http://localhost:3000`.

Pour ne lancer qu'une application :

```bash
pnpm --dir apps/api dev
pnpm --dir apps/web dev
```

## Travailler dans un worktree

Chaque worktree Git dispose de sa propre base, de ses propres ports et de son propre cookie de
session, ce qui permet d'en lancer plusieurs en même temps, dans le même navigateur, sans qu'ils se
marchent dessus. Le checkout principal garde la base `portflow` et les ports `3000` et `3333`.

Orca lance `scripts/worktree/setup.sh` à la création d'un worktree (voir [`orca.yaml`](./orca.yaml)).
Pour un worktree créé autrement, ou pour le remettre d'aplomb, le lancer depuis ce worktree :

```bash
pnpm worktree:setup
```

Le script, que l'on peut relancer sans risque :

- installe les dépendances ;
- démarre `portflow-postgres` s'il est arrêté ;
- réserve un numéro n au worktree, qui lui donne le web sur `3000 + n` et l'API sur `3333 + n` ;
- crée `apps/api/.env` et `apps/web/.env` à partir de ceux du checkout principal, puis y écrit le
  port, la base `portflow_wt_<nom-du-worktree>` et le cookie de session du worktree ;
- crée cette base dans le conteneur existant, la migre et, à sa création seulement, la seed.

Il affiche ensuite les URLs du worktree ; `pnpm dev` démarre les deux applications.

À l'archivage ou à la suppression du worktree, Orca lance `scripts/worktree/teardown.sh`, qui
supprime la base du worktree et libère ses ports. Hors Orca, le lancer avant de supprimer le
worktree :

```bash
pnpm worktree:teardown
```

Il ne supprime jamais une base dont le nom ne commence pas par `portflow_wt_`. Les numéros réservés
sont enregistrés dans `.git/portflow-worktrees/`, partagé par tous les worktrees ; celui d'un
worktree supprimé sans teardown est récupéré au setup suivant, mais sa base reste à supprimer à la
main.

## Commandes utiles

Depuis la racine, Turbo propage la commande aux deux applications :

```bash
pnpm dev
pnpm build
pnpm test
pnpm typecheck
pnpm check
pnpm check:fix
```

`pnpm check`, `pnpm typecheck` et `pnpm test` sont les trois commandes exécutées par la CI.

Depuis `apps/api` :

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm start
pnpm db:migrate
pnpm db:rollback
pnpm db:seed
pnpm db:fresh
```

Depuis `apps/web` :

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm start
pnpm generate
```

## Tests

Côté API, les tests Japa sont organisés en deux niveaux :

- `apps/api/tests/unit` pour les use cases et règles métier ;
- `apps/api/tests/integration` pour les endpoints et flux applicatifs.

Côté web, les tests Vitest suivent la stratégie décrite dans
[apps/web/docs/adr/0001-frontend-testing-strategy.md](./apps/web/docs/adr/0001-frontend-testing-strategy.md) :

- des tests unitaires pour les adaptateurs, mappers et règles pures, sans rendu React ;
- des tests de feature qui rendent l'écran à travers le vrai routeur et les vrais providers, avec MSW pour simuler le réseau.

Lancer toute la suite du monorepo :

```bash
pnpm test
```

Cibler une application :

```bash
pnpm --dir apps/api test
pnpm --dir apps/web test
```

Vérifier le typage :

```bash
pnpm typecheck
```

## Architecture applicative

### apps/api

L'API suit une structure par domaines métier et cas d'usage. On retrouve notamment :

- des `controllers` pour la couche HTTP ;
- des `use_case.ts` pour la logique applicative ;
- des `validator.ts` pour les contrats d'entrée ;
- des `repositories` pour l'accès aux données ;
- des `policies` pour l'autorisation ;
- des `transformers` pour les réponses ;
- des `exceptions` métier explicites.

### apps/web

Le poste de travail web suit la même logique de vertical slices, sous `src/features/<feature>/`, avec des fichiers de route volontairement minces :

- `ui/` pour les écrans et composants de la feature ;
- `queries/` et `mutations/` pour l'accès aux données via Tuyau et TanStack Query ;
- `context/` pour l'état d'écran partagé ;
- `__tests__/` pour les tests de la feature.

Le code partagé reste technique : `src/components/ui` pour les primitives shadcn, `src/libraries` pour les intégrations d'outils et `src/helpers` pour les utilitaires non métier. `features/auth` est l'exception explicite dont les autres features peuvent dépendre pour la session et l'UI sensible aux autorisations. Des helpers de policy peuvent piloter la visibilité côté écran, mais l'API reste autoritaire sur l'autorisation.

### Conventions transverses

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
- [docs/adr/0005-tuyau-api-web-contract.md](./docs/adr/0005-tuyau-api-web-contract.md)
- [docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md](./docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md)

## Authentification et rôles

Le MVP utilise une authentification par session cookie.

Les rôles métier documentés sont :

- `OBSERVER`
- `OPERATIONS_LEAD`
- `OPERATIONS_ADMIN`
- `ORGANIZATION_ADMIN`

La hiérarchie des permissions est décrite dans [CONTEXT.md](./CONTEXT.md), les specs sous [`specs/`](./specs) et les ADR liés aux utilisateurs.

## Documentation produit et architecture

Pour naviguer dans le projet :

- [CONTEXT.md](./CONTEXT.md) : glossaire métier canonique ;
- [`specs/`](./specs) : specs fonctionnelles et roadmaps Spec Kit ;
- [GitHub Issues](https://github.com/whazzark/portflow-ai/issues) : intake, discussions et liens de traçabilité ;
- [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5) : plan de livraison ;
- [docs/adr](./docs/adr) : ADRs racine ;
- [apps/api/docs/adr](./apps/api/docs/adr) : ADRs spécifiques à l'API ;
- [apps/web/docs/adr](./apps/web/docs/adr) : ADRs spécifiques au frontend ;
- [docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md) : fonctionnement du tracker (GitHub Issues) ;
- [docs/agents/spec-kit.md](./docs/agents/spec-kit.md) : guide opératoire Codex + Spec Kit.

## Workflow projet

La source canonique de planification est GitHub :

- [GitHub Issues](https://github.com/whazzark/portflow-ai/issues) : intake et coordination du delivery ;
- [docs/architecture/ai-development-factory.md](./docs/architecture/ai-development-factory.md) : workflow Codex + Spec Kit ;
- [docs/agents/spec-kit.md](./docs/agents/spec-kit.md) : commandes quotidiennes, gates, maintenance et dépannage ;
- [GitHub Project Portflow Roadmap](https://github.com/users/whazzark/projects/5) : statut, priorité et ordre de livraison.

Les idées non encore spécifiées entrent par les [GitHub Issues](https://github.com/whazzark/portflow-ai/issues).

Les conventions de contribution et de delivery agentique sont décrites dans :

- [AGENTS.md](./AGENTS.md)

## Limitations connues de l'état actuel

- le périmètre livré couvre l'authentification, l'administration des utilisateurs et les référentiels du site ; l'exécution opérationnelle, la validation et les rapports restent à livrer ;
- les tables et modèles `Discharge` et `Shift` existent, mais sans endpoint ni écran associé ;
- les tests E2E décrits dans la stratégie de test frontend ne sont pas encore présents dans le dépôt ;
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
