# Research: Create and Inspect Planned Shifts

**Feature**: `GH-63` | **Date**: 2026-09-17 | **Plan**: [plan.md](./plan.md)

The Technical Context has no open question: the stack, test seams, and preparation model are all
delivered by GH-53, GH-54, GH-55, and GH-58. The decisions below settle how this slice fits them.

## Decision 1 — One `POST /discharges/:dischargeId/shifts` command answered with the detail

**Decision**: Adding a shift is a single command whose body carries the shift's client-generated
`id`, its planned period, its responsible, and optional `truckIds`, `warehouseDoorIds`, and
`weighingAreaIds`. It answers with the whole discharge detail, `201` when the shift is added and `200`
when the same `id` already names a shift of this discharge.

**Rationale**:
- Every delivered preparation command answers with `DischargeDetailTransformer`, which the web writes
  straight into the detail query (`applyDetail`). The new shift, the renumbered shifts, the section
  counts, and the gaps all refresh in one round trip (FR-014).
- The resource lists have the exact shape of `plannedShiftCorrectionValidator`, so the web reuses the
  correction's resource fields and refusal mapping (`listRefusals`) without a second format.
- A client-generated identity is how `CreatePlannedDischargeUseCase` already makes a creation
  idempotent (FR-015). The sheet generates it when it opens and keeps it across retries, so a
  resubmitted or double-clicked save finds the shift it already added.

**Alternatives considered**:
- Adding the shift, then selecting resources through `PUT /shifts/:shiftId`: two writes, not atomic
  (FR-011), and a refusal of a resource would leave a shift without it.
- An `Idempotency-Key` header: no precedent in the API, and a second mechanism beside the creation's.
- Comparing the replayed payload with the stored shift: the creation deliberately does not, because an
  identity only lives as long as one open form.

## Decision 2 — The discharge lock admits planned and active discharges; a replay is answered first

**Decision**: A new guard, `lockDischargeOpenToShifts`, locks the discharge `FOR UPDATE` and refuses
an unknown one with `E_DISCHARGE_NOT_FOUND` (404) and a closed one with a new `E_DISCHARGE_CLOSED`
(409). Under that lock, the use case first looks up the submitted `id` in this discharge. When found,
it answers the replay (`200`) before any status or rule check. Only then does it check the discharge's
status and the shift rules.

**Rationale**:
- `lockPlannedDischarge` refuses active discharges, and the spec admits them (FR-004).
- Every shift writer already locks the discharge first, and the start confirmation (GH-56, GH-65) will
  lock the same row. Holding it serializes additions with each other, with corrections, and with a
  start, so the overlap, started-shift, and sequence rules are judged on the state at commit (FR-024).
- A replay that finds its shift succeeded earlier. Answering it before the status check means a
  discharge started or closed between the first attempt and its retry does not turn a success into
  a refusal.
- A shift `id` that exists in another discharge is not found in this one. Its insert then hits the
  primary key and comes back as a `DUPLICATE_ID` outcome, refused with `E_SHIFT_ID_CONFLICT` (409).
  Only a forged request reaches it.

**Alternatives considered**: A database exclusion constraint on shift periods. The schema has none,
every delivered period rule relies on the discharge lock, and a partial overlap constraint would need
the `btree_gist` extension for one rule the lock already guarantees.

## Decision 3 — Resources on an active discharge are refused as a state conflict, not a field error

**Decision**: When the locked discharge is `ACTIVE` and any resource list is non-empty, the addition is
refused with the existing `E_DISCHARGE_NOT_PLANNED` (409) before any reference is locked. The web
hides the resource fields on an active discharge, so only a stale form or a forged request sends them.

**Rationale**:
- User Story 5 scenario 2 describes exactly the stale case: a form opened with resources on a
  planned discharge that started meanwhile. The user must be told the discharge has started, and must
  keep their period and responsible. The web already maps `E_DISCHARGE_NOT_PLANNED` to "the discharge
  has started" for every preparation form.
- A `422` on `truckIds` would read as "this truck is wrong", when the list itself is no longer allowed.

**Alternatives considered**: Silently dropping the resources and adding the shift. That would add a
shift the user did not submit, and contradicts FR-010.

## Decision 4 — "After every started shift" compares planned starts until GH-65 records actual ones

**Decision**: A pure rule refuses a period whose `plannedStartAt` is not strictly after the latest
start of the discharge's `ACTIVE` or `COMPLETED` shifts. The issue is reported on `plannedStartAt`
with rule `shiftAfterStartedShifts`. The start compared is the shift's planned start, because the
`shifts` table has no actual start column yet. The rule takes that start through one function,
`startedShiftStart`, which GH-65 must change to prefer the actual start once it adds the column.

**Rationale**:
- The spec's edge case states the rule uses the actual start once one is recorded and the planned
  start until then. Today no slice records one. Seeds are the only source of active discharges.
- Isolating the choice in one function makes the GH-65 change a single edit covered by this slice's
  unit tests.
- On a planned discharge every shift is planned, so the rule never applies, and a shift may be added
  before, between, or after the others (User Story 1 scenario 4).

**Alternatives considered**: Refusing any period earlier than the last shift of the discharge. That
would forbid adding a planned shift between two planned shifts of an active discharge, which User
Story 2 scenario 4 accepts.

## Decision 5 — Sequences are replanned with the new shift and written with the existing parking

**Decision**: A pure `planAddedShiftSequences(shifts, added)` orders every shift with the new one by
planned start. It returns the new shift's sequence and the existing shifts whose sequence changes. The
repository reuses `renumberShifts`, which parks the changed shifts above the highest sequence before
giving them their final numbers, and then inserts the new shift at its sequence.

**Rationale**:
- `shifts` has a non-deferrable unique index on `(discharge_id, sequence)`. The correction already
  solved moving numbers under it, so the addition reuses that solution instead of a second one.
