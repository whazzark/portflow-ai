# Phase 0 Research: Reactivate a Warehouse Door

**Feature**: `GH-216` | **Spec**: [spec.md](./spec.md) | **Date**: 2026-08-27

The Technical Context carries no `NEEDS CLARIFICATION`: every runtime, dependency, and test seam is
already fixed by the three delivered warehouse-door slices. What this phase resolves instead is the
handful of design questions the spec leaves open on purpose, plus the one question no sibling
reactivation has had to answer — how a door tells an administrator *which* lifecycle is in its way.

---

## R1 — HTTP shape: `POST /api/v1/warehouse-doors/:id/reactivate`

**Decision**: One new route, `POST /api/v1/warehouse-doors/:id/reactivate`, named
`warehouse_doors.reactivate`, with an optional `comment` body and a `200` carrying the reactivated
door.

**Rationale**: Every site reference already reactivates this way — `docks`, `weighing_areas`,
`trucks`, `customers`, `transport_companies`, `warehouses` all expose `POST /:id/reactivate`. A door
has no reason to differ, and an administrator's mental model of "lifecycle transitions are POSTs to
a named sub-path" stays intact.

Two hazards the warehouse routes carry do **not** apply here:

- **No route-ordering guard is needed.** `start/routes.ts:121` and `:124` declare `/warehouses/archive`
  and `/warehouses/reactivate` *before* `/:id/...` so the collection routes are not swallowed as
  `:id = 'archive'`. This slice adds no collection route (R2), so `/:id/reactivate` can be appended
  after `PATCH /:id` with no ordering constraint. The existing `GET /warehouse-doors/available` is a
  different verb on a different path and cannot collide.
- **No `id` shape validation.** Following #213 and #214, the path parameter is left unvalidated: a
  malformed identifier is `E_WAREHOUSE_DOOR_NOT_FOUND` for the client, never a Postgres `22P02`
  turned into a 500. `isUuid` in the repository is what makes that true.

**Alternatives considered**:

- `PATCH /warehouse-doors/:id` with `{ status: 'AVAILABLE' }` — rejected. #214 FR-003 puts the
  lifecycle status deliberately out of reach of the update payload, and the validator refuses it. A
  transition that carries an actor, a time, and a comment is not a field correction.
- `POST /warehouses/:id/doors/:doorId/reactivate` — rejected. Doors are addressed by their own id
  everywhere else in the API; nesting the route would be the only place the containing warehouse
  appears in a door path.

---

## R2 — No bulk endpoint, and no bulk anything

**Decision**: This slice adds a single-door endpoint only. No `POST /warehouse-doors/reactivate`,
no selection state, no `BulkLifecycleOutcome`, no `bulk-resource-lifecycle-actions` wiring.

