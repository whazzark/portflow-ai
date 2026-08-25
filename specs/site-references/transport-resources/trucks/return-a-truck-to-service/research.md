# Research: Return a Truck to Service

**Feature**: `GH-253` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

Phase 0 findings. Each decision records what was chosen, why, and what was rejected. Findings are
grounded in the delivered `#252` code, not inferred from the issue text.

The headline is that the risk profile of this slice is the **inverse** of `#252`'s. There, the action
was trivial and the migration was the dangerous artifact. Here the migration is three nullable
columns, and the risk sits in one business rule (the transport-company gate), one refusal message that
is already wrong in a delivered path, and one interface structure that cannot express what the spec
asks for.

---

## D1 — The return records its own context columns; it does not reuse reactivation's

**Decision**: Add `returned_to_service_at`, `returned_to_service_by_user_id`, and
`return_to_service_comment`. The suspension context is **not** cleared.

**Rationale**: A truck now has two distinct ways of becoming available again, and a reader of a truck's
history must be able to tell which happened. `reactivated_*` means "brought back from archival"; the
delivered `#226` slice writes it, and `truck-details.tsx` labels it *Latest reactivation context*.
Overloading those columns would make an archival reversal and an immobilisation reversal
indistinguishable in the data, in the API response, and on screen — and would silently corrupt a
truck's archive history the first time a suspended truck came back.

Not clearing `suspended_*` is required by FR-013 and US1-6, and costs nothing at the schema level: the
delivered check constraint is `status <> 'SUSPENDED' OR suspended_at IS NOT NULL`, which is
one-directional. An `AVAILABLE` row carrying a `suspended_at` is already legal. This was verified
against `1785300000000_add_truck_suspension.ts` rather than assumed.

**Alternatives rejected**:
- *Reuse `reactivated_*`* — conflates two transitions, as above.
- *Clear `suspended_*` on return* — contradicts FR-013 and destroys the only record of why a vehicle
  was out of service, which is the operational value the suspension comment carries.
- *A `truck_suspensions` history table* — the spec asks for the latest cycle only (US1-7), which two
  context blocks already give. `#252` rejected the same table for the same reason.

---

## D2 — The migration still needs a dialect branch (**corrected during implementation**)

> **This decision was wrong as first written, and the implementation proved it.** It originally
> concluded that three nullable columns needed no dialect branch. Running the suite produced
> `SqliteError: DROP TABLE "trucks" - FOREIGN KEY constraint failed`. The corrected decision is
> below; the original reasoning is kept underneath it, because the half that was right still is.

**What the original reasoning missed**: on SQLite, knex implements *any* added column carrying a
`REFERENCES` clause by rebuilding the whole table — create, copy, `DROP TABLE trucks`, rename. That
DROP is refused while foreign-key enforcement is on, because `discharge_truck_assignments` and
`shift_trucks` both reference `trucks`. The precedent this decision leaned on,
`1784400000000_add_customer_lifecycle_metadata.ts`, works only because nothing references
`customers` — a difference the audit did not check.

**Corrected decision**: One migration, `1785400000000_add_truck_return_to_service.ts`, with
`static disableTransactions = true`. PostgreSQL keeps the plain `alterTable`. SQLite runs the same
`alterTable` inside a `PRAGMA foreign_keys = OFF` / `ON` window, deferred out of the transaction —
the same technique, and the same reason, that
`1785200000000_add_transport_companies_contact_details.ts` and the suspension migration document.
knex generates its own rebuild, so unlike `#252` no table has to be hand-built; verified after the
fact that the rebuild preserves the raw `trucks_registration_unique` index and both check
constraints, since the delivered create/update suites assert them and stay green.

**Still true from the original reasoning**: no status value is added and no check constraint is
widened, so none of `#252`'s `.alter()` hazard applies — that part of the audit held. What did not
hold was the conclusion drawn from it, that the migration therefore needed no dialect branch at all.

**Rationale**: `#252` needed a hand-written, dialect-branched migration because it *widened an enum
check constraint*, and knex's `.alter()` produces a silently broken schema on SQLite and invalid SQL
on PostgreSQL. This slice adds no status value and changes no constraint, so it is the
`1784400000000_add_customer_lifecycle_metadata.ts` shape: `timestamp` + `uuid` FK to `users` with
`ON DELETE SET NULL` + `text`, identical on both dialects.

**Deliberately no paired check constraint.** The `ARCHIVED`/`SUSPENDED` checks exist because those
states are meaningless without their timestamp. `AVAILABLE` carries no such obligation — it is the
default state of every truck ever created, almost all of which have never been returned to service —
so `status = 'AVAILABLE' ⇒ returned_to_service_at IS NOT NULL` would be false for the entire existing
table. Nothing to enforce.

