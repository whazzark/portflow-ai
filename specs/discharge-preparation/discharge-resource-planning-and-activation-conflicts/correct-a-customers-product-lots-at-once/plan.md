# Implementation Plan: Correct a Customer's Product Lots at Once

**Branch**: `whazzark/plan-the-discharge-truck-pool-and-shift-subsets` (delivered under GH-55) | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/correct-a-customers-product-lots-at-once/spec.md`

## Summary

Let a preparer correct, add, and remove the product lots of one customer of a planned discharge in
a single atomic change, and optionally move the whole group to another customer. The single-lot
correction stays.

### API (`apps/api`)

One new route, authorized by the existing `DischargePolicy.update`:
`PATCH …/discharges/:dischargeId/customers/:customerId/product-lots`.
- **Body**: the customer afterwards, the lots to correct (with an id) or add (without one), and the
  ids to remove. A lot of the customer that the body does not name is left untouched.
- **Rules**: a pure rules module judges lot identity on the discharge's lots as they will be after
  the change, so swaps are legal. It also refuses removals of door-assigned lots, a move to an
  unavailable customer, and leaving the discharge without lots.
- **Write**: one savepoint. Lots whose identity changes are parked under their own id before their
  final values are written, because `product_lots_identity_unique` is an expression index checked
  row by row on PostgreSQL and SQLite.
- **Response**: the discharge detail.
- **Refusals** keep GH-53's scheme:
  - 404 `E_DISCHARGE_NOT_FOUND` or `E_PRODUCT_LOT_NOT_FOUND`;
  - 409 `E_DISCHARGE_NOT_PLANNED` or `E_DISCHARGE_LAST_PRODUCT_LOT`;
  - 422 issues at `productLots.N.*`, `removedProductLotIds.N`, and `customerId`.

### Web (`apps/web`)

- **Entry point**: each customer header row of the Product lots card gets `Edit` for preparers. It
  opens an `Edit product lots` sheet.
- **Editor**: the sheet reuses one customer block, extracted from `ProductLotGroupsEditor`, with
  per-row removal blocks shown as tooltips.
- **Form model**: its own model, client rules that mirror the API, a body builder, and an API field
  mapper. They sit beside the existing preparation schema.
- **Outcomes**: stale and refusal outcomes follow the lot sheets GH-53 delivered.

## Technical Context

**Language/Version**: TypeScript on the repository's Node.js ESM runtime (`apps/api` AdonisJS,
`apps/web` TanStack Start)

**Primary Dependencies**:
- API: AdonisJS 7, Lucid, Bouncer, VineJS 4, and decimal.js, all already dependencies.
- Web: Tuyau 1.2, TanStack Query 5 and Form, zod, React 19, shadcn/Base UI (`Sheet`, `Tooltip`,
  `Table`, `Button`), sonner, and Tailwind CSS 4.
- No new dependency.

**Storage**: Existing tables through Lucid:
- Written: `product_lots` (delete, update, insert) and `discharges.updated_at`.
- Read under the discharge's lock: `product_lots`, `warehouse_door_product_lot_assignments`, and
  the target `customers` row (`FOR SHARE`, only when the group moves).

No migration and no seed change (research.md Decision 11).

**Testing**:
- API unit tests (Japa): the rules module at every edge, and the use case with stubbed repositories
  asserting lock order, precedence, and the write command.
- API integration tests (Japa, factories): the route's 401, 403, each role, 404s, 409s, and every
  422 rule, each asserting no lot changed. Also the swap, the move keeping door assignments, and an
  unlisted lot left untouched. They run on SQLite locally and PostgreSQL in CI.
- Web unit tests (Vitest): the schema additions and `correctionRowRemoval`.
- Web feature tests (Vitest, Testing Library, and MSW through the real router): every row of
  `contracts/ui-state.md`, plus regressions of the add and single-lot sheets that share the
  extracted block.
- Playwright is not set up in `apps/web` and stays out of scope, as for GH-53 and GH-55.

**Target Platform**: Authenticated responsive web workstation backed by the Node.js API

**Project Type**: PNPM/Turbo monorepo web application (`apps/api` + `apps/web`)

**Performance Goals**: A correction of up to 20 lots is saved and shown within 2 seconds for at
least 95% of attempts, which supports SC-003.
- The write is one lock and three reads (lots, door assignments, and the customer when moving).
- It then runs at most one statement per removed, parked, and corrected lot, and one batched insert.
- The existing detail read follows.

**Constraints**:
- The API is authoritative; the web only mirrors its rules.
- The change is atomic (FR-005).
- Lot ids are preserved (FR-011).
- Unnamed lots are never touched (FR-012).
- Planned discharges only; lock order discharge, then customers.

**Scale/Scope**:
- **API**: one route, one controller, one use case, one rules module, one validator, two
  repository methods (a door-assignment read and the correction write), and exported
  `lotIdentityKey`.
- **Web**: one sheet, one extracted block component, a `RemoveRowButton` reason, one card change,
  one mutation, schema and view adapters, and an extended MSW helper.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Selected intent**: PASS. The user decided on 2026-09-15 to deliver this under the selected
  issue #55 rather than a new issue; the spec records it. Three clarifications were answered, and
  the spec is the contract.
- **II. Independent delivery**: PASS, with a note. The feature is one vertical slice with its own
  spec, tests, and review, and depends only on delivered GH-53 behavior. It shares GH-55's branch
  and PR by the same decision. Its tasks stay separable, so the diff can still be reviewed on its
  own.
- **III. Human gates**: PASS. The clarifications came before planning. This plan requires human
  review before `/speckit-tasks`.
- **IV. Test-first behavior**: PASS. Every FR has an observable seam:
  - FR-005 to FR-014: the rules unit tests and the integration refusals;
  - FR-001 to FR-004 and FR-015 to FR-017: the web feature tests and the integration successes.
- **V. Deep boundaries**: PASS.
  - **Use case**: owns the transaction, lock order, and mapping outcomes to exceptions and issues.
  - **Rules module**: pure.
  - **Repository**: locked reads, the parked write, and outcome detection.
  - **Controller**: authorizes, validates, and serializes.
  - **Web**: the sheet owns the outcomes; the adapters are pure.
- **VI. Durable knowledge**: PASS. No vocabulary change: `Product Lot` already defines the identity
  judged. No ADR: the parking write is local to one repository method and documented in
  research.md Decision 5.
- **VII. Verification**: PASS. `quickstart.md` lists the API and screen validations, the suites,
  `pnpm check`, `pnpm typecheck`, `pnpm test`, and the fresh review.
- **VIII. One workflow owner**: PASS. No state machine, Project field, or orchestrator is added.

**Post-design re-check**: PASS. Phase 1 adds one route and no table, bypasses no authorization, and
adds no cross-feature web import. Changes outside the new files:

| Change | Reason |
|---|---|
| `ProductLotGroupsEditor` renders its blocks through the extracted `ProductLotGroupFields` | One implementation of the customer block for creation, add, and correction (Decision 9) |
| `RemoveRowButton` gains an optional `blockedReason` | Per-row removal reasons (Decision 9); existing callers unchanged |
| `lotIdentityKey` exported from `discharge_preparation_rules.ts` | Reused by the rules module, so identity is compared the same way everywhere |
| `E_DISCHARGE_LAST_PRODUCT_LOT` joins `STALE_DETAIL_CODES` | That refusal can only follow another user's removal (Decision 10) |

The existing creation, add, and single-lot tests pin that none of these changes current behavior.

## Project Structure

### Documentation (this feature)

```text
specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/correct-a-customers-product-lots-at-once/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── customer-product-lots.openapi.yaml
│   └── ui-state.md
├── checklists/requirements.md
└── tasks.md                     # Created later by /speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── controllers/
│   │   └── discharge_customer_product_lots_controller.ts        # new: update()
│   └── discharges/
│       ├── product_lots/
│       │   ├── correct_customer_product_lots_use_case.ts         # new
│       │   ├── customer_product_lots_rules.ts                    # new, pure: planCustomerProductLotsCorrection
│       │   └── product_lot_validator.ts                          # add customerProductLotsCorrectionValidator
│       └── shared/
│           ├── discharge_preparation_rules.ts                    # export lotIdentityKey
│           └── repositories/
│               ├── discharge_preparation_repository.ts           # add listLotIdsWithDoorAssignments, writeCustomerProductLotsCorrection
│               └── lucid_discharge_preparation_repository.ts     # implement them (delete, park, update, insert, touch)
├── start/routes.ts                                               # customer_product_lots.update in the discharges group
├── .adonisjs/                                                    # regenerated Tuyau registry and controllers, committed
└── tests/
    ├── unit/discharges/preparation/
    │   ├── customer_product_lots_rules.spec.ts                   # new
    │   └── product_lots.spec.ts                                  # extended: the use case with stubbed repositories
    └── integration/discharges/preparation/
        └── correct_customer_product_lots.spec.ts                 # new

