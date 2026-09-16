# Phase 0 Research: Plan Warehouse Door and Checkpoint Assignments

All Technical Context entries are resolved and no `NEEDS CLARIFICATION` remains. The spec's
Clarifications section settled the three product questions: planned discharges only, shift doors
limited to doors assigned in the discharge, and doors used by another discharge accepted with an
indication. This document records the design decisions the plan makes on top of them, and builds
on GH-53's decisions rather than restating them.

## Decision 1 — Two change commands and one options query, nested under the discharge

**Decision**: The API gains three routes in the `discharges` slice.

| Route name | Verb and path | Purpose | Success |
|---|---|---|---|
| `discharges.planning_options` | `GET /api/v1/discharges/:id/planning-options` | Doors and weighing areas a preparer may choose, with each door's current assignments in other discharges | 200 |
| `discharges.product_lots.warehouse_doors` | `PATCH /api/v1/discharges/:dischargeId/product-lots/:id/warehouse-doors` | Assign and withdraw a lot's doors | 200 |
| `discharges.shifts.checkpoints` | `PATCH /api/v1/discharges/:dischargeId/shifts/:id/checkpoints` | Add and remove a planned shift's doors and weighing areas | 200 |

Both commands answer with the whole discharge detail, in the shape `discharges.show` already
returns. Every assignment and selection, current and ended, is already in that shape.

**Rationale**:
- Every rule is decided on the discharge: its status, a door's single current lot within it, and
  whether a planned shift still selects a door. The routes nest under the discharge whose row they
  lock, as GH-53 Decision 1 did for lots.
- `GET /warehouse-doors/available` returns a `warehouseId` but no warehouse name, and the
  warehouses collection is administration context. The detail already names a door's warehouse
  for every role, so the picker needs the same. The indication of FR-009 also needs each door's
  current assignments in other discharges, which only the discharge slice reads. One options
  query answers both, and GH-55 can add its trucks to it without another round trip.
- Answering with the detail lets the web replace its cache in one step, as GH-53 does.

**Alternatives considered**:
- Extending `GET /warehouse-doors/available` with warehouse names and discharge usage. Rejected: it
  would make a site-reference collection carry discharge data, and would change a response every
  role reads for a picker only preparers open.
- Reusing `GET /weighing-areas/available` beside a doors-only options query. Rejected: two
  preloads for one sheet. The options query returns the same available weighing areas.
- A top-level `/warehouse-door-assignments` resource. Rejected for the reason above: the discharge
  is the aggregate that decides.

## Decision 2 — Commands carry a change set, not the desired final set

**Decision**:
- The lot command's body is `{ assign: uuid[], withdraw: uuid[] }`.
- The shift command's body is
  `{ warehouseDoors: { add: uuid[], remove: uuid[] }, weighingAreas: { add: uuid[], remove: uuid[] } }`.

Each identity is applied to the current state under the discharge's lock:
- Assigning or adding a resource that is already current there changes nothing.
- Withdrawing or removing one that is not current there changes nothing.
- An identity listed twice, or in both lists of one pair, is refused with `422` before anything
  is read.
- A body whose lists are all empty answers `200` and changes nothing.

The web computes the change set as the difference between the current state it shows and the
user's choices.

**Rationale**:
- FR-018 forbids losing a change. With a final set, a user whose sheet was opened before a
  colleague added door C would withdraw C without ever seeing it. A change set only touches what
  this user changed.
- FR-017 needs repeated saves to record nothing twice. A change set is idempotent by construction:
  replaying it after it succeeded finds everything already applied.
- One pair of lists per resource kind keeps FR-010's single save for doors and weighing areas.

**Alternatives considered**:
- `PUT` with the final set of current doors. Rejected for the lost-update reason above.
- One request per door or area (`POST` and `DELETE` on each membership). Rejected: FR-016 makes a
  save atomic, and a sheet saving several resources would need several requests, any of which
  could fail alone.
- An optimistic version on the discharge. Rejected: no resource in the repository uses one, and a
  concurrent change to another lot would refuse an unrelated save.

## Decision 3 — Assigning a door held by another lot moves it at one instant

**Decision**: When `assign` names a door that is current on another lot of the same discharge, the
command ends that assignment and starts the new one with the same recorded instant. The command
first ends the old row, then inserts the new one. Nothing else in the response marks a move. The
web recognizes it in the response: an ended assignment of that door, on another lot, whose
`effectiveTo` equals the new assignment's `effectiveFrom`. The web names that lot in its success
toast.

**Rationale**:
- FR-007 requires a single current lot per door and tells the user which lot the door came from.
  Deriving the move from the detail keeps one response shape for every discharge write.
- The web cannot rely on the detail it showed before the save, because a colleague may have moved
  the door in the meantime. The response is authoritative.
