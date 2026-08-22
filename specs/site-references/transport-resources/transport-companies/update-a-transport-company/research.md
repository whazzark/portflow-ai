# Research: Update a Transport Company

No `NEEDS CLARIFICATION` items were carried into planning. The spec's Assumptions section resolved the open product decisions from established site-reference precedent; the decisions below resolve the technical ones.

## Decision 1: Extend the delivered transport-company slice with an administration workflow

**Decision**: Add `apps/api/app/transport_companies/update/update_transport_company_use_case.ts` alongside the existing `list/` and `available/` workflows, plus shared `transport_company_validator.ts` and `transport_company_exceptions.ts`, an `update` ability on the existing policy, and an `update` action on the existing controller.

**Rationale**: Customer administration is the closest delivered precedent and already proves this shape: workflow directory per behavior, one shared validator and exception module per resource, a resource policy for authorization, and a controller that only adapts HTTP. Reusing it satisfies constitution principle V and keeps #220/#221 able to add `archive/` and `reactivate/` workflows without restructuring.

**Alternatives considered**:

- A generic site-reference update service shared by customers, docks, and transport companies: rejected as cross-domain refactoring with no demonstrated need; each resource's mutable fields and lifecycle blockers differ.
- Update directly from the controller through Lucid: rejected because it bypasses the required use-case/repository boundary.
- A single `administer` policy ability covering update, archive, and reactivate: rejected because per-ability methods keep the authorization surface explicit and match `CustomerPolicy`.

## Decision 2: Enforce case-insensitive name uniqueness in the database

**Decision**: Add migration `1785100000000_add_transport_companies_name_unique_index.ts` creating `CREATE UNIQUE INDEX transport_companies_name_unique ON transport_companies (LOWER(name))` through `this.defer`, then translate the resulting unique violation into a domain result in the Lucid repository.

**Rationale**: FR-007 and spec edge case 3 require that two administrators submitting the same new name concurrently produce exactly one success. A read-then-write duplicate check cannot guarantee that; a unique index can, and it is the mechanism already used by `customers_company_name_unique` and `docks_name_unique`. `this.defer` with `db.rawQuery` is the established portable form for expression indexes and works on both PostgreSQL and the in-memory SQLite used by tests. Existing fixture names are already case-insensitively distinct — the transport-company seeder asserts this — so no data cleanup precedes the migration.

**Alternatives considered**:

- Check for a duplicate in the use case before writing: rejected because it leaves a race window and would make the concurrency edge case untestable.
- Restrict uniqueness to `AVAILABLE` companies via a partial index: rejected because it would let an archived company block reactivation later, and because customers and docks make the name unique across both lifecycle states.
- Defer the constraint to the creation slice #218: rejected because this slice cannot honor FR-007 without it, and #217 explicitly deferred the write-time duplicate policy to whichever write slice landed first.
- Normalize a separate lowercase column: rejected as redundant storage when an expression index expresses the rule directly.

## Decision 3: Update only rows still available, using one conditional write

**Decision**: Add `updateAvailable(command)` to `TransportCompanyRepository`, returning a discriminated `TransportCompanyWriteResult` of `UPDATED | NOT_FOUND | ARCHIVED | DUPLICATE_NAME`. The Lucid implementation issues `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'`, and only when zero rows are affected does it re-read the row to distinguish "missing" from "archived".

**Rationale**: This is exactly the delivered `LucidCustomerRepository.updateAvailable` shape. The lifecycle guard lives in the same statement as the write, so a company archived between form load and submission is refused rather than silently renamed (spec edge case 1). The extra read happens only on the failure path, and the discriminated result keeps persistence mechanics out of the use case, which owns the mapping to exceptions.

**Alternatives considered**:

- Load, guard in the use case, then save: rejected because the guard would not be atomic with the write.
- Throw persistence exceptions directly from the repository: rejected because it inverts the boundary; the use case owns domain meaning.
- Wrap the operation in an explicit transaction: rejected as unnecessary for a single-row, single-statement write whose only concurrent hazard is already covered by the unique index.

## Decision 4: Model the contract as a partial PATCH carrying only `name`

**Decision**: Expose `PATCH /api/v1/transport-companies/:id` accepting `{ "name": string }`. The Vine validator requires a non-blank `name` of 1–255 characters, and `assertValidSiteReferenceName` trims and re-validates in the use case. Success returns `200` with the full transport-company representation already defined by the consultation contract.

**Rationale**: PATCH with the resource transformer response matches the customer, dock, and weighing-area update contracts, so the Tuyau client and the web details panel need no new response shape. `name` is the only mutable field (FR-003), so unlike customers there is no `requiredIfMissing` interplay — the field is simply required, which makes an empty body a `422` rather than a silent no-op. Validating at the HTTP boundary and normalizing in the domain keeps the trimming rule (FR-006) true regardless of caller.

**Alternatives considered**:

- `PUT` with the full representation: rejected because clients would have to echo immutable lifecycle fields, inviting accidental lifecycle writes.
- A dedicated `POST /:id/rename` action: rejected because the resource has one mutable field today and PATCH already expresses partial update; a named action would diverge from the three delivered site-reference update contracts.
- Accepting lifecycle fields and ignoring them: rejected because FR-011 is easier to guarantee when the contract cannot express them at all.

## Decision 5: Map every refusal to a distinct, already-established status and code

