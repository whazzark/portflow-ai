# Phase 0 Research: Plan the Discharge Truck Pool and Shift Subsets

All Technical Context entries are resolved and no `NEEDS CLARIFICATION` remains. The spec's
Clarifications section settled the four product questions:
- exclusivity is decided at start;
- withdrawal cascades to planned shifts;
- withdrawal leaves nothing behind;
- the planned shifts of an active discharge are out of scope.

This document records the design decisions the plan makes on top of them. It reuses every GH-53
convention it does not explicitly change: the refusal scheme, the lock discipline, the use-case
transaction, and the detail as the answer to every write.

## Decision 1 — One read and three writes, nested under the discharge

**Decision**: The discharges slice gains four routes, all authorized by `DischargePolicy.update`.

| Route name | Verb and path | Purpose | Success |
|---|---|---|---|
| `discharges.truck_pool.candidates` | `GET /api/v1/discharges/:dischargeId/truck-pool/candidates` | Trucks offered for reservation, each with the other discharges holding it | 200 |
| `discharges.truck_pool.store` | `POST /api/v1/discharges/:dischargeId/truck-pool` | Reserve one or several trucks | 200 |
| `discharges.truck_pool.withdraw` | `POST /api/v1/discharges/:dischargeId/truck-pool/withdrawals` | Withdraw one or several trucks, and remove them from planned shifts | 200 |
| `discharges.shift_trucks.update` | `PUT /api/v1/discharges/:dischargeId/shifts/:shiftId/trucks` | Replace a planned shift's truck selection | 200 |

The three writes answer with the whole discharge detail, as GH-53's writes do.

**Rationale**:
- **Nesting**: the pool and a shift's selection are decided on the discharge. Its status, its held
  trucks, and its planned shifts are all read under the discharge row lock (Decision 4), so the
  routes nest under the discharge, as the product lot routes do.
- **Batch bodies**: each write takes `truckIds`. FR-006, FR-013, and FR-020 require several trucks
  in one atomic change, and per-truck routes would make atomicity the client's problem.
- **Withdrawal verb**: withdrawal is a `POST` to a `withdrawals` sub-resource rather than a `DELETE`
  with a body. Bodies on `DELETE` are unevenly supported by proxies and HTTP clients, and the
  withdrawal is a command on a set.
- **Selection verb**: the shift selection is a `PUT` of the full set. The sheet edits the whole
  selection at once (Story 2), and a full set is idempotent by construction. The server computes the
  difference, so trucks that stay selected keep their row (FR-021).
- **Status codes**: every write answers `200`, not `201`. A reservation may reactivate a row or be a
  no-op (Decision 5), and the resource each write returns is the existing discharge.

**Alternatives considered**:
- Reusing `GET /trucks/available` with `GET /transport-companies/available` for the picker.
  Rejected: neither says which other discharges hold a truck (FR-009), and the truck view carries
  only the company identity, so the page would have to join three collections.
- `POST` and `DELETE /discharges/:dischargeId/shifts/:shiftId/trucks/:truckId`, one per truck.
  Rejected: Story 2 saves one selection atomically, and per-truck calls could leave a shift
  half-changed after a refusal.
- Routing the shift selection under a top-level `/shifts/:id`. Rejected: shift routes belong to
  GH-63 and GH-64, and every rule here is decided on the discharge.

## Decision 2 — The candidates read returns the whole offer, computed on the server

**Decision**:
- `discharges.truck_pool.candidates` returns every `AVAILABLE` truck of the site that the discharge
  does not hold, ordered by lower-cased registration then identity.
- Each item is
  `{ id, registration, transportCompany: { id, name }, otherHoldings: [{ dischargeId, vesselName, status }] }`.
- `otherHoldings` lists the planned and active discharges, other than this one, whose assignment
  for the truck has no `released_at`. They are ordered `ACTIVE` first, then by vessel name.
- There is no pagination and no server filter. The web narrows by registration and company name in
  the browser. It uses the shared `normalizeSearch` helper, as the trucks feature's search does,
  through a `candidateMatchesSearch` function in `truck-pool-selection.ts`.
  `truckMatchesSearch` itself takes the trucks feature's DTOs, so it is not imported.
- The read refuses `404 E_DISCHARGE_NOT_FOUND` and `409 E_DISCHARGE_NOT_PLANNED`, so the sheet
  never offers a reservation the write would refuse.