**Consequence**: the PostgreSQL `db:migrate` / `db:rollback` / `db:migrate` check remains routine —
it passed on the first, wrong version of the migration. The step that caught the real problem was the
**SQLite** one, i.e. running the test suite. The lesson is the inverse of `#252`'s: there, the green
SQLite suite could not prove PostgreSQL correct; here, the green PostgreSQL check could not prove
SQLite correct.

**Deliberately no paired check constraint** — see below; that part of the decision was unaffected.

---

## D3 — The return must carry `#226`'s archived-transport-company gate, including the row lock

This is the substantive business rule in the slice, and `#252` predicted it in its own research (D6)
and data model.

**Finding**: `LucidTruckRepository#findCompanyIdsWithAvailableTrucks` filters `status = 'AVAILABLE'`.
`LucidTransportCompanyRepository#archiveAvailable` uses exactly that to refuse archiving a company
that still provides available trucks. A **suspended** truck is not available, so a transport company
can legitimately be archived while its entire fleet is in the workshop.

**Consequence**: without a gate, returning one of those trucks to service produces an available truck
under an archived transport company — breaking the invariant `CONTEXT.md` records and that
`#226` already defends.

**Decision**: `returnSuspendedToService` mirrors `reactivateArchived` exactly:

1. `forUpdate` on the truck row; refuse `AVAILABLE` (already available) and `ARCHIVED`.
2. `forUpdate` on `transport_companies` for the truck's `transportCompanyId`, read **inside the same
   transaction**; refuse unless `status === 'AVAILABLE'`.
3. Guarded `UPDATE … WHERE id = ? AND status = 'SUSPENDED'`.

Reading the company under a lock, rather than plainly, is what closes the check-then-act window
against a concurrent company archival. The truck's `transportCompanyId` cannot move underneath this
transaction, because `updateAvailable` is guarded by `WHERE status = 'AVAILABLE'` and the row is
suspended and locked.

**Lock-ordering check (asked before it is asked at review)**: company archival locks the *company*
first and then reads trucks; this path locks the *truck* first and then the company — opposite order.
That is not a deadlock, because `findCompanyIdsWithAvailableTrucks` issues a plain `SELECT` and takes
no row locks. One transaction can wait on the other, never both. Whichever commits first wins, and the
loser reads a committed state and refuses correctly. This is the same argument `#226` relies on; it is
restated here because this slice adds a second writer to the invariant.

**Alternative rejected**: *count suspended trucks as blocking company archival, and drop the gate.*
It would change the delivered transport-company slice (out of scope per FR-026) and is wrong on its
own terms — it would refuse to archive a company whose whole fleet happens to be under repair.
`#252` rejected the same alternative.

---

## D4 — Refusal vocabulary: reuse two codes, add one, and correct one message

| Condition | Code | Origin |
|---|---|---|
| Truck already available | `E_TRUCK_ALREADY_AVAILABLE` | **reuse** `TruckAlreadyAvailableException` verbatim — same meaning, same status, already used by `#226` |
| Truck archived | `E_TRUCK_ARCHIVED_CANNOT_RETURN` | **new** `TruckArchivedCannotReturnException`, mirroring `TruckArchivedCannotSuspendException`; FR-006 requires naming reactivation as the right action, which `ArchivedTruckReadOnlyException` ("Archived trucks are read-only") does not |
| Transport company archived | `E_TRUCK_TRANSPORT_COMPANY_ARCHIVED` | **reuse** `TruckTransportCompanyArchivedException` — identical condition, and the web already maps this code |
| Unknown truck | `E_TRUCK_NOT_FOUND` | reuse |

**The message correction, and why it is not cosmetic.** The delivered message reads:

> `Truck transport company is archived; reactivate the company or reassign the truck before returning it to service`

Two things are wrong with it, and only one of them is caused by this slice:

1. **"reassign the truck" is impossible — and always has been.** Reassignment goes through
   `updateAvailable`, guarded by `WHERE status = 'AVAILABLE'`. An archived truck cannot be reassigned,
   so the advice was already unreachable for the `#226` path it was written for. A suspended truck
   cannot be reassigned either (`SuspendedTruckReadOnlyException`), so it is unreachable here too.
2. **"before returning it to service" reads as a *next* step**, which is incoherent when the
   administrator is being refused *while* returning it to service.

**Decision**: keep one exception and one code, and correct the message to name the only action that
actually unblocks either path — reactivating the transport company. FR-020 requires actionable
feedback, and advice that cannot be followed is not actionable.

