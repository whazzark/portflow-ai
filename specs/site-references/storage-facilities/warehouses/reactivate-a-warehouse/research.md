# Research: Reactivate a Warehouse

**Feature**: `GH-211` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

Phase 0 output. Every decision below is grounded in code that exists on `master` today, in the
delivered Archive a Warehouse slice (`#210`), or in the delivered sibling reactivation slices. No
`NEEDS CLARIFICATION` remained in the Technical Context after this pass.

The headline finding: **`#210` was built with this slice in mind.** Three of the mechanisms #211
needs — the cascade marker column, the `ALREADY_AVAILABLE` blocker branch, and the `REACTIVATE`
bulk intent — already exist and carry comments naming `#211` as their consumer. The work is
narrower than the spec's 42 requirements suggest, and most risk sits in the two-table restore
transaction (D3, D4) rather than in new domain logic.

---

## D1 — Which doors a reactivation restores

**Decision**: Restore exactly the doors of the warehouse where
`status = 'ARCHIVED' AND archived_with_warehouse = true`. Leave every other door untouched.

**Rationale**: `#210` FR-013 exists solely to make this possible, and the column is already there:

```
apps/api/database/migrations/1785300000000_add_archived_with_warehouse_to_warehouse_doors.ts
  "Records why a door is archived: `true` when it was archived as part of its warehouse's
   archival, `false` when it was archived on its own. Reactivating a warehouse (#211) restores
   exactly the doors carrying `true`."
```

`WarehouseDoor.archivedWithWarehouse` (`apps/api/app/models/warehouse_door.ts:27`) normalizes the
SQLite integer to a real boolean on read, so the predicate behaves identically on PostgreSQL and on
the Japa test database. `WarehouseTransformer` (`warehouse_transformer.ts:38`) already ships the
flag to the client, so the web confirmation can count the restore set without a second request.

**Alternatives considered**:

- *Restore every archived door of the warehouse.* Rejected — it resurrects doors an administrator
  deliberately retired on their own, violating spec FR-008, and it makes Reactivate a Warehouse Door
  (`#216`) unable to express "this door stays archived".
- *Restore nothing; require doors to be reactivated separately.* Rejected — it leaves an available
  warehouse with zero available doors, which is operationally useless, and it contradicts FR-007.
- *Infer the set by comparing timestamps (`door.archivedAt === warehouse.archivedAt`).* Rejected —
  fragile across clock precision, and `#210` already rejected it by adding an explicit column.

---

## D2 — Clearing the marker on restore

**Decision**: Every door the reactivation restores is written back with
`archived_with_warehouse = false`.

**Rationale**: This is spec FR-009, and without it the marker decays into a lie across a second
lifecycle cycle. Concretely: archive warehouse W (door D1 cascades, marker `true`) → reactivate W
(D1 available, marker still `true`) → archive D1 **on its own** via `#216` → archive W → reactivate
W. On that last step D1 would be restored despite having been retired independently, which is
exactly the bug D1's column was introduced to prevent.

Setting it to `false` rather than `null` keeps the column `NOT NULL DEFAULT false` as the migration
declares it, so no schema change is needed. The value is only ever meaningful for an archived door;
`false` on an available door reads as "no cascade owns this door", which is true.

**Alternatives considered**:

- *Leave the marker set and rely on `status`.* Rejected — the predicate in D1 does read `status`
  too, so this "works" until the door is independently archived, at which point the stale `true`
  silently re-enters the restore set. A correctness trap with no upside.
- *Null the door's `archivedAt` on restore instead.* Rejected — it destroys the archive history the
  spec requires preserved (FR-015), and the doors panel already gates its provenance line on
  current status precisely so `archivedAt` can survive reactivation
  (`warehouse-doors-panel.tsx:82-90`).

---

## D3 — Transaction shape and lock order

**Decision**: Reuse the archival transaction shape exactly — `Warehouse.transaction`, lock
warehouses first with `.whereIn('id', ids).orderBy('id').forUpdate()`, then write warehouses, then
write doors. No usage query.

