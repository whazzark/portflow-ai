# Research: Reactivate a Transport Company

No `NEEDS CLARIFICATION` items were carried into planning. The spec's Assumptions section resolved the open product decisions from the `CONTEXT.md` definition of **Site Reference Reactivation** and from the delivered customer, dock, and weighing-area reactivation journeys; the decisions below resolve the technical ones.

## Decision 1: Add a `reactivate/` workflow to the delivered transport-company slice

**Decision**: Add `apps/api/app/transport_companies/reactivate/` holding `reactivate_transport_company_use_case.ts` and `reactivate_transport_companies_use_case.ts`, beside the existing `create/`, `list/`, `available/`, `update/`, and `archive/` workflows. Extend the shared modules: a `reactivate` ability on `TransportCompanyPolicy`, two reactivate validators, one new exception, a status-parameterised blockers module, and two writes on the repository. Add two actions to the existing controller.

**Rationale**: `apps/api/app/customers/reactivate/` is the delivered precedent and holds exactly this pair of use cases for exactly this pair of cardinalities. The archive slice deliberately left room for it — its research Decision 1 recorded that "#221 [is] able to add `reactivate/` — single and bulk — without restructuring anything this slice touches" — and that promise is what this decision cashes in.

A separate `reactivate` policy ability, rather than reusing `archive`, matches `CustomerPolicy`, which declares both. The two abilities happen to resolve identically today; keeping them separate is what lets a future policy change treat "retire a provider" and "restore a provider" differently without editing call sites.

**Alternatives considered**:

- One `lifecycle` ability covering both directions: rejected because it makes the authorization surface less explicit for no gain, and diverges from every delivered site-reference policy.
- One use case per cardinality handling both directions, parameterised by a target status: rejected because the two directions have different guards and different exception vocabularies; the parameter would immediately branch on itself. The repository is where the two directions genuinely share code, and there they do.
- Folding reactivation into `PATCH /:id` as a `status` field: rejected under FR-034 and the update slice's own contract — a rename must never be able to change lifecycle state, and the update contract deliberately cannot express `status`.

## Decision 2: Generalise the blockers module to a status expectation, and accept the widened reason union

**Decision**: Rewrite `apps/api/app/transport_companies/shared/transport_company_lifecycle_blockers.ts` so that `findBulkArchiveBlockers(ids, companiesById, companyIdsWithAvailableTrucks)` becomes:

```text
findBulkBlockers(
  ids                          : string[],
  companiesById                : Map<string, TransportCompanyLifecycleRecord>,
  expectedStatus               : 'AVAILABLE' | 'ARCHIVED',
  companyIdsWithAvailableTrucks: Set<string> = new Set(),
) : BulkTransportCompanyLifecycleBlocker[]
```

A company whose status is not `expectedStatus` yields `ALREADY_ARCHIVED` when `AVAILABLE` was expected and `ALREADY_AVAILABLE` when `ARCHIVED` was expected. The truck set is consulted only when `AVAILABLE` is expected. `BulkTransportCompanyLifecycleBlocker['reason']` widens to `'NOT_FOUND' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE' | 'HAS_AVAILABLE_TRUCKS'`.

**Rationale**: This is precisely what the archive slice's research Decision 12 deferred: "The helper is scoped to archival … rather than parameterised by an expected status the way the customer version is. Reactivation does not exist for transport companies yet … #221 can generalise it when it has a second caller." This slice is that caller, and the generalised signature is character-for-character the delivered `customer_lifecycle_blockers.ts` shape, so there is no new pattern to learn or review.

The cost is real and worth naming: a single widened union means the archive endpoint's serialized blocker type admits `ALREADY_AVAILABLE`, which it can never return, and the reactivate endpoint's admits two reasons it can never return. That is the trade-off the delivered customer contract already accepted, and it buys something concrete on the web side — one `BulkTransportCompanyLifecycleBlocker` type alias and one `formatBlockerReason` map serve both directions, instead of a discriminated union the bulk component would have to narrow before it could render a label.

On the web side the same widening decides how the shared result type is anchored: `BulkTransportCompanyLifecycleResult` becomes the union of the two route responses rather than staying pinned to `archive_many`, and `BulkTransportCompanyLifecycleBlocker` keeps deriving from it by indexed access. The two responses are structurally identical today, so the union is a no-op; it exists so that a future divergence surfaces as a typecheck failure in the bulk component rather than as one direction quietly typed as the other.