**Rationale**: `spec.md` Assumptions settles the product question — doors are consulted as a list
scoped to one selected warehouse, whose per-row menu is the surface a lifecycle action lands on, and
doors already come back in bulk through their warehouse (#211). The plan only records the
consequences: `WarehouseDoorRepository` gains one method taking one id, the result type is a single
discriminated union rather than an `updated`/`blocked` pair, and no blocker-reason label map is
needed on the web because a refusal is a toast about one named door, not a list.

**Alternatives considered**: mirroring the warehouse's `reactivateArchivedMany` for symmetry —
rejected. It would ship an endpoint with no caller, and the bulk machinery on the web
(`bulk-resource-lifecycle-actions.tsx`) is driven by map multi-selection, which the Doors panel does
not have.

---

## R3 — The blocker set, and the one exception to the "the warehouse's code names it" rule

**Decision**: Four refusal outcomes:

| Result kind | Exception | Status | Meaning |
|---|---|---|---|
| `DOOR_NOT_FOUND` | `WarehouseDoorNotFoundException` *(exists)* | 404 | No such door, or a malformed id |
| `ALREADY_AVAILABLE` | `WarehouseDoorAlreadyAvailableException` *(new)* | 409 | The door is already in service |
| `WAREHOUSE_ARCHIVED` | `WarehouseDoorArchivedWithWarehouseException` *(new)* | 409 | It comes back with its warehouse |
| `WAREHOUSE_NOT_FOUND` | `WarehouseNotFoundException` *(reused)* | 404 | The warehouse vanished mid-request |

**Rationale**: The spec's clarification collapses what looked like two refusals into one. Archiving
a warehouse takes **every** door it holds and reactivating it gives every one of them back, so an
archived warehouse holds no door archived on its own: the refusal is always "reactivate the
warehouse, **and the door returns with it**" — one step, never two.

That single remedy is why `WAREHOUSE_ARCHIVED` maps to a *door* exception here rather than to the
reused `E_WAREHOUSE_ARCHIVED`, which is the one deliberate exception to the rule
`warehouse_door_exceptions.ts` states at the top of the file. `E_WAREHOUSE_ARCHIVED` carries
"Reactivate the warehouse first", written for a write that must then be resubmitted; on this path
that second submission does not exist, and telling the administrator to make it would be wrong.
`WAREHOUSE_NOT_FOUND` keeps reusing the warehouse's own code, where the rule applies unchanged.

**Alternatives considered**: a single `E_WAREHOUSE_DOOR_NOT_REACTIVATABLE` carrying a reason string —
rejected. The codebase discriminates by exception code everywhere, and a reason string would be the
only place a client has to parse a payload to know what happened.

---

## R4 — Phrasing the refusal, once the guarded lock has missed

**Decision**: The disambiguation happens in the *fallback* branch, after the guarded warehouse lock
misses, by re-reading both rows:

```
lock warehouse WHERE id = door.warehouseId AND status = 'AVAILABLE'  → miss
  re-read door
    gone                       → DOOR_NOT_FOUND
    status = AVAILABLE         → ALREADY_AVAILABLE
  re-read warehouse
    gone or AVAILABLE          → WAREHOUSE_NOT_FOUND   (retryable; see below)
    archived                   → WAREHOUSE_ARCHIVED
```

**Rationale**: The lock order is the warehouse's first, as `create` and `updateAvailable` both take
it, and that order decides the whole refusal set: an archived warehouse fires the warehouse guard,
and there is nothing further to distinguish, because every archived door under it was archived with
it. Deciding the phrasing in the fallback costs nothing: the branch already re-reads the warehouse to
tell "gone" from "archived" (the pattern `create` established at
`lucid_warehouse_door_repository.ts:76` and `updateAvailable` repeats at `:164`), and the door
pre-read the lock ordering needs is already in hand.

The re-read of the door is an **addition** to the sibling pattern, and it earns its place: without
it, a warehouse reactivated in the window between the failed lock and the fallback read would answer
`WAREHOUSE_NOT_FOUND` for a door that is, by then, available — the cascade having restored it. With
it, the administrator gets `ALREADY_AVAILABLE`, which is both true and actionable.

`WAREHOUSE_NOT_FOUND` for a warehouse that has since become available is kept as-is, following the
comment #213 wrote for the same window: "reactivate it first" is guidance the administrator cannot
act on, whereas a retry resolves it.

**Alternatives considered**:

- Keeping a per-door provenance marker so the two archived-warehouse refusals could still be told
  apart — rejected, and its column dropped (R5). With the cascade taking every door and the restore
  giving every one back, the marker has no state left to record: it would be `true` on exactly the
  rows whose warehouse is archived.
- Locking the door before the warehouse — rejected. It inverts the warehouse-then-door lock order
  that `create`, `updateAvailable`, and #210's cascade all share, and would let a concurrent
  archival deadlock against a reactivation.

---

## R5 — The guarded write, and what it does not write

**Decision**:

```
UPDATE warehouse_doors
   SET status = 'AVAILABLE', reactivated_at = :at, reactivated_by_user_id = :actor,
       reactivation_comment = :comment, updated_at = :at
 WHERE id = :id AND status = 'ARCHIVED'
```

Zero affected rows falls into the same fallback disambiguation as R4.

**Rationale**: The payload is `applyReactivation`'s (`lucid_warehouse_repository.ts:451`), and the
differences are all deliberate:

- **`updated_at` advances to `reactivated_at`**, exactly as the warehouse cascade does. A
  query-builder update bypasses Lucid's timestamp hooks, so it must be written explicitly — the same
  trap `updateAvailable` documents at `:151`.
- **The archive context is preserved**, not nulled. FR-013 requires it, and #210's own reactivation
  leaves it in place; the panel and any future detail surface read the two directions side by side.
- **`archived_with_warehouse` is dropped, not written.** The clarification leaves it with nothing to
  record: the cascade takes every door and the restore gives every one back, so the marker would be
  `true` on exactly the rows whose warehouse is archived — a fact the warehouse row already carries.
  A migration removes the column, and `WarehouseTransformer`, the model, the factory, and the web
  DTO lose the member with it.

The `WHERE` clause carrying the status, under the warehouse lock, is what makes the whole
eligibility decision atomic: a door archived by #215 a microsecond earlier, or restored by a
warehouse reactivation a microsecond earlier, changes the affected-row count rather than slipping
through.

**Alternatives considered**: reading the door under `FOR UPDATE` and deciding in TypeScript —
rejected. It is a second lock for a decision one guarded `UPDATE` already makes atomically, and it
would need the same fallback re-read anyway to phrase the refusal.

---

## R6 — No migration, and no footprint on the lock

**Decision**: One migration, and it only **drops** a column: `archived_with_warehouse` (R5). No
column is added. The locked warehouse read drops `.preload('footprintPoints')`.

**Rationale**: `warehouse_doors` has carried `status`, `archived_at`, `archived_by_user_id`,
`archive_comment`, `reactivated_at`, `reactivated_by_user_id`, and `reactivation_comment` since #210
(`database/schema.ts:377`). This slice writes columns that already exist and removes the one the
clarification leaves empty of meaning, along with the model's boolean normalizer that existed only
for it.

The drop is written as raw `ALTER TABLE … DROP COLUMN`, identical on both dialects, rather than
through `table.dropColumn`: on SQLite knex rebuilds the whole table for a drop, and the rebuild's
`DROP TABLE` is refused by the children of `warehouse_doors` (`shift_warehouse_doors`,
`warehouse_door_product_lot_assignments`) — the same class of failure `#253` hit and
`1785500000000_add_user_password_renewal.ts` records.

Dropping the footprint preload is small but worth stating, because `create` and `updateAvailable`
both keep it: reactivation asks no containment question. #209 refuses any footprint reshape that
would leave an existing door outside the new outline **whatever that door's lifecycle status**
(`update_warehouse_use_case.ts:24`), so a door's stored position is still inside its warehouse when
it returns to service. Re-validating would be re-deciding a rule another slice already guarantees.

---

## R7 — Policy, validator, and the rest of the API surface

**Decision**: `WarehouseDoorPolicy.reactivate` returns `ORGANIZATION_ADMIN || OPERATIONS_ADMIN`,
identical to `create` and `update`. `reactivateWarehouseDoorValidator = vine.create({ comment:
lifecycleComment() })`, reusing `#shared/validators/lifecycle_validator`.

**Rationale**: FR-001 names the same warehouse-door management permission the two delivered write
slices use, and `lifecycleComment()` is the single home of the optional-trimmed-1000-character rule
every site reference shares (FR-010, FR-011). Nothing here is new; the value of recording it is that
`/speckit-tasks` must not invent a door-specific comment rule.

The use case trims with `input.comment?.trim() || null`, the exact expression
`ReactivateWarehouseUseCase` uses, which collapses `undefined`, `''`, and whitespace-only to `null`
in one step — FR-010's three cases in one line.

---

## R8 — Web: one lifecycle module, mirroring `truck-lifecycle.tsx`

**Decision**: A new `features/warehouse-doors/warehouse-door-lifecycle.tsx` exporting
`WAREHOUSE_DOOR_SINGULAR`, `warehouseDoorLifecycleActions(door, warehouseStatus)`,
`useWarehouseDoorLifecycleConfig(door)`, and `WarehouseDoorLifecycleDialog`.
`ResourceRowActions` and `ResourceLifecycleDialog` are consumed **unchanged**.

**Rationale**: `truck-lifecycle.tsx` is the line-for-line precedent, and `truck-row-actions.tsx`
shows the composition: `actions` from a status function, `renderDialog` mounting the feature's
dialog so the mutation hooks run only while a confirmation is open. `ResourceRowActions`'s prop type
is a discriminated union whose second arm — non-empty `actions` plus `renderDialog` — is exactly
what this slice supplies, so #214's "the menu exists now so #215 and #216 arrive as entries beside
`Edit`" is honoured with no change to the shared component.

`ResourceLifecycleActions` (the detail-pane footer) is **not** used: doors have no detail pane, and
#212 FR-004a forbids introducing one.

**Alternatives considered**: putting the config inline in `warehouse-door-row-actions.tsx` — rejected.
Every other resource keeps its lifecycle wiring in a `*-lifecycle.tsx` module, and #215 will need
the same module for `Archive`.

---

## R9 — Client-side eligibility: absent, not disabled

**Decision**:

```ts
warehouseDoorLifecycleActions(door, warehouseStatus): LifecycleAction[]
  → ['reactivate']  when door.status === 'ARCHIVED'
                     && warehouseStatus === 'AVAILABLE'
  → []              otherwise
```

**Rationale**: It mirrors the two server conditions exactly (FR-003, FR-024), and it re-uses the
existing `editable` gate's shape in `warehouse-door-row-actions.tsx`, which already reads both the
door's and the warehouse's status. When the array is empty and `Edit` is unavailable,
`ResourceRowActions` renders nothing at all — the "absent, not disabled" rule the spec's Assumptions
records for a door of an archived warehouse. The row's own provenance line, "Archived with this
warehouse" — itself derived from the warehouse's status — is what explains the absence.

The API stays authoritative: the client gate is a courtesy, and every refusal path is exercised by
the integration tests regardless of what the menu offers.

---

## R10 — Showing the reactivation on a row, symmetric with the archive line

**Decision**: `warehouse-doors-panel.tsx` gains a line on `AVAILABLE` rows carrying `reactivatedAt`:

```
Reactivated · 27/08/2026 14:20 · Back in service after works
```

mirroring the existing archived-row line, and gated on the current status the same way.

**Rationale**: US1 scenario 2 requires the comment to be visible in the door's lifecycle context, and
there is no door detail pane to put it in. The archived line is already gated on
`door.status === 'ARCHIVED'` precisely because reactivation leaves `archivedAt` in place — the
comment at `warehouse-doors-panel.tsx:110` says so. The symmetric line completes that reasoning: an
archived door that was reactivated once before would otherwise show its archive context and hide the
reactivation that preceded the re-archival.

The actor is **not** rendered, exactly as the archive line does not render it: the door objects
embedded by `WarehouseTransformer` expose `reactivatedByUserId`, not a resolved user, and resolving
it would widen a read contract three consultation surfaces depend on. The actor is recorded and
verified server-side (FR-009, SC-002).

**Alternatives considered**: `ResourceLifecycleSummary` — rejected. It is a detail-pane block with
headings, separators, and a definition list; a door row is a two-line card inside a scrollable
panel.

---

## R11 — What happens to the tab and the selection after a success

**Decision**: Neither is touched. The reactivated door leaves the Archived tab and appears in the
Available tab, both counts move, and the toast is the confirmation. The administrator stays where
they were.

**Rationale**: An administrator reactivating doors is usually working through a batch of archived
ones. Auto-switching to the Available tab to "show the result" would move them away from the list
they are still working on, and would do it once per door. The toast already names what happened
(`Warehouse door reactivated`), and the two tab counts change in view.

This also matches how the delivered row menus behave elsewhere: archiving a truck from the Available
tab lets it leave that tab rather than following it.

**Alternatives considered**: clearing `selectedDoorId` when it names the reactivated door — rejected
as unnecessary. The door still exists and its marker is still on the map, now drawn with the
available styling; the highlight remains meaningful.

---

## R12 — Mutation and cache invalidation

**Decision**: `useWarehouseDoorMutations` gains `reactivate`, invalidating
`warehouseQueries.list()` exactly as `create` and `update` do. The `ResourceLifecycleConfig.refresh`
member points at that same invalidation.

**Rationale**: Doors are embedded under their warehouse in the warehouse collection, so that one
query is the whole refresh — the hook's existing comment states it. `refresh` matters as much on the
**failure** path as on the success path: `ResourceLifecycleDialog` calls it inside its `catch`
because a refusal usually means the authoritative state has moved on since the view loaded, which is
precisely the `ALREADY_AVAILABLE` and `WAREHOUSE_ARCHIVED` races this slice must survive.

`GET /warehouse-doors/available` needs no invalidation from here: no web surface consumes it yet.

---

## Consolidated: nothing left unresolved

No `NEEDS CLARIFICATION` markers entered Phase 0 and none leave it. The two product questions raised
during specification — whether to ship bulk, and whether the confirmation names the containing
warehouse — are settled in `spec.md` Assumptions and consumed here as given.