**Rationale**:
- **Volume**: the spec sizes the site at 300 trucks (SC-007). Every existing truck collection is
  unpaginated and filtered in the browser, and one response of 300 small rows fits the 2-second
  target.
- **Query cost**: the offer is one query for the trucks and their companies, plus one query for
  the holdings of those trucks. It never runs a query per truck.
- **Authorization**: the read is authorized for preparers only. Observers never open the sheet,
  and the holdings they may see appear on the detail (Decision 3).

**Alternatives considered**: Server-side search with pagination. Rejected: it adds a query
contract for a volume the browser filters instantly, and it would diverge from the trucks feature's
search behavior.

## Decision 3 — The detail marks held trucks that other discharges also hold

**Decision**: Every `truckPool` entry of the discharge detail gains `otherHoldings`, with the same
item shape and order as in Decision 2.
- It is filled only for entries that the discharge still holds, on a planned or active discharge.
- It is empty for released entries and for every entry of a closed discharge, which never holds
  trucks, as GH-58 decided.

`DischargeRepository.findDetail` loads these holdings in one additional query, restricted to the
trucks the discharge holds. It returns them beside the discharge as a `DischargeDetailRead`, which
`DischargeDetailTransformer` now takes. The `show` controller and GH-53's five write controllers
switch to that read; the shape they answer only gains the new field.

**Rationale**:
- Story 1 scenario 7 and FR-009 require the pool marker on the detail itself, visible to every
  role that reads it.
- One query keeps the detail within its current performance: a pool of 50 trucks costs one
  `IN (…)` query.
- **Why a read model**: attaching the holdings to the Lucid model through `$extras` would hide an
  untyped dependency inside the transformer. A small read model keeps it typed.

**Alternatives considered**: A separate `GET …/truck-pool/holdings` query. Rejected: the marker
belongs to the detail GH-58 already caches, and a second request would let the two drift apart
after a write.

## Decision 4 — The discharge row is the lock; reserved trucks are locked for share

**Decision**: Every write runs in one transaction owned by its use case, as in GH-53. Locks are
taken in a fixed order:

1. The discharge row, `FOR UPDATE`, through the existing `lockPlannedDischarge`. It refuses
   `404 E_DISCHARGE_NOT_FOUND` and `409 E_DISCHARGE_NOT_PLANNED`.
2. The trucks the write may newly use, ordered by identity and locked `FOR SHARE`, with their
   transport company read in the same statement. For a reservation, that is every requested truck.
   For a shift selection, it is the trucks being added. Withdrawal takes no truck lock, because
   ending usage cannot break a truck invariant.

The pool, the planned shifts, and the shift's current selection are read after the discharge lock.
They are not locked separately: every writer of those rows must lock the discharge first.

**Rationale**:
- **Archive and suspension**: a truck archive already locks its row `FOR UPDATE` and checks usage
  in the same transaction. A suspension locks its row `FOR UPDATE` and checks nothing. `FOR SHARE`
  conflicts with both, so a concurrent archive or suspension either:
  - waits for the reservation to commit, and an archive then sees the new usage; or
  - commits first, and the reservation then reads the truck as archived or suspended, and refuses
    it (FR-010).
- **Concurrent reservations**: share locks do not block each other. Two planned discharges
  reserving the same truck at once both succeed, as the first clarification requires.
- **Deadlocks**: the fixed order, discharge then trucks, prevents deadlocks between two writes of
  this slice.

**Consequence, in scope: transport company changes**. `UpdateTruckUseCase` checks
`findUsedByPlannedOrActiveDischarge` without a transaction, then writes a compare-and-swap on the
company. A reservation can commit between the two, and the truck then changes company while a
planned discharge holds it. That breaks the `CONTEXT.md` rule and makes the reservation's company
snapshot stale on day one.

This slice is the first real writer of `discharge_truck_assignments`. It therefore moves the
company change to the archive pattern: the truck row is locked `FOR UPDATE`, and usage is checked
through the same transaction client. This is the only change outside the discharge slice, as GH-53
Decision 5 did for docks and customers.

**Consequence, recorded for later slices**:
- GH-56, which activates the discharge, and GH-63, GH-64, GH-76, and GH-78, which write shifts or
  shift memberships, must lock the discharge row `FOR UPDATE` before they write.
- GH-56 must also lock the first shift's trucks before refusing one held by another active
  discharge.

The test database is SQLite, where Knex ignores row locks. As in the archive slices, these races
are guaranteed by design and review, not by an automated test.

## Decision 5 — Writes are set operations and naturally idempotent

