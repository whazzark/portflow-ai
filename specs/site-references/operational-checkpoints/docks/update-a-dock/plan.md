# Implementation Plan: Update a Dock

**Branch**: `feat/199-update-dock` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/operational-checkpoints/docks/update-a-dock/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Let an authorized administrator correct an available dock's name and map position from the existing
checkpoint consultation map (`/checkpoints`), by opening an edit mode on the selected dock, dragging
its marker or typing new coordinates, and saving.

Research into the current codebase found that the **write path already exists and is correct**:
`PATCH /api/v1/docks/:id`, `updateDockValidator`, `UpdateDockUseCase`, `DockPolicy.update`, and
`LucidDockRepository.updateAvailable` together already enforce every rule the spec requires —
trimmed non-blank name, 255-character cap, case-insensitive cross-status uniqueness (via the
`LOWER(name)` unique index), coordinate ranges, administrator-only authorization, active-user
enforcement (in `auth_middleware`), archived-is-read-only (the update query is scoped to
`status = 'AVAILABLE'`), and not-found. **No production backend code changes.**

What is missing is (a) the entire frontend, and (b) API *test* coverage for the update paths that
were never exercised: duplicate name, self-name resubmission, archived read-only, not-found, and
coordinate range at the HTTP boundary. So this is a **frontend-delivery slice with a backend
test-coverage top-up**.

The frontend approach is deliberately not to build a second map-editing mechanism. #198 already
extracted `useResourceMapPlacement` + `PendingPlacementMarker` into the resource-agnostic
`apps/web/src/components/resource-map/resource-map-placement.tsx`, and left an explicit marker in
`checkpoint-sheet.tsx` — `/** 'edit' is intentionally not modeled yet — see issue #199. */`.
Editing is therefore modeled as **the create flow rebound to a different starting point**: instead
of `pending = null`, edit mode seeds `pending` from the dock's stored coordinates, hides the dock's
own real marker, and lets the same pending-placement marker stand in as the unsaved draft. Every
placement behavior — click-to-move, drag-to-adjust, coordinate-field sync, muted sibling markers,
relocated map controls, non-modal sheet — comes for free and stays consistent between create and
edit.

## Technical Context

**Language/Version**: TypeScript (apps/web: React 19 via TanStack Start; apps/api: AdonisJS on Node.js)

**Primary Dependencies**: TanStack Router/Query/Form (`useAppForm`), `@tuyau/react-query` (typed client), Zod, `sonner`, Radix-based `Sheet`/`Field` primitives; backend: AdonisJS, VineJS, Lucid, Bouncer (all pre-existing; only tests added)

**Storage**: PostgreSQL via the existing `docks` table — no migration, no schema change

**Testing**: Vitest + Testing Library + MSW for `apps/web`; Japa for `apps/api` (new update-path integration and unit tests added to the existing dock spec files)

**Target Platform**: Web application (desktop and tablet browsers)

**Project Type**: Web application monorepo (`apps/api` + `apps/web`), extending an existing feature area

**Performance Goals**: Corrected name/position visible in the map collection within 2 seconds of a successful save (SC-001); single-row `UPDATE`, no new backend load characteristics

**Constraints**: Must reuse the existing `/checkpoints` route, its `checkpoint=<kind>:<id>` selection contract, and the `resource-map-placement` primitive from #198 rather than introducing a second map-editing mechanism or a standalone edit page; must not modify the shared primitive's resource-agnostic public surface (weighing areas, warehouses, and warehouse doors are its future consumers); must not change any production backend file

