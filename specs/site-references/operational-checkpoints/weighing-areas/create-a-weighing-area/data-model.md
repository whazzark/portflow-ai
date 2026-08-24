# Phase 1 Data Model: Create a Weighing Area

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

**No schema change, no migration.** Every persisted structure below already exists. This document
records what the create path writes and which spec rules each field carries, so the implementation
and its tests have one place to check against.

---

## Persisted entity: Weighing Area

Table `weighing_areas` (migration `1784600000000_create_weighing_areas_table.ts`), model
`#models/weighing_area`. Fields relevant to creation:

| Field | Type | Set on create by | Rules |
|---|---|---|---|
| `id` | uuid, primary key | Model (uuid default) | Stable identity for the `checkpoint=WEIGHING_AREA:<id>` selection contract |
| `name` | string, not null | Administrator, trimmed by the use case | Non-blank, ≤ 255 chars (FR-006, FR-007); unique case-insensitively among weighing areas (FR-008, FR-009) |
| `latitude` | double, not null | Pending placement's final value | −90..90, enforced by validator, use case, and a DB CHECK (FR-010) |
| `longitude` | double, not null | Pending placement's final value | −180..180, same triple enforcement (FR-010) |
| `status` | enum `AVAILABLE` \| `ARCHIVED` | Repository, hard-coded `AVAILABLE` | Not accepted from input — `CreateWeighingAreaCommand` has no `status` field (FR-011) |
| `createdAt` | timestamp, not null | Lucid | The creation time surfaced in the detail state (FR-012) |
| `updatedAt` | timestamp, not null | Lucid | — |
| `archivedAt`, `archivedByUserId`, `archiveComment` | nullable | — | Always null on creation; owned by #205 |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | nullable | — | Always null on creation; owned by #206 |

**Uniqueness**: `CREATE UNIQUE INDEX weighing_areas_name_unique ON weighing_areas (LOWER(name))`.
Because the index is scoped to this table it enforces FR-008 (across Available *and* Archived) and
FR-009 (independent of dock names) simultaneously, and it is the mechanism behind SC-005: two
near-simultaneous inserts of the same name make one succeed and the other raise a unique violation,
which `LucidWeighingAreaRepository.create` converts to `{ kind: 'DUPLICATE_NAME' }`.

**Coordinate storage note**: latitude and longitude are `double`, so a value typed by an
administrator is stored as given; the boundary values −90/90 and −180/180 are legal and covered by
an existing test using the `boundaryCoordinates` factory state.

---

## Transient client entity: Pending Weighing Area Placement

Not persisted. Represented by the existing resource-agnostic `LatLng` type from
`components/resource-map/resource-map-placement.tsx`:

```ts
type LatLng = { latitude: number; longitude: number }
```

| Aspect | Behavior |
|---|---|
| Created by | A map click while placement is armed, or by typing both coordinate fields |
| Mutated by | Dragging the pending marker, clicking a different point, or editing either coordinate field |
| Lifetime | Exists only while a creation flow is active for this kind |
| Discarded when | The administrator cancels, switches to the dock creation flow (FR-017), navigates away, or a creation succeeds |
| Preserved when | A submission is rejected for any reason (FR-014) |
| Not | A weighing area — no identity, no status, never sent anywhere until submit |

**State transitions** for one creation flow:

```text
idle
 └─(administrator picks "New weighing area", is authorized)─> armed, no placement
      ├─(map click / both coordinates typed)─> armed, placement pending
      │     ├─(drag marker / edit a coordinate)──────────> armed, placement pending  (updated)
      │     ├─(submit, rejected)────────────────────────> armed, placement pending  (unchanged, FR-014)
      │     ├─(submit, accepted)────────────────────────> idle + new weighing area selected (FR-013)
      │     ├─(cancel / close sheet)────────────────────> idle, placement discarded (FR-016)
      │     └─(switch to dock creation)─────────────────> dock flow armed, this placement discarded (FR-017)
      └─(submit attempted with no placement)────────────> blocked, nothing created (FR-004)
```

---

## Client view model

| Type | Source | Notes |
|---|---|---|
| `WeighingAreaDto` | `features/weighing-areas/types.ts`, derived from `Route.Response<'weighing_areas.index'>` | Already exists; the create response has the same shape |
| `PresentedCheckpoint` | `features/checkpoints/types.ts` | The created area enters this collection via the existing `toWeighingAreaCheckpoint` adapter after the list query is invalidated |
| `CheckpointMapPlacement` | `features/checkpoints/map/checkpoint-map.tsx` | Already kind-agnostic (`label`, `icon`); reused as-is |

**Creation input** sent to the API — nothing else is sent, and no status field exists to send:

```ts
{ name: string /* trimmed client-side too */, latitude: number, longitude: number }
```