**Rationale**: Deadlock avoidance is the whole reason this matters. `archiveAvailable` /
`archiveAvailableMany` take warehouse row locks ordered by id, then touch `warehouse_doors`
(`lucid_warehouse_repository.ts:142-147` records this as a deliberate fixed lock order). If
reactivation touched doors before warehouses, a concurrent archive and reactivate over the same
warehouse would take the two tables in opposite orders and deadlock. Taking the same
warehouses-then-doors order makes an archive/reactivate race queue instead, which is what spec
FR-020 and the edge case "a door never ends available under an archived warehouse" require.

Reactivation needs **no** `SiteReferenceUsageChecker` call. An archived warehouse holds no door with
a current assignment in a Planned or Active Discharge by construction (spec Assumptions), so the
`IN_USE` branch is unreachable — which is why `findBulkBlockers` defaults `usedIds` to an empty set
(`warehouse_lifecycle_blockers.ts:25`). Dropping the door `forUpdate()` scan that
`findWarehousesWithDoorsInUse` performs also drops the only reason archival reads the doors table
before writing it.

**Alternatives considered**:

- *No transaction; two sequential updates.* Rejected — FR-021 forbids a warehouse ending available
  while its cascaded doors stay archived, and the sibling non-cascading slices only get away with a
  single unwrapped `UPDATE` (`lucid_weighing_area_repository.ts:127`) because they touch one table.
- *Lock doors as well as warehouses.* Rejected as unnecessary: the conditional `UPDATE` on doors
  takes its own row locks, and it runs after the warehouse locks are already held, so the ordering
  guarantee is intact without an extra scan.

---

## D4 — All-or-nothing guard

**Decision**: Mirror `applyArchival` — guard the **warehouse** update on its affected-row count
matching the eligible set and throw if it does not; return the door update's affected-row count
rather than asserting on it.

**Rationale**: `applyArchival` (`lucid_warehouse_repository.ts:196-238`) does exactly this, and the
asymmetry is correct rather than an oversight. The eligible warehouse count is known before the
write, so a mismatch proves a concurrent writer slipped between the lock and the update — an
integrity failure worth aborting the transaction for. The door count is *not* known in advance:
how many doors carry the marker is only discoverable by the update itself, so there is no expected
value to compare against. Returning it serves FR-018's confirmation and D5's response field.

**Alternatives considered**:

- *Pre-count the restorable doors and assert on the count.* Rejected — it adds a query whose result
  the `forUpdate()` on warehouses does not actually protect (doors are not locked, per D3), so the
  assertion would be racy in exactly the case it claims to catch.
- *Assert `affectedDoors > 0`.* Rejected — spec FR-010 and US1 scenario 4 make a zero-door restore a
  legitimate success, not a failure.

---

## D5 — Reporting how many doors came back

**Decision**: The single-warehouse endpoint returns
`{ warehouse, reactivatedDoorCount }`, mirroring archival's `{ warehouse, archivedDoorCount }`.
The bulk endpoint returns `{ updatedWarehouses, blockedWarehouses }` with no door count.

**Rationale**: `WarehousesController.archive` already breaks from the sibling single-archive
endpoints for this reason, and the comment says why: *"a warehouse archival also changes rows the
resource alone cannot account for. `archivedDoorCount` reports what the cascade actually did at
submission time, which is not always the count the confirmation showed"*
(`warehouses_controller.ts:59-63`). Reactivation has the same gap between the advisory count shown
in the dialog and the authoritative set restored at submission time, so it needs the same field.

Bulk gets no aggregate door count because the bulk toast already reports per-warehouse outcomes and
`BulkLifecycleOutcome` (`bulk-resource-lifecycle-actions.tsx:27-30`) has no slot for it. Adding one
would mean changing a shared component that four other resources depend on, for a number the
administrator has no action to take on.

**Alternatives considered**:

