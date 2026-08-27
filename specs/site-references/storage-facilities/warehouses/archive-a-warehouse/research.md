# Phase 0 Research: Archive a Warehouse

> **Amended by [#216 Reactivate a Warehouse Door](../../warehouse-doors/reactivate-a-warehouse-door/spec.md).**
> The cascade now takes **every** door of the warehouse, replacing the archive context of one
> already archived on its own, and `warehouse_doors.archived_with_warehouse` — added by this slice —
> is dropped. Where this document reasons about sparing already-archived doors or about recording a
> per-door provenance, read `spec.md`'s 2026-08-27 clarification instead. The text is kept as the
> delivery record of what was built at the time.

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-25

No `NEEDS CLARIFICATION` markers reached this phase: the two material scope questions (single vs.
multiple, and the door cascade) were answered by the product owner during `/speckit-specify` and are
recorded in the spec's Clarifications section. This document records the design decisions that
follow from them, each grounded in delivered code rather than in convention alone.

---

## D1 — Warehouse eligibility is derived from door usage, reusing the existing checker

**Decision**: Do **not** add a `WAREHOUSE` member to `SITE_REFERENCE_TYPES`. Instead, collect the
door ids of the candidate warehouses, call the existing
`SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'WAREHOUSE_DOOR', … })`,
and map the returned door ids back to their warehouses. A warehouse is blocked when that mapping
yields at least one of its doors.

**Rationale**:

- `WAREHOUSE_DOOR` usage is **already implemented** in
  `apps/api/app/discharges/shared/repositories/lucid_discharge_usage_repository.ts` — it joins
  `warehouse_door_product_lot_assignments` on Planned/Active discharges and filters
  `effective_to IS NULL`, which is exactly `#240` FR-006.
- Spec FR-006 requires this slice to introduce no second definition of door usage, and `#240` FR-015
  scoped that checker to be consumed by later lifecycle workflows — this is that consumption.
- Warehouses have **no direct relationship to a discharge**. `grep` over `apps/api/app/models/*.ts`
  finds `warehouseId` only on `warehouse_door.ts` and `warehouse_footprint_point.ts`. There is
  nothing for a `WAREHOUSE` checker branch to query except the doors, so adding one would duplicate
  the door branch behind a second name.
- The door rows must be loaded and locked anyway to perform the cascade, so the door-id set costs
  nothing extra.

**Alternatives considered**:

- *Add `WAREHOUSE` to `SITE_REFERENCE_TYPES`*: rejected. It widens a closed union owned by `#240`,
  duplicates the door join, and creates a second place where "warehouse in use" could drift from
  "door in use".
- *Block on "has any available door" (the current `CONTEXT.md` rule)*: rejected by the product
  decision — that rule is what the cascade replaces. See **D10**.

---

## D2 — FR-013 needs a new column: `warehouse_doors.archived_with_warehouse`

**Decision**: Add a migration introducing `archived_with_warehouse` on `warehouse_doors`, `boolean`,
`NOT NULL`, `DEFAULT false`. The cascade sets it to `true` on every door it archives. Doors archived
on their own (`#215`) leave it `false`.

**Rationale**:

- FR-013 requires that a later warehouse reactivation restore *exactly* the doors this feature
  archived, and not doors that were already archived beforehand. The seeded fixtures make this
  concrete: `WAREHOUSE_FIXTURE_IDS.sica` has one available door (`Porte Nord`) and one already
  archived (`Porte Historique`). Archiving SICA must archive the first and leave the second's
  existing context intact (FR-012); reactivating SICA later must restore only the first.
- Inferring the set from a shared `archived_at` timestamp is not sound: two doors can share a
  timestamp by coincidence, and an administrator can archive a door on its own with the same
  comment. The fact is a fact about *provenance* and deserves to be stored, not reconstructed.
- A boolean is sufficient because the state is genuinely binary and cannot accumulate: an
  already-archived warehouse refuses re-archival (FR-004), so the flag is never written twice
  without an intervening reactivation.

**Contract obligation this creates for later slices** — record in `#211` and `#216`:

- `#211` (Reactivate a Warehouse) reactivates exactly the doors with `archived_with_warehouse = true`
  and clears the flag.
- `#216` (Reactivate a Warehouse Door) must clear the flag when reactivating a door independently,
  otherwise a later warehouse reactivation would resurrect a door the administrator had deliberately
  left archived.

**Alternatives considered**:

- *`archived_via` enum (`SELF` | `WAREHOUSE`)*: equivalent expressiveness today, more ceremony, and
  the third value nobody needs yet. Rejected in favour of the boolean, which can be widened later if
  a third provenance ever appears.
- *A join table of "doors archived by warehouse archival N"*: rejected. The lifecycle model across
  every site reference replaces the most recent context rather than accumulating history
  (spec Assumptions), so a history table would contradict the established model.

**Note**: `apps/api/database/schema.ts` carries a "DO NOT EDIT manually" banner and is regenerated by
`node ace migration:run`. The migration must be run so the generated `WarehouseDoorSchema` picks up
the column before the model or repository reference it.

---

## D3 — One transaction, two tables, a fixed lock order, and an affected-rows guard

**Decision**: The cascade runs inside a single `Warehouse.transaction`. Within it:

1. Lock candidate warehouses: `Warehouse.query({client: trx}).whereIn('id', ids).orderBy('id').forUpdate()`.
2. Lock their doors: `WarehouseDoor.query({client: trx}).whereIn('warehouseId', ids).orderBy('id').forUpdate()`.
3. Assess door usage set-based through **D1**, passing `client: trx`.
4. Compute blockers, derive the eligible warehouse ids.
5. Conditional update on `warehouses` (`where status = 'AVAILABLE'`), then on `warehouse_doors`
   (`whereIn warehouse_id`, `where status = 'AVAILABLE'`).
6. Guard: the warehouse update's affected-row count must equal `eligibleIds.length`, otherwise throw
   so the transaction rolls back.

**Rationale**:

- This is exactly the shape delivered in `lucid_weighing_area_repository.ts#archiveAvailableMany`,
  including its comment explaining that `orderBy('id')` before `forUpdate()` is what keeps concurrent
  bulk archives and reactivations over overlapping id sets from deadlocking. Extending it to a second
  table only requires that **the table order is also fixed**: warehouses first, then doors, always.
  Every writer in this slice takes them in that order.
- FR-027 ("recorded in full or not at all: never a warehouse archived while one of its available
  doors remains available") is precisely a two-table atomicity requirement, so both writes must share
  the transaction and the guard.
- The door update needs no affected-rows guard of its own: the door rows are already locked in step 2,
  so nothing can change them between assessment and write. The guard exists on the warehouse update to
  catch a row that changed *before* the lock was granted.

**Asymmetry NOT inherited — revised during implementation.** This decision originally planned to keep
the delivered split: usage assessed in the use case on the single path, inside the repository
transaction on the bulk path. Implementing the cascade showed that split to be unsafe *here*. The
other site references do not cascade, so a single path that loses the race merely fails to archive
one record; a warehouse that loses the same race would archive a door a planned or active discharge
still holds — the exact outcome the issue's "without invalidating its doors" forbids. **Both paths
therefore assess usage inside the transaction, under the row locks that guard the write**, which is
also the only reading under which spec FR-008 ("assessed at the moment archival is submitted") is
literally true. `LucidWarehouseRepository` takes `SiteReferenceUsageChecker` exactly as
`LucidWeighingAreaRepository` already does; the use case keeps the business decision of mapping each
typed outcome onto its named exception. The delivered slices are untouched.

**Alternatives considered**:

- *Two transactions (warehouse, then doors)*: rejected outright — it is the exact failure FR-027
  forbids.
- *A database `ON UPDATE` trigger cascading the status*: rejected. It would put a business rule
  outside the use-case/repository boundary Principle V draws, and it could not record
  `archived_with_warehouse` provenance or respect the "leave already-archived doors untouched" rule
  without embedding more logic in SQL.

---

## D4 — Blocked reason stays the shared `IN_USE` code, with warehouse-specific wording

**Decision**: The bulk blocker union stays `'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED'`, matching
`BulkWeighingAreaLifecycleBlocker` and the web's `BulkLifecycleBlocker`. The single path throws
`WarehouseInUseException` (`E_WAREHOUSE_IN_USE`, 409) whose message names the cause: a door of this
warehouse is used by a planned or active discharge.

**Rationale**:

- Spec FR-036 requires the reason to *distinguish* not found, already archived, and door in use. A
  stable code plus a warehouse-specific message satisfies that; a new code would not add information.
- `BulkCheckpointLifecycleActions` already ships `BLOCKER_REASON_LABELS` keyed by that union. Reusing
  the codes lets warehouses reuse the extracted component (**D5**) without widening a type that four
  delivered features depend on.

**Response envelope, corrected during implementation**: the single archive returns
`{ data: { warehouse, archivedDoorCount } }`, not `{ data: {...warehouse}, archivedDoorCount }`. The
project's `ApiSerializer` wraps everything under `data` and its second `serialize` argument is a
container resolver, not a metadata bag, so a sibling of `data` was never available. Reporting what
the cascade actually did still matters (see **D9**), so the count travels inside the wrapper
alongside the warehouse.

**Deferred**: naming the *specific blocking door* in the bulk outcome. It would require carrying door
names in the blocker payload, and the administrator can already see which doors are in use by opening
the warehouse. Recorded here so `/speckit-tasks` does not silently invent it.

---

## D5 — Extract a kind-agnostic bulk lifecycle action bar; Checkpoints becomes a wrapper

**Decision**: Move `BulkCheckpointLifecycleActions` into
`components/resource-map/bulk-resource-lifecycle-actions.tsx` as `BulkResourceLifecycleActions`,
parameterized by explicit `singular`, `plural`, `description`, and `idPrefix` strings instead of a
`CheckpointKind`. `BulkCheckpointLifecycleActions` stays where it is and becomes a thin wrapper that
resolves those four strings from `CHECKPOINT_KIND_*_LABELS` and `BULK_LIFECYCLE_DESCRIPTIONS`.

**Rationale**:

- The component is *already* resource-agnostic where it matters: `submit` and `refresh` are
  injected, and its own doc comment says "this component holds no resource-specific knowledge". The
  only coupling left is that its labels are keyed by `CheckpointKind`, a union that cannot contain
  `WAREHOUSE`.
- FR-045 requires warehouses to meet the delivered interaction model rather than a second one.
  Copying the component would guarantee drift; extracting it guarantees the opposite.
- The wrapper keeps every delivered dock and weighing-area string byte-identical, so the existing
  `__tests__/bulk-archive/*` and `__tests__/bulk-reactivate*/*` suites remain the regression net for
  the extraction. If they pass unchanged, the extraction was behavior-preserving.

**Warehouse-specific description**: the warehouse dialog's description is computed, not constant —
it must state how many available doors will be archived (FR-023). See **D9**.

**Alternatives considered**:

- *Widen `CheckpointKind` to include `WAREHOUSE`*: rejected. A warehouse is not a checkpoint; it has
  a polygon, not a point, and it appears on a different map with different filters. The union would
  become a lie to make one component reusable.
- *Copy the component into `features/warehouses/`*: rejected — this is exactly what FR-045 forbids.

---

## D6 — Select mode on polygons reuses the delivered marker pattern

**Decision**: Add `selecting` to the warehouses route search schema
(`z.enum(['warehouses']).optional().catch(undefined)`), mirroring the Checkpoints
`selecting=docks|weighing-areas` param. In select mode:

- `WarehousePolygons` accepts optional `checkedIds` and `onToggleChecked`. When present, each
  warehouse's focus-marker button renders as a checkable control — `aria-pressed`, a
  `Select/Deselect …` label, `data-checked` — exactly as `CheckpointMarker` does when its `checked`
  prop is defined.
- The polygon paint gains a `checked` case alongside the existing `selected` / `isSearchMatch` cases,
  so a checked warehouse is visible as a polygon and not only as a marker.
- `WarehouseMap` gains a `SquareDashedMousePointer` `ControlButton` in its `MapControls`, matching
  `checkpoint-map.tsx`.
- Shift-clicking a polygon enters select mode and checks that warehouse, as shift-clicking a marker
  already does on Checkpoints.

**One existing behavior must change**: `WarehousePolygonLayer` currently returns `null` for the
focus marker of the selected warehouse (`if (warehouse.id === selectedId) return null`). In select
mode there is no details selection, so every marker must render — otherwise a warehouse would become
uncheckable simply because it had been opened first.

**Rationale**: the checkable-marker affordance, its accessible naming, and its keyboard semantics are
all delivered and tested in `checkpoint-marker.tsx`. Reproducing the same contract on the warehouse
marker is what FR-045 asks for, and it keeps the polygon layer's rendering concerns untouched.

---

## D7 — The selection keyboard shortcuts move to a shared hook

**Decision**: Extract two small hooks into `components/resource-map/use-bulk-selection-shortcuts.ts`:
`useSelectAllShortcut({ enabled, onSelectAll })` (Ctrl/Cmd+A, ignored while a text field has focus)
and `useClearSelectionShortcut({ enabled, onClear })` (Escape, active only while something is
checked). Both Checkpoints and Warehouses consume them; each page keeps its own logic for deciding
*what* "all" means.

**Rationale**:

- FR-045 names "the same selection shortcuts" explicitly. Two hand-written copies of a global
  `keydown` listener is how that requirement quietly stops being true.
- The delivered Checkpoints handler carries two non-obvious behaviors worth preserving exactly: it
  ignores the shortcut while typing in an `INPUT`/`TEXTAREA`/`contentEditable` so the browser's
  native select-all keeps working, and it binds Escape *only* while something is checked so a second
  Escape falls through to whatever else Escape does. Both live in the hook.
- Deliberately **not** extracted: the kind resolution, intent clamping, and layer-visibility fallback
  around Ctrl+A. Those are Checkpoints-specific (two kinds, two intents) and have no warehouse
  counterpart; moving them would be generalizing for its own sake.

`__tests__/bulk-archive/keyboard-shortcuts.test.tsx` and its reactivate twin are the regression net
for this extraction.

---

## D8 — The read contract must carry lifecycle context it currently drops

**Decision**: Extend `WarehouseTransformer` to emit `archivedAt`, `archivedByUserId`,
`archiveComment`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`, `createdAt`,
`updatedAt` on the warehouse, and the same set plus `archivedWithWarehouse` on each embedded door.

**Rationale**:

- Today it emits only `id`, `name`, `status`, `footprint`, and `doors{id,name,status,latitude,longitude}`.
  US1 scenario 5 requires the archive time, actor, and comment to be shown; US1 scenario 6 and FR-012
  require each door's own context to remain visible and demonstrably unchanged.
- `WeighingAreaTransformer` already exposes exactly this field set, so warehouses converge on the
  delivered shape rather than inventing one.
- The change is purely additive to a `GET` response, so `#207`'s consumers keep working. `#212`'s
  door DTO (`WarehouseDoorDto` in `features/warehouse-doors/types.ts`) widens with optional fields.

**Watch item for `/speckit-tasks`**: `apps/web/src/features/warehouses/types.ts` derives `WarehouseDto`
from `Route.Response<'warehouses.index'>`, so the web types follow automatically once the Tuyau
contract regenerates — but the MSW fixtures under `features/warehouses/__tests__/support/fixtures.ts`
and `features/warehouse-doors/__tests__/support/` are hand-written and must be widened by hand.

---

## D9 — The door count in the confirmation is computed client-side

**Decision**: The archive confirmation states how many available doors will be archived (FR-023),
computed from the already-loaded warehouse DTO:
`warehouse.doors.filter(door => door.status === 'AVAILABLE').length`. For a bulk submission it is the
sum across the checked warehouses. No new endpoint, no preflight request.

**Rationale**: `warehouses.index` already embeds every available and archived door under its
warehouse (`#212` FR-003), and `LucidWarehouseRepository.list()` already preloads `doors`. The number
is therefore free.

**Deliberate consequence, already specified**: the count shown is advisory. Spec's Edge Cases state
that the authoritative set is the one assessed at submission time, so a door that changed status
since the dialog opened does not invalidate the submission — the reported outcome reflects what
actually happened. The confirmation wording must not promise an exact number it cannot guarantee.

---

## D10 — `CONTEXT.md` must be amended in this delivery

**Decision**: Update the `Warehouse` entry in `CONTEXT.md` (line 152) to describe the cascade and the
door-usage blocking rule, replacing "it cannot be archived while it still has available warehouse
doors".

**Rationale**: Constitution Principle VI gives durable domain vocabulary exactly one home. The spec
records the amendment as an assumption; the plan makes it a task. Shipping the cascade while
`CONTEXT.md` still states the opposite rule would leave the canonical decision contradicting itself,
and the next agent to read `CONTEXT.md` would implement the wrong rule.

**Note on the divergence from `GH-220`**: `archive-a-transport-company` FR-003 enforces the
*non-cascading* form of this container rule — a transport company that still provides an available
truck is refused. Warehouses now deliberately differ. The two are not inconsistent as products (a
truck can be reassigned to another company; a door belongs permanently to one warehouse, per
`CONTEXT.md`'s "permanently belonging to one warehouse"), but the divergence is worth one sentence in
the amended entry so it reads as a decision rather than an oversight.

---

## D11 — What this slice deliberately does not build

Recorded so `/speckit-tasks` does not expand scope:

- **Independent door archival/reactivation** (`#215`, `#216`) — the cascade is the only way a door's
  status changes here. No door-level archive endpoint, no per-door archive control.
- **Warehouse reactivation** (`#211`) — `warehouse_lifecycle_blockers.ts` is written with the
  `expectedStatus: 'AVAILABLE' | 'ARCHIVED'` signature the weighing-area helper uses, so `#211`
  reuses it, but no reactivate path is built.
- **Warehouse create/update** (`#208`, `#209`) — no name-uniqueness or footprint validation work.
  Spec FR-022 (archival does not release the name) is satisfied structurally: the migration's
  `warehouses_name_unique` index on `LOWER(name)` is status-independent, so nothing needs doing.
- **Permanent deletion** — `warehouse_doors.warehouse_id` is `onDelete('RESTRICT')`, so the schema
  already forbids deleting a warehouse that has doors. FR-031 needs no new enforcement, only a test
  asserting no deletion path exists.