- Ending before inserting keeps the partial unique index of Decision 7 satisfied at every
  statement.

## Decision 4 — Refusals follow GH-53's scheme

**Decision**: A refusal of a chosen value is `422 E_VALIDATION_ERROR`, with dotted paths into the
body. A refusal caused by the state of the discharge, lot, or shift is a `404` or `409` code.

| Status | Code or rule | Field | When |
|---|---|---|---|
| 422 | `distinct` (Vine), `notInBothLists` (validator) | `assign.N`, `withdraw.N`, `warehouseDoors.add.N`, … | An identity repeated, or in both lists of a pair |
| 422 | `availableWarehouseDoor` | `assign.N` | Door unknown, archived, or of an archived warehouse |
| 422 | `selectedByPlannedShift` | `withdraw.N` | Door current on this lot and selected by a planned shift of the discharge |
| 422 | `assignedWarehouseDoor` | `warehouseDoors.add.N` | Door not currently assigned to a lot of this discharge |
| 422 | `availableWeighingArea` | `weighingAreas.add.N` | Weighing area unknown or archived |
| 404 | `E_DISCHARGE_NOT_FOUND` | — | Unknown or malformed discharge |
| 404 | `E_PRODUCT_LOT_NOT_FOUND` | — | Lot unknown, malformed, or not in that discharge |
| 404 | `E_SHIFT_NOT_FOUND` (new) | — | Shift unknown, malformed, or not in that discharge |
| 409 | `E_DISCHARGE_NOT_PLANNED` | — | Discharge active or closed |
| 409 | `E_SHIFT_NOT_PLANNED` (new) | — | Shift active or completed |
| 409 | `E_DISCHARGE_PLANNING_CONFLICT` (new) | — | A partial unique index refused the write (Decision 7); only reachable where row locks are not honored |
| 403 | `E_AUTHORIZATION_FAILURE` | — | Observer |
| 401 | `E_UNAUTHORIZED_ACCESS` | — | Unauthenticated or not active |

`E_DISCHARGE_NOT_PLANNED`'s message changes from "Only a planned discharge can be corrected" to
"Only a planned discharge can be changed", which fits every writer. The code is unchanged.

**Rationale**:
- Every item is checked before anything is written, and all issues are reported together, so a
  sheet can mark several doors at once (FR-021).
- The `selectedByPlannedShift` message is generic. The web names the shifts from the refetched
  detail (Decision 9), so the API does not format dates in a zone it does not know (GH-53
  Decision 6).
- Within a planned discharge every shift is planned, because activation makes the first shift
  active in the same transaction. `E_SHIFT_NOT_PLANNED` is therefore reached only through a
  forged request or a later slice's state, and costs one comparison.

## Decision 5 — Lock order extends GH-53's: warehouses, doors, then weighing areas

**Decision**: Both commands run in one transaction owned by the use case (pattern B).
1. `lockPlannedDischarge` locks the discharge `FOR UPDATE` and requires it to be planned.
2. Lots, shifts, current assignments, and current selections are read without further locks. The
   discharge lock already serializes every writer of them (GH-53 Decision 5, GH-56 obligation).
3. **Lot command, doors in `assign` only**: their warehouses, then the doors, each ordered by
   identity and locked `FOR SHARE`, then their statuses are checked.
4. **Shift command, weighing areas in `add` only**: locked `FOR SHARE`, then checked. Doors in
   `add` are not locked: Decision 6 explains why.

The full order across the discharge slice becomes: discharge, docks, customers, users, warehouses,
warehouse doors, weighing areas. The comment on `DischargePreparationRepository` records it.

**Rationale**:
- A door's usage is its current lot assignment, and a weighing area's usage is its current shift
  selection (`LucidDischargeUsageRepository`). A row lock on the reference does not block an
  insert that refers to it, so the writer must lock explicitly. The warehouse door repository
  records that as an obligation on "whoever adds one", and this slice closes it.
- Door archive paths take the warehouse `FOR UPDATE` and then the door `FOR UPDATE`. The warehouse
  archive takes the warehouse `FOR UPDATE` and then updates its doors. A share lock on the
  warehouse and the door therefore makes each archive either wait for the assignment to commit and
  then see it as a usage, or commit first so that this command reads the archived status. Taking
  warehouses before doors matches their order, so they cannot deadlock.
- References being withdrawn or removed are not locked: ending a usage cannot break "no archive
  while in use".

