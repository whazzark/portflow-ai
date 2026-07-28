# Implementation Plan: Administer Customers From the Web Workbench

**Feature ID**: `GH-37` | **Date**: `2026-07-28` | **Spec**: `specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/spec.md`

## Summary

Complete the authenticated `/customers` workbench on top of the customer capabilities delivered by GH-35 and GH-36. Active users can consult available and archived customers; `Organization Admin` and `Operations Admin` can create, update, archive, and reactivate them. Creation and update remain individual commands. Individual and grouped lifecycle commands are supported, with grouped commands applying eligible transitions and returning blocked records separately.

The existing customer API, persistence model, route, Tuyau client, query adapters, and web feature slice are the implementation baseline. The principal change required by this plan is replacing the current all-or-nothing bulk lifecycle behavior with a transactional, per-record partial-success result that re-evaluates lifecycle and discharge usage state at the write boundary.

## Technical Context

- **Apps**: `apps/api` and `apps/web` in the PNPM/Turbo monorepo.
- **Runtime**: TypeScript, AdonisJS/Lucid, PostgreSQL, TanStack Start/Router/Query/Table, React, Japa/Vitest, MSW, and Playwright where configured.
- **Existing baseline**: `apps/api/app/customers/` already contains create, list, available-list, update, individual lifecycle, shared policy/validation/transformer/repository seams, and tests. `apps/web/src/features/customers/` and `apps/web/src/routes/_authenticated/customers.tsx` already provide the workbench, forms, detail sheet, selection, lifecycle controls, and feature tests.
- **Persistence**: Existing `customers` table, normalized uniqueness indexes, status column, and lifecycle metadata migration are reused. No migration is expected unless the gap audit identifies a missing required field or constraint.
- **Authorization**: The API remains authoritative. Active users may list customers; only `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` may mutate. UI permission checks only control affordances.
- **Bulk invariant**: A bulk archive/reactivate request evaluates every distinct selected ID under the lifecycle write boundary. Eligible records change; missing, wrong-state, or usage-blocked records remain unchanged and are returned with stable reasons. A blocked record must not roll back an eligible record.
- **Out of scope**: Customer-user accounts, unrelated site references, permanent deletion, pagination redesign, and new customer business fields.

## Constitution Check

- **I. Versioned intent**: behavior is traced to GH-37 and its clarified `spec.md`.
- **II. Coherent delivery**: the scope is one customer-lifecycle workbench; GH-35/GH-36 are reused rather than re-delivered.
- **III. Human gates**: this plan follows the clarified spec and requires plan review before implementation.
- **IV. Test-first behavior**: API and web tests cover each acceptance scenario and the partial-success invariant before implementation changes.
- **V. Explicit boundaries**: use cases own decisions, repositories own transaction/lock mechanics, controllers adapt HTTP, and web adapters translate transport results.
- **VI. Durable knowledge**: feature-specific contracts remain in this directory; no durable vocabulary or architecture decision changes.
- **VII. Verification**: focused suites, `pnpm check`, `pnpm typecheck`, `pnpm test`, relevant browser coverage, Spec Kit analysis, and convergence remain delivery gates.
- **VIII. Secure and reversible**: HTTP authorization is tested, bulk writes are transactional, and no destructive deletion is introduced.

No constitution exception is required.

## Existing Baseline and Planned Delta

| Area | Existing implementation | Planned GH-37 work |
|---|---|---|
| API routes | Authenticated customer list, available list, create, update, individual archive/reactivate, and grouped lifecycle routes exist in `apps/api/start/routes.ts`. | Keep route names and paths stable; align grouped response and error contracts with partial success. |
| Domain/persistence | Customer status, normalized uniqueness, lifecycle metadata, policy, validation, individual transitions, and discharge usage checker exist. | Move grouped eligibility and planned/active usage evaluation into the repository transaction/write boundary; preserve individual invariants. |
| Bulk API result | Current bulk use cases preflight and throw a `409` when any blocker exists; repository bulk writes are all-or-nothing. | Return `{ updatedCustomers, blockedCustomers }` for mixed selections with request-order-stable arrays and no changes to blocked records. |
| Web workbench | `/customers` supports tabs, URL search/sort/detail state, forms, read-only archived details, selection, lifecycle confirmations, and blocker display for conflict errors. | Consume structured mixed results, refresh both customer query families, clear successful selections, and retain actionable blockers for records that were not changed. |
| Test coverage | Existing unit, integration, and web feature tests cover the delivered baseline and atomic bulk behavior. | Replace atomic bulk assertions and add mixed archive/reactivate, concurrent/stale selection, response ordering, and UI partial-result tests. |

