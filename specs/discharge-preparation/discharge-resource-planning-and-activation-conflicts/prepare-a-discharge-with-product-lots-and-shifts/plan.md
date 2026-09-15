# Implementation Plan: Prepare a Planned Discharge With Its Product Lots and Shifts

**Branch**: `whazzark/prepare-a-planned-discharge-with-its-product-lot` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/prepare-a-discharge-with-product-lots-and-shifts/spec.md`

## Summary

Make a discharge something the product can create and correct, rather than something only seeds
produce.

In `apps/api`, the `discharges` slice gains its first commands, each authorized for active
operations leads, operations admins, and organization admins:
- `POST /discharges` creates a planned discharge with its product lots and planned shifts in one
  transaction. It is idempotent through a creation identity that the client generates.
- `PATCH /discharges/:id` corrects the vessel description, the dock, and the expected start.
- `POST`, `PATCH`, and `DELETE /discharges/:dischargeId/product-lots[/:id]` add, correct, and
  remove lots.

Every command answers with the existing discharge detail. Refusals follow one scheme:
- A value the user entered is refused with `422 E_VALIDATION_ERROR` and dotted field paths. This
  covers shape failures, cross-item rules decided by a pure rules module (duplicate lots and
  overlapping shifts), and references that are no longer available or eligible.
- A discharge in the wrong state is refused with a `409` code of the slice.

Writes lock the discharge row, then lock docks, customers, and users `FOR SHARE`. This closes the
race with archives and deactivations. The single dock and customer archives move under the same
lock discipline. The users slice gains `GET /users/eligible-shift-responsibles`, so operations
leads can pick a responsible.

In `apps/web`:
- A new `/discharges/new` page, under the discharges layout, holds the creation form. Its lots and
  shifts are TanStack Form array fields, and dates use a native `datetime-local` field.
- The list and its empty state offer `Create discharge` to preparers.
- On a planned discharge's detail, the Overview and Product lots cards gain `Edit`,
  `Add product lot`, and `Remove` actions. They open sheets and a destructive confirmation.
- `applyValidationError` learns to map indexed paths onto array fields.

The slice changes no table and no seed, and records no activity log entry.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**:
- API: AdonisJS 7, Lucid, Bouncer, VineJS 4, Luxon, and `decimal.js`, all already dependencies.
- Web: Tuyau 1.2, TanStack Start/Router/Query 5, TanStack Form (`useAppForm`), Zod 4, React 19,
  shadcn/Base UI (`Sheet`, `AlertDialog`, `Select`, `Card`), sonner, and Tailwind CSS 4.
- No new dependency.

**Storage**: Existing PostgreSQL tables through Lucid:
- Written: `discharges`, `product_lots`, `shifts`.
- Read under lock: `docks`, `customers`, `users`.
- Read for the removal rule: `warehouse_door_product_lot_assignments`.

No migration and no seed change (research.md Decision 14).

**Testing**:
- API: Japa unit tests, for the rules module, the policies, the validators' rules, and the use
  cases with stubbed repositories. Japa integration tests, for all six routes and the hardened
  archives, on the existing factories.
- Web: Vitest with jsdom, Testing Library, and MSW, through the real router. There are pure unit
  tests for the schemas, the date helpers, and path translation.
- Playwright is not set up in `apps/web`, and is out of scope, as it was for GH-58 and GH-61.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: A preparation of 20 lots and 40 shifts is saved and its detail shown within
3 seconds for at least 95% of attempts (SC-007). Creation runs a fixed number of statements, one
per locked table and one batched insert per child table, followed by the existing detail read.

**Constraints**:
- The API is authoritative for authorization and every rule. Client-side validation only mirrors
  it.
- Creation is atomic and idempotent.
- Quantities stay exact decimals end to end.
- Date-times carry an offset on the wire.
- Every refusal caused by an entered value identifies its field.
- Observers and non-planned discharges see no action.
- No shift correction, truck, door, or checkpoint write.

**Scale/Scope**:
- **API**: five discharge commands, one user query, two policy methods on `DischargePolicy`, one on
  `UserPolicy`, one rules module, one eligibility module, four exceptions, two shared Vine rules,
  and two hardened archive repositories.
- **Web**:
  - Routes and page: one new route with its creation page.
  - Forms: three reusable field groups, three sheets, and one confirmation dialog.
  - Data and permissions: one mutations hook, two query additions, and one permission helper.
  - Shared form infrastructure: one new form field and one error-mapping change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected intent**: PASS. Issue #53 is selected. Its spec was clarified on 2026-09-15 and is
  the contract. The plan does not reach into GH-54 to GH-56 or GH-63 to GH-66. It only records the
  locking and eligibility obligations they inherit.
- **II. Independent delivery**: PASS. This is one vertical slice with its commands in `apps/api`
  and its screens in `apps/web`, mergeable as one PR. Its blocker, GH-58, is delivered, and the
  model it writes into, GH-236, is delivered.
- **III. Human gates**: PASS. The three open product questions were settled with the product owner
  before planning. Human review of this plan is required before `/speckit-tasks`.
- **IV. Test-first behavior**: PASS. Every requirement has an observable seam:
  - API unit tests: every preparation rule at its edges, eligibility, both policies, and the
    decimal and date-time rules.
  - API integration tests: for each route, 401, 403, each role's success, 404, 409, and every 422
    rule, each asserting that nothing changed; plus the creation replay and the hardened archives.
  - Web unit tests: schemas, date conversion, and path translation.
  - Web feature tests through the real router: creation, client and server refusals, the options
    states, the redirect, every correction, and the stale-state outcomes.
- **V. Deep boundaries**: PASS.
  - **Use cases** own the transaction, locking order, rule evaluation, and exception mapping.
  - **Repositories** own locked reads, batched inserts, and the malformed-id guard.
  - **The rules module** is pure.
  - **Controllers** authorize, validate, and serialize.
  - **Web pages and sheets** own mutation outcomes; field groups own inputs only; the route file
    stays thin.
  - **Cross-slice sharing**: the users slice exports one eligibility module, and the discharge
    slice imports it. No policy calls another policy.
- **VI. Durable knowledge**: PASS. The vocabulary is already in `CONTEXT.md`. No ADR is needed: the
  locking discipline extends the repository's existing archive pattern, and the idempotent
  creation identity is recorded in research.md Decision 2 as a slice decision. If a second slice
  adopts it, it should become an ADR.
- **VII. Verification**: PASS. `quickstart.md` lists the API and screen validations, the targeted
  suites, `pnpm check`, `pnpm typecheck`, `pnpm test`, and the fresh review.
- **VIII. One workflow owner**: PASS. No delivery state machine, Project field, or orchestrator is
  introduced.

**Post-design re-check**: PASS. Phase 1 adds six routes and no table, bypasses no authorization,
and adds no cross-feature import in the web: the discharges feature imports the customers and docks
query factories through their public `queries/` modules, as the trucks feature does with transport
companies. The changes outside the two slices are listed below, each with its reason:

| Change | Reason |
|---|---|
| Dock and customer single archives lock and check usage in one transaction | Keeps "no archive while in use" true against the new writer (Decision 5) |
| `DetailSection` gains an optional `actions` slot | Needed for the card header actions |
| `applyValidationError` translates indexed paths | Needed for array fields (Decision 13) |
| A `DateTimeField` in `libraries/forms` | The first date-time input (Decision 6) |
| Two helpers in `helpers/dates.ts` | Local and ISO date-time conversion (Decision 6) |

None of them changes an existing page's behavior, and the existing archive, form, and detail tests pin that.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/prepare-a-discharge-with-product-lots-and-shifts/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── discharge-preparation.openapi.yaml
│   └── ui-state.md
├── checklists/requirements.md
└── tasks.md             # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   ├── discharges_controller.ts                          # add store(), update()
│   │   ├── discharge_product_lots_controller.ts              # new: store(), update(), destroy()
│   │   └── users_controller.ts                               # add eligibleShiftResponsibles()
│   ├── discharges/
│   │   ├── create/
│   │   │   ├── create_planned_discharge_use_case.ts          # new
│   │   │   └── create_planned_discharge_validator.ts         # new
│   │   ├── update/
│   │   │   ├── correct_discharge_identity_use_case.ts        # new
│   │   │   └── discharge_identity_validator.ts               # new: identity fields, shared with create
│   │   ├── product_lots/
│   │   │   ├── add_product_lot_use_case.ts                   # new
│   │   │   ├── correct_product_lot_use_case.ts               # new
│   │   │   ├── remove_product_lot_use_case.ts                # new
│   │   │   └── product_lot_validator.ts                      # new: lot fields, shared with create
│   │   └── shared/
│   │       ├── discharge_preparation_rules.ts                # new: pure cross-item rules, orderShifts
│   │       ├── discharge_preparation_issues.ts               # new: issues → Vine E_VALIDATION_ERROR
│   │       ├── planned_discharge_guard.ts                    # new: lockPlannedDischarge, shared by every correction
│   │       ├── discharge_exceptions.ts                       # add NotPlanned, LastProductLot, ProductLotNotFound, ProductLotHasDoorAssignments
│   │       ├── discharge_policy.ts                           # add create(), update()
│   │       └── repositories/
│   │           ├── discharge_preparation_repository.ts       # new: abstract locked reads and writes (trx client)
│   │           └── lucid_discharge_preparation_repository.ts # new
│   ├── users/
│   │   ├── eligible_shift_responsibles/
│   │   │   └── list_eligible_shift_responsibles_use_case.ts  # new
│   │   └── shared/
│   │       ├── shift_responsible_eligibility.ts              # new: SHIFT_RESPONSIBLE_ROLES, isEligibleShiftResponsible
│   │       ├── user_policy.ts                                # add listEligibleShiftResponsibles()
│   │       └── repositories/{user_repository,lucid_user_repository}.ts  # add listEligibleShiftResponsibles()
│   ├── docks/shared/repositories/lucid_dock_repository.ts    # archiveAvailable: lock + usage check in one trx
│   ├── docks/archive/archive_dock_use_case.ts                # usage check moves into the repository
│   ├── customers/shared/repositories/lucid_customer_repository.ts  # same hardening
│   ├── customers/archive/archive_customer_use_case.ts        # same
│   └── shared/validators/
│       ├── tonnage_validator.ts                              # new: decimal-string tonnage rule
│       └── instant_validator.ts                              # new: ISO 8601 with offset → DateTime
├── providers/repositories_provider.ts                        # bind DischargePreparationRepository
├── start/routes.ts                                           # discharges store/update, product_lots group; users eligible-shift-responsibles before /:id
├── .adonisjs/                                                # regenerated Tuyau registry and controllers, committed
└── tests/
    ├── unit/
    │   ├── discharges/preparation/{rules,policy,create,correct_identity,product_lots}.spec.ts
    │   ├── users/consultation/shift_responsible_eligibility.spec.ts
    │   └── shared/validators/{tonnage,instant}.spec.ts
    └── integration/
        ├── discharges/preparation/{create,correct_identity,add_product_lot,correct_product_lot,remove_product_lot}.spec.ts
        ├── discharges/preparation/preparation_scenario.ts   # factories for a prepared discharge (not a spec)
        ├── users/consultation/eligible_shift_responsibles.spec.ts
        ├── docks.spec.ts                                     # extended: single archive in-use refusal still holds
        └── customers/lifecycle/archive.spec.ts               # same

apps/web/src/
├── helpers/dates.ts                                          # add toDateTimeLocalValue, fromDateTimeLocalValue
├── libraries/forms/
│   ├── api-error.ts                                          # indexed path translation; unmatched paths to the form error
│   ├── form.tsx                                              # register DateTimeField
│   └── fields/date-time-field.tsx                            # new
├── routes/_authenticated/discharges.new.tsx                  # new: redirect non-preparers, preload options
└── features/
    ├── docks/queries/dock-queries.ts                         # add available()
    └── discharges/
        ├── discharge-permissions.ts                          # new: canPrepareDischarges
        ├── discharge-preparation-schema.ts                   # new: Zod schemas, form ⇄ body mapping
        ├── queries/discharge-queries.ts                      # add eligibleResponsibles()
        ├── mutations/use-discharge-mutations.ts              # new: create, correctIdentity, addLot, correctLot, removeLot
        └── ui/
            ├── discharges-page.tsx                           # Create discharge action
            ├── create/
            │   ├── create-discharge-page.tsx                 # new: options states, submit outcomes
            │   ├── create-discharge-form.tsx                 # new: sections, array fields, tonnage preview
            │   └── create-discharge-pending.tsx              # new
            ├── preparation/
            │   ├── discharge-identity-fields.tsx             # new, shared
            │   ├── product-lot-fields.tsx                    # new, shared
            │   └── planned-shift-fields.tsx                  # new
            └── detail/
                ├── detail-section.tsx                        # optional actions slot (CardAction)
                ├── discharge-detail-page.tsx                 # reads session user; passes canCorrect
                ├── discharge-identity-card.tsx               # Edit action
                ├── discharge-product-lots-card.tsx           # Add / Edit / Remove actions
                ├── edit-discharge-identity-sheet.tsx         # new
                ├── product-lot-sheet.tsx                     # new: add and edit modes
                └── remove-product-lot-dialog.tsx             # new
    └── discharges/__tests__/
        ├── support/{fixtures.ts,test-helpers.ts}             # add options fixtures, mockPreparationOptions, mutation handlers
        ├── discharge-preparation-schema.test.ts              # new, unit
        ├── access/authorization.test.tsx                     # updated: create action for preparers only
        ├── detail/access.test.tsx                            # updated: actions for preparers on planned only
        ├── create/{form,validation,server-refusals,options,access,success}.test.tsx
        └── detail/{correct-identity,add-product-lot,correct-product-lot,remove-product-lot,stale-state}.test.tsx
```

