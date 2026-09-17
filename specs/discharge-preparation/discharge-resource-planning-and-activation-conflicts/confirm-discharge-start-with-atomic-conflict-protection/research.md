# Phase 0 Research: Confirm Discharge Start With Conflict Protection and Handling

All Technical Context entries are resolved and no `NEEDS CLARIFICATION` remains. The spec's
clarification settled the only product question: every product lot needs a current warehouse door.
This document records the design decisions the plan makes on top of the spec, building on GH-53,
GH-54, and GH-55's decisions rather than restating them.

Three spec statements were corrected while planning, because they did not match the delivered
product. Each correction is recorded in the spec itself:
- A discharge has no business identifier. A conflict names the other discharge by its vessel name
  and leads to it (FR-022).
- User Story 3 scenario 5 refused the start for a suspended first-shift truck, which contradicted
  the edge case and FR-012. A suspended truck now only fails to count as usable.
- User Story 1 scenario 5 promised a "held by an active discharge" indication wherever a resource is
  offered. The product names other holders for trucks (GH-55) and doors (GH-54), not docks. The
  scenario now relies on those indications, whose status turns `ACTIVE`.

## Decision 1 — One check query and one start command, nested under the discharge

**Decision**: The API gains two routes in the `discharges` slice.

| Route name | Verb and path | Purpose | Success |
|---|---|---|---|
| `discharges.start_check` | `GET /api/v1/discharges/:id/start-check` | The shift that would start and every problem known now, without changing anything | 200 |
| `discharges.start` | `POST /api/v1/discharges/:id/start` | Check under lock and start the discharge and its first shift | 200 with the detail |

Both are authorized by a new `DischargePolicy.start` ability, with the same predicate as `update`
(`isEligibleShiftResponsible`). Both answer `404 E_DISCHARGE_NOT_FOUND` and
`409 E_DISCHARGE_NOT_PLANNED`. The command answers a refused start with
`409 E_DISCHARGE_START_REFUSED` carrying the shift and the problem list in `meta.shiftId` and
`meta.problems`.

**Rationale**:
- The review needs the problems before the user confirms (FR-005), and some of them, such as the
  conflicts with other active discharges, are not in the detail. A read that runs the command's own
  rules on unlocked reads gives the review the same answer the command would give now.
- A separate ability keeps the start authorizable on its own once the product narrows it, while its
  predicate stays the preparers' today (spec Assumptions).
- `POST` on a named action follows the "named REST capabilities" decision of the parent roadmap
  and GH-55's `POST /truck-pool/withdrawals`.

**Alternatives considered**:
- Computing the review's problems in the web from the detail and the planning options. Rejected:
  the dock has no holder read, and the rules would exist twice.
- A `PATCH /discharges/:id` with `{ status: 'ACTIVE' }`. Rejected: the start is not an edit, and
  the identity correction already owns that route.
- A dry-run flag on the command. Rejected: a `POST` that does not write is surprising, and the
  review would need a body just to read.

## Decision 2 — One pure rules module decides both the check and the start

**Decision**: `app/discharges/start/discharge_start_rules.ts` exports
`evaluateDischargeStart(state): { shiftId: string | null; problems: StartProblem[] }`. `state` is a
plain snapshot:
- the lots, with their customer's status and their current door ids;
- the current assignments' doors, each with its status and its warehouse's status;
- the dock's status;
- the held pool's truck ids;
- the earliest planned shift, with its responsible's access status and role and its current trucks
  (with status), doors, and weighing areas (with status);
- the other active discharges holding the dock, a held truck, or a current door.

The check use case builds the snapshot from unlocked reads; the start use case builds it from
reads made under the locks of Decision 4. Neither decides anything itself.

**Rationale**: The review and the refusal must list the same problems in the same terms (spec Edge
Cases). One function guarantees it, and it is unit-tested at every edge without a database, as
GH-54's `discharge_resource_planning_rules.ts` is.

**Alternatives considered**: Rules inside the repository's queries. Rejected: they could only be
tested through the database and would diverge between the locked and unlocked reads.

## Decision 3 — A closed problem taxonomy, shared by API and web

**Decision**: A problem is `{ family, code, subject, context?, holder? }`.

