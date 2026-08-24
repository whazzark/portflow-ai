# Tasks: Archive Docks

**Input**: Design documents from
`specs/site-references/operational-checkpoints/docks/archive-docks/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Observable business behavior follows RED → GREEN → REFACTOR (Constitution Principle IV).
Test tasks must be written and observed failing (or, for already-correct backend behavior, written
and observed passing — a real gap if they don't) before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

Per `plan.md`/`research.md` D1, the **individual**-archive backend (`ArchiveDockUseCase`,
`archiveDockValidator`, `DockPolicy.archive`, `LucidDockRepository.archiveAvailable`) already exists
and is already unit-tested — US1's backend work is an HTTP-level test top-up, not new production
code. The **bulk** surface does not exist at any layer and is this feature's primary deliverable
(US2). US1 and US2 touch disjoint files (confirmed below), so despite both being P1 they can be
staffed and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: Maps a task to its user story from `spec.md`.

---

## Phase 1: Setup

**Purpose**: Extend the checkpoints route's URL contract to carry the new select mode.

- [X] T001 Add a `selecting` search param (`z.enum(['docks']).optional().catch(undefined)`) to the checkpoints search schema in `apps/web/src/routes/_authenticated/checkpoints.tsx`, parallel to the existing `create` and `edit` params (`contracts/dock-archive-ui-state.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the bulk-lifecycle validator pieces the Customer domain already built into the
shared site-reference validator module, so the Dock bulk validator (US2) consumes one rule instead
of a second copy of it (`research.md` D2).

**⚠️ CRITICAL**: US2's validator cannot be written correctly until this phase is complete. US1 does
not depend on it and may proceed in parallel.

- [X] T002 Move the `distinctUuids` rule and the `lifecycleIds`/`lifecycleComment` factory functions out of `apps/api/app/customers/shared/customer_validator.ts` into `apps/api/app/site_references/shared/site_reference_validator.ts`, alongside the existing `nonBlank` rule, with identical rule names, messages, and behavior
- [X] T003 Update `apps/api/app/customers/shared/customer_validator.ts` to import and use the extracted `distinctUuids`/`lifecycleIds`/`lifecycleComment` from `site_reference_validator.ts` in place of its local copies — no behavior change (depends on T002)
- [X] T004 Run the existing Customer bulk-lifecycle suites (`apps/api/tests/integration/customers/lifecycle/bulk/*.spec.ts`, `apps/api/tests/unit/customers/lifecycle/bulk/*.spec.ts`) and confirm they are still green after T002–T003 — the regression guard for the extraction (depends on T003)

**Checkpoint**: The shared bulk-lifecycle validator rules have one home. US1 and US2 implementation
can now both proceed.

---

## Phase 3: User Story 1 - Archive One Eligible Dock (Priority: P1) 🎯 MVP candidate A

**Goal**: An authorized administrator opens an available dock and archives it, optionally with a
comment, through the existing (already-correct) backend — the dock stops appearing for new
discharge assignment while staying consultable.

**Independent Test**: Select an available dock with no planned/active discharge referencing it,
archive it with and without a comment, and verify it is shown Archived with lifecycle metadata
while remaining consultable (spec.md, US1).

### Tests for User Story 1 (write and observe first — most should go GREEN immediately per research D1)

- [X] T005 [P] [US1] Add HTTP-level integration tests for the individual archive endpoint in `apps/api/tests/integration/docks/lifecycle/archive.spec.ts` (new file): unauthenticated → 401 `E_UNAUTHORIZED_ACCESS`; non-admin → 403 `E_AUTHORIZATION_FAILURE`; happy path with a comment → 200 with `archivedAt`/`archivedByUserId`/`archiveComment` set; happy path with no comment → 200 with `archiveComment` null; already-archived → 409 `E_DOCK_ALREADY_ARCHIVED`; in-use (via `createPersistedDockUsageScenario`) → 409 `E_DOCK_IN_USE`; unknown id → 404 `E_DOCK_NOT_FOUND` — every refusal case asserted to leave the dock row unchanged (`contracts/dock-archive-api.md` requirement-to-test mapping; `research.md` D1)
- [X] T006 [P] [US1] Add a web test for the individual archive UI in `apps/web/src/features/docks/__tests__/archive/individual.test.tsx`: an "Archive dock" action is offered on an available dock's details sheet for an administrator and not for an Observer; it is not offered on an archived dock; activating it opens a confirmation with an optional comment field; confirming succeeds, shows a success toast, and the dock's marker and details switch to Archived without a manual reload; the archive action then disappears from that dock's details (`quickstart.md` scenarios 1–3; `contracts/dock-archive-ui-state.md`)