**Scope honesty**: this edits a delivered slice's message and one asserted string in
`apps/web/src/features/trucks/__tests__/lifecycle/reactivate.test.tsx`. That is the same call `#252`
made for the misleading "Archived trucks are read-only" refusal on a suspended truck (its D5), and it
is flagged in the plan's Constitution Check rather than made quietly. **It also supersedes a spec
assumption**, which anticipated two differently-worded refusals on the belief that reactivation's
wording was correct.

**Alternative rejected**: *a second code for the same condition*
(`E_TRUCK_TRANSPORT_COMPANY_ARCHIVED_CANNOT_RETURN`). It would spare the delivered message but forces
the web to map two codes to one sentence, and leaves the inaccurate advice standing in the
reactivation path.

---

## D5 — Concurrency and idempotence reuse the delivered shape exactly

**Decision**: no new concurrency concept. `FOR UPDATE` on the truck row, then a status-guarded
`UPDATE … WHERE status = 'SUSPENDED'`, then the same zero-row fallback re-read that
`suspendAvailable` already carries for SQLite (where knex emits no `FOR UPDATE`, so a concurrent
writer can still slip in between the read and the update).

The fallback's classification differs from `suspendAvailable`'s in one branch and it matters: a
zero-row update whose re-read shows `AVAILABLE` means **another return won the race**, so the correct
outcome is `ALREADY_AVAILABLE` (FR-021), not the `NOT_FOUND` that the suspend path returns for its
own stale-read case. `ARCHIVED` cannot be reached from `SUSPENDED` by any delivered path — archival
refuses a suspended truck — but the branch is still classified rather than collapsed, because the
race window is against *any* committed writer, present or future.

FR-021's "exactly one recorded return" falls out of the guard: the loser updates zero rows and is
refused, and no return context is overwritten (FR-022).

---

## D6 — No bulk return, and what that leaves untouched

Per FR-025, the return is one truck per action, symmetric with suspension. Concretely: **no**
`POST /trucks/return-to-service` collection route, no `returnSuspendedToServiceMany`, no bulk
validator, no `SuspendTrucksUseCase` counterpart.

`findBulkBlockers` and `BulkTruckLifecycleBlocker` need **no change at all** — `#252` already added the
`SUSPENDED` blocker reason, and this slice adds no status value for them to misclassify. The suspended
tab keeps `selectable={false}` and no bulk toolbar.

This is the one place a reviewer might read an absence as an oversight, exactly as `#252` noted for
suspension.

---

## D7 — The rotation half of the spec still has no code to attach to

**Finding**: unchanged since `#252`'s D4. `apps/api/app/models/` has `discharge`, `shift`,
`shift_truck`, and `discharge_truck_assignment` — and **no rotation model**. There are no discharge,
shift, or assignment use cases, only tables, factories, and a usage-read repository.

**Consequence, scenario by scenario**:

| Spec item | Status in this slice |
|---|---|
| US2-1 (planned-discharge assignment survives and is usable), US2-2 (active-shift assignment survives) | **Testable now** — assert the `discharge_truck_assignments` and `shift_trucks` rows are unchanged and the truck is `AVAILABLE` again. `createReservedAndShiftedTruckScenario` already builds this shape for `#252`. |
| US2-3 (offered for a new discharge or shift), FR-014, FR-017 | **Satisfied by construction** — `listAvailable` filters `status = 'AVAILABLE'`, so the returned truck reappears in `GET /trucks/available` with no code of its own. Assert it rather than assume it. |
| US2-5, US2-6 (history and registration unaffected) | **Testable now.** |
| US2-4 (in-progress rotation, continuation now accepted, no second concurrent rotation) | **Cannot be implemented or tested.** Rotations do not exist. |
| FR-019 (rotation eligibility restored under existing rules) | **Recorded, not implemented** — the `Rotation-Eligible Truck` entry in `CONTEXT.md` gains the return direction so the future rotation slice inherits it. |

**Decision**: deliver what exists; record the rest as forward constraints in `CONTEXT.md`. Do not
invent a rotation model. This is stated plainly for the same reason `#252` stated it: a reader of the
spec would reasonably expect US2-4 to ship, and it will not.

---

## D8 — The detail pane must show two lifecycle contexts, which it structurally cannot today

**Finding**: `truck-details.tsx` renders **exactly one** lifecycle block, chosen by current status —
archived → archive context, suspended → suspension context, otherwise → *Latest reactivation context*.

That structure cannot express what this slice produces. A truck that has just been returned to service
is `AVAILABLE`, so the delivered panel would show it the **reactivation** context — usually empty —
and hide both the return that just happened (FR-009) and the suspension it ended (FR-013, US1-6). A
single `isReturned` branch would not fix it either: US1-6 requires both blocks visible *at once*.