**Decision**:

- **Reservation**: for each requested truck, in one savepoint:
  - already held by the discharge: nothing changes (FR-011);
  - with a released row for this discharge, left by a seed or a later runtime release: that row is
    updated. Its `released_at` becomes `null`, `reserved_at` becomes the command's instant, and the
    registration, company identity, and company name snapshots are captured again (FR-012). The
    `unique (discharge_id, truck_id)` index makes a second row impossible;
  - otherwise: a row is inserted with the snapshots and `reserved_at`.
- **Withdrawal**: in one savepoint:
  1. `shift_trucks` rows with `effective_to IS NULL`, for the requested trucks, in this discharge's
     `PLANNED` shifts, are deleted;
  2. `discharge_truck_assignments` rows for the requested trucks with `released_at IS NULL` are
     deleted.

  A requested truck the discharge does not hold is ignored, which covers a truck already withdrawn
  by someone else (Story 3 scenario 6). Released rows are never touched.
- **Shift selection**: the set of current rows (`effective_to IS NULL`) is compared with the
  requested set:
  - removed trucks have their rows deleted;
  - added trucks get a row with `effective_from` set to the command's instant and `effective_to`
    set to `null`;
  - trucks in both sets are untouched.
- Every accepted write bumps `discharges.updated_at`, as GH-53's `touchDischarge` does.

The same request sent twice produces the same state and the same answer, so no client-generated
identity is needed (FR-033).

**Rationale**:
- **Planned-shift deselection**: deleting the row follows the spec's assumption. A shift that has
  not started has no effective period, so recording an ended period would be invented history.
- **`effective_from` for planned selections**: it records when the selection was made, as the
  fixtures already do for the seeded planned shift.
- **Withdrawal**: deleting the reservation follows the third clarification. No released entry is
  ever produced before activation.
- **Idempotency**: the `unique (shift_id, truck_id, effective_from)` index and the set semantics
  make a replay harmless. GH-53 needed a client identity only because a creation is not a set
  operation.

**Alternatives considered**:
- Setting `released_at` on withdrawal. Rejected by the third clarification.
- Ending shift memberships with `effective_to` on deselection. Rejected by the spec's assumption,
  and because GH-58 would then show invented ended periods on a planned shift.

## Decision 6 — Refusals follow GH-53's scheme

**Decision**:

Values the user entered are refused with `422 E_VALIDATION_ERROR`, with `field` set to
`truckIds.N`:

| Rule | Write | When |
|---|---|---|
| Vine shape | all | `truckIds` missing, not an array, holding a non-UUID, duplicated, or outside its bounds (Decision 7) |
| `availableTruck` | reservation | The truck is unknown, `ARCHIVED`, or `SUSPENDED` |
| `heldTruck` | shift selection | The truck is not held by the discharge: unknown, withdrawn, or only released |
| `selectableTruck` | shift selection | The truck is `SUSPENDED` and not already selected for that shift |

State refusals:

| Status | Code | When |
|---|---|---|
| 404 | `E_DISCHARGE_NOT_FOUND` (exists) | Unknown or malformed discharge |
| 409 | `E_DISCHARGE_NOT_PLANNED` (exists) | Discharge active or closed, including the candidates read |
| 404 | `E_SHIFT_NOT_FOUND` (new) | Shift unknown, malformed, or not in that discharge |
| 409 | `E_SHIFT_NOT_PLANNED` (new) | Shift not `PLANNED` on a planned discharge |
| 403 | `E_AUTHORIZATION_FAILURE` | Observer |
| 401 | `E_UNAUTHORIZED_ACCESS` | Unauthenticated or not active |

A reservation is never refused because another discharge holds the truck (FR-008).

**Rationale**:
- A truck that became unavailable is still a refusal of the value the user chose, so it gets a
  `422` on the item, as GH-53 Decision 3 settled for docks and customers. The sheet then keeps the
  selection and names the truck (FR-030).
- `E_SHIFT_NOT_PLANNED` should be unreachable today: a shift only starts with its discharge
  (GH-56). It is still defended, because GH-64 and GH-65 will add other ways for a shift to change,
  and a factory can build the state. A removed shift is `404`, as a removed lot is.
- The decisions live in a pure `truck_pool_rules.ts` module that returns issues and write plans.
  Every rule is unit-tested at its edges without a database.

## Decision 7 — Request bounds