| Family | Codes |
|---|---|
| `INCOMPLETE_PREPARATION` | `NO_PRODUCT_LOT`, `NO_PLANNED_SHIFT`, `LOT_WITHOUT_WAREHOUSE_DOOR`, `SHIFT_WITHOUT_TRUCK`, `SHIFT_WITHOUT_WAREHOUSE_DOOR`, `SHIFT_WITHOUT_WEIGHING_AREA` |
| `UNAVAILABLE_REFERENCE` | `DOCK_ARCHIVED`, `CUSTOMER_ARCHIVED`, `WAREHOUSE_DOOR_ARCHIVED`, `WEIGHING_AREA_ARCHIVED`, `TRUCK_ARCHIVED` |
| `INELIGIBLE_RESPONSIBLE` | `RESPONSIBLE_INELIGIBLE` |
| `ACTIVE_DISCHARGE_CONFLICT` | `DOCK_HELD`, `TRUCK_HELD`, `WAREHOUSE_DOOR_HELD` |

The fifth family of FR-016, "discharge no longer planned", is the existing
`409 E_DISCHARGE_NOT_PLANNED` rather than a listed problem: it replaces every other answer.

- `subject` is `{ type, id }` for the offending discharge, lot, shift, user, dock, customer, door,
  weighing area, or truck. `context` is the lot or shift it was found in.
- `holder` is `{ dischargeId, vesselName }` for a conflict.
- Problems are ordered by family in the table's order, then by the detail's order of their subject.
- The web resolves labels (lot name, registration, door and warehouse names) from the detail it
  already holds, and falls back to a generic label when the subject is no longer there. Only the
  holder's vessel name, which the detail cannot know, travels with the problem.

`WAREHOUSE_DOOR_ARCHIVED` covers a door whose warehouse is archived: both make the door unusable,
and the warehouse is named from the detail. `TRUCK_ARCHIVED` and `WEIGHING_AREA_ARCHIVED` are
reported only for the first shift's current selections, which are what the start uses. A pool truck
cannot be archived while held, so no other archived truck can exist.

A suspended truck is not a problem: it only fails to count as usable, so `SHIFT_WITHOUT_TRUCK`
appears when it was the shift's only truck.

**Rationale**:
- The absorbed frontend slice asked for "one conflict taxonomy": codes, not messages, let the web
  word, group, and link each problem, and let tests assert them.