**Alternatives considered**:

- Keep `findBulkArchiveBlockers` and add a parallel `findBulkReactivateBlockers`: rejected as two implementations of one partition rule — "unknown id, then wrong status, then resource-specific blocker" — that can drift apart. It would also duplicate the `NOT_FOUND` branch, which is the branch most likely to be got subtly wrong.
- Preserve exact per-direction reason types with generics or overloads: rejected because Tuyau serializes the repository's return type, so precision would require two blocker types, two web type aliases, and a narrowing step in the bulk component — real complexity bought for a type-level nicety the interface never observes.
- Reuse `customer_lifecycle_blockers.ts` directly: rejected as premature cross-resource abstraction over two blocker vocabularies that only partly overlap, the same reason #220 gave.

## Decision 3: Perform no truck read, and add no reactivation-side lifecycle rule

**Decision**: `ReactivateTransportCompanyUseCase` and `ReactivateTransportCompaniesUseCase` do not inject `TruckRepository`. The bulk path calls `findBulkBlockers(..., 'ARCHIVED')` and lets the truck-set parameter default to empty. `reactivateArchived` and `reactivateArchivedMany` issue no query against `trucks`. Reactivating a company changes no truck's lifecycle state.

**Rationale**: This is the defining asymmetry of the slice, and it follows directly from how the rule is written. `CONTEXT.md` says of a transport company: "It cannot be **archived** while it still provides available trucks." The rule constrains leaving `AVAILABLE`, not returning to it. Nothing about restoring a provider can violate it — and inverting it would be actively wrong: a company with no available trucks is exactly what a successful archival produces, so a symmetric "must still provide trucks" rule would make every archival permanent. FR-006 states the absence explicitly and SC-005 makes it verifiable, so the absence is tested rather than merely intended.

The consequence to state plainly, because the interface must not contradict it: reactivation routinely yields an available company that provides no available truck. That is a legitimate intermediate state — the administrator restores the provider, then restores or creates its trucks — not an inconsistency to repair here.

Trucks are equally untouched in the other direction: an archived truck stays archived when its company returns (FR-015). Cascading would silently restore vehicles that may have been archived for their own reasons, and would make one confirmation write rows the administrator never saw.

**Alternatives considered**:

- Require at least one truck before allowing reactivation: rejected as the inverted rule described above; it would make archival irreversible and contradicts FR-006.
- Cascade-reactivate the company's archived trucks: rejected under FR-015 and FR-034. Truck lifecycle is its own slice with its own authorization and its own audit trail; a company-level confirmation is not informed consent for an unbounded set of truck writes.
- Warn in the dialog when the company has no available truck: rejected as unrequested surface resting on a cached truck collection the workspace may not even have loaded for that company. If the empty-provider state proves confusing in use, it deserves its own issue.
- Pass the truck set through anyway "for symmetry": rejected — an argument that is always empty is a query that should not run.

## Decision 4: Rely on the lifecycle-spanning name index; assert it rather than assume it

**Decision**: Add no name-uniqueness check and no name-conflict refusal to the reactivation path. Add an integration test that archives a company, fails to create another company with the same name while it is archived, then reactivates the first successfully.

**Rationale**: `transport_companies_name_unique` is `CREATE UNIQUE INDEX … ON transport_companies (LOWER(name))` with no partial predicate, so it spans `AVAILABLE` and `ARCHIVED` rows alike. An archived company's name therefore stays reserved for as long as it is archived, and no reactivation can collide. This is what makes reactivation *total* — every archived company is restorable — and it is the premise the spec records in its Assumptions.

The premise is load-bearing enough to test. If a future issue makes that index partial to free archived names for reuse, reactivation acquires a genuine conflict outcome, and this slice must fail loudly at that moment rather than start writing duplicate names.

**Alternatives considered**:

- Pre-check the name before reactivating and refuse with a conflict: rejected as dead code today — the check can never fire — and as a refusal path with no reviewed specification behind it.
- Leave the premise as a comment in the use case: rejected because a comment does not fail a build. Constitution principle IV asks for observable behavior to be proven, and "the name is still free" is observable.

