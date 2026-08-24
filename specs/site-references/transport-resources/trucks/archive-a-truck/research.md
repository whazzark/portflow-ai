# Research: Archive a Truck

All Technical Context items are resolved from the existing codebase; no NEEDS CLARIFICATION items remain.

## Decision: Reuse the Customer archive slice shape for Truck

**Decision**: Add an `archive` vertical slice to the existing `apps/api/app/trucks/` module (`archive/archive_truck_use_case.ts`), following the exact shape already proven by `apps/api/app/customers/archive/archive_customer_use_case.ts`: the use case loads the truck, rejects a missing record, rejects an already-archived record, asks the shared usage checker whether the truck is in use, then delegates to a repository `archiveAvailable()` call that returns a discriminated result the use case maps to domain exceptions.

**Rationale**: `TruckPolicy`, `TruckTransformer`, the `trucks` table with its full lifecycle columns, and the `Truck` model already exist from List Trucks (`#222`) and Create a Truck (`#223`); only the lifecycle write path is missing. Mirroring an already-reviewed, already-tested pattern keeps deep-boundary ownership consistent with Constitution Principle V (use case = business decision, repository = persistence, controller = HTTP adaptation) and means Reactivate a Truck (`#226`) can follow the same shape without further design work.

**Alternatives considered**: A generic "site reference lifecycle" service shared across Customers, Docks, Weighing Areas, and Trucks — rejected because the List Trucks and Create a Truck plans already rejected a generic site-reference abstraction in favor of per-resource vertical slices, and each resource carries a different usage rule and a different set of blocking relationships that the abstraction would have to special-case anyway.

## Decision: Consume the existing shared usage checker rather than implement truck usage

**Decision**: `ArchiveTruckUseCase` injects the abstract `SiteReferenceUsageChecker` and calls `findUsedByPlannedOrActiveDischarge({ referenceType: 'TRUCK', referenceIds: [id] })`. No new query, repository, or rule is written for truck usage.

**Rationale**: This is already fully implemented. `SITE_REFERENCE_TYPES` in `site_reference_usage_checker.ts` already includes `'TRUCK'`, and `LucidDischargeUsageRepository` already has a `case 'TRUCK'` branch that joins `discharge_truck_assignments` to planned or active discharges and filters `discharge_truck_assignments.released_at IS NULL`. Enforce Persisted Site-Reference Usage Rules (`#240`) delivered that branch specifically so that "later Truck or Warehouse Door workflows" could not interpret the same discharge state differently — this slice is that later workflow. Consuming it directly satisfies FR-005, FR-006, and FR-007 with zero new persistence surface and guarantees trucks and customers cannot drift into two answers for the same stored state (Constitution Principle VI).

**Alternatives considered**: Writing a truck-specific in-use query inside `LucidTruckRepository` — rejected because it would duplicate a rule that already has an owner and would reintroduce exactly the divergence `#240` was delivered to prevent.

## Decision: Enforce single-archival with a status-guarded conditional UPDATE, not a lock or a re-read

**Decision**: `LucidTruckRepository.archiveAvailable()` issues one `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'` and inspects the affected-row count. Zero affected rows triggers a follow-up read that distinguishes `NOT_FOUND` from `ALREADY_ARCHIVED`; one affected row reloads and returns the archived truck.

**Rationale**: This is the pattern already implemented and tested in `LucidCustomerRepository.archiveAvailable()`. The `status = 'AVAILABLE'` predicate makes the transition atomic at the database level, so two near-simultaneous archival requests for the same truck necessarily collapse to exactly one recorded archival with a single archive time, actor, and comment — FR-016 and SC-005 — without introducing row locking, an application mutex, or an idempotency key. It also makes FR-017 automatic: a refused attempt performs no write at all, so the row is left byte-for-byte unchanged.

**Alternatives considered**: Read-then-write with `SELECT ... FOR UPDATE` — rejected as heavier than needed for a single-row transition and inconsistent with the sibling implementation; an unconditional `UPDATE` after an in-memory status check — rejected because it reintroduces a check-then-act race that would let the second of two concurrent requests overwrite the first archival's context.

## Decision: Reload the archived truck with its lifecycle relations preloaded

**Decision**: After a successful conditional update, `archiveAvailable()` reloads the truck with `preload('archivedBy')` and `preload('reactivatedBy')` before returning it, so the archive response carries a populated `archivedBy` summary rather than only `archivedByUserId`.

**Rationale**: `TruckTransformer` already emits `archivedBy` as a user summary, and the read contract established by List Trucks (`#222`) populates it because `list()`/`listAvailable()` preload both relations. Returning an unpreloaded model would make the archive response the only place in the truck contract where `archivedBy` is `null` while `archivedByUserId` is set — a contract inconsistency a client could reasonably read as "archived by nobody". The sibling `LucidCustomerRepository.archiveAvailable()` reloads with a bare `Customer.find()`, which has this exact gap; not copying it is a deliberate, contained improvement rather than a new pattern.