**Scale/Scope**: One new UI mode in one existing feature area; one generalized form component; no new API surface, no new persisted entity, no data migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected feature intent is versioned** — PASS. This spec was created from issue #199,
  selected off the Docks roadmap (#190). Not speculative bulk expansion.
- **II. One independently deliverable feature per spec** — PASS. Scope is exactly "update a dock"
  end-to-end (entry point → existing API → visible corrected result). Archive (#200) and reactivate
  (#201) stay out, as does updating any other site reference type (spec FR-024). The slice is not
  split into API-only or interface-only work: it delivers the observable product behavior, and the
  API test top-up is part of the same slice because those rules are this slice's rules.
- **III. Vanilla Spec Kit gates** — PASS. No repository-owned delivery state machine introduced.
- **IV. Test-first observable behavior** — PASS with a scope note. The backend's *implementation*
  exists, but five of its observable behaviors are untested (duplicate name, self-name
  resubmission, archived read-only, not-found, coordinate range over HTTP). Those get RED→GREEN
  tests here — RED against the existing implementation is expected to fail only where a real gap
  exists, and each test is written before it is run. All new frontend behavior is RED→GREEN.
- **V. Deep boundaries and explicit contracts** — PASS. The UI calls the existing typed
  `docks.update` contract through a mutation hook, exactly as `customers.update` is called by
  `customer-sheet.tsx`. No layer is shortcut; no controller, use case, or repository is modified.
- **VI. Durable knowledge has a home** — PASS. No new domain vocabulary or architectural decision
  needing `CONTEXT.md`/ADR treatment. Dock and Checkpoint vocabulary is reused from #197/#198.
- **VII. Verification is part of delivery** — Deferred to implementation/verification phases.
- **VIII. One workflow owner** — PASS. Artifacts stay inside Spec Kit.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/operational-checkpoints/docks/update-a-dock/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── dock-update-api.md
│   └── dock-edit-ui-state.md
├── checklists/
│   └── requirements.md  # /speckit-specify output
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/                                       # No production change — tests only
├── app/docks/
│   ├── update/update_dock_use_case.ts           # UNCHANGED — already implements every backend FR
│   ├── shared/dock_validator.ts                 # UNCHANGED — updateDockValidator already correct
│   ├── shared/dock_policy.ts                    # UNCHANGED — `update` already admin-only
│   └── shared/repositories/lucid_dock_repository.ts  # UNCHANGED — updateAvailable already scopes to AVAILABLE
├── app/controllers/docks_controller.ts          # UNCHANGED — `update` already wired at PATCH /api/v1/docks/:id
└── tests/
    ├── integration/docks.spec.ts                # MODIFIED — add duplicate / self-name / archived / not-found / range cases
    └── unit/docks/dock_use_cases.spec.ts        # MODIFIED — add archived + not-found + duplicate use-case cases

apps/web/                                       # This feature's delivery surface
├── src/components/resource-map/
│   └── resource-map-placement.tsx               # UNCHANGED — reused verbatim; public surface must stay resource-agnostic
├── src/features/docks/
│   ├── mutations/use-dock-mutations.ts          # MODIFIED — add `update` mutation + shared invalidation
│   ├── ui/
│   │   ├── dock-form.tsx                        # MODIFIED — generalized to create *and* update (initialValues + onSubmit)
│   │   ├── edit-dock-panel.tsx                  # NEW — Sheet panel, mirrors edit-customer-panel.tsx
│   │   ├── create-dock-panel.tsx                # UNCHANGED — keeps consuming the generalized form
│   │   └── dock-details.tsx                     # MODIFIED — add the "Edit dock" entry point
│   └── __tests__/update/                        # NEW — update.test.tsx, validation.test.tsx, permissions.test.tsx
├── src/features/checkpoints/
│   ├── ui/
│   │   ├── checkpoint-sheet.tsx                 # MODIFIED — model the 'edit' mode the #199 comment reserves
│   │   └── checkpoints-page.tsx                 # MODIFIED — edit session state, draft placement, save/cancel wiring
│   └── __tests__/support/mock-checkpoint-map.tsx # MODIFIED — allow the drag seam to serve edit as well as create
└── src/routes/_authenticated/checkpoints.tsx    # MODIFIED — add `edit` to the search-param schema
```

**Structure Decision**: Web application monorepo, already in place. No backend production file is
added or changed. The map-editing mechanism is **not** rebuilt: `resource-map-placement.tsx` is
consumed exactly as the create flow consumes it, which is why that file appears as UNCHANGED above
— a second placement implementation for editing would be the single most likely source of drift
between "where the marker says the dock is" and "where the dock is."

Dock-specific work stays in `apps/web/src/features/docks`, following the pattern
`edit-customer-panel.tsx` / `customer-sheet.tsx` already established for customers. The
`apps/web/src/features/checkpoints` changes are additive: a new mode on the existing sheet, a new
search param, and the edit-session state that owns the draft placement.

**Form generalization**: `dock-form.tsx` is currently hard-bound to creation (`defaultValues:
{ name: '' }`, an `onCreate` prop, and `canSubmit = Boolean(pending) && !hasCoordinateError`). It is
generalized rather than duplicated, following `customer-form.tsx`, which already serves both create
and edit. The `useCoordinateFields` hook needs no change at all — it is already driven by an
external `pending` value in one direction and writes back to it in the other, so seeding it from a
stored dock position works identically to seeding it from a map click.

## Complexity Tracking

*No Constitution Check violations were identified. This section intentionally left without entries.*

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 design (research.md, data-model.md, contracts/, quickstart.md):

- **II. One independently deliverable feature per spec** — Confirmed still PASS. The design adds an
  `edit` search param and an `EditDockPanel`, both scoped to docks. The generalization of
  `dock-form.tsx` touches the create flow's file but not its behavior; `quickstart.md` scenario 14
  exists specifically to prove creation still works unchanged after the generalization.
- **IV. Test-first observable behavior** — Confirmed still PASS. `quickstart.md` scenarios 1–14 are
  the RED targets `/speckit-tasks` will order, and `contracts/dock-update-api.md` carries a
  requirement-to-test mapping table that names which five API behaviors currently have **no** test
  and must get one.
- **V. Deep boundaries and explicit contracts** — Confirmed still PASS. Two new contracts are
  documented (`dock-update-api.md` for the existing HTTP surface, `dock-edit-ui-state.md` for the
  new UI state machine). Neither crosses a layer boundary; the UI reaches the database only through
  the existing typed endpoint.
- **VI. Durable knowledge has a home** — Confirmed still PASS. The one judgment call with durable
  reach — last-write-wins concurrency with no optimistic locking — is recorded as decision D6 in
  `research.md` with its rationale and its revisit trigger, rather than being left implicit in code.
- No other gate is affected. No new violations to record.