**Consequence, in scope**: `ArchiveWeighingAreaUseCase` checks usage outside any transaction and
then runs an unguarded conditional update. That is the same window GH-53 closed for docks and
customers. `LucidWeighingAreaRepository.archiveAvailable` moves to the dock pattern: it locks the
row `FOR UPDATE`, checks usage through the transaction client, and updates in the same
transaction. The use case loses its pre-checks, and the existing weighing area archive tests pin
the unchanged outcomes. The single and bulk door and warehouse archives already decide under lock
and need no change beyond updating the two comments that described the missing writer.

## Decision 6 — A shift's doors are guarded through the lot assignment, not a lock of their own

**Decision**: The shift command checks that each door in `warehouseDoors.add` has a current
assignment to a lot of the same discharge, reading under the discharge lock. The lot command
refuses to withdraw a door that a planned shift of the discharge currently selects. Door rows are
not locked by the shift command.

**Rationale**:
- Both rules are decided on rows only the discharge lock's holders write, so they cannot race each
  other.
- A door with a current assignment in a planned discharge is in use, so it cannot be archived. A
  door selected by a planned shift always has that assignment, so it cannot be archived either,
  and no further lock is needed. The site-reference usage rule stays as it is.
- Moving a door to another lot of the same discharge (Decision 3) keeps it assigned in the
  discharge, so it never trips the rule.

**Alternatives considered**: Counting shift door selections as door usage in
`LucidDischargeUsageRepository`. Rejected: the invariant above already makes it redundant, and
changing the shared usage rule would reach every site-reference slice.

## Decision 7 — One instant per command, and partial unique indexes as the backstop

**Decision**:
- A command takes its recorded instant once, from the server clock, truncated to the whole second.
  Every row it starts gets that instant as `effective_from`, and every row it ends gets it as
  `effective_to`.
- If the latest `effective_from` or `effective_to` already recorded in the command's scope is at or
  after that instant, the instant becomes that time plus one second. The scope is the discharge's
  door assignments for the lot command, and the shift's selections for the shift command. This
  happens with two saves in the same second, or with clock skew.
- The adjustment keeps the existing `effective_from < effective_to` checks from turning into a
  `500`. It also keeps the existing unique index on
  `(discharge_id, warehouse_door_id, product_lot_id, effective_from)` from rejecting a door
  withdrawn and assigned again within one second.
- Whole seconds are the coarsest precision the two engines store: Lucid writes SQLite date-times as
  `yyyy-MM-dd HH:mm:ss`. A millisecond adjustment would be lost there.
- A migration adds three partial unique indexes, each restricted to rows where `effective_to` is
  null:
  - `warehouse_door_product_lot_assignments (discharge_id, warehouse_door_id)`
  - `shift_warehouse_doors (shift_id, warehouse_door_id)`
  - `shift_weighing_areas (shift_id, weighing_area_id)`
- A unique violation on any of them is mapped to a retryable `409 E_DISCHARGE_PLANNING_CONFLICT`
  (new), which the web treats as a stale detail.

**Rationale**:
- FR-008 and FR-013 date each period from the moment it is recorded, and Decision 3 needs a move
  to end and start at one instant.
- The discharge lock is the guarantee, but the test database is SQLite, where Knex ignores row
  locks (GH-53 Decision 5). The indexes make "one current lot per door within a discharge" and "no
  duplicated current selection" (FR-018, SC-004) hold in the database itself, and both engines
  support partial indexes.
- The index is per discharge, not per site, because the spec accepts a door current in several
  planned discharges (Clarifications, Q3).
- The GH-236 fixtures give each door at most one current assignment per discharge, and one current
  membership per shift, so the seed stays valid. A task runs `db:fresh` to confirm it.

**Alternatives considered**: No migration, relying on the lock alone as GH-53 did. Rejected: GH-53
added no invariant the existing indexes did not already back, while this slice introduces one.

## Decision 8 — The options query names other discharges but not their lots

**Decision**: `GET /discharges/:id/planning-options` is authorized by `DischargePolicy.update` and
answers `404` for an unknown discharge. It returns:
- `warehouseDoors`: every available door of an available warehouse, as `{ id, name, warehouse: { id, name }, otherDischargeAssignments }`, ordered by warehouse name, door name, and identity.
  `otherDischargeAssignments` lists the planned or active discharges other than this one where the
  door has a current assignment, as `{ discharge: { id, vesselName, status, expectedStartAt } }`,
  ordered by expected start.
- `weighingAreas`: every available weighing area, as `{ id, name }`, ordered by name and identity.

It does not filter by the discharge's status. The web only opens it from the actions of a planned
discharge.

**Rationale**:
- The indication of FR-009 names the other discharge. Its vessel name, status, and expected start
  are what the discharges list already shows every active role. The other discharge's customers and
  lots add nothing to the decision and stay out.
- Assignments current in this discharge are already in the detail, so they are not repeated here.
- `update` is the policy method every planning write uses. Observers never open a sheet, and a
  query they cannot use should not be open to them.