**Decision**:
- **Reservation and withdrawal**: `truckIds` is a distinct array of 1 to 500 UUIDs.
- **Shift selection**: `truckIds` is a distinct array of 0 to 500 UUIDs. An empty array clears the
  selection (FR-028).

Identities are compared lower-cased, as `lockableIds` already does.

**Rationale**: 500 covers selecting every candidate of a 300-truck site with headroom, and it keeps
a request from growing without bound. A duplicate in the request is almost certainly a client bug,
so it is refused rather than silently merged.

## Decision 8 — Eligibility and authorization reuse GH-53

**Decision**: The three writes and the candidates read authorize with `DischargePolicy.update`,
which requires active access and a role among operations lead, operations admin, and organization
admin. On the web, `canPrepareDischarges(user) && discharge.status === 'PLANNED'` gates every
action, as `canCorrect` already does on the detail page. No new policy method is added.

**Rationale**: The spec's actors are GH-53's (Assumptions). Another method with the same body
would add a name without a rule.

## Decision 9 — Web: pool actions, a picker sheet, a withdrawal dialog, and a selection sheet

**Decision**:

- **Truck pool card**. `DischargeTruckPoolCard` receives `canCorrect`. When it is true:
  - Its header offers `Add trucks`, which opens `AddTrucksSheet`, and so does its empty state.
  - Each held row gains a selection checkbox and a ghost `Withdraw` button, whose accessible name
    is `Withdraw {registration}`.
  - While at least one row is selected, the header also offers `Withdraw`, labelled with the count.
    Both open `WithdrawTrucksDialog`.
  - Every held row with `otherHoldings` shows a warning badge `Also held` and the holding vessels
    and statuses, for every role.
- **`AddTrucksSheet`**:
  - Content: an `InputSearch`, a checklist of candidates with a select-all over the filtered rows,
    each row's registration, transport company, and holding warning, and a `Reserve` submit.
  - It loads `dischargeQueries.truckCandidates(dischargeId)` when opened, with loading, error with
    retry, and empty states.
  - Selection state comes from the existing `useBulkSelection`, and the checklist follows
    `truck-list.tsx`.
- **`WithdrawTrucksDialog`**: a destructive `AlertDialog`.
  - It names the trucks, and every planned shift whose current selection contains one of them. The
    shifts are computed from the cached detail and identified by their planned period.
  - The confirm button is `Withdraw`.
- **Shifts card**. `DischargeShiftsCard` receives `canCorrect`. When it is true, each planned
  shift's Trucks group offers `Edit`, with accessible name `Edit trucks for shift {period}`. It
  opens `ShiftTrucksSheet`.
- **`ShiftTrucksSheet`**:
  - It lists the discharge's held trucks that are not suspended, plus any suspended truck already
    selected for that shift. A suspended truck keeps its marker and can only be unchecked.
  - It offers select-all and a `Save` submit.
  - It reads the cached detail and needs no other query.
  - With an empty pool, it shows an empty state pointing to `Add trucks`, and `Save` is disabled.
- **Mutations**. `useDischargeMutations` gains `reserveTrucks`, `withdrawTrucks`, and
  `selectShiftTrucks` with the existing `applyDetail` and `refreshAfterStaleRefusal`.
  `STALE_DETAIL_CODES` gains `E_SHIFT_NOT_FOUND` and `E_SHIFT_NOT_PLANNED`. A reservation or
  withdrawal also invalidates `truckCandidates` for that discharge.

Outcomes follow GH-53 Decision 11:
- **Success** closes, replaces the detail cache, and toasts.
- **A `422`** keeps the sheet open, and shows each refused truck's reason on its row, plus a
  summary alert.
- **A stale refusal** (`E_DISCHARGE_NOT_PLANNED`, `E_DISCHARGE_NOT_FOUND`, `E_SHIFT_NOT_FOUND`,
  `E_SHIFT_NOT_PLANNED`) closes, refetches the detail, and toasts.
- **Any other failure** keeps the selection and offers retry.

**Rationale**:
- **Why not `useAppForm`**: a checklist of identities is a selection, not a form with fields. The
  forms library has no multi-value field, and adding a generic checkbox group for one use would be
  speculative. The existing `useBulkSelection` and the trucks checklist already solve exactly this.
- **Refused trucks**: a `truckIds.N` path matches no mounted field, so it cannot use
  `applyValidationError`. A pure adapter, `truck-pool-refusals.ts`, maps each index back to the
  identity submitted at that position. It is unit-tested.