### Implementation for User Story 1

- [X] T007 [P] [US1] Add an `archive` mutation (`tuyauQuery.docks.archive.mutationOptions({ onSuccess: () => invalidateDocks() })`) to `apps/web/src/features/docks/mutations/use-dock-mutations.ts`, mirroring `use-customer-mutations.ts`'s `archive`
- [X] T008 [US1] Create `apps/web/src/features/docks/ui/dock-lifecycle-actions.tsx`: the archive-only counterpart of `customers/ui/lifecycle-actions.tsx` (no `isArchived`/reactivate branch — research D6), an `AlertDialog` with an optional 1000-char comment field, calling the T007 mutation and toasting on success/failure (depends on T007)
- [X] T009 [US1] Render `DockLifecycleActions` in `apps/web/src/features/docks/ui/dock-details.tsx`'s footer, alongside "Edit dock", only when `canEdit && dock.status === 'AVAILABLE'` (depends on T008)
- [X] T010 [US1] Run the focused US1 tests (T005, T006) and refactor without changing behavior

**Checkpoint**: An administrator can archive one available dock end-to-end, with or without a
comment. US1 is independently demonstrable.

---

## Phase 4: User Story 2 - Archive a Selection of Eligible Docks Together (Priority: P1) 🎯 MVP candidate B

**Goal**: An authorized administrator selects several docks on the checkpoints map and archives every
eligible one in a single action, with every blocked dock reported individually with its reason.

**Independent Test**: Select a mix of eligible and ineligible docks (in use, already archived, and an
unknown id via the API), submit one archive action with a shared comment, and verify eligible docks
archive while every blocked dock is reported with `NOT_FOUND` / `IN_USE` / `ALREADY_ARCHIVED` (spec.md,
US2).

### Tests for User Story 2 (write and observe RED first — this surface is entirely new)

- [X] T011 [P] [US2] Add bulk archive integration tests in `apps/api/tests/integration/docks/lifecycle/bulk/archive.spec.ts` (new file), mirroring `apps/api/tests/integration/customers/lifecycle/bulk/archive.spec.ts`: unauthenticated → 401; non-admin → 403; empty `ids` → 422 with zero docks touched; duplicate ids, including case-differing → 422 with zero docks touched; a malformed (non-UUID) id → 422 with zero docks touched; an over-1000-char comment → 422 with zero docks touched; a fully-eligible selection archives every dock with the shared comment; a mixed selection (one used-by-discharge, one unknown id, one already-archived, one eligible) archives only the eligible one and reports the other three with `IN_USE`/`NOT_FOUND`/`ALREADY_ARCHIVED` respectively, both lists in request order; a selection that is entirely blocked (none eligible) still returns 200 with an empty `updatedDocks` and every entry blocked, not a 422 (`contracts/dock-archive-api.md`; spec edge case "a selection that becomes entirely blocked… is not treated as an empty selection")
- [X] T012 [P] [US2] Add a concurrency integration test in `apps/api/tests/integration/docks/lifecycle/bulk/archive.spec.ts`: fire two overlapping bulk archive requests that both include the same dock id at nearly the same time and assert exactly one archives it while the other reports `ALREADY_ARCHIVED` for that id (`research.md` D5; spec FR-016; quickstart scenario 11)
- [X] T013 [P] [US2] Add a unit test for the bulk archive path in `apps/api/tests/unit/docks/lifecycle/bulk_archive.spec.ts` (new file), mirroring the Customer bulk-archive unit spec: `findBulkBlockers` produces the correct reason per case (missing, wrong status, in-use) and `ArchiveDocksUseCase`/`LucidDockRepository.archiveAvailableMany` partitions a mixed id list into `updatedDocks`/`blockedDocks` correctly
- [X] T014 [P] [US2] Add a select-mode component test in `apps/web/src/features/checkpoints/__tests__/bulk-archive/select-mode.test.tsx`: activating "Select docks" sets `selecting=docks`, hides the create/edit entry points, and turns dock-marker clicks into checked-state toggles instead of opening the details sheet; a weighing-area marker click still opens its details sheet unchanged; an archived dock's marker is not checkable while selecting (`contracts/dock-archive-ui-state.md`; quickstart scenario 5)
- [X] T015 [P] [US2] Add a bulk action bar component test in `apps/web/src/features/checkpoints/__tests__/bulk-archive/bulk-archive-actions.test.tsx`: the bar is hidden until at least one dock is checked; "Archive selected" opens a confirmation with an optional shared comment; a fully-eligible submission clears the selection and shows a success toast naming the count; a mixed submission keeps only the `IN_USE`-blocked ids checked, lists every blocked dock with its reason, and offers "Retry blocked docks" (`contracts/dock-archive-ui-state.md`; quickstart scenarios 6–7)