**Decision**: Introduce `TransportCompanyNotFoundException` (`404`, `E_TRANSPORT_COMPANY_NOT_FOUND`), `DuplicateTransportCompanyNameException` (`409`, `E_TRANSPORT_COMPANY_NAME_CONFLICT`), and `ArchivedTransportCompanyReadOnlyException` (`409`, `E_TRANSPORT_COMPANY_ARCHIVED`). Blank or over-long names surface as the framework's `422 E_VALIDATION_ERROR`; invalid names reaching the domain raise the shared `422 E_SITE_REFERENCE_NAME_INVALID`. Authentication middleware yields `401 E_UNAUTHORIZED_ACCESS` and the policy yields `403 E_AUTHORIZATION_FAILURE`.

**Rationale**: FR-017 requires seven distinguishable outcomes, and the web layer needs stable codes to render distinct messages. Mirroring the customer exception vocabulary means the existing `parseApiError`/`applyValidationError` helpers work unchanged, with field-level validation errors landing on the form input and domain conflicts landing in a toast.

**Alternatives considered**:

- Reuse the customer exception classes: rejected because error codes are part of the public contract and must name the resource they describe.
- Return `404` for archived companies to hide their existence: rejected because archived companies are already readable to every active user through consultation, so the distinct `409` is both truthful and more actionable.
- Return `422` for a duplicate name: rejected because the value is well-formed and the failure is a state conflict; `409` matches the customer precedent.

## Decision 6: Treat an unchanged name as a normal success

**Decision**: Perform no equality short-circuit. A resubmitted current name is trimmed, passes validation, and is written; the `LOWER(name)` unique index does not conflict with the row against itself, so the result is `UPDATED` with `updatedAt` refreshed.

**Rationale**: FR-008 requires that this succeed and not be reported as a duplicate, which falls out of the index semantics without special-casing. Adding a short-circuit would introduce a second code path whose only observable difference is a stale `updatedAt`, and it would hide the case where another administrator's concurrent rename has already changed the row.

**Alternatives considered**:

- Detect no-op and return the loaded record untouched: rejected as an untestable optimization that complicates the use case.
- Reject an unchanged name as a client error: rejected because it contradicts FR-008 and would make a re-submitted form fail confusingly.

## Decision 7: Make edit a URL-addressable mode of the existing master-detail panel

**Decision**: Add `companyMode: z.enum(['view', 'edit']).catch('view')` to the transport-resources route search schema. `TransportCompanyDetails` gains a guarded **Edit company** action shown only when the viewer is an administrator and the company is `AVAILABLE`; choosing it sets `companyMode=edit`, which renders `EditTransportCompanyPanel` in the detail pane instead of navigating away. Cancel and successful save both return to `companyMode=view`.

**Rationale**: URL-backed panel state is the pattern #217 established for `companyStatus`, `companySearch`, and `transportCompanyId`, and customer administration already models edit as a `mode` in route search. Keeping the form in the detail pane satisfies "without leaving the consultation context" and makes the edit state reloadable, shareable, and directly reachable by router-level tests. Rendering the affordance behind `isAdministrator` satisfies FR-016 and the third acceptance scenario of user story 3, while the policy keeps the API authoritative per FR-020.

**Alternatives considered**:

- A modal sheet like customers: rejected because transport companies already present details inline; a sheet would cover the directory the administrator is working from.
- Local component state for edit mode: rejected because a refresh would drop the form and the mode could not be asserted through the real router.
- Inline click-to-edit on the name heading: rejected because it offers no room for field-level validation messages, a pending state, or an explicit cancel.

## Decision 8: Build the form on the shared form stack with server-driven field errors

**Decision**: Implement `TransportCompanyForm` with `useAppForm`, a Zod schema mirroring the server rule (`trim`, 1–255), and a submit handler that calls the update mutation. On failure it first attempts `applyValidationError(formApi, error)`; if the error is not a field-level validation failure it falls back to a Sonner toast built from `parseApiError`. `useTransportCompanyMutations` invalidates both `transportCompanyQueries.all()` and `.available()` on success.

**Rationale**: This is the delivered `CustomerForm` contract, so client-side rules stay a fast echo of server rules rather than a second source of truth, and `422` field errors attach to the input while `409` conflicts read as toasts. Invalidating both consultation queries keeps the renamed company authoritative everywhere it appears (FR-013), including any operational selector fed by the available-only endpoint.

**Alternatives considered**:

- Optimistic cache updates: rejected because a refused write would have to be rolled back, and FR-012 is easier to demonstrate when the client only ever shows server-confirmed state.
- Client-side duplicate checking against the loaded collection: rejected because it would duplicate an invariant the database owns and would be wrong against a stale snapshot.
- Invalidate only the complete collection: rejected because the available-only query backs operational selectors and would keep serving the old name.

## Decision 9: Test through real persistence and the real router

**Decision**: Drive API behavior with Japa unit specs (use case against the real Lucid repository on in-memory SQLite) and integration specs (HTTP through the real middleware, policy, and validator) under `tests/*/transport_companies/administration/update.spec.ts`. Drive web behavior through the real TanStack router with MSW intercepting the PATCH, adding `administration/update.test.tsx` and `administration/permissions.test.tsx` plus an administrator fixture and PATCH interception in the existing support helpers.

**Rationale**: This follows the seams #217 established for this resource and the repository's frontend testing strategy. Real persistence is what proves the unique index, the `WHERE status = 'AVAILABLE'` guard, and the trimming rule; MSW preserves the real Tuyau request so refusal responses are exercised as the browser would receive them. No Playwright suite is configured, so the quickstart retains a manual browser flow.

**Alternatives considered**:

- Fake the repository in unit tests: rejected because the constraint and lifecycle guard are precisely what must be proven.
- Mock the Tuyau client or `fetch`: rejected by the web testing conventions because it bypasses the transport adapter.
- Component-level tests of the form in isolation: rejected as the primary seam because they cannot show mode transitions, permission gating, or cache invalidation; they remain acceptable as supplements.