## Design

### Domain and persistence

Keep `Customer` as the site-reference entity with stable UUID identity, normalized case-insensitive unique `code` and `companyName`, `AVAILABLE`/`ARCHIVED` status, timestamps, and archive/reactivation actor and comment metadata. Available customers are editable and selectable; archived customers remain readable and read-only until reactivation.

The bulk repository methods must select the complete request set with row locks inside one transaction, classify each row in request order, and re-check planned/active discharge usage for archive immediately before updating eligible rows. Missing, wrong-state, and in-use rows become blockers; eligible rows are updated and returned. The transaction commits the eligible updates even when blockers exist. Duplicate IDs are malformed input and remain a `422`, not a blocker category.

### API contract and boundaries

- Keep `CustomerPolicy` checks on every controller action.
- Keep normalization, domain outcome mapping, and lifecycle decisions in customer use cases; keep discharge-table knowledge behind `SiteReferenceUsageChecker`.
- Keep persistence locks, conditional writes, and bulk transaction mechanics in `LucidCustomerRepository`.
- Keep the existing `/api/v1/customers` paths and Tuyau route names.
- Individual lifecycle failures remain explicit `404`/`409` domain errors.
- Grouped lifecycle endpoints return `200` with `data.updatedCustomers` and `data.blockedCustomers` for mixed results. Each blocker contains the selected ID, known identity labels when available, a stable reason (`NOT_FOUND`, `IN_USE`, `ALREADY_ARCHIVED`, or `ALREADY_AVAILABLE`), and display guidance belongs to the web adapter.
- Malformed IDs, empty/duplicate selections, validation errors, authentication, and authorization retain the repository’s shared `422`, `401`, and `403` envelopes.

### Web boundaries

- Keep route search validation in `apps/web/src/routes/_authenticated/customers.tsx` for status, search, per-status sorting, detail ID, and mode.
- Keep customer behavior in `apps/web/src/features/customers/`; use Tuyau-generated query/mutation options and MSW at the transport boundary.
- Preserve separate available/archived tables, URL-restorable filters, accessible controls, loading/error/empty states, observer read-only behavior, and archived read-only details.
- After any successful individual or grouped mutation, invalidate list and available queries. For mixed grouped results, refresh both lists, clear IDs that changed, and leave blocked IDs available for explicit retry or removal with their reasons visible.
- The UI may hide unauthorized controls based on the authenticated user but must render API failures without treating client-side role checks as enforcement.

### Test strategy

- **API**: policy tests; use-case tests for normalization, read-only archived records, usage blockers, and partial bulk outcomes; integration tests for auth, authorization, validation, response shape, duplicate conflicts, lifecycle metadata, mixed results, request order, and unchanged blockers.
- **Web**: feature tests through the real router/providers with MSW for list/detail/form flows, observer permissions, individual lifecycle actions, filtered selection, mixed bulk archive/reactivate results, stale/blocker feedback, loading, retry, and cache refresh.
- **Concurrency**: test the observable guarantee that a concurrently blocked record remains unchanged while eligible records commit; do not expose the lock mechanism as a client contract.
- **Browser**: run the configured authenticated customer journey if present; otherwise document the unavailable seam in `quickstart.md`.

## Repository Changes