- Listing every problem at once (FR-022) needs a list body, not the first exception thrown.
- A `409` with `meta` follows the exception handler's existing envelope (`{ error: { code,
  message, meta } }`), as the user invitation exceptions do. A `422` would claim a problem with the
  request body, which a start has none of.

**Alternatives considered**:
- `E_VALIDATION_ERROR` with field paths, as GH-53 and GH-54 refuse chosen values. Rejected: nothing
  here was entered, and field paths cannot name another discharge.
- One exception per family. Rejected: several families usually apply at once.

## Decision 4 — Serialize competing starts with claim locks on the exclusive resources

**Decision**: `StartDischargeUseCase` runs one transaction, in the lock order
`DischargePreparationRepository` already documents:

1. The discharge `FOR UPDATE`, through `lockPlannedDischarge`. It must still be planned.
2. Unlocked reads of the plan under that lock: lots, held pool, current door assignments, and the
   earliest planned shift with its current selections.
3. The dock `FOR NO KEY UPDATE`.
4. The lots' customers `FOR SHARE`.
5. The first shift's responsible `FOR SHARE`.
6. Every held pool truck and every first-shift truck `FOR NO KEY UPDATE`, by id.
7. Their warehouses `FOR SHARE`, then every current door `FOR NO KEY UPDATE`, by id.
8. The first shift's weighing areas `FOR SHARE`.
9. The holder queries: other `ACTIVE` discharges on the dock, holding a truck (`released_at IS
   NULL`), or with a current assignment of a door (`effective_to IS NULL`).
10. `evaluateDischargeStart`, then either the refusal or the activation write.

**Rationale**:
- Each start locks only its own discharge row, so two discharges sharing a truck would never meet
  on it. `FOR SHARE` on the truck would not help either: two starts can both hold it, both read no
  active holder, and both commit.
- `FOR NO KEY UPDATE` conflicts with itself, so the second start waits on the shared dock, truck, or
  door until the first commits. Its holder queries then run as new statements under `READ
  COMMITTED` and see the first discharge as active. No resource can become held by two active
  discharges.
- It also conflicts with the `FOR SHARE` every planning writer takes and with the `FOR UPDATE` every
  archive takes, so neither interleaves with a start. Unlike `FOR UPDATE`, it does not block the
  `FOR KEY SHARE` that foreign-key inserts referencing the row take, such as another discharge's
  reservation that took no explicit lock.
- Customers, the responsible, warehouses, and weighing areas stay `FOR SHARE`: they are shared, and
  only need to stay unarchived, active, and eligible until commit. A user deactivation or role change
  takes `FOR NO KEY UPDATE` on the user and waits.
- Locking the whole pool and every current door, not only the first shift's, follows from
  exclusivity through the whole pool and every current assignment (spec Assumptions).
- The order extends the existing one without reordering it, so a start cannot deadlock with a
  planning writer or an archive.

**Obligation recorded for later slices**: runtime claims on an active discharge (dock reassignment
GH-75, truck assignment GH-76, door assignment GH-77) must take the same `FOR NO KEY UPDATE` on the
resource before checking its active holders. The contract comment of
`DischargePreparationRepository` gains the claim lock and this obligation.

**Alternatives considered**:
- A transaction-level advisory lock serializing every start on the site. Rejected: simpler, but
  runtime claims would need the same global lock, and it serializes starts that share nothing.
- `SERIALIZABLE` isolation for the start. Rejected: serialization failures would need retries, and
  every other writer runs at `READ COMMITTED`.
- `FOR UPDATE` claims. Rejected: they needlessly block unrelated foreign-key inserts.

## Decision 5 — Database backstops where one index can express the invariant

**Decision**: The migration adds two partial unique indexes:
- `discharges_active_dock_unique` on `discharges (dock_id) WHERE status = 'ACTIVE'`
- `shifts_active_per_discharge_unique` on `shifts (discharge_id) WHERE status = 'ACTIVE'`

A write the indexes refuse is mapped to the existing `409 E_DISCHARGE_PLANNING_CONFLICT` ("changed
meanwhile"), which the web already treats as stale.

Truck and door exclusivity across active discharges get no index: the status lives on
`discharges`, not on the pool or assignment rows, and denormalizing it would add a second writer to
keep in step for every later lifecycle slice.

**Rationale**:
- The seed's active discharges use distinct docks and never have two active shifts (checked in
  `database/fixtures/discharge_preparation.ts`), so both indexes build on a seeded database.
- Partial unique indexes work on PostgreSQL and on the SQLite test database, as GH-54 Decision 7's
  indexes do, so the backstops are testable.
- They also protect the invariants against later writers: GH-69's later starts and GH-75's dock
  reassignment.

**Alternatives considered**: Triggers, or an `active` column copied onto pool and assignment rows.
Rejected as disproportionate: the claim locks prevent those races, and the quickstart shows it on
PostgreSQL.

## Decision 6 — Record the confirmation on the discharge and the start on the shift

**Decision**: One migration adds nullable columns:
- `discharges.started_at` and `discharges.started_by_user_id` (references `users`, `RESTRICT`)
- `shifts.actual_start_at` and `shifts.started_by_user_id` (references `users`, `RESTRICT`)

The start writes all four at one instant: the server time truncated to the second, the precision
`recordedInstant` already keeps for SQLite. The migration backfills the seeded or legacy rows:
- non-planned discharges get `started_at` from their earliest shift's `planned_start_at`, falling
  back to `expected_start_at`;
- active and completed shifts get `actual_start_at` from `planned_start_at`;
- the actors stay `null`, as nobody is known to have started them.

The seed sets the same values, so `db:fresh` and a migrated database agree. The detail exposes
`startedAt` and `startedBy` on the discharge, and `actualStartAt` and `startedBy` on each shift.

**Rationale**:
- `CONTEXT.md` separates the confirmation, an event with an actor, from the shift's actual start,
  which GH-70 may later correct with a comment. Storing the discharge's own time keeps that
  correction from rewriting who started the discharge and when.
- The shift's starting actor is distinct from its responsible (`CONTEXT.md`, Shift Responsible), and
  GH-69 will record it for later shifts.
- Nullable actors keep seeded history readable without inventing a user.
- No `CHECK` ties the status to these columns: SQLite cannot add one to an existing table, and the
  only writer is this use case, whose integration tests assert the pairing.

**Alternatives considered**:
- Deriving the discharge's start from its first started shift. Rejected: a GH-70 correction would
  silently change the confirmation.
- A separate `discharge_start_confirmations` table. Rejected: one row per discharge, never
  corrected, belongs on the discharge. The activity log (GH-102) will hold the event history.

## Decision 7 — The earliest planned shift is chosen by the server

**Decision**: The shift that starts is the planned shift with the lowest `planned_start_at`, ties
broken by `sequence`. The check returns its id and the command starts it. The command takes no body.

**Rationale**: The user does not choose it (spec Edge Cases). Returning it from the check lets the
review show exactly the shift the server will start, instead of the web re-deriving it.

**Alternatives considered**: Passing the expected shift id and refusing on mismatch. Rejected: the
spec checks against the current state (US3 scenario 6), and a replanned shift is already reported
through the problems the review re-reads after a refusal.

## Decision 8 — A review dialog opened from the header, refreshed on every refusal

**Decision**: In `apps/web`, the detail header's `actions` slot, reserved by GH-55, gains a `Start`
button for preparers on a planned discharge.
- It opens `StartDischargeDialog`, which loads `dischargeQueries.startCheck(id)` fresh on every
  opening. The dialog shows the review from the detail already in cache (Decision 7's shift) and the
  problems grouped by kind of element, in the detail's section order: `Dock`, `Product lots` (each
  lot with its doors), `Truck pool`, `Shifts` (each shift). A conflict sits with its element, since
  it is fixed in this discharge too, and names the holding discharge as a secondary link.
- `Start discharge` is disabled while problems are listed (FR-005), and the review folds away behind
  them. Following a problem closes the dialog; opening it again re-runs the check. A `409
  E_DISCHARGE_START_REFUSED` replaces the check's cached answer with `meta.problems`, refreshes the
  detail, and keeps the dialog open with the list focused.
- `E_DISCHARGE_NOT_PLANNED` and `E_DISCHARGE_NOT_FOUND` follow the existing stale pattern: a toast,
  the dialog closes, and the detail refreshes.
- Each problem links to its section (`tab`, plus `shiftId` for a shift) or, for a conflict, to the
  holding discharge's detail. Following a link closes the dialog.
- Success writes the returned detail into the cache, closes the dialog, and shows a success toast.
  The header then shows `Started <date> by <name>`, and the existing `canCorrect` gating removes
  every planning action and the preparation card.

The pure module `discharge-start-view.ts` groups the review (customers with lots and their current
doors, the starting shift with its resources) and describes each problem as `{ family, text, link }`.
It is unit-tested like `discharge-planning-view.ts`.

**Rationale**:
- The button label follows the repository rule that button labels carry the action only.
- A dialog keeps the user on the detail they are fixing, and matches GH-55's `WithdrawTrucksDialog`
  refusal pattern (alert inside, focused).
- Reusing the cached detail avoids a second full read, while the check adds only what the detail
  lacks.

**Alternatives considered**:
- A dedicated `/discharges/$id/start` page. Rejected: problems are fixed in the detail's sections,
  so the user would bounce between pages.
- Keeping `Start discharge` enabled while problems are listed, since the check is advisory and the
  state may have changed since. Rejected after use: offering a start the API is about to refuse
  confused users, and reopening the review checks a state fixed meanwhile.
- Grouping problems by family (`Incomplete preparation`, `Held by another active discharge`, …).
  Rejected after use: a long discharge read as a wall of repeated lines.
- Grouping conflicts by holding discharge (`Held by MV Ocean Cedar`). Rejected after use: a conflict
  is fixed in this discharge (change the dock, reassign the door, withdraw the truck), so the holder
  sent the user to the wrong place first, and a lot's problems were split across groups.

## Decision 9 — Concurrency is proven by invariant tests on SQLite and by a PostgreSQL run

**Decision**:
- A unit lock-order test, in the style of `tests/unit/discharges/truck_pool/lock_order.spec.ts`,
  records the start use case's repository calls. It asserts the order of Decision 4 and that the
  holder queries run after every claim.
- An integration test races two starts sharing a truck with `Promise.all` over HTTP, repeated,
  without the global transaction, as `tests/integration/users/role_change/final_admin.spec.ts`
  does. It asserts exactly one `200` and one `409 E_DISCHARGE_START_REFUSED` (or
  `E_DISCHARGE_PLANNING_CONFLICT`).
- The integration tests assert that the partial unique indexes refuse a second active discharge on a
  dock and a second active shift.
- `quickstart.md` runs the same race against PostgreSQL, where the row locks are real.

**Rationale**: The test database is single-connection SQLite, where row locks are no-ops. The
existing suites prove invariants there and locks on PostgreSQL, and this slice does the same.

## Decision 10 — Scope kept out of this slice

- **Activity log**: no entry is written. GH-102 does not exist, and the start's actor and time are
  kept on the rows (Decision 6).
- **Shift workspace**: GH-65 builds the live screen. The detail's Shifts section only shows the
  active shift's actual start and who started it.
- **Responsible guard**: the GH-66 guard against deactivating a shift's responsible does not exist
  yet. The start refuses an ineligible responsible, which is all this slice needs.
- **Dock holder indication**: no other-holder read is added for docks while planning. GH-53 left dock
  conflicts to the start, which now names them.
