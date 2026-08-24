# Implementation Plan: Update a Weighing Area

**Branch**: `feat/204-update-weighing-area` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-checkpoints/weighing-areas/update-a-weighing-area/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Let an authorized administrator correct an available weighing area's name and map position from the
existing checkpoint consultation map (`/checkpoints`), by opening an edit mode on the selected
weighing area, dragging its marker or typing new coordinates, and saving.

Research into the current codebase found the same shape as #199 (Update a Dock), one step further
along: the **write path already exists and is correct** — `PATCH /api/v1/weighing-areas/:id`,
`updateWeighingAreaValidator`, `UpdateWeighingAreaUseCase`, `WeighingAreaPolicy.update`, and
`LucidWeighingAreaRepository.updateAvailable` together already enforce every rule the spec requires:
trimmed non-blank name, 255-character cap, case-insensitive cross-status uniqueness (via the
`LOWER(name)` unique index), coordinate ranges, administrator-only authorization, active-user
enforcement (in `auth_middleware`), archived-is-read-only (the update query is scoped to
`status = 'AVAILABLE'`), and not-found. **No production backend code changes.**

What is missing is (a) the entire frontend, and (b) API *test* coverage for the update paths that
were never exercised: unauthorized update, empty-body update, duplicate name, self-name
resubmission, archived read-only, not-found, and coordinate range at the HTTP boundary. So this is
again a **frontend-delivery slice with a backend test-coverage top-up**.

The frontend approach is **generalization, not duplication**. #199 already built the complete
map-edit mechanism — URL-addressable edit mode, draft placement marker replacing the real one,
origin snapshot, editability frozen at session start, sheet non-modal while editing, creation
control hidden mid-edit — but bound every piece of it to docks: `edit === 'dock'`,
`isEditingDock`, `draftDockPlacement`, `EditDockPanel`, and `canEditDock` / `onEditDock` on
`CheckpointSheet`. This slice lifts that machinery to be keyed by **checkpoint kind + id** rather
than by "the dock", and plugs weighing areas in as its second consumer. Doing it this way is what
makes spec FR-023 (session scoping) nearly free here: the three leaks fixed after review of #199
are inherited rather than re-created, which a parallel weighing-area edit path would have had to
rediscover.

## Technical Context

**Language/Version**: TypeScript (apps/web: React 19 via TanStack Start; apps/api: AdonisJS on Node.js)