## Decision 5: Guard the transition inside the write, without a transaction on the single path

**Decision**: Add two writes to `TransportCompanyRepository`:

- `reactivateArchived(command)` returning `ReactivateTransportCompanyResult` of `REACTIVATED | NOT_FOUND | ALREADY_AVAILABLE`, issuing `UPDATE … WHERE id = ? AND status = 'ARCHIVED'` and re-reading only when zero rows are affected, to tell "no such row" from "already available".
- `reactivateArchivedMany(command)` returning `BulkTransportCompanyLifecycleResult`, running inside one transaction that locks the requested rows `forUpdate`, partitions them with `findBulkBlockers(..., 'ARCHIVED')`, updates the eligible ids in one statement, and asserts that the affected-row count equals the eligible count.

The single path deliberately takes **no** transaction and **no** row lock.

**Rationale**: Keeping the lifecycle guard in the same statement as the write is what makes spec edge case 3 true — two administrators confirming concurrently produce exactly one success and exactly one `ALREADY_AVAILABLE`, with one stored reactivation context. The pre-check in the use case is not the guarantee; it exists to produce a clear reason without a wasted write.

The absence of a transaction on the single path is a deliberate divergence from the delivered `archiveAvailable`, which does lock. Archival locks because it must read `trucks` and write `transport_companies` as one indivisible step, and because truck creation takes the same lock from the other side. Reactivation reads nothing else and races with nothing else, so a single conditional `UPDATE` is already atomic; wrapping it would serialize nothing and would imply a hazard that does not exist. `LucidCustomerRepository.reactivateArchived` is the delivered precedent for that shape — a bare conditional `UPDATE` with a re-read only when zero rows are affected.

The bulk path keeps the transaction for a different reason: the partition is computed from rows read separately from the write, so the lock is what stops a company from changing status between being classified and being updated, and the affected-row assertion is what turns an unexpected change into an abort rather than a success that did not happen (FR-028).

**Alternatives considered**:

- Load, guard in the use case, then `save()`: rejected because the guard would not be atomic with the write and the concurrency edge cases would be untestable.
- Lock the row `forUpdate` on the single path for symmetry with archival: rejected as ceremony — nothing else contends for it, and copying a lock without copying its reason is how locks become cargo cult.
- Run the bulk path as N single reactivations: rejected. N round trips, no lock over the selection, and the shared reactivation time would drift across the request, breaking FR-027.
- All-or-nothing rollback when any company is blocked: rejected against FR-024; see Decision 8.
- Throw persistence exceptions from the repository: rejected because it inverts the boundary — the use cases own domain meaning.

## Decision 6: Order the single-reactivation guards so the refusal a caller sees is stable

**Decision**: `ReactivateTransportCompanyUseCase` checks in this order: row exists (`404 E_TRANSPORT_COMPANY_NOT_FOUND`), row is not already available (`409 E_TRANSPORT_COMPANY_ALREADY_AVAILABLE`), then issues the conditional write. Authentication (`401`), authorization (`403`), and comment validation (`422`) precede all of it at the HTTP boundary. The bulk path evaluates the same two conditions in the same order per company.

**Rationale**: FR-019 requires six distinguishable outcomes and FR-025 requires two distinguishable blocker reasons, so the order must be decided rather than incidental. With only two conditions the order is nearly forced — an id that matches no row cannot have a status — but stating it keeps the two paths aligned: a company blocked inside a selection reports exactly the reason it would report alone, which is what makes the per-company outcome comprehensible.

Authorization before validation, and validation before any read, is the delivered ordering from the archive contract: an unauthorized caller learns nothing about a company's existence or about the validity of their payload.

**Alternatives considered**:

- Treat an already-available company as an idempotent `200`: rejected under FR-003. Succeeding would overwrite the actor, time, and comment of the real reactivation with a transition that never happened, which is exactly the history-rewriting this guard exists to prevent.
- Validate the comment before authorizing: rejected as an information leak about payload shape to callers with no right to the action, and as a divergence from every delivered lifecycle endpoint.

## Decision 7: Model the contracts as `POST /:id/reactivate` and `POST /reactivate`