- Shifts are ordered by planned start everywhere they are shown (FR-013). Numbering by planned start
  keeps the sequence consistent with the correction's `planShiftSequences`.
- On an active discharge the new shift starts after every started shift, so no started shift is
  renumbered. The use case asserts this and throws if a started shift would move, rather than
  renumbering history.

## Decision 6 — The correction's resource planning moves into a shared module

**Decision**: `CorrectPlannedShiftUseCase`'s private `planWarehouseDoors` and `planWeighingAreas` move,
unchanged, to `app/discharges/shared/planned_shift_resources.ts`. That module also calls
`planShiftTruckSelection` and returns one combined plan. The addition calls it with an empty current
selection, and the correction with the shift's current one.

**Rationale**:
- FR-009 requires the addition to apply exactly the correction's resource rules. Sharing the code
  makes that a structural guarantee, not a convention to maintain.
- The lock order stays the one every preparation write takes: discharge, then users, trucks,
  warehouses and doors, and weighing areas.
- `planShiftTruckSelection` already works for a shift id with no selection yet, since it filters the
  discharge's selections by shift id.

## Decision 7 — Readiness gaps are derived by the API and exposed as codes on each shift

**Decision**: A pure module, `app/discharges/shared/planned_shift_readiness.ts`, derives the gaps of a
planned shift from the detail read the API already loads. `DischargeDetailTransformer` exposes them
per shift as `readinessGaps`. The value is an ordered array of codes for a planned shift and `null`
for an active or completed one. The codes are `NO_USABLE_TRUCK`, `NO_USABLE_WAREHOUSE_DOOR`,
`NO_USABLE_WEIGHING_AREA`, and `RESPONSIBLE_NOT_ELIGIBLE`.

Usability follows FR-018:
- a truck is usable when its membership is current, a held pool entry exists for it, and its status is
  `AVAILABLE`;
- a door is usable when its membership is current, the door and its warehouse are `AVAILABLE`, and a
  lot of the discharge currently holds it;
- a weighing area is usable when its membership is current and it is `AVAILABLE`.

The responsible's eligibility is `isEligibleShiftResponsible`.

**Rationale**:
- Eligibility depends on the responsible's role and access status, which the detail keeps out of the
  wire because they are administration context. A gap code tells every role that the responsible is no
  longer eligible, which FR-003 requires, without saying why.
- GH-65 revalidates the same four conditions when a shift starts. A pure API module is what it can
  import, and it keeps the web from deriving a business rule the API must enforce anyway.
- The detail already preloads every membership, reference status, pool entry, and door assignment the
  derivation reads, so it adds no query (SC-008).
- `null` rather than `[]` for started shifts lets the web tell "no gap" from "not applicable" without
  re-reading the status.

**Alternatives considered**:
- Deriving gaps in the web from the detail: this works for resources, but needs a new
  `responsible.eligible` field anyway and duplicates a rule GH-65 needs on the API.
- A separate readiness endpoint: a second request for data the detail already holds, and gaps that
  could disagree with the detail they sit beside.

## Decision 8 — The web adds an `Add shift` sheet beside the shift panel, reusing the edit form's parts

**Decision**: The Shifts section's header gets an `Add shift` action, shown when the viewer
`canPrepareDischarges` and the discharge is not closed. The empty state offers the same action. The
action opens `AddShiftSheet`, a sheet separate from the address-driven `ShiftPanel`, whose form
reuses:
- `planned-shift-fields.tsx` for the period and responsible;
- a `ShiftResourceFields` component extracted from `ShiftEditForm` for the trucks, doors, and weighing
  areas, rendered only while the discharge is planned;
- an `addShiftRulesSchema` in `discharge-preparation-schema.ts` that mirrors the overlap and
  started-shift rules against the current detail.

A successful addition closes the sheet and opens the new shift's panel through `shiftSearch(id)`.

**Rationale**:
- Opening the new shift's panel shows the user exactly what was saved, including its gaps (FR-014).
  It uses the address mechanism GH-55 delivered.
- The form is not kept in the address, as no correction is (GH-53), so a reload discards it, as the
  spec's edge case expects.
- Extracting `ShiftResourceFields` keeps one rendering of offered, current, locked, and refused
  resources for both forms.
- The action label follows the repository's rule: creation buttons may name their object.

**Addendum (2026-09-17)**: a period drawn over the calendar with a mouse or a pen opens the same sheet
with that period entered (`AddShiftSheet`'s `period`). The sheet stays the only addition flow: drawing
only replaces the default period, and touch and keyboard users keep the `Add shift` action.

**Alternatives considered**: Selecting a slot by a single click with a fixed duration, which cannot
draw a shift of another length or across midnight in one gesture. An
`add` view inside `ShiftPanel`, which would tie a form with no shift to a panel keyed by a shift id in
the address.

## Decision 9 — Gaps are shown in the shift details and replace the calendar's truck-only marker

**Decision**: `ShiftDetails` gets a `Readiness` block for planned shifts. It lists each gap as a
sentence or states "Nothing missing", and never says "ready". For a viewer who may correct the shift,
it offers `Edit`, plus `Go to truck pool` when the discharge holds no truck. In the calendar, the
current `lacksTrucks` warning border becomes `hasGaps`, derived from `readinessGaps.length > 0`, and
gains a warning icon and a screen-reader phrase naming the number of gaps, so colour is not the only
signal (FR-020). The Overview preparation summary keeps its GH-55 counts.

**Rationale**:
- The calendar already marks planned shifts with no truck. Widening that marker to every gap keeps a
  single signal to learn, and meets SC-007 without opening a shift.
- The summary's counts were specified by GH-55, and the spec leaves them unchanged.