### Implementation for User Story 2 — backend

- [X] T016 [P] [US2] Create `apps/api/app/docks/shared/dock_lifecycle_blockers.ts` mirroring `customer_lifecycle_blockers.ts`: `indexDocksById`, `orderDocks`, and `findBulkBlockers(ids, docksById, expectedStatus, usedIds?)` producing `{ id, name?, reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE' }` (`data-model.md`)
- [X] T017 [US2] Add `ArchiveDocksCommand`, `BulkDockLifecycleResult`, and an abstract `archiveAvailableMany(command): Promise<BulkDockLifecycleResult>` to `apps/api/app/docks/shared/repositories/dock_repository.ts`, re-exporting `BulkDockLifecycleBlocker` from T016 (depends on T016)
- [X] T018 [US2] Implement `archiveAvailableMany` in `apps/api/app/docks/shared/repositories/lucid_dock_repository.ts`: one `Dock.transaction`, lock candidate rows with `.forUpdate()`, compute blockers via T016's `findBulkBlockers` plus one bulk `SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'DOCK', referenceIds: command.ids, client: trx })` call, then `UPDATE … WHERE id IN (eligibleIds) AND status = 'AVAILABLE'` in one statement, mirroring `LucidCustomerRepository.archiveAvailableMany` (depends on T017)
- [X] T019 [P] [US2] Add `archiveDocksValidator` to `apps/api/app/docks/shared/dock_validator.ts`, built from the T002/T003 shared `lifecycleIds`/`lifecycleComment` factories (depends on T003)
- [X] T020 [US2] Create `apps/api/app/docks/archive/archive_docks_use_case.ts`: a thin wrapper delegating to `dockRepository.archiveAvailableMany`, mirroring `archive_customers_use_case.ts` (depends on T018)
- [X] T021 [US2] Add `archiveMany` to `apps/api/app/controllers/docks_controller.ts`: inject `ArchiveDocksUseCase`, authorize via the existing `DockPolicy.archive`, validate with T019's `archiveDocksValidator`, call the use case, and serialize `{ updatedDocks: DockTransformer.transform(...), blockedDocks }` (depends on T019, T020)
- [X] T022 [US2] Register `router.post('/archive', [controllers.Docks, 'archiveMany']).as('archive_many')` in `apps/api/start/routes.ts`, inside the `docks` group and before the existing `/:id/archive` route, matching the Customer group's ordering (depends on T021)

### Implementation for User Story 2 — frontend

