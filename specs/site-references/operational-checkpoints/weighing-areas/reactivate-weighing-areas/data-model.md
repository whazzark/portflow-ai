# Phase 1 Data Model: Reactivate Weighing Areas

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-25

No migration and no schema change. Every column this feature writes already exists on the
`weighing_areas` table, created by `1784600000000_create_weighing_areas_table.ts`. This document
records which fields the feature reads and writes, and the shapes that cross each boundary.

---

## Weighing Area (existing — `apps/api/app/models/weighing_area.ts`, `weighing_areas` table)

| Field | Type | Role in this feature |
| --- | --- | --- |
| `id` | uuid, PK | Selection key; preserved (FR-009) |
| `name` | string, unique on `LOWER(name)` | Preserved (FR-009); blocker label |
| `latitude` | double, checked `[-90, 90]` | Preserved (FR-009) |
| `longitude` | double, checked `[-180, 180]` | Preserved (FR-009) |
| `status` | enum `AVAILABLE` \| `ARCHIVED` | **Written**: `ARCHIVED` → `AVAILABLE` (FR-006) |
| `archivedAt` | timestamp, nullable | Read-only here; preserved (FR-010) |
| `archivedByUserId` | uuid → `users.id`, nullable | Read-only here; preserved (FR-010) |
| `archiveComment` | text, nullable | Read-only here; preserved (FR-010) |
| `reactivatedAt` | timestamp, nullable | **Written**: submission time (FR-006) |
| `reactivatedByUserId` | uuid → `users.id`, nullable | **Written**: acting administrator (FR-006) |
| `reactivationComment` | text, nullable | **Written**: trimmed comment or `null` (FR-007) |
| `createdAt` | timestamp | Preserved (FR-009) |
| `updatedAt` | timestamp | **Written**: set to the reactivation time |

**Why archive context survives without any code arranging it**: the archive and reactivation
contexts are two independent column groups, and the reactivation write touches only the second.
FR-010 is therefore a property of the schema. The corollary is that a weighing area archived and
reactivated repeatedly (FR-019) keeps only the *most recent* transition per direction — the two
groups are overwritten independently, not appended to. That matches the site-reference lifecycle
model recorded in the spec's Assumptions; this feature introduces no history table.

### State transitions

```text
                       archive (#205)
        AVAILABLE  ─────────────────────────►  ARCHIVED
            ▲                                     │
            └─────────────────────────────────────┘
                   reactivate (this feature)

Guard: the reactivation UPDATE carries `WHERE status = 'ARCHIVED'`.
  0 rows affected + row exists as AVAILABLE  → ALREADY_AVAILABLE
  0 rows affected + row absent               → NOT_FOUND
```

`IN_USE` cannot arise on this transition: an archived weighing area holds no shift membership in a
planned or active discharge, and `findBulkBlockers` only performs the usage lookup when
`expectedStatus === 'AVAILABLE'`.

---

## Reactivation Blocker (existing type — `weighing_area_lifecycle_blockers.ts`, unchanged)

```ts
type BulkWeighingAreaLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}
```

The declared union spans both lifecycle directions. On the reactivation path exactly two members
are reachable — `NOT_FOUND` (no `name`, since none was resolved) and `ALREADY_AVAILABLE` (with
`name`) — which is what FR-024 requires the response to carry. No narrowing type is introduced;
`BulkLifecycleBlocker` on the web side already declares the same union and
`BLOCKER_REASON_LABELS` already maps `ALREADY_AVAILABLE` to "already available".

---

## Multiple-Reactivation Selection (request shape — validated, not persisted)

```ts
// reactivateWeighingAreasValidator
{
  ids: string[]      // lifecycleIds(): uuid, lowercased, minLength 1, duplicate-free
  comment?: string | null   // lifecycleComment(): trimmed, maxLength 1000, nullable, optional
}
```

Every rule in FR-028 is enforced here, *before* any weighing area is read: an empty array fails
`minLength(1)`, a repeated identifier fails the `distinctUuids` rule, and a non-UUID fails
`uuid()`. All three produce a 422 with no lifecycle change, which is deliberately distinct from a
well-formed identifier that resolves to nothing and comes back per-entry as `NOT_FOUND` (FR-005).

The individual endpoint takes the same `comment` field and no `ids`
(`reactivateWeighingAreaValidator`, corrected to `lifecycleComment()` per research D2).

---

## Bulk Reactivation Result (response shape — existing type, reused)

```ts
type BulkWeighingAreaLifecycleResult = {
  updatedWeighingAreas: WeighingArea[]   // ordered by submitted id order
  blockedWeighingAreas: BulkWeighingAreaLifecycleBlocker[]
}
```

Identical to the archive response, which is why `apps/web/.../types.ts` can keep deriving
`BulkWeighingAreaLifecycleResult` from `Route.Response<'weighing_areas.archive_many'>` with no
change, and why `toBulkLifecycleOutcome` normalizes both directions without branching.

Every entry in `updatedWeighingAreas` carries the same `reactivatedAt`, `reactivatedByUserId`, and
`reactivationComment` — one `DateTime.now()` taken in the controller flows into the single `UPDATE`
(FR-025).

---

## Selection Intent (client-side only — existing, `checkpoints-page.tsx` + `types.ts`)

```ts
type BulkLifecycleIntent = 'ARCHIVE' | 'REACTIVATE'

BULK_LIFECYCLE_INTENTS: Record<CheckpointKind, BulkLifecycleIntent[]>
// DOCK:          ['ARCHIVE', 'REACTIVATE']
// WEIGHING_AREA: ['ARCHIVE']  →  ['ARCHIVE', 'REACTIVATE']   ← this feature

STATUS_FOR_BULK_INTENT: Record<BulkLifecycleIntent, CheckpointStatus>
// ARCHIVE: 'AVAILABLE'   REACTIVATE: 'ARCHIVED'
```

`selectionIntent` is derived, not stored: it is `undefined` while nothing is checked, and otherwise
the intent implied by the first checked marker's status. That keeps a selection homogeneous by
construction — once an archived weighing area is checked, `checkableIds` excludes every available
one until the selection is cleared — which is what makes FR-023's per-entry partial success the
only mixed outcome the administrator can produce (mixed selections arise from staleness and direct
API calls, not from the map). Adding `'REACTIVATE'` to the weighing-area row is what makes archived
weighing-area markers checkable at all.

---

## Relationships (unchanged by this feature)

- **Weighing Area → Shift memberships / recorded weighings**: existing references are neither read
  nor written by reactivation; they keep pointing at the same weighing area (FR-012).
- **Weighing Area → Users** (`archivedByUserId`, `reactivatedByUserId`): both `ON DELETE SET NULL`.
  Reactivation sets the second; it never clears the first.
- **Name uniqueness** (`weighing_areas_name_unique` on `LOWER(name)`): spans both lifecycle states,
  so reactivation cannot collide — the name was never released by archival.
