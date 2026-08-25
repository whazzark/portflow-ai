# Quickstart: Archive Weighing Areas

**Feature**: `GH-205` | **Date**: 2026-08-24 | **Plan**: [plan.md](./plan.md)

How to run and validate this feature. Contract details live in
[contracts/](./contracts/); entity and column detail in [data-model.md](./data-model.md).

## Prerequisites

- Node.js 25 and pnpm 10 (repo pins `pnpm@10.28.1`).
- Docker, for PostgreSQL 17.

```bash
pnpm install
docker compose -f docker/docker-compose.yml up -d postgres   # exposes 5433

cp apps/api/.env.example apps/api/.env
cd apps/api && node --import reflect-metadata --import tsx ace.js generate:key && cd ../..
cp apps/web/.env.example apps/web/.env
```

`weighing_areas` already has every column this feature writes, so **no new migration** is
introduced. Seed the fixtures:

```bash
cd apps/api && pnpm db:fresh && cd ../..
```

> Running against a database shared with another worktree will regenerate
> `apps/api/database/schema.ts` from whatever that branch migrated. If the file turns up dirty and
> the diff is unrelated to weighing areas, discard it.

## Run

```bash
pnpm dev        # turbo: API on :3333, web on :3000
```

Ports are shared machine-wide. To run beside another worktree, set `PORT` and `WEB_ORIGIN` in
`apps/api/.env`, point `VITE_API_BASE_URL` at it, and start web with `vite --port <other>`.

Seeded logins (password `Password!234` for all):

| Email | Role | Can archive? |
|---|---|---|
| `claire.martin@portflow.ai` | `ORGANIZATION_ADMIN` | yes |
| `thomas.bernard@portflow.ai` | `OPERATIONS_ADMIN` | yes |
| `sophie.dubois@portflow.ai` | `OPERATIONS_LEAD` | no |
| `lucas.moreau@portflow.ai` | `OBSERVER` | no |

Seeded weighing areas — one available, one reactivated (also available), one archived:

| Name | Lifecycle |
|---|---|
| Pont-bascule Nord | available |
| Pont-bascule Sud | reactivated → available |
| Ancien pont-bascule Chef de Baie | archived |

The reactivated one is the fixture to use when proving FR-011: archiving it must preserve its
existing reactivation context.

## Validate

### Single archive

Sign in as `claire.martin@portflow.ai`, open `/checkpoints`, select **Pont-bascule Nord**, archive
it with a comment. Expect: it leaves the available scope, appears under the archived status filter
with archive time, actor, and comment, and the map updates without a reload.

```bash
curl -sX POST http://localhost:3333/weighing-areas/<id>/archive \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"comment":"Decommissioned"}'
```

Then re-issue the same call: expect `409 E_WEIGHING_AREA_ALREADY_ARCHIVED` with the original archive
context intact.

### The in-use refusal

The discharge preparation seeder (`09_discharge_preparation_seeder.ts`) creates planned/active
discharges with shift memberships. Archiving a weighing area holding a **current** shift membership
in a planned or active discharge must return `409 E_WEIGHING_AREA_IN_USE` and leave it available.
Close that discharge (or end the membership) and retry — it must now succeed. This is the
`#240` usage rule; it is not re-implemented here.

### Bulk archive

```bash
curl -sX POST http://localhost:3333/weighing-areas/archive \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"ids":["<available>","<already-archived>","<in-use>","1c77b0de-0000-4000-8000-000000000000"],
       "comment":"End-of-campaign cleanup"}'
```

Expect `200`, with the eligible one in `updatedWeighingAreas` and the other three in
`blockedWeighingAreas` as `ALREADY_ARCHIVED`, `IN_USE`, and `NOT_FOUND` — the last without a `name`.

Whole-request rejections, none of which may change any weighing area:

```bash
-d '{"ids":[]}'                              # 422 — empty
-d '{"ids":["not-a-uuid"]}'                  # 422 — malformed
-d '{"ids":["<id>","<id>"]}'                 # 422 — duplicate
-d '{"ids":["<id>"],"comment":"'"$(printf 'x%.0s' {1..1001})"'"}'   # 422 — comment too long
```

The malformed-vs-`NOT_FOUND` split is the contract's sharpest edge: a bad *shape* fails the whole
request, a well-formed id that resolves to nothing is a per-record blocker.

### Bulk in the interface

The dock equivalent is already delivered on this same map — compare against it as you go, since the
weighing-area behavior must match (FR-038).

As an administrator on `/checkpoints`, press **"Select weighing areas"**, check several available
ones, and archive them with one comment. Verify:

- The URL carries `?selecting=weighing-areas`, and create actions are hidden while selecting.
- All archived ones share one archive time, actor, and comment.
- Blocked ones are named with their reason in the outcome toast, and stay available.
- **Blocked ones stay checked** while archived ones disappear, so pressing "Archive selected" again
  resubmits exactly the blocked set — no separate retry control.
- A **search term that hides a checked marker keeps it checked**; switching the status filter or the
  resource-kind filter to docks empties the actionable selection.
- **Dock markers keep opening their details sheet** while selecting weighing areas — the mirror of
  the delivered dock test, and the assertion that proves the generalization did not break docks.
- Archived markers are not checkable and keep opening details.
- Shift-clicking an available weighing-area marker enters select mode and checks it; Ctrl/Cmd+A
  checks every visible available one, but does nothing while typing in the search field.
- Non-administrators (`sophie.dubois`, `lucas.moreau`) are offered neither the toggle nor any
  archive action.

## Tests

```bash
pnpm test                                            # everything

cd apps/api && pnpm test --files="**/weighing_areas/**"        # API slice
cd apps/web && pnpm test src/features/weighing-areas           # web slice
cd apps/web && pnpm test src/features/checkpoints              # selection model
```

New API suites follow the dock lifecycle layout delivered by `#200`:

```text
apps/api/tests/unit/weighing_areas/lifecycle/bulk_archive.spec.ts
apps/api/tests/integration/weighing_areas/lifecycle/bulk/archive.spec.ts
```

Note the existing weighing-area tests are flat (`tests/integration/weighing_areas.spec.ts`) rather
than nested — as the dock ones partly were. Whether to migrate the existing flat files is a
judgement call for `/speckit-tasks`, not a requirement of this feature.

Web suites mirror `#200`'s split between map-level selection
(`features/checkpoints/__tests__/bulk-archive/`) and resource-level archiving
(`features/weighing-areas/__tests__/archive/`) — see the UI-state contract, section H.

Concurrency deserves an explicit integration test rather than trust in the transaction: two
overlapping submissions must archive each weighing area exactly once, the loser reporting
`ALREADY_ARCHIVED` without overwriting the winner's context (FR-020).

## Before the PR

Per constitution VII:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

Plus the browser flow above, and a fresh read-only review of the final diff.

Call out in the PR description that `archiveWeighingAreaValidator` now trims and caps the comment at
1,000 characters — a behavior change to the already-delivered single archive path, required by
FR-009/FR-010 and explained in [research.md](./research.md) D3.