**Decision**: Expose `POST /api/v1/transport-companies/:id/reactivate` accepting `{ "comment"?: string | null }` and `POST /api/v1/transport-companies/reactivate` accepting `{ "ids": string[], "comment"?: string | null }`. Single success returns `200` with the full company representation, `reactivatedBy` preloaded. Bulk success returns `200` with `{ "data": { "updatedCompanies": [...], "blockedCompanies": [...] } }`. Register the literal `/reactivate` path before the parameterised `/:id/reactivate`, and reuse `lifecycleComment()` and `lifecycleIds()` from `#shared/validators/lifecycle_validator` unchanged.

**Rationale**: This is the delivered lifecycle route pair for customers and the exact mirror of the transport-company archive pair shipped by #220, so the Tuyau client, the web panel, and `parseApiError` need no new shapes. Returning complete records means the details panel can render the reactivation context — including who performed it — without a follow-up read. The two paths are separate endpoints rather than one polymorphic endpoint because their responses genuinely differ: one record versus a partitioned outcome.

The validators are reused rather than redeclared. `lifecycleComment()` and `lifecycleIds()` were hoisted into the shared site-reference validator by #220 precisely so the next lifecycle slice would import them; FR-009 and FR-029 are exactly those two rules, so this slice adds no validation logic of its own. That also means the "no maximum selection size" property of FR-029 is inherited rather than newly decided.

**Alternatives considered**:

- One endpoint accepting either an id or a list: rejected because the response shape would have to vary with the request shape, which is worse for a typed client than two honest contracts.
- `POST /:id/unarchive` or `DELETE /:id/archive`: rejected — `CONTEXT.md` names the concept **Site Reference Reactivation** and explicitly lists "unarchive" under _Avoid_.
- `PATCH /:id` with `{ status: 'AVAILABLE' }`: rejected because it would let a rename and a lifecycle transition share a contract, which FR-034 and the update slice both depend on being separable.
- Returning `204 No Content`: rejected because the panel needs the new lifecycle context and every delivered lifecycle endpoint returns records.

## Decision 8: Bulk reactivation is a partial success, not an atomic all-or-nothing request

**Decision**: `POST /transport-companies/reactivate` returns `200` whenever the request itself is well-formed and authorized, partitioning the outcome into `updatedCompanies` and `blockedCompanies`, including `200` with an empty `updatedCompanies` when every company is blocked. Only authentication, authorization, and payload validation produce a non-`2xx` status.

**Rationale**: This is the delivered customer and transport-company bulk contract, and the reasoning transfers unchanged: a selection is an administrator's convenience, not a business transaction, so failing forty valid reactivations because a forty-first company was restored by a colleague a second earlier would be hostile. FR-024 states this directly. Atomicity is preserved where it matters — per company, inside one transaction (FR-028).

`200` for the all-blocked case is deliberate: nothing about the *request* was wrong, and the administrator needs the per-company reasons that only the success envelope carries. FR-030 makes the interface responsible for saying plainly that nothing changed. For reactivation the all-blocked case is more common than for archival, because "someone already restored these" is a realistic outcome of two administrators tidying the same archive.

**Alternatives considered**:

- `207 Multi-Status`: rejected as a status no other endpoint in this API uses and no client here interprets.
- `409` when every company is blocked: rejected because it would force the blocker reasons into an error envelope with no place for them, and would need two client code paths for the same information.
- All-or-nothing rollback on any blocker: rejected per the above.

## Decision 9: Make the delivered web lifecycle components direction-aware instead of adding twins

**Decision**: Extend `TransportCompanyLifecycleActions` and `BulkTransportCompanyLifecycleActions` with a lifecycle direction — derived from `company.status` for the single component and from `companyStatus` for the bulk one — that selects the mutation, the button label and variant, the dialog copy, and the toast wording. Add no new component. `TransportCompanyDetails` renders its administrator footer for archived companies too, offering **Reactivate company** alone; `TransportResourcesWorkspace` passes selection props and renders the toolbar on both lifecycle tabs.

**Rationale**: `features/customers/ui/lifecycle-actions.tsx` and `bulk-lifecycle-actions.tsx` have been direction-aware since customers shipped both transitions, and they are the components these two were modelled on. Twin components would duplicate the dialog, the comment field, the 1,000-character cap, the pending state, and the error handling — five things that must stay identical — to vary a verb.

