# Research: Create a Transport Company

No `NEEDS CLARIFICATION` items were carried into planning. The spec's Assumptions section resolved the open product decisions from established site-reference precedent; the decisions below resolve the technical ones. Two of them — the auditing question and the reuse of the already-delivered uniqueness index — settle points the spec explicitly deferred here.

## Decision 1: Add a `create/` workflow to the delivered transport-company slice

**Decision**: Add `apps/api/app/transport_companies/create/create_transport_company_use_case.ts` alongside the existing `list/`, `available/`, and `update/` workflows. Extend the existing shared modules rather than creating new ones: a `createTransportCompanyValidator` in `transport_company_validator.ts`, a `create` ability on `TransportCompanyPolicy`, and a `store` action on `TransportCompaniesController`.

**Rationale**: `CreateDockUseCase` and `CreateCustomerUseCase` already prove this exact shape for a site reference, and #219 established it inside this resource. Reusing it satisfies constitution principle V and leaves #220/#221 free to add `archive/` and `reactivate/` workflows without restructuring. No new exception class is needed: `DuplicateTransportCompanyNameException` already exists and already means what creation needs it to mean.

**Alternatives considered**:

- A shared site-reference creation service across customers, docks, and transport companies: rejected as cross-domain refactoring with no demonstrated need; each resource's required fields differ (customers carry a code, docks carry coordinates).
- Creating from the controller through Lucid directly: rejected because it bypasses the required use-case/repository boundary.
- A separate `create_transport_company_validator.ts` module: rejected because the resource already has one validator module and the two schemas are siblings.

## Decision 2: Inherit the existing uniqueness index; add no migration

**Decision**: This slice adds no migration and no schema change. It relies on `transport_companies_name_unique` — the `CREATE UNIQUE INDEX ... ON transport_companies (LOWER(name))` delivered by #219's migration `1785100000000_add_transport_companies_name_unique_index.ts` — and translates the resulting unique violation into `DUPLICATE_NAME` at the repository boundary.

**Rationale**: FR-007 and FR-019 require that two administrators submitting the same name concurrently produce exactly one stored company. A `LOWER(name)` unique index constrains inserts as well as updates, so the invariant this slice must guarantee is already enforced in the database. #219's plan recorded that it "will inherit the guarantee"; this is the slice that inherits it. Adding a second constraint would be redundant, and adding a read-then-write duplicate check in the use case would leave a race window the index closes.

**Alternatives considered**:

- A pre-write `SELECT` to detect duplicates and return a friendlier error: rejected because it cannot close the concurrency window and would make spec edge case 1 untestable. The unique violation is caught and translated instead, which is both atomic and already the delivered customer/dock pattern.
- Restricting uniqueness to `AVAILABLE` companies: rejected — the index is not this slice's to redefine, and the spec's assumption is explicit that an archived company still reserves its name.
- Normalizing to a lowercase shadow column: rejected as redundant storage when the expression index already expresses the rule.

## Decision 3: Record no creation actor

**Decision**: Store no `created_by_user_id`. A created company carries `id`, `name`, `status = 'AVAILABLE'`, and the server-managed `createdAt`/`updatedAt`, and nothing else.

**Rationale**: This resolves the auditing question the spec deferred to planning. No functional requirement and no acceptance scenario in this slice observes who created a company; FR-010 asks only for a creation time. Every delivered site reference — customers, docks, weighing areas — records lifecycle actors (`archivedByUserId`, `reactivatedByUserId`) but no creation actor, because archival and reactivation are accountable decisions about an existing reference while creation is not modelled as a lifecycle transition. Adding a column with no behavior attached would be a schema change this slice cannot test through observable behavior, which principle IV forbids.

**Alternatives considered**:

- Add `created_by_user_id` now "since it's cheap": rejected because it is untestable behavior in this slice and would put transport companies out of step with the other three site references. If organization-wide reference auditing is later wanted, it belongs in one cross-resource issue, not in one resource's creation slice.
- Record creation as a lifecycle transition with actor and comment: rejected because it contradicts the spec's assumption that creation is not a lifecycle transition, and would give a fresh company a misleading lifecycle context that FR-009 says must be absent.

## Decision 4: Model the contract as `POST /api/v1/transport-companies` returning `201`

**Decision**: Expose `POST /api/v1/transport-companies` accepting `{ "name": string }`, registered as `router.post('/', [controllers.TransportCompanies, 'store']).as('store')` in the existing group. The Vine validator requires a non-blank `name` of 1–255 characters, `assertValidSiteReferenceName` trims and re-validates in the use case, and success returns `201` with the complete company built by `TransportCompanyTransformer`.

**Rationale**: `POST /api/v1/customers`, `POST /api/v1/docks`, and `POST /api/v1/weighing-areas` all use this exact shape, including the explicit `response.status(201)` in the controller. Returning the full representation means the web client needs no follow-up read to show the new company, and reusing the consultation transformer means no new response shape enters the Tuyau contract. Validating at the HTTP boundary and normalizing in the domain keeps FR-006's trimming rule true regardless of caller.

**Alternatives considered**:

- Returning `200` with the created record: rejected because it loses the "a resource was created" signal and diverges from all three delivered creation contracts.
- Returning `201` with only the new id: rejected because the client would need a second request to render the company, which works against FR-012.
- Accepting `status` in the body so a company could be created archived: rejected — the spec's assumption forbids it, and FR-009 is easiest to guarantee when the contract cannot express it.

## Decision 5: Add `CREATED` to the existing write-result union

**Decision**: Add `create(command: CreateTransportCompanyCommand)` to `TransportCompanyRepository` and a `{ kind: 'CREATED'; company }` variant to the existing `TransportCompanyWriteResult`. The Lucid implementation is `TransportCompany.create({ ...command, status: 'AVAILABLE' })` inside a `try`, translating `isUniqueViolation(error)` into `{ kind: 'DUPLICATE_NAME' }` and rethrowing anything else. The use case maps `DUPLICATE_NAME` to `DuplicateTransportCompanyNameException` and throws on any unexpected kind.

**Rationale**: `LucidDockRepository.create` is byte-for-byte this shape, and `CustomerWriteResult` already demonstrates one union carrying both `CREATED` and `UPDATED`. Keeping one union per resource means the use cases share one exhaustive mapping vocabulary. The model's `@beforeCreate` hook assigns the UUID, so identity generation needs nothing new (FR-008).

**Alternatives considered**:

- A separate `TransportCompanyCreateResult` union: rejected because the outcomes overlap (`DUPLICATE_NAME`) and two unions would drift.
- Returning the model or throwing from the repository: rejected because it inverts the boundary; the use case owns domain meaning.
- Wrapping the insert in an explicit transaction: rejected as unnecessary for a single-row insert whose only concurrent hazard the unique index already covers.

## Decision 6: Do not preload lifecycle relations on the created company

**Decision**: Return the model produced by `TransportCompany.create` directly, without a follow-up preloading read.

**Rationale**: A newly created company has `archivedByUserId` and `reactivatedByUserId` null by construction (FR-009), so `archivedBy` and `reactivatedBy` have nothing to preload. `TransportCompanyTransformer` already guards both with a truthiness check and emits `null`, which is exactly the correct payload here. This matches `LucidCustomerRepository.create` and `LucidDockRepository.create`, neither of which re-reads. `updateAvailable` does re-read, but only because a renamed company may legitimately carry lifecycle actors.

**Alternatives considered**:

- Re-read with `.preload('archivedBy').preload('reactivatedBy')` for symmetry with `updateAvailable`: rejected as a guaranteed-empty round trip on the hot path.

## Decision 7: Make create a third mode of the existing details sheet