## Decision 9 — Sheets opened from the lot and shift cards

**Decision**:
- Each lot's `Warehouse doors` block gains an `Edit` action, whose accessible name is
  `Edit warehouse doors of {customer} · {product}`. It opens `LotWarehouseDoorsSheet`.
- The `Warehouse doors` and `Weighing areas` groups of each planned shift gain an `Edit` action.
  Both open `ShiftCheckpointsSheet`, which holds both lists and saves them together, scrolled to
  the group whose `Edit` was used.
- Actions render only for `canPrepareDischarges(user)` on a `PLANNED` discharge, and for shifts
  only on `PLANNED` shifts. `DischargeShiftsCard` gains the `canCorrect` prop the lots card already
  takes.
- Choices are a new registered `CheckboxGroupField`. Doors are grouped under their warehouse, and
  both lists have an `InputSearch` filter.
- In the lot sheet, a door current on another lot of this discharge shows `Assigned to
  {customer} · {product}`. A door with other discharge assignments shows `Also assigned to
  {vessel} ({status}, expected {date})`. A door currently selected by planned shifts shows
  `Selected for shift {period}`, and unchecking it is refused on submit, mirroring
  `selectedByPlannedShift`.
- In the shift sheet, only doors currently assigned to a lot of the discharge are offered, each
  with its lot. When none are, the sheet explains that doors are assigned to product lots first.
- The shift groups show `None currently selected` when every selection has ended, mirroring
  `lotDoorNotice` (FR-015).

Sheets are not reflected in the address, as GH-53 decided for its correction sheets.

**Superseded (sheet redesign)**: the lot sheet became a two-column `Warehouse doors` dialog
(available doors beside the lot's, moved across with `Add` and `Remove`), without the removed
`CheckboxGroupField`. A door a planned shift uses is locked from the start, with a link to that
shift.
`contracts/ui-state.md` is the reference.

**Outcomes** follow GH-53 Decision 11, extended:

| Outcome | Response in the sheet |
|---|---|
| Success | The sheet closes, the detail cache takes the response, and a toast appears. Moves add `Taken from {lot}` (Decision 3) |
| `422` | The sheet stays open, and each offending identity is resolved through the submitted change set to its door or area label and shown on the field. For `selectedByPlannedShift`, the detail is refetched and the shifts are named from it |
| `E_DISCHARGE_NOT_PLANNED`, `E_DISCHARGE_NOT_FOUND`, `E_PRODUCT_LOT_NOT_FOUND`, `E_SHIFT_NOT_FOUND`, `E_SHIFT_NOT_PLANNED`, `E_DISCHARGE_PLANNING_CONFLICT` | The sheet closes, the detail is refetched, and a toast gives the reason |
| Other failure | The sheet stays open with its choices kept, and a toast gives the API message |

**Rationale**:
- Button labels carry the action only. The accessible name disambiguates the several `Edit`
  buttons on a lot for assistive technology and for tests.
- An `Edit` on each group rather than on the shift header leaves the header free for GH-64's
  replanning and GH-66's reassignment. It also lets GH-55 add its own `Edit` on the `Trucks` group
  without touching this slice's sheet.
- A checkbox list shows every chosen door at once, which a combobox would hide. The repository has
  no multi-select combobox, and a site's doors fit a filtered list.

## Decision 10 — No activity log, no seed change

**Decision**: No Activity Log Entry is written, and no seed changes. The only schema change is
Decision 7's indexes.

**Rationale**: GH-102 depends on GH-53 and does not exist yet (spec Assumptions). The effective
periods on the rows themselves keep every change readable (FR-008, FR-013), and GH-58's detail
already shows them.

## Resolved technical unknowns

| Unknown | Resolution |
|---|---|
| Door and area choices with warehouse names for an operations lead | `discharges.planning_options` (Decisions 1 and 8) |
| Lost updates between two users planning one discharge | Change sets applied under the discharge lock (Decision 2) |
| Moving a door between lots and telling the user | One instant per command; move derived from the response (Decisions 3 and 7) |
| Error shape | GH-53's `422` field paths, plus two new `404`/`409` codes (Decision 4) |
| Race with door, warehouse, and weighing area archives | Warehouses, doors, and areas locked `FOR SHARE`; single weighing area archive hardened (Decision 5) |
| Shift doors guarded against archival | Through the lot assignment invariant (Decision 6) |
| Database backstop against double current rows | Partial unique indexes (Decision 7) |
| Where the actions live | `Edit` on each lot's doors and each planned shift's checkpoint groups, opening sheets (Decision 9) |
| E2E coverage | None: `apps/web/e2e` is not set up. Feature tests go through the real router with MSW, as GH-53 did |