**Alternatives considered**: Returning the unpreloaded model and relying on the web client's query invalidation to refetch the populated record — rejected because it makes the HTTP contract depend on a particular client's caching behavior, and any non-web consumer would receive a misleading representation.

## Decision: Extract the lifecycle-comment validation rule to its shared site-reference home

**Decision**: Move both `lifecycleComment()` (`vine.string().trim().maxLength(1000).nullable().optional()`) and `lifecycleIds()` (`vine.array(vine.string().uuid().toLowerCase()).minLength(1).use(distinctUuids())`, with its `distinctUuids` rule) out of `apps/api/app/customers/shared/customer_validator.ts` into `apps/api/app/site_references/shared/site_reference_validator.ts` as exported helpers. `customer_validator.ts` imports them; the new `archiveTruckValidator` and `archiveTrucksValidator` in `truck_validator.ts` import them too.

**Rationale**: `site_reference_validator.ts` is already the shared home for cross-resource validation rules (`nonBlank`, imported today by both the customer and truck validators), so the helpers move to an established location rather than creating one. The 1,000-character comment limit and the "at least one, no duplicates, lower-cased UUIDs" selection rule are site-reference lifecycle rules, not customer rules: Reactivate a Truck (`#226`) will need both, as will any later dock or weighing-area lifecycle slice. Extracting once now prevents a second and third copy and satisfies Constitution Principle VI ("a canonical decision MUST NOT be duplicated in a second hand-maintained document"). Customer behavior is unchanged — the same rule chains are applied from a different import path, which the existing customer lifecycle suites verify.

**Alternatives considered**: Duplicating the helpers into `truck_validator.ts` — rejected because it silently forks the comment-length and selection limits across resources, so a later change to one would leave the other inconsistent with no compiler signal. Importing them from `customer_validator.ts` into the truck slice — rejected because it would make the trucks slice depend on the customers slice, violating the vertical-slice boundary that both prior truck plans preserve.

## Decision: Three new truck exceptions following the existing status-code convention

**Decision**: Add to `apps/api/app/trucks/shared/truck_exceptions.ts`: `TruckNotFoundException` (`404`, `E_TRUCK_NOT_FOUND`), `TruckAlreadyArchivedException` (`409`, `E_TRUCK_ALREADY_ARCHIVED`), and `TruckInUseException` (`409`, `E_TRUCK_IN_USE`, message "Truck is used by a planned or active discharge").

**Rationale**: These mirror `CustomerNotFoundException`, `CustomerAlreadyArchivedException`, and `CustomerInUseException` one-for-one, including status codes and code-string shape, so a client that already handles customer lifecycle conflicts needs no new error-handling concept. `404` is correct here (unlike the `422` chosen for an invalid transport company during creation) because the truck identifier is the addressed URL resource, not a field inside a payload. Authorization denial continues to rely on Bouncer's own `403`, matching how `trucks_controller.ts` already delegates entirely to `bouncer.with(TruckPolicy).authorize(...)`.

**Alternatives considered**: A single `E_TRUCK_LIFECYCLE_CONFLICT` covering both `409` cases — rejected because FR-015 and SC-006 require an already-archived conflict and an in-use conflict to produce distinct, actionable feedback, and one code would force the web client to parse a message string to tell them apart.

## Decision: Check order is not-found → already-archived → in-use → conditional update

**Decision**: `ArchiveTruckUseCase.handle()` evaluates in that fixed order, and the conditional update result is still mapped back to `NOT_FOUND` / `ALREADY_ARCHIVED` to catch a state change that occurred after the in-memory checks.

**Rationale**: Checking already-archived before in-use means re-archiving an archived truck reports the state conflict rather than an incidental usage answer, which is what an administrator acting on a stale view needs to see (User Story 3, scenario 2). Running the usage check inside `handle()` — after the truck is loaded, immediately before the write — is what makes FR-007 true: usage is evaluated when the archival is submitted, so a discharge that closed in the meantime unblocks the archival and a discharge planned in the meantime blocks it. Re-mapping the conditional-update result closes the residual window between the in-memory checks and the write.

**Alternatives considered**: Evaluating usage before loading the truck — rejected because it would run a discharge query for a nonexistent identifier and could disclose usage information about a truck the caller may not address; evaluating usage only inside the repository transaction — rejected because it would move a business decision out of the use case, against Principle V.

## Decision: Web archive action reuses the Customer lifecycle dialog, archive-only for this slice