`routeTree.gen.ts` is regenerated for the new route. Web unit tests for `helpers/dates.ts` and
`libraries/forms/api-error.ts` sit beside those files, following each directory's existing
convention.

**Structure Decision**: Extend the delivered discharge slice with the repository's mutation shape
instead of inventing a new one.

In the API:
- Creation, identity correction, and lot commands each get a per-action folder, as the customers
  and warehouses slices do. Lot commands share one folder because they share their validator and
  their controller.
- One `DischargePreparationRepository` holds every locked read and write the commands need. The
  existing `DischargeRepository` stays read-only, and the detail read after a write reuses its
  `findDetail`.
- The use cases own the transaction (pattern B, as in the users identity slice), because every
  rule reads rows under the locks taken in the same transaction.
- Route parameters are guarded with `isUuid` in the repository rather than validated by Vine, so a
  malformed identity is the same `404` as in GH-58, not a `422`.
- The users route is declared before `/:id`, as the file's comments require.

In the web:
- The creation page and its form live under `ui/create/`. The field groups that creation and
  correction share live under `ui/preparation/`, and the correction sheets live beside the cards
  they open from, under `ui/detail/`.
- Routes stay thin, per `apps/web/AGENTS.md`.
- Two existing tests that assert "no create or edit action for any role" are rewritten, because
  FR-003 and FR-023 to FR-024 reverse what they pin for preparers. Their observer halves remain
  unchanged as regression checks.

## Complexity Tracking

No constitution violation to justify. The deliberate choices that go beyond existing precedent are
each recorded where they are decided:

| Choice | Where decided |
|---|---|
| A client-generated creation identity for idempotency, a first in the repository | research.md Decision 2 |
| Cross-item and availability refusals reported as `E_VALIDATION_ERROR`, rather than as slice-specific `422` codes | research.md Decision 3 |
| Hardening the single dock and customer archives, outside the discharge slice | research.md Decision 5 |