**Decision**: replace the status-derived single block with a list of every lifecycle context block the
truck actually carries — archive, reactivation, suspension, return — each with its own heading and
actor label, ordered newest first by its timestamp, empty blocks omitted. The current status stays in
the badge and the *Truck status* field, where it already is.

This also repairs two pre-existing gaps rather than adding a fourth branch to them: an archived truck
that was previously reactivated currently hides its reactivation, and a suspended truck currently hides
its archive history — which `#252`'s FR-011 said should stay readable.

**Not scope creep**: two simultaneous blocks are a spec requirement, and the delivered shape admits
exactly one. The change stays inside `truck-details.tsx`.

**Alternative rejected**: *show only the most recent block, by timestamp.* One line smaller, and it
satisfies FR-009 — but it fails US1-6, because the suspension that just ended is exactly the block it
would hide.

---

## D9 — A returned truck exposes `suspendedBy` to operational users

**Finding**: an asymmetry in the delivered transformer variants, which this slice is the first to make
reachable.

| Endpoint | Variant | Actors exposed | Audience |
|---|---|---|---|
| `GET /trucks/suspended` | `toOperationalView` | **none** — deliberately | every active role |
| `GET /trucks/available` | `toObject` | all of them | every active role |
| `GET /trucks` | `toObject` | all of them | administrators only |

`#252` deliberately withheld `suspendedBy` from the suspended collection: *"Who suspended it stays
administrator-only, withheld by the transformer variant rather than by this rule"* (`truck_policy.ts`).
But once a truck is returned to service it leaves that collection and enters `/trucks/available`,
which serializes with `toObject` — so an operations lead or observer can then read who suspended it,
and who returned it.

**Decision**: add the three new fields to both variants, with `returnedToServiceBy` in `toObject` only,
exactly mirroring `suspendedBy`. Do **not** change `/trucks/available`'s variant.

**Rationale**: `reactivatedBy` and `archivedBy` are *already* disclosed to every active role through
`/trucks/available` — this is the delivered rule FR-016 points at, not a new leak invented here.
Narrowing that endpoint would change a contract delivered by `#222`/`#226`, whose consultation tests
assert those fields, and FR-026 puts it out of scope.

**Flagged for the review gate anyway**, because this slice is what turns a hypothetical into a live
path: before it, no suspended truck could ever reach `/trucks/available`. If the intent of `#252`'s
withholding was that the *suspending administrator* is never operational information, then
`/trucks/available` should move to `toOperationalView` — a small follow-up against `#222`, not a
silent change here.

---

## D10 — Fixtures and factory, and the one side effect worth checking

**Decision**:
- `TruckFactory` gains a `returned` state: `AVAILABLE`, with `suspendedAt` and `returnedToServiceAt`
  both set, so the two-context shape is one line to build in tests.
- `database/fixtures/trucks.ts` gains a sixth truck in that state, so the seeded dataset shows a
  vehicle that went out of service and came back — the story this slice completes. The local
  `TruckLifecycleAttributes` type gains the three fields; the shared `LifecycleAttributes` in
  `fixtures/shared.ts` stays untouched, for the reason `#252` recorded: only trucks have these states.
- The existing suspended fixture (`DD-404-PF`) **stays suspended**, so the suspended tab is still
  populated and the new action still has a subject after `db:fresh`.

**Side effect to verify, not to assume**: `discharge_preparation.ts` derives `operationalTrucks` by
filtering `TRUCK_FIXTURES` on `status === 'AVAILABLE'`, and round-robins them across 24 generated
historical discharges. Appending an available truck takes that set from three to four and redistributes
the generated dataset. `#252` could append safely because a `SUSPENDED` fixture is filtered out; this
one is not. Nothing in the test suite asserts that distribution today
(`tests/unit/database/storage_reference_lifecycle.spec.ts` is the only fixture-shape test, and it may
need the new state added), but `pnpm --filter @portflow/api db:fresh` followed by the full suite is the
check, and it belongs in the quickstart rather than in a reviewer's head.

---

## D11 — A fourth `.preload` across nine query sites argues for a helper

**Finding**: `lucid_truck_repository.ts` repeats

```ts
.preload('archivedBy').preload('reactivatedBy').preload('suspendedBy')
```

at **nine** call sites. This slice adds `.preload('returnedToServiceBy')` to every one of them, and a
missed site is invisible in types — the relation simply serializes as `null`, so the actor silently
disappears from one endpoint.

**Decision**: extract one local helper (`preloadLifecycleActors(query)`) and route the nine sites
through it. It is a strict simplification of code this slice must touch anyway, it makes a fifth
context block a one-line change, and it converts a silent-omission failure mode into an impossible
one.

**Alternative rejected**: *add the fourth line nine times.* Faster to write, and it is what a reviewer
would flag: nine copies of a four-line incantation, one of which will eventually be wrong.