**Decision**: Add `apps/web/src/features/trucks/ui/truck-lifecycle-actions.tsx`, modeled on `apps/web/src/features/customers/ui/lifecycle-actions.tsx` (destructive button → `AlertDialog` confirmation → optional comment textarea → mutation → toast), rendered from `TruckDetails` and shown only when the viewer is an administrator and the truck is `AVAILABLE`. `useTruckMutations` gains an `archive` mutation that invalidates both the `truckQueries.all()` and `truckQueries.available()` keys on success, exactly as `create` already does.

**Rationale**: The trucks workspace already renders truck details in a panel and already gates administrator-only controls with `isAdministrator(user)` (the create-truck button in `trucks-page.tsx`), so the archive action slots into an existing, tested composition. Invalidating both query keys is what makes FR-013 and FR-018 observable without a manual refresh: the archived truck disappears from the available tab and count and appears in the administrator-only archived tab. This slice renders only the archive branch; Reactivate a Truck (`#226`) extends the same component with the reactivate branch, matching how the customer component handles both.

**Alternatives considered**: Building the customer component's full archive-and-reactivate toggle now — rejected as delivering `#226`'s behavior inside `#225`'s slice.

## Decision: Multiple archival is one transaction with row locks, not a loop over the single path

**Decision**: `LucidTruckRepository.archiveAvailableMany()` opens one transaction, loads the submitted trucks with `forUpdate()`, resolves usage once for the whole set through the shared checker (passing `client: trx`), classifies every submitted id into eligible or blocked, issues one guarded `UPDATE ... WHERE id IN (eligible) AND status = 'AVAILABLE'`, asserts the affected-row count equals the eligible count, and returns the archived trucks alongside the blockers.

**Rationale**: This is the shape already implemented and tested in `LucidCustomerRepository.archiveAvailableMany()`. It is what makes FR-026 true — the eligible subset commits atomically, so a failure part-way through leaves nothing archived — while still satisfying FR-023's partial-success requirement, because ineligible trucks are classified before the update rather than causing it to fail. Resolving usage once for the whole set is also the reason the shared checker takes `referenceIds` as an array and returns a `Set`: one bounded query answers the whole submission. The `forUpdate()` lock plus the `status = 'AVAILABLE'` predicate is what makes overlapping concurrent submissions safe (FR-016): each truck is archived exactly once and the losing submission reports it as already archived without overwriting the winner's context. The affected-row assertion turns any residual drift into a loud failure rather than a silently short archival.

**Alternatives considered**: Looping over `ArchiveTruckUseCase` once per selected truck — rejected because it breaks FR-026 (a mid-loop failure leaves an arbitrary prefix archived), gives each truck a different `archivedAt` against FR-025, and issues one usage query per truck instead of one per submission. Running the multiple path outside a transaction and reporting per-truck outcomes — rejected for the same all-or-nothing reason. Refusing the whole submission when any truck is ineligible — rejected because FR-023 and the customer precedent both require partial success; an administrator retiring a fleet should not have to unpick one blocked vehicle from a batch of twenty.

## Decision: A truck-local lifecycle-blockers module, mirroring the customer one

**Decision**: Add `apps/api/app/trucks/shared/truck_lifecycle_blockers.ts` exporting `TruckLifecycleRecord`, `BulkTruckLifecycleBlocker` (`{ id, registration?, reason }`), `indexTrucksById`, `findBulkBlockers`, and `orderTrucks` — the same shape as `customer_lifecycle_blockers.ts`, with `registration` as the identifying label instead of `code`/`companyName`. The reason vocabulary for this slice is `NOT_FOUND`, `IN_USE`, and `ALREADY_ARCHIVED` (`ALREADY_AVAILABLE` arrives with reactivation in `#226`).

**Rationale**: These are pure, side-effect-free classification functions over already-loaded records, which is why they live beside the repository rather than inside it and are unit-testable without a database. Keeping them truck-local matches the per-resource vertical-slice direction that both prior truck plans set and that the List Trucks plan explicitly chose over a generic site-reference abstraction. Crucially, this repeats *code shape*, not a canonical decision: the actual eligibility rule — what counts as in use — still has exactly one owner in `SiteReferenceUsageChecker`, so trucks and customers cannot answer the same question differently no matter how the classification helpers are packaged.

**Alternatives considered**: Generalizing `customer_lifecycle_blockers.ts` into a shared `site_reference_lifecycle_blockers.ts` parameterized over the display fields — genuinely tempting under Principle VI, and worth revisiting once a third resource needs it, but rejected now because the two resources disagree on their identifying labels (`code` + `companyName` versus `registration`) and on their reason vocabulary, so the abstraction would immediately need type parameters or optional fields for both, buying indirection rather than a single source of truth. Having trucks import the customer module — rejected outright as a cross-slice dependency.

## Decision: Bulk route is `POST /api/v1/trucks/archive`, mirroring `customers.archive_many`