**Decision**: Widen the transport-resources route search schema from `companyDetailsMode: z.enum(['view', 'edit'])` to `z.enum(['view', 'edit', 'create'])`. In `create` mode `companyDetailsId` is absent, the sheet opens on the mode rather than on a resolved company, and it renders a new `CreateTransportCompanyPanel`. A **Create transport company** action appears in the directory card header for administrators, and the available-lifecycle empty state offers the same action so the first company can be created from an empty collection (FR-014). Cancelling returns to `companyDetailsMode=view` with no `companyDetailsId`; a successful save selects the new company in `view` mode.

**Rationale**: URL-backed panel state is the pattern #217 established and #219 extended for this resource, and `customers-page.tsx` already models create as a `mode` in route search with `customerId` cleared. Reusing the sheet keeps the administrator in the directory they are working from, makes the create state reloadable and shareable, and makes it directly reachable by router-level tests. Landing on the new company in `view` mode gives immediate, observable confirmation that FR-012 holds.

**Alternatives considered**:

- A separate `?creating=true` boolean alongside `companyDetailsMode`: rejected because two flags can contradict each other; one enum cannot.
- Local component state for create mode: rejected because a refresh would drop the form and the mode could not be asserted through the real router.
- A dedicated `/transport-companies/new` route: rejected because it leaves the directory context and the legacy `/transport-companies` path is already a redirect shim.
- Offering create only from the header and not from the empty state: rejected because the empty collection is exactly when creation matters most, and acceptance scenario 5 of user story 1 names it.

## Decision 8: Generalize the existing form rather than fork it

**Decision**: Change `TransportCompanyForm` to take an optional `company` and both `onCreate` and `onSuccess`, defaulting the name field to `company?.name ?? ''` and choosing the submit label, toast message, and handler on the presence of `company`. Add a `create` mutation to `useTransportCompanyMutations` that invalidates both `transportCompanyQueries.all()` and `.available()` on success.

**Rationale**: This is exactly `CustomerForm`, which already serves both create and edit from one component with one Zod schema. Forking would duplicate the trimming rule, the `applyValidationError`/`parseApiError` fallback, and the 1–255 bound across two files that must stay identical. Invalidating both consultation queries keeps the new company authoritative everywhere it appears (FR-012), including operational selectors fed by the available-only endpoint.

**Alternatives considered**:

- A separate `CreateTransportCompanyForm`: rejected as duplication of a schema that must not drift from the server rule.
- Optimistic insertion into the cache: rejected because a refused write would have to be rolled back, and FR-011 is easier to demonstrate when the client only ever shows server-confirmed state.
- Client-side duplicate checking against the loaded collection: rejected because it duplicates an invariant the database owns and would be wrong against a stale snapshot; the server's `409` is the only truthful answer.

## Decision 9: Test through real persistence and the real router

**Decision**: Drive API behavior with a Japa unit spec (the use case against the real Lucid repository on in-memory SQLite) and an integration spec (HTTP through the real middleware, policy, and validator) at `tests/{unit,integration}/transport_companies/administration/create.spec.ts`. Drive web behavior through the real TanStack router with MSW intercepting the `POST`, adding `__tests__/administration/create.test.tsx` and extending the existing `administration/permissions.test.tsx` and support helpers.

**Rationale**: This follows the seams #217 established and #219 extended for this resource, and the repository's frontend testing strategy. Real persistence is what proves the inherited unique index actually refuses a case-insensitive duplicate insert and that `@beforeCreate` assigns a distinct identity; MSW preserves the real Tuyau request so `201`, `422`, and `409` responses are exercised as the browser would receive them. No Playwright suite is configured, so the quickstart retains a manual browser flow.

**Alternatives considered**:

- Fake the repository in unit tests: rejected because the inherited constraint is precisely what must be proven here.
- Mock the Tuyau client or `fetch`: rejected by the web testing conventions because it bypasses the transport adapter.
- Skip the concurrency assertion as untestable: rejected — two awaited inserts of the same name in one spec demonstrate FR-019 deterministically against the real index.
