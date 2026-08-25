# Research: Suspend a Truck From Service

**Feature**: `GH-252` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

Phase 0 findings. Each decision records what was chosen, why, and what was rejected. Findings
marked **spike-verified** were reproduced against the repository's actual dependency versions
(knex 3.2.10 / better-sqlite3 12.11.1) rather than reasoned about.

---

## D1 — Represent suspension as a third `trucks.status` value, not a derived flag

**Decision**: Add `SUSPENDED` to `TRUCK_STATUSES` and to the `trucks.status` check constraint.
Suspension context lives in three new nullable columns: `suspended_at`, `suspended_by_user_id`,
`suspension_comment`.

**Rationale**: Every read and write path that currently means "available" is expressed as
`status = 'AVAILABLE'`:

| Call site | What the `= 'AVAILABLE'` filter protects |
|---|---|
| `LucidTruckRepository#listAvailable` | `GET /trucks/available`, the collection every future assignment slice will consume |
| `LucidTruckRepository#findCompanyIdsWithAvailableTrucks` | the transport-company archival invariant |
| `LucidTruckRepository#updateAvailable` (`WHERE status = 'AVAILABLE'`) | the update guard |
| `LucidTruckRepository#archiveAvailableMany` (`WHERE status = 'AVAILABLE'`) | the bulk archive guard |