**Decision**: Register `router.post('/archive', [controllers.Trucks, 'archiveMany']).as('archive_many')` alongside the single `router.post('/:id/archive', [controllers.Trucks, 'archive']).as('archive')`, exactly as the customers group already does. The bulk response returns `{ updatedTrucks, blockedTrucks }` rather than a bare collection.

**Rationale**: Reusing the customers route naming means the Tuyau client surface (`tuyauQuery.trucks.archiveMany`) matches `tuyauQuery.customers.archiveMany`, so the web bulk component transposes without inventing a call shape. The two paths do not collide: `/archive` is a single path segment and `/:id/archive` is two, so registration order is irrelevant. A distinct response envelope rather than a plain list is what carries FR-024's per-truck reasons to the client.

**Alternatives considered**: `PATCH /api/v1/trucks` with a status field — rejected as a different mutation idiom from every existing lifecycle route in the codebase; encoding ids in a query string on the single route — rejected as unbounded in URL length and inconsistent with the customer contract.

## Decision: Selection lives in page state, scoped to the visible lifecycle and company filter

**Decision**: `trucks-page.tsx` holds `selectedTruckIds` as a `useState<Set<string>>` and derives a pruned set containing only ids currently listed in the active lifecycle view and transport-company filter, mirroring `customers-page.tsx`'s `visibleSelectedCustomerIds`. Search text does **not** prune the selection. Selection and the bulk toolbar render only for administrators and only in the available view. Blocked ids from a previous attempt become the selection for a retry, as `lifecycleActionIds` already does for customers.

**Rationale**: The truck directory has two navigational scopes the customer table lacks — the lifecycle tab and the transport-company filter — and both change what the directory *represents*, so carrying a selection across them would let an administrator archive trucks they can no longer see (FR-029). Search is different in kind: it narrows what is *displayed* within one scope, so a selected truck hidden behind a search term is still deliberately chosen, which is why the spec's edge cases keep it selected. Keeping the state in the page rather than the URL matches the customers precedent and avoids putting a potentially long id list in a shareable link.

**Alternatives considered**: Persisting selection in route search params — rejected as unbounded URL growth and surprising when a link is shared; pruning by search as well — rejected because it silently discards deliberate choices as the administrator types; keeping selection global across tabs and filters — rejected as directly violating FR-029.

## Decision: Restructure truck list rows to hold a checkbox beside the details button

**Decision**: In `truck-list.tsx`, each row becomes a container holding a `Checkbox` and the existing details `<button>` as siblings, with a select-all `Checkbox` in the list header covering the currently listed (search-filtered) trucks. The checkbox carries an explicit per-row accessible label naming the truck's registration, matching `customer-table.tsx`'s `Select customer {code}` pattern.

**Rationale**: This is the single largest piece of genuinely new construction in the slice and it is forced by the current markup: each row today is one full-width `<button>` wrapping the whole row, and interactive controls cannot be nested inside a button — doing so produces invalid HTML and breaks keyboard and screen-reader behavior. The customers feature avoided this because it renders a real `<table>` with a dedicated checkbox column. Splitting the row preserves the existing click-to-open-details affordance while making selection a separate, independently labelled control.

**Alternatives considered**: Making the whole row toggle selection and moving details opening to a secondary control — rejected because it changes an interaction List Trucks (`#222`) already established and users rely on; converting the truck directory to the customers `<table>` component — rejected as a far larger rewrite of a workspace this slice is not chartered to redesign, and unsuitable for the narrow directory column the workspace layout gives it.

## Decision: API tests introduce a `lifecycle/` folder mirroring the customers layout

**Decision**: Add `apps/api/tests/{unit,integration}/trucks/lifecycle/archive.spec.ts` and `apps/api/tests/{unit,integration}/trucks/lifecycle/bulk/archive.spec.ts`, alongside the existing `tests/{unit,integration}/trucks/administration/` and `consultation/` folders. Web coverage lands in `apps/web/src/features/trucks/__tests__/lifecycle/archive.test.tsx`, `__tests__/bulk/archive.test.tsx`, `__tests__/bulk/mixed-archive.test.tsx`, and `__tests__/selection/selection.test.tsx`.

**Rationale**: `tests/unit/customers/` and `tests/integration/customers/` already split into `administration/`, `consultation/`, and `lifecycle/` — the latter with a `bulk/` subfolder — and the trucks trees already use the first two names. Mirroring the full layout means a reader finds truck archival exactly where customer archival lives. The web feature already groups tests by concern (`access/`, `details/`, `list/`), and the customers feature already uses `bulk/` and `selection/` folders, so both conventions transfer unchanged.

**Alternatives considered**: Placing archive tests under the existing `administration/` folder — rejected because it would diverge from the customers layout that reviewers already navigate, and would mix a lifecycle transition with create/update coverage.