- [X] T023 [P] [US2] Add an `archiveMany` mutation (`tuyauQuery.docks.archive_many.mutationOptions()`) to `apps/web/src/features/docks/mutations/use-dock-mutations.ts` (depends on T022 for the generated route type)
- [X] T024 [P] [US2] Add `BulkDockLifecycleResult`/`BulkDockLifecycleBlocker` types to `apps/web/src/features/docks/types.ts`, derived from `Route.Response<'docks.archive_many'>`, mirroring `customers/types.ts` (depends on T022)
- [X] T025 [US2] Add an optional `checked` prop to `apps/web/src/features/checkpoints/map/checkpoint-marker.tsx` that renders a selection ring, additive to the marker's existing `selected`-driven styling
- [X] T026 [US2] Thread `selectMode: 'docks' | undefined`, `checkedIds: Set<string>`, and `onToggleChecked: (id: string) => void` through `apps/web/src/features/checkpoints/map/checkpoint-map.tsx` to each `DOCK` marker, routing its click to `onToggleChecked` instead of `onSelect` while active and leaving `WEIGHING_AREA` markers on the existing `onSelect` path (depends on T025)
- [X] T027 [US2] Add an admin-only "Select docks" toggle to `apps/web/src/features/checkpoints/ui/checkpoint-map-controls.tsx`, visible only when the `DOCK` layer is visible, navigating `selecting` to `'docks'`/`undefined`
- [X] T028 [US2] Create `apps/web/src/features/checkpoints/ui/bulk-archive-docks-actions.tsx`: the archive-only counterpart of `customers/ui/bulk-lifecycle-actions.tsx` (no reactivate branch — research D6), calling the T023 mutation and rendering the T024 result's `blockedDocks` (depends on T023, T024)
- [X] T029 [US2] Wire `apps/web/src/features/checkpoints/ui/checkpoints-page.tsx`: own `checkedDockIds`/`blockedDocks` state; pass `selectMode`/`checkedIds`/`onToggleChecked` into `CheckpointMap` when `selecting === 'docks'`; suppress the `checkpoint` sheet-opening navigation for dock clicks while selecting; only wire `onToggleChecked` for `AVAILABLE` docks; clear checked/blocked state on search/status/kind changes and when create or edit starts; render `BulkArchiveDocksActions`, on success keeping only `IN_USE`-blocked ids checked (mirrors `customers-page.tsx`'s `onSuccess`) (depends on T001, T026, T027, T028)
- [X] T030 [US2] Run the focused US2 tests (T011–T015) and refactor the select-mode/bulk-action wiring without changing behavior

**Checkpoint**: An administrator can select and archive a batch of eligible docks end-to-end, with
mixed selections partially succeeding and reporting per-dock reasons. US1 and US2 together form the
MVP.

---

## Phase 5: User Story 3 - Reject Invalid Selections and Protect What Must Not Change (Priority: P2)

**Goal**: Empty, malformed, or duplicate selections are rejected before any dock changes;
unauthorized actors are refused for both the individual and bulk paths; an administrator can resume
a multiple-archive attempt after some docks were blocked without re-touching what already succeeded.

**Independent Test**: Attempt an empty selection, a duplicated id, a malformed id, and an
unauthorized bulk/individual archive; verify every attempt is refused before any dock changes; then
from a partially-blocked bulk result, drop the blocked docks and resubmit, verifying the
already-archived docks are not re-touched (spec.md, US3).

> Most of US3's guard behavior is already proven by T005 (individual auth/lifecycle refusals) and
> T011 (bulk empty/duplicate/malformed/auth refusals) — those tasks were written against US3's
> acceptance criteria from the start, per `research.md` D1/D3, because the individual and bulk paths
> share one set of rules (plan.md Constitution Check, principle II). This phase adds the coverage
> that is genuinely specific to US3 and not a byproduct of building US1/US2.

### Tests for User Story 3 (write and observe RED first)

- [X] T031 [P] [US3] Add a resubmission test in `apps/web/src/features/checkpoints/__tests__/bulk-archive/resubmission.test.tsx`: from a bulk result with a mix of archived and `IN_USE`-blocked docks, drop the still-checked blocked docks and resubmit; assert the resubmission's `updatedDocks` contains only the newly-archived docks and does not re-report or attempt the docks already archived in the prior request (spec FR-018; quickstart scenario 8)
- [X] T032 [P] [US3] Add a consolidated permission test in `apps/web/src/features/docks/__tests__/archive/permissions.test.tsx`: for an Observer, neither "Archive dock" (on any dock status) nor "Select docks" is rendered anywhere on `/checkpoints`; forcing `selecting=docks` via the URL as an Observer renders no checkable markers and no bulk action bar (spec US3 AC3; quickstart scenario 10)

### Implementation for User Story 3

- [X] T033 [US3] Close any gap T031/T032 find: confirm `BulkArchiveDocksActions`'/`checkpoints-page.tsx`'s success handling keeps exactly the `IN_USE`-blocked ids checked and nothing else (per `contracts/dock-archive-ui-state.md`), and confirm both the "Archive dock" action and the "Select docks" toggle are gated on the same administrator check used elsewhere on the page
- [X] T034 [US3] Run the focused US3 tests (T031, T032) and refactor without changing behavior

**Checkpoint**: All three user stories are independently functional. Every refusal path — individual,
bulk, and the request-validity gate in front of bulk — is proven end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T035 [P] Confirm `apps/web/src/components/resource-map/resource-map-placement.tsx` and `resource-map-workspace.tsx` are unchanged and their public surface stays resource-agnostic — no `Dock`/`DockDto`/select-mode leakage — so future Weighing Area / Warehouse consumers are unaffected (`plan.md` Structure Decision)
- [X] T036 [P] Verify accessibility across the new UI: the "Select docks" toggle exposes its pressed/active state; a checked marker has a text alternative (not color-only); `BulkArchiveDocksActions`' toolbar and `DockLifecycleActions`' dialog follow the same `role`/labeling conventions already used by `bulk-lifecycle-actions.tsx`/`lifecycle-actions.tsx`; the comment textarea is labelled in both
- [X] T037 Run the full `quickstart.md` validation, scenarios 1–15, against a running app with the fixtures listed in its Prerequisites (five available docks, one archived dock, one discharge-referenced dock)
- [X] T038 Run `pnpm typecheck`, `pnpm check`, and the full fast test suites (`pnpm --filter @portflow/api test`, `pnpm --filter @portflow/web test`) and resolve any fallout (Constitution Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: No dependencies on Phase 1. **Blocks US2's validator task (T019)**
  only — US1 does not depend on it.
- **User Stories (Phases 3–5)**: US1 depends only on nothing beyond the existing codebase and may
  start immediately. US2 depends on Phase 2 (for T019) and Phase 1 (for T029). US3 depends on both
  US1 and US2 being implemented, since it tests guard behavior across both paths.
- **Polish (Phase 6)**: Depends on all three stories.

### Within Phase 2

T002 → T003 → T004 are strictly sequential (extract, then consume, then verify no regression).

### User Story Dependencies

- **US1 (P1)**: No dependency on Phase 2 or on US2. Fully self-contained — the individual backend
  already exists; only frontend wiring and an HTTP test top-up are added. Can ship alone as a
  minimal MVP.
- **US2 (P1)**: Depends on Phase 1 (T001) and Phase 2 (T002–T003, for T019). Does **not** depend on
  US1 — no file US1 touches is touched by US2 (see below). Can be built by a different person at the
  same time as US1.
- **US3 (P2)**: Depends on US1 and US2 both being implemented; its tests exercise behavior from
  both paths and its resubmission test needs US2's bulk action bar to exist.

### Cross-story file contention

`use-dock-mutations.ts` is touched by T007 (US1, adds `archive`) and T023 (US2, adds
`archiveMany`) — two different functions in the same file, so run them sequentially rather than
truly in parallel to avoid a merge conflict, even though nothing else couples them. Every other file
US1 touches (`dock-details.tsx`, the new `dock-lifecycle-actions.tsx`) is untouched by US2, and every
file US2 touches (`checkpoints-page.tsx`, `checkpoint-map.tsx`, `checkpoint-map-controls.tsx`,
`checkpoint-marker.tsx`, all of `apps/api/app/docks/archive/`, `dock_repository.ts`,
`lucid_dock_repository.ts`, `dock_validator.ts`, `docks_controller.ts`, `routes.ts`) is untouched by
US1. This is what makes the two P1 stories genuinely independently deliverable.

### Parallel Opportunities

- Phase 2: T002 must precede T003 must precede T004 — no internal parallelism.
- US1: T005 and T006 in parallel (different files, API vs. web); then T007 and T006's UI don't block
  each other, but T008 needs T007 done first.
- US2: T011–T015 all in parallel (five different test files, two backend/three frontend); on the
  backend, T016 unblocks T017 and T019 (T017→T018 sequential, T019 independent of T017/T018); on the
  frontend, T023 and T024 can run in parallel once T022 lands, and T025 can start immediately
  (touches only the marker) while the backend chain runs.
- US3: T031 and T032 in parallel.
- Phase 6: T035 and T036 in parallel.

---

## Parallel Example: User Story 2

```bash
# All five US2 test tasks touch different files — launch together:
Task: "Bulk archive integration tests in apps/api/tests/integration/docks/lifecycle/bulk/archive.spec.ts"
Task: "Bulk archive concurrency test in apps/api/tests/integration/docks/lifecycle/bulk/archive.spec.ts"
Task: "Bulk archive unit test in apps/api/tests/unit/docks/lifecycle/bulk_archive.spec.ts"
Task: "Select-mode component test in apps/web/src/features/checkpoints/__tests__/bulk-archive/select-mode.test.tsx"
Task: "Bulk action bar component test in apps/web/src/features/checkpoints/__tests__/bulk-archive/bulk-archive-actions.test.tsx"
```

---

## Implementation Strategy

### MVP First

Both US1 and US2 are P1 because the issue's delivery boundary explicitly bundles individual and
multiple archive as one outcome (spec "Delivery boundary"; plan.md Constitution Check, principle
II). The true minimum shippable slice is **both**:

1. Phase 1 (T001) + Phase 2 (T002–T004).
2. Phase 3 (US1, T005–T010) and Phase 4 (US2, T011–T030) — independently, in parallel if staffed,
   or US1 first since it is the smaller of the two and de-risks the shared
   `use-dock-mutations.ts` file before US2 touches it.
3. **STOP and VALIDATE**: `quickstart.md` scenarios 1–9, 11–12, 14.
4. At this point every rule in the spec is already enforced by the backend (individual: since #178;
   bulk: built in Phase 4) — US3 makes the request-validity and resubmission guarantees *proven*,
   not *true*.

### Incremental Delivery

1. Setup + Foundational → route contract extended, shared validator rules have one home.
2. + US1 → demo archiving a single dock (smallest possible MVP slice, if a partial demo is needed).
3. + US2 → demo batch archiving with partial success (completes the issue's stated MVP).
4. + US3 → request-validity gate and resubmission behavior proven end-to-end.
5. Polish → quickstart, accessibility, full suites.

### A note on the individual-path backend tasks

T005 tests behavior that is **already implemented and already unit-tested**. Write it before
running it, and expect it to go GREEN on first run. A test that goes RED here has found a real
defect in the existing #178 implementation — fix the implementation, do not soften the test to match
it.

---

## Notes

- [P] tasks = different files, no dependencies.
- Verify tests fail before implementing, except where noted for the pre-existing individual-archive
  backend behavior (T005).
- Commit after each task or logical group; Conventional Commits, on `feat/200-archive-dock`.
- Two decisions in `research.md` were resolved without user confirmation and are worth re-raising at
  review: **D4** (multi-select as a map mode rather than a table page) and **D6** (the Dock
  lifecycle-actions components are archive-only, with reactivate left entirely to #201). Changing
  either is a spec/plan change, not a task change.
