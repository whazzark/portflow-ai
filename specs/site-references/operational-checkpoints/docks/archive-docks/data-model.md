# Phase 1 Data Model: Archive Docks

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No schema change. This documents the existing `docks` table's lifecycle fields (unchanged) and the
new in-memory shapes the bulk archive surface introduces.

## Dock (existing — `apps/api/app/models/dock.ts`, `docks` table)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Stable identity, unchanged by archiving |
| `name` | string | Unchanged by archiving |
| `latitude`, `longitude` | number | Unchanged by archiving |
| `status` | `'AVAILABLE' \| 'ARCHIVED'` | The field this feature mutates |
| `archivedAt` | timestamp \| null | Set on archive, never cleared by this feature |
| `archivedByUserId` | uuid \| null | The administrator who performed the archive |
| `archiveComment` | string \| null | Trimmed; `null` when omitted or whitespace-only |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | — | Untouched by this feature; owned by #201 |
| `createdAt`, `updatedAt` | timestamp | `updatedAt` advances on archive; `createdAt` never changes |

**State transition** (this feature only adds the `AVAILABLE → ARCHIVED` edge, already implemented):

```
AVAILABLE --[archive: eligible]--> ARCHIVED
AVAILABLE --[archive: in use]-----> AVAILABLE   (blocked, IN_USE)
ARCHIVED  --[archive: already]----> ARCHIVED    (blocked, ALREADY_ARCHIVED)
(no dock) --[archive: missing]----> —           (blocked, NOT_FOUND)
```

Eligibility (`AVAILABLE` and not currently referenced by a Planned or Active discharge) is decided
fresh at write time inside the same transaction that performs the update, for both the individual
and the bulk path — never from a value read earlier in the request.

## Archive Blocker (new type — `dock_lifecycle_blockers.ts`)

```ts
type BulkDockLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED'
}
```

Mirrors `BulkCustomerLifecycleBlocker`, with `name` in place of `code`/`companyName` and without
`ALREADY_AVAILABLE` (that reason only applies to reactivation, out of this issue's scope; the
shared `findBulkBlockers(ids, docksById, expectedStatus, usedIds?)` helper still accepts
`expectedStatus: 'ARCHIVED'` so #201 can produce it later without changing this file).

`name` is omitted only for `NOT_FOUND` (there is no dock row to read it from); it is always present
for `IN_USE` and `ALREADY_ARCHIVED`, so the UI can show a human-readable identifier alongside the
reason.

## Multiple-Archive Selection (request shape — validated, not persisted)

```ts
type ArchiveDocksRequest = {
  ids: string[]   // non-empty, each a UUID, case-insensitively distinct — rejected in full otherwise
  comment?: string | null   // optional, trimmed, ≤1000 chars, applied to every dock this request archives
}
```

Validated by `archiveDocksValidator` (new, in `dock_validator.ts`, built from the extracted shared
factories — see research D2) before any dock is read. A request failing this validation never
reaches `ArchiveDocksUseCase` or touches the database (spec FR-004, FR-005).

## Bulk Archive Result (response shape)

```ts
type BulkDockLifecycleResult = {
  updatedDocks: Dock[]              // every dock this request archived, in request order
  blockedDocks: BulkDockLifecycleBlocker[]   // every dock this request did not archive, with its reason, in request order
}
```

`updatedDocks` uses the same serialized shape as every other dock endpoint (`DockTransformer`).
`ids` present in the request but absent from both `updatedDocks` and `blockedDocks` cannot occur —
`findBulkBlockers` plus the eligibility filter partition the validated `ids` exactly into the two
lists (spec FR-010, SC-003).

## Relationships (unchanged)

- **Discharge → Dock**: A Planned or Active discharge's current dock reference is what
  `SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'DOCK', ... })`
  reads to compute `IN_USE`. This feature only reads that relationship; it never creates, closes, or
  reassigns a discharge (spec FR-006, FR-008, FR-015).
- **Administrator (User) → Dock**: `archivedByUserId` is the only new relationship instance this
  feature creates, once per dock per successful archive, identical in shape to the existing
  individual-archive relationship.