- *Return the restored door ids.* Rejected — the web already refetches the whole warehouse
  collection with doors embedded (`use-warehouse-mutations.ts:9-11`), so the ids add payload and a
  second source of truth for state the client is about to reload anyway.

---

## D6 — Blocker computation

**Decision**: Call the existing `findBulkBlockers(ids, warehousesById, 'ARCHIVED')` with no
`usedIds` argument. Write no new blocker logic.

**Rationale**: The helper was written for this call site. Its own doc comment says so: *"`expectedStatus`
and the `ALREADY_AVAILABLE` reason are unreachable from archival; they exist so warehouse
reactivation (#211) reuses this helper rather than writing a second one"*
(`warehouse_lifecycle_blockers.ts:19-21`). Passing `'ARCHIVED'` flips the branch to emit
`ALREADY_AVAILABLE`, and the omitted `usedIds` defaults to an empty set so `IN_USE` cannot fire —
matching spec FR-003 and the blocker set `{NOT_FOUND, ALREADY_AVAILABLE}`.

This means the bulk path needs **zero** new decision code; only the write differs.

---

## D7 — Authorization

**Decision**: Add `reactivate(user)` to `WarehousePolicy`, identical in body to `archive`.

**Rationale**: `WeighingAreaPolicy` carries a distinct `reactivate` ability with the same body
(`weighing_area_policy.ts:26-28`), and every delivered reactivation slice follows that shape. A
named ability per transition keeps the authorization surface readable and lets the two diverge
later without a migration of call sites. Spec FR-001/FR-028 require the same right for single and
bulk, which one shared method satisfies.

**Alternatives considered**:

- *Reuse `archive` for both directions.* Rejected — it reads wrong at the call site
  (`authorize('archive')` on a reactivate endpoint) and breaks the sibling convention for no gain.

---

## D8 — Single-warehouse UI: one component, two directions

**Decision**: Extend `WarehouseLifecycleActions` to render an Archive action for an available
warehouse and a Reactivate action for an archived one, and change `WarehouseDetails` to render the
footer for both statuses.

**Rationale**: Both gates currently hard-stop on status:
`WarehouseLifecycleActions` returns `null` when `status === 'ARCHIVED'`
(`warehouse-lifecycle-actions.tsx:48-50`), and `WarehouseDetails` renders the footer only when
`canArchive && warehouse.status === 'AVAILABLE'` (`warehouse-details.tsx:54`). Both must open up.

Keeping one component avoids duplicating the dialog, the comment field with its `maxLength={1000}`,
the stay-open-on-failure behavior, and the `parseApiError` detail extraction — all of which the
spec requires identically in both directions (FR-011, FR-012, FR-019). The `canArchive` prop is
renamed to `canManageLifecycle`, since it now gates two transitions.

**Alternatives considered**:

- *A separate `WarehouseReactivateAction` component.* Rejected — it duplicates ~80 lines of dialog
  for a variant that differs in three strings and one mutation.

---

## D9 — Bulk UI: intent derived from the selection

**Decision**: Transpose the Checkpoints intent model. Derive `selectionIntent` from the status of
the first checked warehouse, widen `checkableIds` to admit archived warehouses when the intent is
`REACTIVATE` (or when nothing is checked yet), and pass the derived intent to
`BulkResourceLifecycleActions`.

**Rationale**: `BulkResourceLifecycleActions` already accepts `intent: 'ARCHIVE' | 'REACTIVATE'` and
derives every label, tense, and toast from it (`bulk-resource-lifecycle-actions.tsx:77-81`) — `#210`
lifted it out of Checkpoints precisely so a second resource could drive it. The warehouses page
currently hard-codes `intent="ARCHIVE"` (`warehouses-page.tsx:370`) and filters `checkableIds` to
`status === 'AVAILABLE'` (`warehouses-page.tsx:87-91`); those two lines are the whole gap.

`checkpoints-page.tsx:145-152` is the reference implementation for deriving intent, including the
comment explaining why a selection is homogeneous by construction. Following it keeps FR-040's
"one interaction model" promise literal rather than approximate.

The existing effect that prunes checked ids when `checkableIds` changes
(`warehouses-page.tsx:106-116`) already delivers FR-038's "do not carry a selection into a scope
where it is no longer listed", and keeps search-hidden warehouses checked. It needs no change once
`checkableIds` is intent-aware.

**Alternatives considered**:

- *Derive intent from the `status` URL filter alone.* Rejected — the filter can be `all`, which
  determines nothing, and Checkpoints already found that the checked set is the reliable signal.
  The filter is used only as the tie-breaker for select-all, as `checkpoints-page.tsx:288` does.

---

## D10 — Advisory door count in the confirmation

**Decision**: Count doors with `status === 'ARCHIVED' && archivedWithWarehouse === true` for the
reactivation confirmation, and label it as what returns to service. Keep it advisory.

**Rationale**: Symmetric with `countAvailableDoors` / `countAvailableDoorsIn`
(`warehouse-lifecycle-adapter.ts:16-23`), whose comments already state the authoritative set is
assessed at submission time. The data is present in the embedded `doors` array, so no request is
needed. D5's `reactivatedDoorCount` is what the success toast reports, so a stale advisory count
never becomes a false claim about what happened.

---

## D11 — Doors panel needs no change

**Decision**: Leave `WarehouseDoorsPanel` alone.

**Rationale**: Verified during research. Its provenance line is already gated on
`door.status === 'ARCHIVED'` before reading `archivedWithWarehouse`, with a comment stating the
reason: *"reactivation leaves `archivedAt` in place, so an available door would otherwise still
claim it was archived"* (`warehouse-doors-panel.tsx:82-90`). A restored door therefore renders as
available with no stale archive line, satisfying spec FR-023 and US1 scenario 7 with zero edits.
This is worth recording because the spec makes it an explicit requirement, and a reader would
otherwise expect a task for it.

---

## D12 — `CONTEXT.md` amendment is part of this delivery

**Decision**: Extend the `Warehouse` entry in `CONTEXT.md` to state that reactivating a warehouse
restores exactly the doors archived with it and clears that record.

**Rationale**: Constitution Principle VI gives domain vocabulary a single home. `CONTEXT.md:152`
currently documents the forward direction in full — the cascade, the shared context, the marker —
but stops there. Delivering the reverse direction without documenting it leaves the canonical entry
describing half a lifecycle. `#210` set this precedent by amending the same entry as part of its own
delivery rather than deferring it.

---

## D13 — Migration: none required

**Decision**: No database migration in this slice.

**Rationale**: Confirmed against the schema. `warehouses` and `warehouse_doors` both already carry
`status`, `archived_at`, `archived_by_user_id`, `archive_comment`, `reactivated_at`,
`reactivated_by_user_id`, and `reactivation_comment` — the transformer reads all of them
(`warehouse_transformer.ts:17-19`, `:40-42`) and the web fixtures already populate them
(`__tests__/support/fixtures.ts:28-30`). `archived_with_warehouse` arrived with `#210`. Reactivation
writes only existing columns, so `apps/api/database/schema.ts` does not need regenerating either.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Archive/reactivate deadlock over the same warehouse | Low | Fixed lock order, warehouses before doors (D3); integration test with overlapping concurrent submissions |
| Stale cascade marker resurrects an independently archived door | Medium if D2 is skipped | FR-009 write, plus the explicit cycle test in SC-012 |
| Widening `checkableIds` lets a mixed-status selection form | Medium | Intent derivation makes the set homogeneous by construction (D9); dedicated selection-scope test |
| `canArchive` → `canManageLifecycle` rename misses a call site | Low | Typecheck catches it; only two call sites exist |
| Bulk toast reports reactivation with archival wording | Low | `BulkResourceLifecycleActions` derives wording from `intent`; covered by a bulk web test |