Opening the Archived tab to selection is a workspace change only: `TransportCompanyList` already renders checkboxes exactly when the handlers are passed, so the Archived tab simply starts receiving what the Available tab already gets. #220 withheld this deliberately, to avoid inventing an answer to "what does bulk archive mean here?" before reactivation existed. It now has one.

Edit stays absent from the archived footer. The update slice refuses archived companies with `409 E_TRANSPORT_COMPANY_ARCHIVED`, so offering a form that cannot save would be strictly worse than offering nothing — and the existing `editSession` guard already blocks a hand-typed `companyDetailsMode=edit`.

**Alternatives considered**:

- Separate `TransportCompanyReactivateActions` / `BulkTransportCompanyReactivateActions`: rejected per the duplication above.
- A shared headless lifecycle hook consumed by four thin components: rejected as more indirection than two `if`s deserve at this size.
- Keep bulk on the Available tab only and offer single reactivation alone: rejected against FR-021; the archived collection is exactly where a selection is useful after a bulk archival.
- Show checkboxes on both tabs for observers: rejected under FR-032 — selection exists to feed an action an observer cannot perform.

## Decision 10: Follow the reactivated companies, and be honest about what "retry" means here

**Decision**: On a successful single reactivation, show a confirmation toast, keep the details sheet open on the same company, and navigate the workspace to `companyStatus: 'available'`, clearing `transportCompanyId` and `truckId` as every other tab change already does. On a bulk reactivation, show an aggregate toast, keep the administrator on the Archived tab, and replace the selection with the blocked companies.

**Rationale**: The directory is filtered by lifecycle tab, so reactivating from the Archived tab makes the company vanish from the visible list; following it to the tab that now shows it is the delivered pattern from creation and from single archival, and it puts the restored company where the administrator can confirm it. Keeping the sheet open matters because the reactivation context — when, by whom, the comment — is exactly what the administrator wants to verify, and the panel already renders it under "Latest reactivation context".

For bulk the reasoning inverts, as it does for archival: jumping to the Available tab would abandon the blocked companies, which are the only ones still needing attention.

The honest caveat, recorded rather than glossed: unlike `HAS_AVAILABLE_TRUCKS`, **neither reactivation blocker is recoverable**. `ALREADY_AVAILABLE` means the company is already in the requested state; `NOT_FOUND` means it is gone. Narrowing the selection to the blocked companies satisfies FR-031 literally and keeps the reasons on screen where the administrator can read and dismiss them, but pressing the action again will simply reproduce the same outcome. The retry that genuinely matters for this slice is the whole-request failure — a `5xx` or a network fault — where nothing was written, the selection is preserved untouched, and pressing again is exactly right.

**Alternatives considered**:

- Clear the selection entirely after a bulk reactivation: rejected because the blocked companies and their reasons would disappear with it, contradicting FR-030 and FR-031.
- Jump to the Available tab after a bulk reactivation: rejected as above — it hides the work that remains.
- Drop the retry affordance for reactivation because no blocker is recoverable: rejected because the whole-request failure case is real and is the one that needs it, and because a toolbar that disappears on partial success would strand the reasons.
- Close the details sheet after a single reactivation: rejected because the reactivation context is the thing worth confirming.

## Decision 11: Leave the seeded fixtures untouched

**Decision**: Add no transport-company fixture. Prove the second-reactivation and null-actor cases in automated tests, and use the delivered dataset for the browser flow.

**Rationale**: `TRANSPORT_COMPANY_FIXTURES` already contains everything this slice needs to demonstrate, which is unusual enough to be worth stating:

- *Loire Vrac Transport* — archived with a resolvable actor and a comment: the ordinary reactivation.
- *Noroît Logistique* — archived with `archivedByUserId: null`: proves the details panel and the response tolerate a missing archival actor across a reactivation.
- *Estuaire Bennes* — available, carrying a *previous* archival and reactivation context: proves that a second reactivation replaces the reactivation triple rather than accumulating, and is also a ready-made `ALREADY_AVAILABLE` blocker for a mixed selection.

Two archived companies also make a genuine multi-company bulk selection demonstrable without touching `TRUCK_FIXTURES`, which `discharge_preparation.ts` indexes positionally.

**Alternatives considered**:

- Add a third archived company for a larger bulk demonstration: rejected as churn in shared seed data for no case the existing pair does not already cover.