A third enum value makes all four correct **by construction**: a suspended row simply stops matching.
Modelling suspension as `status = 'AVAILABLE' AND suspended_at IS NOT NULL` would invert that — every
one of those queries would silently keep treating a suspended truck as available, and FR-013 and
FR-020 would have to be re-implemented at each call site. The issue also asks for the third state
explicitly ("`trucks.status` currently admits only `AVAILABLE` and `ARCHIVED`, so this slice
introduces a third operational state").

**Alternatives rejected**:
- *Derived `suspended_at` flag on an `AVAILABLE` row* — silently unsafe, as above.
- *Separate `truck_suspensions` table* — suspension has at most one current record per truck and no
  history requirement (FR: "each cycle replacing the previous suspension context"). A table would add
  a join to every truck read for no behaviour the columns do not already give.

---

## D2 — The migration must be hand-written and dialect-branched (**spike-verified**)

**Context**: `1784900000000_create_trucks_table.ts` declares `table.enum('status', ['AVAILABLE',
'ARCHIVED'])`. Tests run migrations against in-memory SQLite (`tests/bootstrap.ts` →
`testUtils.db().migrate()`); production is PostgreSQL (ADR 0002). The migration must work on both.

**Spike finding 1 — the two dialects render `table.enum()` differently.**

```
SQLite:   `status` text check (`status` in ('AVAILABLE', 'ARCHIVED')) not null default 'AVAILABLE'
          → an INLINE, UNNAMED, column-level CHECK
Postgres: "status" text check ("status" in ('AVAILABLE', 'ARCHIVED')) not null
          → an inline check that PostgreSQL auto-names (expected: trucks_status_check)
```

**Spike finding 2 — `dropChecks` cannot reach the SQLite constraint.**
`alterTable(t => t.dropChecks(['trucks_status_check']))` fails on SQLite with
`no such constraint: trucks_status_check`. SQLite has no `DROP CONSTRAINT` at all.

**Spike finding 3 — `.alter()` is actively dangerous and must not be used.**
`t.enum('status', [...3 values]).notNullable().defaultTo('AVAILABLE').alter()`:

- *On SQLite*: reports success, rebuilds the table, and leaves **both** checks in place —
  ``` `status` text check (`status` in ('AVAILABLE','ARCHIVED','SUSPENDED')) NOT NULL CHECK (`status` in('AVAILABLE','ARCHIVED')) ```
  Inserting `SUSPENDED` then fails with `CHECK constraint failed: status`. A green migration and a
  broken schema.
- *On PostgreSQL*: emits malformed SQL —
  `alter column "status" type text check (...) using ("status"::text::text check (...))`.

**Decision**: One migration, `static disableTransactions = true`, in three steps:

1. **Additive columns** via `alterTable` — `suspended_at`, `suspended_by_user_id` (FK to `users`,
   `ON DELETE SET NULL`), `suspension_comment`. Works identically on both dialects; this is the
   `1784400000000_add_customer_lifecycle_metadata.ts` pattern.
2. **Widen the status check**, branching on `this.db.dialect`:
   - *PostgreSQL*: look the constraint up rather than trusting a name — query `pg_constraint` for
     `contype = 'c'` on `trucks` whose `pg_get_constraintdef` mentions `status` and `'ARCHIVED'`,
     assert exactly one match, `DROP CONSTRAINT`, then `ADD CONSTRAINT trucks_status_check CHECK
     (status IN ('AVAILABLE','ARCHIVED','SUSPENDED'))`. No local PostgreSQL was reachable to confirm
     the auto-generated name, so the lookup is deliberate: a hard-coded `DROP CONSTRAINT IF EXISTS`
     would silently no-op against a different name and leave the old check in force.
   - *SQLite*: manual table rebuild — `PRAGMA foreign_keys = OFF`, create the new table with the
     three-value check, `INSERT … SELECT`, `DROP TABLE trucks`, `ALTER TABLE … RENAME TO trucks`,
     recreate `trucks_status_index` and the raw `trucks_registration_unique` index, `PRAGMA
     foreign_keys = ON`. `disableTransactions` is required because SQLite ignores the pragma inside a
     transaction — the same reason and the same comment as
     `1785200000000_add_transport_companies_contact_details.ts`.
3. **Pair the new state with its timestamp**: add `CHECK (status != 'SUSPENDED' OR suspended_at IS
   NOT NULL)`, mirroring the existing archived check. On SQLite this rides along with step 2's
   rebuild; on PostgreSQL it is one more `ADD CONSTRAINT`.

**Spike-verified for the SQLite rebuild**, on a faithful replica of the real table (parent FK to
`transport_companies`, actor FK to `users`, child FK from `shift_trucks`, both indexes, both checks,
with rows in every table): `PRAGMA foreign_key_check` returns empty, child rows survive, truck rows
survive, `trucks_registration_unique` still rejects a case-insensitive duplicate, the child FK still
rejects an orphan, `SUSPENDED` inserts, `SUSPENDED` without `suspended_at` is refused, and a bogus
status is refused.

**Alternative rejected**: *amend `1784900000000_create_trucks_table.ts` in place.* Cheaper and it is
what the test suite alone would need, but it is only correct if no environment has ever run it. That
is not knowable from the repository, and a migration that has been applied anywhere is immutable. If
the team knows the schema has never been deployed, this becomes a one-line change and the whole of
D2 collapses — worth a moment at the plan-review gate, but the safe default is the new migration.

---

## D3 — Introducing a third state silently breaks four delivered write paths

This is the largest risk in the slice and it is invisible from the spec: three merged use cases read
`trucks.status` as a boolean. None of them fails loudly when a third value appears.

| # | Path | Behaviour once `SUSPENDED` exists | Required fix |
|---|---|---|---|
| 1 | `LucidTruckRepository#archiveAvailable` | Guards only `status === 'ARCHIVED'`, then updates `WHERE id = ?` with no status guard. A **suspended truck would be archived successfully**, contradicting the spec's "archival still requires an available truck". | Refuse anything not `AVAILABLE`; add result kind `SUSPENDED` |
| 2 | `LucidTruckRepository#reactivateArchived` | Guards only `status === 'AVAILABLE'`. A **suspended truck would be reactivated to `AVAILABLE`**, erasing the suspension without a return-to-service action. | Refuse anything not `ARCHIVED`; add result kind `SUSPENDED` |
| 3 | `findBulkBlockers` (both bulk paths) | Classifies any status mismatch as `ALREADY_ARCHIVED` (archive) or `ALREADY_AVAILABLE` (reactivate). A suspended truck is misreported, **and** the follow-up guarded `UPDATE` then matches fewer rows than `eligibleIds`, tripping `throw new Error('Truck bulk … changed during transaction')` — a 500 on a legitimate request. | Add blocker reason `SUSPENDED`, returned whenever the mismatch is a suspended truck |
| 4 | `UpdateTruckUseCase` / `updateAvailable` | Use case checks `status === 'ARCHIVED'`; repository returns `{ kind: 'ARCHIVED' }` for any non-available row. Editing a suspended truck is refused with **"Archived trucks are read-only"** — wrong reason, and FR-021 requires accurate feedback. | Distinguish the suspended case and report it as such |

**Decision**: All four are in scope for this slice. They are not scope creep — they are the cost of
the state the issue asks for, and items 1 and 2 are data-integrity bugs, not cosmetics. Each gets a
regression test alongside the new suspend tests.

---

## D4 — Most of FR-017 to FR-020 has no code to attach to yet

**Finding**: The operational-use side of the spec is largely unbuilt.

- `apps/api/app/discharges/` contains only `discharge_usage_repository.ts` and its Lucid
  implementation. There are no discharge, shift, or assignment use cases and no controllers.
- There is **no rotation model at all** (`apps/api/app/models/` has `discharge`, `shift`,
  `shift_truck`, `discharge_truck_assignment` — no rotation).
- The only place an available truck is offered for operational work today is
  `GET /api/v1/trucks/available`.

**Consequence for the spec, by scenario**:

| Spec item | Status in this slice |
|---|---|
| US2-1 (suspend a truck on a planned discharge), US2-2 (on an active shift) | **Implementable and testable now.** `discharge_truck_assignments` and `shift_trucks` tables, their factories, and `createReservedTruckScenario` all exist. The test is precisely that suspension succeeds where archival is refused. |
| US2-7 (history untouched) | **Testable now** — assert the assignment rows are unchanged after suspension. |
| FR-013, FR-020 (excluded from new-work collections) | **Satisfied by construction** via `listAvailable`'s `status = 'AVAILABLE'`; covered by a regression test asserting a suspended truck is absent from `/trucks/available`. |
| US2-3, US2-4, US2-5 (in-progress rotation, continuation refusal, not offered for a new rotation) | **Cannot be implemented or tested.** Rotations do not exist. |

**Decision**: Deliver what exists, and record the rotation rules as forward constraints in
`CONTEXT.md` (via the `Rotation-Eligible Truck` entry, which already says "an available truck …") so
the future rotation slice inherits them. Do **not** invent a rotation model to satisfy the spec.

This is stated plainly rather than quietly: a reader of the spec would reasonably expect US2-3 to
US2-5 to ship here, and they will not. The spec is not wrong — it describes the behaviour the state
must have — but three of its acceptance scenarios are unverifiable until rotations are built.

---

## D5 — A suspended truck stays non-editable, with an accurate refusal

**Decision**: Keep `updateAvailable`'s `WHERE status = 'AVAILABLE'` guard as it is, so a suspended
truck cannot be edited, but report the refusal accurately with a new
`SuspendedTruckReadOnlyException` instead of the misleading "Archived trucks are read-only".

**Rationale**: Widening the update guard would change the delivered update slice's contract *and* its
concurrency reasoning — `UpdateTruckUseCase` runs a compare-and-swap retry loop keyed on
`expectedTransportCompanyId`, and admitting a second writable status means re-deriving when a
reassignment is legal for a truck that is out of service. FR-027 and FR-028 put that outside this
slice. Correcting the *message* is not optional: FR-021 requires distinct, accurate feedback for
every refusal, and a brand-new state reporting itself as "archived" fails that.

**Flagged for the plan-review gate**: this is a product decision, not just a technical one. A vehicle
in the workshop is exactly when someone might correct its recorded capacity or vehicle model. If the
answer is that suspended trucks should be editable, it is a small follow-up issue against
Update a Truck (`#224`) — not a change to make silently here.

---

## D6 — Transport-company archival needs no change here, but `#253` inherits a gate

**Finding**: `findCompanyIdsWithAvailableTrucks` filters `status = 'AVAILABLE'`, so suspended trucks
do not block archiving their transport company.

**Is that correct?** Yes, while the truck is suspended. The recorded invariant is "a transport company
cannot be archived while it still provides **available** trucks" (`CONTEXT.md`), and a suspended truck
is not available. No invariant is broken by this slice.

**But**: a company can therefore be archived while it still provides suspended trucks, and returning
one of those trucks to service would create an available truck under an archived company. That is the
identical situation Reactivate a Truck (`#226`) already solved, with a `FOR UPDATE` company lock and
a `TRANSPORT_COMPANY_ARCHIVED` refusal.

**Decision**: Change nothing in the transport-company slice. Record as a forward constraint that
Return a Truck to Service (`#253`) **must carry the same transport-company gate as `#226`**, including
the company row lock. Recorded here, in `data-model.md`, and worth a note on issue `#253`.

**Alternative rejected**: *count suspended trucks as blocking company archival now.* It would change a
delivered slice's behaviour (out of scope per FR-027) and it is wrong on its own terms — it would
refuse to archive a company whose entire fleet happens to be in the workshop.

---

## D7 — Suspension needs no company lock; archival's usage check is deliberately absent

**Decision**: `suspendAvailable` mirrors `archiveAvailable`'s shape — one transaction, `forUpdate` on
the truck row, a status guard, one guarded `UPDATE` — with two deliberate differences:

1. **No `SiteReferenceUsageChecker` call.** This is the whole point of Q1's answer: unlike archival,
   suspension is never refused for a truck on a planned or active discharge (FR-017).
2. **No transport-company `FOR UPDATE` lock.** `#226` needs one because reactivation *produces* an
   available truck and could race a company archival. Suspension *removes* an available truck, so it
   can only ever make the invariant more true. Adding a lock would be cargo-culting the pattern.

Repeated and concurrent suspensions collapse to one recorded suspension through the same row lock
plus status guard the archive path already uses (FR-022), so no new concurrency concept is introduced.

---

## D8 — Fixtures: add a suspended truck; correct the misleading comment

**Finding**: The comment the issue cites — `"Vehicle temporarily suspended for fleet maintenance"` in
`apps/api/database/fixtures/trucks.ts` — belongs to the truck seeded in the **`reactivated`** state,
not an archived one. It is the *archive* comment of a truck that was archived for maintenance and
later reactivated: the workaround, recorded as history.

**Decision**: Two changes, and a correction to a spec assumption.
- Append a fifth truck fixture in a new `suspended` state, so seeded data exercises the new state.
  `discharge_preparation.ts` reads `TRUCK_FIXTURES[0]` and `[1]` positionally and filters the rest by
  `status === 'AVAILABLE'`, so appending is safe.
- Reword the reactivated truck's archive comment to a retirement reason, so no seeded row still models
  a maintenance pause as a retirement.
- Add a `suspended` state to `TruckFactory`.

**Spec correction**: the spec's assumption says that fixture "is expected to move to the new suspended
state". It cannot — the truck is currently available, having been reactivated, and returning a
suspended truck to service is `#253`. The intent behind the assumption (seeded data stops modelling a
maintenance pause as a retirement) is met by the two changes above.

**Scope note**: the shared `LifecycleAttributes` type in `database/fixtures/shared.ts` is used by every
site reference. It must **not** gain `SUSPENDED` — only trucks can be suspended. The suspended shape
is declared locally in `fixtures/trucks.ts`.

---

## D9 — No bulk suspension: what that removes, and what it costs

Per the spec's Q3 answer, suspension is one truck per action. Concretely this means **no**
`POST /trucks/suspend` route, no `suspendAvailableMany`, no `SuspendTrucksUseCase`, no bulk validator,
and no change to `TruckBulkLifecycleActions`.

`findBulkBlockers` still changes, but only to stop *misclassifying* suspended trucks in the existing
archive and reactivate bulk paths (D3, item 3) — not to gain a suspend direction.

On the web, the suspended tab renders with `selectable={false}` and no bulk toolbar, which is a first
for the truck workspace: the archived and available tabs both offer selection. This is the honest
rendering of the decision, and it is the one place a reviewer might read the absence as an oversight.

---

## D10 — Web tri-state, and a suspended truck with no available action

**Finding**: the truck workspace reads status as a boolean in exactly five places, and two of them
fail in ways worse than "missing feature":

- `trucks-page.tsx` partitions into `available` and `archived`. A suspended truck currently appears in
  **neither** list — it becomes invisible in the workspace.
- The selection-sync effect maps `selected.status === 'ARCHIVED' ? 'archived' : 'available'`, so
  selecting a suspended truck would bounce the tab to `available`, where the truck is not listed, and
  the "selection no longer valid" effect would then clear it. An unusable loop.
- `truck-details.tsx` offers **Edit truck** whenever `!isArchived`, so a suspended truck would show an
  edit button the API refuses (D5).
- `truck-overview.tsx` computes `Total = available + archived`, undercounting.
- `TruckLifecycleActions` is a binary archive/reactivate switch.

**Decision**: Introduce `TruckLifecycle = 'available' | 'suspended' | 'archived'`, widen the route
search enum, add the third tab and count, and drive every branch off the three-value status.
`TruckLifecycleActions` becomes: available → **Archive truck** and **Suspend truck**; archived →
**Reactivate truck**; suspended → **no lifecycle action**, with a short line stating the truck must be
returned to service before it can be archived, and that returning it to service is not yet available.

That empty state is a real consequence of the issue's boundary (`#253` owns the reverse transition),
not a design gap. It is the second thing to put in front of the plan reviewer: until `#253` ships, an
administrator can put a truck into a state nothing can take it out of except a database write.

**Alternative rejected**: *hide suspended trucks from the workspace entirely until `#253`.* It would
avoid the dead-end screen, but it makes FR-015 (a suspended truck stays readable and distinguishable)
undeliverable, and hiding a live reference is exactly the failure the issue is trying to end.