**Primary Dependencies**: TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query` (typed client), Zod, `sonner`, Radix-based `Sheet`/`Field` primitives; backend: AdonisJS, VineJS, Lucid, Bouncer (all pre-existing; only tests added)

**Storage**: PostgreSQL via the existing `weighing_areas` table — no migration, no schema change

**Testing**: Vitest + Testing Library + MSW for `apps/web`; Japa for `apps/api` (new update-path integration and unit tests added to the existing weighing-area spec files)

**Target Platform**: Web application (desktop and tablet browsers)

**Project Type**: Web application monorepo (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: Corrected name/position visible in the map collection within 2 seconds of a successful save (SC-001); single-row `UPDATE`, no new backend load characteristics

**Constraints**: Must reuse the existing `/checkpoints` route, its `checkpoint=<kind>:<id>` selection contract, and the `resource-map-placement` primitive from #198; must generalize the #199 edit machinery in place rather than adding a second, weighing-area-specific edit path; must not regress any behavior #199 delivered for docks (its five test files are the regression net); must not change any production backend file

**Scale/Scope**: One existing UI mode widened from one checkpoint kind to both; one form component generalized; no new API surface, no new persisted entity, no data migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected feature intent is versioned** — PASS. This spec was created from issue #204,
  selected off the Weighing Areas roadmap (#191). Not speculative bulk expansion.
- **II. One independently deliverable feature per spec** — PASS. Scope is exactly "update a weighing
  area" end-to-end (entry point → existing API → visible corrected result). Archive (#205) and
  reactivate (#206) stay out, as does updating any other site reference type (spec FR-025). The
  slice is not split into API-only or interface-only work: the API test top-up is part of the same
  slice because those rules are this slice's rules. The generalization of the shared checkpoint edit
  machinery is in scope because it is the means of delivering this behavior, not a separate refactor
  — and it is bounded: no dock behavior changes, only the names and keys of the state that carries
  it.
- **III. Vanilla Spec Kit gates** — PASS. No repository-owned delivery state machine introduced.
- **IV. Test-first observable behavior** — PASS with the same scope note as #199. The backend
  *implementation* exists, but seven of its observable behaviors are untested at the HTTP boundary
  (unauthorized, empty body, duplicate name, self-name resubmission, archived read-only, not-found,
  coordinate range) plus three at the use-case level (archived, not-found, duplicate on the update
  path). Those get RED→GREEN tests here, each written before it is run. All new frontend behavior is
  RED→GREEN.
- **V. Deep boundaries and explicit contracts** — PASS. The UI calls the existing typed
  `weighingAreas.update` contract through a mutation hook, exactly as `docks.update` is called by
  `checkpoints-page.tsx`. No layer is shortcut; no controller, use case, or repository is modified.
- **VI. Durable knowledge has a home** — PASS. No new domain vocabulary or architectural decision
  needing `CONTEXT.md`/ADR treatment. Weighing Area and Checkpoint vocabulary is reused from
  #202/#203. The one judgment call with durable reach — update does **not** run the usage check that
  archival runs — is recorded as decision D10 in `research.md`.
- **VII. Verification is part of delivery** — Deferred to implementation/verification phases.
- **VIII. One workflow owner** — PASS. Artifacts stay inside Spec Kit.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/weighing-areas/update-a-weighing-area/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── weighing-area-update-api.md
│   └── checkpoint-edit-ui-state.md
├── checklists/
│   └── requirements.md  # /speckit-specify output
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/                                        # No production change — tests only
├── app/weighing_areas/
│   ├── update/update_weighing_area_use_case.ts   # UNCHANGED — already implements every backend FR
│   ├── shared/weighing_area_validator.ts         # UNCHANGED — updateWeighingAreaValidator already correct
│   ├── shared/weighing_area_policy.ts            # UNCHANGED — `update` already admin-only
│   ├── shared/weighing_area_exceptions.ts        # UNCHANGED — the three update outcomes already exist
│   └── shared/repositories/lucid_weighing_area_repository.ts  # UNCHANGED — updateAvailable already scopes to AVAILABLE
├── app/controllers/weighing_areas_controller.ts  # UNCHANGED — `update` already wired at PATCH /api/v1/weighing-areas/:id
└── tests/
    ├── integration/weighing_areas.spec.ts        # MODIFIED — add unauthorized / empty-body / duplicate / self-name / archived / not-found / range cases
    └── unit/weighing_areas/weighing_area_use_cases.spec.ts  # MODIFIED — add archived + not-found + duplicate cases on the update path

apps/web/
├── src/components/resource-map/
│   ├── resource-map-placement.tsx                # UNCHANGED — reused verbatim, as by create and by #199
│   └── resource-placement-fields.tsx             # UNCHANGED — `useCoordinateFields` already seeds from any LatLng
├── src/features/checkpoints/
│   ├── use-checkpoint-edit-session.ts            # NEW — the edit-session state and its three review-hardened rules, keyed by kind + id
│   ├── ui/
│   │   ├── checkpoints-page.tsx                  # MODIFIED — edit wiring generalized from dock-only to per-kind
│   │   └── checkpoint-sheet.tsx                  # MODIFIED — `canEditDock`/`onEditDock` → kind-agnostic edit props
│   └── __tests__/                                # MODIFIED/NEW — session-scoping coverage extended across kinds
├── src/features/weighing-areas/
│   ├── mutations/use-weighing-area-mutations.ts  # MODIFIED — add `update` mutation + shared invalidation
│   ├── ui/
│   │   ├── weighing-area-form.tsx                # MODIFIED — generalized to create *and* update, mirroring dock-form.tsx
│   │   ├── edit-weighing-area-panel.tsx          # NEW — Sheet panel, mirrors edit-dock-panel.tsx
│   │   ├── create-weighing-area-panel.tsx        # MODIFIED — keeps consuming the generalized form
│   │   └── weighing-area-details.tsx             # MODIFIED — add the "Edit weighing area" entry point
│   └── __tests__/update/                         # NEW — update, validation, permissions, placement, session
├── src/features/docks/ui/edit-dock-panel.tsx     # UNCHANGED — its props already match the generalized session
└── src/routes/_authenticated/checkpoints.tsx     # MODIFIED — `edit` enum accepts 'weighing-area'
```