apps/web/src/features/discharges/
├── discharge-preparation-schema.ts                               # customer lots form values, schemas, body, field mapper
├── customer-lots-correction.ts                                   # new, pure: correctionRowRemoval
├── mutations/use-discharge-mutations.ts                          # correctCustomerLots; E_DISCHARGE_LAST_PRODUCT_LOT stale
├── ui/
│   ├── preparation/
│   │   ├── product-lot-group-fields.tsx                          # new: one customer block (extracted)
│   │   ├── product-lot-groups-editor.tsx                         # maps blocks onto ProductLotGroupFields
│   │   └── repeated-rows.tsx                                     # RemoveRowButton blockedReason
│   └── detail/
│       ├── discharge-product-lots-card.tsx                       # Edit on the customer header row; mounts the sheet
│       └── customer-product-lots-sheet.tsx                       # new
└── __tests__/
    ├── support/test-helpers.ts                                   # PATCH customer lots handler, customerLotRequests, respondToCustomerLots
    ├── customer-product-lots-schema.test.ts                      # new: the schema additions
    ├── customer-lots-correction.test.ts                          # new: correctionRowRemoval
    └── detail/
        ├── correct-customer-product-lots.test.tsx                # new
        └── add-product-lots.test.tsx                             # regression: unchanged assertions
```

**Structure Decision**: Extend GH-53's `product_lots` slice.

In the API:
- The use case, rules, and validator sit beside the lot use cases they generalize.
- The route gets its own controller, because it nests under a customer, as GH-55's shift trucks
  nest under a shift.
- Locked reads and the write join `DischargePreparationRepository`, where `lockPlannedDischarge` and
  every lot write already live.

In the web:
- The sheet lives beside the card that opens it.
- The extracted block lives beside the editor it came from.
- The adapters extend the existing schema and view modules, as GH-53's add sheet does.

## Complexity Tracking

No constitution violation to justify. The choices that go beyond existing precedent are each
recorded where they are decided:

| Choice | Where decided |
|---|---|
| `PATCH` with explicit removals instead of a full-set `PUT` | spec FR-012; research.md Decision 1 |
| Identity judged on the state after the change, including other customers' lots | spec US1-6, US4-3; research.md Decision 3 |
| Parking renamed lots under their own id inside the transaction | research.md Decision 5 |
| Door-assignment removal refused as a `422` issue rather than GH-53's `409` | research.md Decision 6 |
| Delivered on GH-55's branch rather than its own issue | spec header; user decision 2026-09-15 |