```text
apps/api/app/customers/archive/archive_customers_use_case.ts
apps/api/app/customers/reactivate/reactivate_customers_use_case.ts
apps/api/app/customers/shared/customer_lifecycle_blockers.ts
apps/api/app/customers/shared/repositories/customer_repository.ts
apps/api/app/customers/shared/repositories/lucid_customer_repository.ts
apps/api/app/controllers/customers_controller.ts
apps/api/tests/unit/customers/administration/create.spec.ts
apps/api/tests/unit/customers/administration/update.spec.ts
apps/api/tests/unit/customers/consultation/list.spec.ts
apps/api/tests/unit/customers/consultation/available.spec.ts
apps/api/tests/unit/customers/lifecycle/archive.spec.ts
apps/api/tests/unit/customers/lifecycle/reactivate.spec.ts
apps/api/tests/unit/customers/lifecycle/bulk/archive.spec.ts
apps/api/tests/unit/customers/lifecycle/bulk/reactivate.spec.ts
apps/api/tests/integration/customers/administration/create.spec.ts
apps/api/tests/integration/customers/administration/update.spec.ts
apps/api/tests/integration/customers/consultation/list.spec.ts
apps/api/tests/integration/customers/consultation/available.spec.ts
apps/api/tests/integration/customers/lifecycle/archive.spec.ts
apps/api/tests/integration/customers/lifecycle/reactivate.spec.ts
apps/api/tests/integration/customers/lifecycle/bulk/archive.spec.ts
apps/api/tests/integration/customers/lifecycle/bulk/reactivate.spec.ts
apps/web/src/features/customers/mutations/use-customer-mutations.ts
apps/web/src/features/customers/ui/bulk-lifecycle-actions.tsx
apps/web/src/features/customers/__tests__/bulk/*.test.tsx
specs/site-references/customer-reference-and-site-reference-lifecycle-foundation/administer-customers-from-the-web-workbench/
  research.md data-model.md contracts/api.md contracts/ui.md quickstart.md
```

The listed API and web files are existing seams, not evidence that every file needs rewriting. Implementation must begin with the baseline audit and change only the contract-divergent portions.

## Risks and Rollout

- **Partial-success drift**: define one DTO and blocker vocabulary shared by repository, use case, generated client, and UI tests.
- **Usage race**: perform usage evaluation inside the same transaction/write boundary as the locked customer decision; blocked customers must remain available.
- **Stale selections**: classify current state at mutation time, return `ALREADY_*` blockers, refresh caches, and preserve actionable UI feedback.
- **Authorization drift**: retain policy checks and protected HTTP integration tests; UI affordance checks are supplementary.
- **Rollback**: the change is additive to existing customer data. Reverting the bulk behavior removes the new response consumer without deleting customer rows or lifecycle metadata.

## Acceptance Traceability

| Requirement / scenario | Observable verification | Implementation seam |
|---|---|---|
| FR-001, US1 scenarios 1–4 | List/detail service-boundary and web workbench tests | Customer controller, authenticated route, customer feature UI |
| FR-002, US1 scenario 5; SC-002 | Policy and protected HTTP tests plus observer UI test | `CustomerPolicy`, controller, permission-derived UI |
| FR-003–FR-004, US2 scenarios 1–4 | Individual create/update tests for valid, normalized, invalid, duplicate, and archived inputs | Customer use cases, validator, repository, form adapter |
| FR-005–FR-007, US3 scenarios 1–3 | Individual lifecycle tests for confirmation, metadata, in-use blocking, read-only archive, and reactivation | Lifecycle use cases, usage checker, repository, lifecycle UI |
| FR-006, FR-008, US3 scenarios 4–5; SC-003 | Mixed grouped archive/reactivate tests prove eligible updates, unchanged blockers, stable reasons, request ordering, and stale-selection recovery | Bulk use cases/repository, controller DTO, bulk action UI |
| FR-009–FR-010, SC-005–SC-006 | Lifecycle metadata, cache-refresh, selection, retention, and no-deletion tests | Repository/transformer and customer feature query invalidation |
| FR-011–FR-014, SC-001, SC-004 | URL restoration, accessibility, focused suites, browser journey, and timed task-completion review | Authenticated route, UI components, API/web test seams |

## Post-Design Constitution Check

All initial checks remain satisfied. The design does not add a new authorization boundary, durable domain term, migration, or external integration. The partial-success result is an explicit contract because it is required by FR-008; transaction and locking are implementation details supporting that observable guarantee.
