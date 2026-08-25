# Phase 1 Data Model: Reactivate Docks

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No schema change. This documents the existing `docks` table's lifecycle fields (unchanged) and the
in-memory shapes the bulk reactivation surface reuses or introduces.

## Dock (existing — `apps/api/app/models/dock.ts`, `docks` table)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Stable identity, unchanged by reactivation |
| `name` | string | Unchanged by reactivation |
| `latitude`, `longitude` | number | Unchanged by reactivation |
| `status` | `'AVAILABLE' \| 'ARCHIVED'` | The field this feature mutates |
| `archivedAt` | timestamp \| null | **Preserved** by reactivation — never cleared (spec FR-013) |
| `archivedByUserId` | uuid \| null | **Preserved** by reactivation |
| `archiveComment` | string \| null | **Preserved** by reactivation |
| `reactivatedAt` | timestamp \| null | Set on reactivation; overwritten by a later reactivation |
| `reactivatedByUserId` | uuid \| null | The administrator who performed the reactivation |
| `reactivationComment` | string \| null | Trimmed; `null` when omitted or whitespace-only |
| `createdAt`, `updatedAt` | timestamp | `updatedAt` advances on reactivation; `createdAt` never changes |

**State transition** (this feature adds the `ARCHIVED → AVAILABLE` edge at selection scope; the
individual edge already exists):

```
ARCHIVED  --[reactivate: eligible]--> AVAILABLE
AVAILABLE --[reactivate: already]---> AVAILABLE   (blocked, ALREADY_AVAILABLE)
(no dock) --[reactivate: missing]---> —           (blocked, NOT_FOUND)
```

There is no usage-based edge: `IN_USE` cannot arise on this path, because an archived dock is not
the current dock of any Planned or Active discharge (spec Assumptions, research D2). The
reactivation path has no `SiteReferenceUsageChecker` collaborator at all.

Eligibility (`status = 'ARCHIVED'`) is decided fresh at write time inside the same transaction that
performs the update, for both the individual and the bulk path — never from a value read earlier in
the request.

**Repeatability** (spec FR-021): the two metadata groups are independent columns, so a dock may
cycle `AVAILABLE → ARCHIVED → AVAILABLE → ARCHIVED …` any number of times. Each transition
overwrites its own direction's three columns and leaves the other direction's untouched, so a dock
always carries its most recent archive *and* its most recent reactivation, and `status` alone says
which one is current.

## Reactivation Blocker (existing type — `dock_lifecycle_blockers.ts`, unchanged)

```ts
type BulkDockLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}
```

Reactivation produces only `NOT_FOUND` and `ALREADY_AVAILABLE` (spec FR-009). The other two reasons
belong to the archive direction and are unreachable here:
`findBulkBlockers(ids, docksById, 'ARCHIVED')` emits `ALREADY_AVAILABLE` for a status mismatch, and
its `IN_USE` branch is guarded by `expectedStatus === 'AVAILABLE'`.

`name` is omitted only for `NOT_FOUND` (there is no dock row to read it from); it is always present
for `ALREADY_AVAILABLE`, so the UI can show a human-readable identifier alongside the reason.

## Multiple-Reactivation Selection (request shape — validated, not persisted)

```ts
type ReactivateDocksRequest = {
  ids: string[]   // non-empty, each a UUID, case-insensitively distinct — rejected in full otherwise
  comment?: string | null   // optional, trimmed, ≤1000 chars, applied to every dock this request reactivates
}
```

Validated by `reactivateDocksValidator` (new, in `dock_validator.ts`, built from the same
`lifecycleIds()` / `lifecycleComment()` factories as `archiveDocksValidator`) before any dock is
read. A request failing this validation never reaches `ReactivateDocksUseCase` or touches the
database (spec FR-004, FR-005).

## Bulk Reactivation Result (response shape — existing type, reused)

```ts
type BulkDockLifecycleResult = {
  updatedDocks: Dock[]                       // every dock this request reactivated, in request order
  blockedDocks: BulkDockLifecycleBlocker[]   // every dock this request did not reactivate, with its reason, in request order
}
```

Structurally identical to the bulk-archive result, so the web-side `BulkDockLifecycleResult` type
alias (derived from `Route.Response<'docks.archive_many'>['data']`) keeps serving both directions
unchanged. `updatedDocks` uses the standard serialized dock shape (`DockTransformer`). Ids present
in the request but absent from both lists cannot occur — `findBulkBlockers` plus the eligibility
filter partition the validated `ids` exactly into the two lists (spec FR-009, SC-003).

## Selection Intent (new, client-side only — `checkpoints-page.tsx`)

```ts
type SelectionIntent = 'ARCHIVE' | 'REACTIVATE'
```

Not persisted, not sent to the API, and not stored in the URL: derived on each render from the
status of the currently checked docks, which are homogeneous by construction (research D3). With an
empty selection the intent is undefined, and every dock is checkable; a selection of `AVAILABLE`
docks means `ARCHIVE`, a selection of `ARCHIVED` docks means `REACTIVATE`. It selects the endpoint,
the bar's labels, and the confirmation dialog's copy — see
[contracts/dock-reactivate-ui-state.md](./contracts/dock-reactivate-ui-state.md).

## Relationships (unchanged)

- **Discharge → Dock**: historical references are untouched. A discharge that referenced a dock
  before it was archived still references the same dock after reactivation; no discharge is created,
  closed, or reassigned by this feature (spec FR-015).
- **Administrator (User) → Dock**: `reactivatedByUserId` is the only relationship instance this
  feature creates, once per dock per successful reactivation, identical in shape to the existing
  individual-reactivation relationship and to `archivedByUserId`.