- **Labels**: they carry the action only. `Add trucks` names its resource, as creation actions do.
- **Placement**: the sheets and the dialog live beside the cards that open them, under
  `ui/detail/`, as GH-53's do.

**Alternatives considered**:
- A generic `CheckboxGroupField` in `libraries/forms`. Rejected for now: this is its only use.
- Opening the selection sheet from a shift-level page. Rejected: the detail is the planning
  surface GH-53 established.

## Decision 10 — Durable vocabulary changes in this slice

**Decision**: The PR amends `CONTEXT.md`:
- **Truck**: "can be assigned to at most one planned or active discharge" becomes "can be held by
  several planned discharges but by at most one active discharge, which the start confirmation
  enforces".
- **Discharge Truck Assignment**: a new sentence says that before the discharge starts, removing a
  truck withdraws the assignment entirely, while a release ends it with its history once active.
- **Truck Pool Withdrawal**: a new term, with `_Avoid_: release, unassignment` before activation.

It also refreshes the Notes of `checklists/requirements.md`, which still describe the defaults from
before clarification.

**Rationale**: Constitution principle VI puts domain vocabulary in `CONTEXT.md`, and the first
clarification changed a rule written there. No ADR is needed: the decisions extend existing lock
and refusal patterns.

## Decision 11 — No migration, no seed change, no activity log

**Decision**: No table, column, index, or seed changes, and no activity log entry is written.

**Rationale**:
- **Schema**: every column exists since GH-236. The `unique (discharge_id, truck_id)` index is
  handled by reactivating a released row (Decision 5). No index is needed for the holdings query:
  `discharge_truck_assignments (truck_id, released_at)` already exists.
- **Seed**: the seeded planned discharge `MV Atlantic Dawn` already holds a truck selected for its
  planned shift, and the active `MV Ocean Cedar` holds another. Together they exercise the
  warnings and the not-planned refusal.
- **Activity log**: GH-102 is not delivered (spec Assumptions).

## Decision 12 — Web: a tabbed detail with the open section in the address

**Decision**: The detail becomes a persistent header and four section tabs (Overview, Product lots,
Truck pool, Shifts), with the open section in `?tab=`. The detail route validates it as
`z.enum(DISCHARGE_DETAIL_TABS).optional().catch(undefined)`, and the page reads `overview` by
default. The list route drops `tab` in a search middleware. Inactive panels are not mounted. A
factual preparation summary joins the Overview of a planned discharge.

**Rationale**:
- This slice adds planning actions to two sections, and GH-54 and GH-56 add more; stacked cards no
  longer give a reading or an order of work. `apps/web/AGENTS.md` puts anything a user is halfway
  through in the URL.
- The router keeps search parameters no route declares, and every way back (back link, breadcrumb,
  list row links) copies the previous search. One middleware on the list route covers them all.

**Alternatives rejected**:
- **One child route per section**: more route files for the same state, and the loader and its
  pending, error, and not-found handling would be repeated or hoisted.
- **`.catch('overview')`**: with zod 4 it makes `tab` a required input on every link to the detail,
  and writes `?tab=overview` into links built by the router.
- **Replacing history on a tab change**: the list's status tabs push; the two would behave
  differently.
- **`keepMounted` panels**: hidden panels are skipped by role queries anyway, and a hidden sheet or
  selection has no reason to survive.
- **Stripping `tab` on each link**: four places to keep in step, and the next one added would leak.

## Resolved technical unknowns

| Unknown | Resolution |
|---|---|
| How to offer trucks with the discharges holding them | New candidates read in the discharges slice (Decisions 1 and 2) |
| Marker on the detail | `otherHoldings` on pool entries through a detail read model (Decision 3) |
| Race with truck archive, suspension, and company change | Discharge `FOR UPDATE`, trucks `FOR SHARE`; company change hardened (Decision 4) |
| `unique (discharge_id, truck_id)` versus re-reserving | Reactivate the released row; withdrawal deletes held rows (Decision 5) |
| `effective_from` for a planned shift selection | The command's instant; deselection deletes (Decision 5) |
| Duplicate submissions | Set semantics make every write idempotent (Decision 5) |
| Refusal shapes | GH-53 scheme; three item rules and two new shift codes (Decision 6) |
| Multi-select UI without a form field | `useBulkSelection` and a pure refusal adapter (Decision 9) |
| `CONTEXT.md` contradiction | Amended in this PR (Decision 10) |
| E2E coverage | None: `apps/web/e2e` is not set up. Feature tests go through the real router with MSW, as GH-53 did |