**Structure Decision**: Web application monorepo, already in place. No backend production file is
added or changed.

The map-editing mechanism is **not** rebuilt and **not** copied. `checkpoints-page.tsx` currently
carries the edit session as three dock-named pieces of state plus an effect whose comments record
three real defects found in review of #199 (edit state outliving its selection, the creation control
tearing down an in-progress edit, and a live-data comparison letting another administrator's move
masquerade as this administrator's unsaved change). That effect is the single most delicate part of
the feature, and it doubles in subtlety once it must key on *which kind* is being edited. It moves
to `use-checkpoint-edit-session.ts` so it has one testable home rather than two divergent copies —
see research decision D3.

Resource-specific work stays in each feature directory, as it already does:
`edit-weighing-area-panel.tsx` and the generalized `weighing-area-form.tsx` live under
`features/weighing-areas`, mirroring `edit-dock-panel.tsx` / `dock-form.tsx` one-for-one. The two
forms are deliberately **not** merged into one cross-resource form in this slice — the reasoning and
the revisit trigger are recorded as decision D4.

**Form generalization**: `weighing-area-form.tsx` is currently hard-bound to creation
(`defaultValues: { name: '' }`, an `onCreate` prop, `canSubmit = Boolean(pending) && …`, and a
single `E_WEIGHING_AREA_NAME_CONFLICT` branch). It is generalized exactly as `dock-form.tsx` was:
`initialValues` seeds the name and marks edit mode, `onSubmit` replaces `onCreate`, labels become
props, and the error branch grows the archived and not-found outcomes. `useCoordinateFields` needs
no change at all — it is already driven by an external `pending` value in one direction and writes
back to it in the other, so seeding it from a stored weighing-area position works identically to
seeding it from a map click.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 design (research.md, data-model.md, contracts/, quickstart.md):

- **II. One independently deliverable feature per spec** — Confirmed still PASS. The design touches
  files the dock flow uses (`checkpoints-page.tsx`, `checkpoint-sheet.tsx`, the route schema), so
  `quickstart.md` scenario 16 exists specifically to prove dock editing and both creation flows
  still behave exactly as #198/#199 left them. The five existing
  `features/docks/__tests__/update/*` files are treated as a regression gate that must stay green
  without modification beyond renamed props.
- **IV. Test-first observable behavior** — Confirmed still PASS. `quickstart.md` scenarios 1–16 are
  the RED targets `/speckit-tasks` will order, and `contracts/weighing-area-update-api.md` carries a
  requirement-to-test mapping table naming which ten API behaviors currently have **no** test and
  must get one.
- **V. Deep boundaries and explicit contracts** — Confirmed still PASS. Two contracts are documented
  (`weighing-area-update-api.md` for the existing HTTP surface, `checkpoint-edit-ui-state.md` for
  the generalized UI state machine, which supersedes #199's dock-only `dock-edit-ui-state.md`).
  Neither crosses a layer boundary; the UI reaches the database only through the existing typed
  endpoint.
- **VI. Durable knowledge has a home** — Confirmed still PASS. Two judgment calls with durable reach
  are recorded rather than left implicit in code: update does not run archival's usage check (D10),
  and concurrency stays last-write-wins with no optimistic locking (D9), each with its revisit
  trigger.
- No other gate is affected. No new violations to record.
