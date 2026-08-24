# Research: Archive a Transport Company

**Last Updated**: 2026-08-24 — Decisions 2, 4, 8, 9 revised and Decisions 11 to 13 added after bulk archival entered scope.

No `NEEDS CLARIFICATION` items were carried into planning. The spec's Assumptions section resolved the open product decisions from established site-reference precedent and from the `CONTEXT.md` definition of **Transport Company**; the decisions below resolve the technical ones.

## Decision 1: Add an `archive/` workflow to the delivered transport-company slice

**Decision**: Add `apps/api/app/transport_companies/archive/` holding `archive_transport_company_use_case.ts` and `archive_transport_companies_use_case.ts`, beside the existing `create/`, `list/`, `available/`, and `update/` workflows. Extend the shared modules: an `archive` ability on `TransportCompanyPolicy`, two archive validators, two lifecycle exceptions, a lifecycle-blockers module, and two writes on the repository. Add two actions to the existing controller.

**Rationale**: `apps/api/app/customers/archive/` is the delivered precedent and already holds exactly this pair of use cases for exactly this pair of cardinalities. Reusing its shape satisfies constitution principle V and leaves #221 able to add `reactivate/` — single and bulk — without restructuring anything this slice touches.

**Alternatives considered**:

- A generic site-reference lifecycle service shared by customers, docks, weighing areas, and transport companies: rejected as cross-domain refactoring with no demonstrated need. Each resource's blocking rule differs — discharge usage for customers, docks, and weighing areas; available trucks for transport companies; available doors for warehouses — and folding them together would hide exactly the part that differs.
- One use case handling both cardinalities, with the single path passing a one-element array: rejected because their outcomes genuinely differ. Single archival must *throw* a distinguishable exception per refusal; bulk archival must *return* a per-company reason and keep going. Merging them would force one of the two into an unnatural shape, and customers already proved the split works.
- Extending the existing `update` ability to cover archival: rejected because per-ability policy methods keep the authorization surface explicit and match `CustomerPolicy` and `WeighingAreaPolicy`. It would also make #221 unable to authorize reactivation independently.
- Putting the lifecycle transition on the `update` endpoint as a `status` field: rejected under FR-036 and the update slice's FR-011 — a rename must never be able to archive, and the update contract deliberately cannot express a lifecycle field.

## Decision 2: Enforce the available-truck rule through one set-based truck read, used by both paths

**Decision**: Add to `TruckRepository`:

```text
findCompanyIdsWithAvailableTrucks(input: {
  transportCompanyIds: readonly string[]
  client?: QueryClientContract
}): Promise<Set<string>>
```

implemented in `LucidTruckRepository` as a single grouped query on `trucks` filtered by `whereIn('transport_company_id', ids)` and `status = 'AVAILABLE'`. Both use cases call it — the single one with a one-element list — and both treat membership in the returned set as the blocker.

**Rationale**: `CONTEXT.md` states the rule as a property of the transport company ("It cannot be archived while it still provides available trucks"), so the decision belongs to the transport-company use cases; only the fact they need comes from the truck slice. The delivered `CreateTruckUseCase` already injects `TransportCompanyRepository` in the opposite direction, so a cross-slice repository read is the established boundary here rather than a new pattern. The set shape is the delivered `SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge` shape, which `ArchiveCustomerUseCase` likewise calls with `referenceIds: [input.id]` — one rule, one query, one place to be wrong. The optional `client` lets the bulk path run the read inside its transaction, as `archiveAvailableMany` already does for customers.

**Note on a reversed decision**: before bulk archival entered scope this was specified as a boolean `hasAvailableForTransportCompany(id)`, and the set-based shape was rejected as speculative. Bulk archival makes it necessary, and once it exists, a second boolean method would be a second way to ask the same question. The set shape is now the only one.

**Alternatives considered**:

- Extend `SiteReferenceUsageChecker` with a `TRANSPORT_COMPANY` reference type: rejected because that abstraction answers exactly one question — "is this reference used by a planned or active discharge?" — and the transport-company blocker is a different question about structural ownership of trucks. Overloading it would make one interface mean two things and would put a rule that is true regardless of any discharge behind a discharge-shaped API.
- Add a *second* check against planned or active discharge usage alongside the truck rule: rejected as redundant and dangerous. A truck reserved by a planned or active discharge is necessarily `AVAILABLE`, so the truck rule already refuses those companies; two rules that must agree are two rules that can disagree.
- Keep a boolean method for the single path and add a set method for bulk: rejected as two implementations of one rule that can drift apart.
- One truck query per company in the bulk path: rejected — it is the N+1 that the set shape exists to avoid, and it would put the rule's cost on the size of the selection.
- Denormalize an `available_truck_count` column on `transport_companies`: rejected as a cache with no invalidation owner; every truck write would have to maintain it, and #223 shipped without it.

## Decision 3: Order the single-archival guards so the refusal a caller sees is stable

**Decision**: `ArchiveTransportCompanyUseCase` checks in this order: row exists (`404`), row is not already archived (`409 ALREADY_ARCHIVED`), company provides no available truck (`409 HAS_AVAILABLE_TRUCKS`), then issues the conditional write. Authentication (`401`), authorization (`403`), and comment validation (`422`) precede all of it at the HTTP boundary. The bulk path evaluates the same three conditions in the same order per company, and reports the first that applies.

**Rationale**: FR-021 requires seven distinguishable outcomes and FR-027 requires three distinguishable blocker reasons, so the order must be decided rather than incidental — it determines what an already-archived company with available trucks reports. Reporting `ALREADY_ARCHIVED` first is right because it is the outcome the caller can act on: the company is already in the state they asked for, and the truck blocker is irrelevant to that. Using the same order in both paths means a company blocked in a selection reports the same reason it would report alone, which is what makes "retry the blocked ones individually" comprehensible.

**Alternatives considered**:

- Report the truck blocker before the already-archived state: rejected because it answers a question the caller did not ask and makes an idempotent-looking retry return a conflict about trucks.
- Report *all* applicable reasons per company in the bulk result: rejected because the administrator acts on one reason at a time, and the delivered customer blocker contract carries exactly one.

## Decision 4: Guard the lifecycle transition inside the write, in both paths

**Decision**: Add two writes to `TransportCompanyRepository`:

- `archiveAvailable(command)` returning `ArchiveTransportCompanyResult` of `ARCHIVED | NOT_FOUND | ALREADY_ARCHIVED`, issuing `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'` and re-reading only when zero rows are affected.
- `archiveAvailableMany(command)` returning `BulkTransportCompanyLifecycleResult` of `{ updatedCompanies, blockedCompanies }`, running inside one transaction that locks the requested rows `forUpdate`, computes blockers, updates the eligible ids in one statement, and asserts that the affected-row count equals the eligible count.

**Rationale**: These are the delivered `LucidCustomerRepository.archiveAvailable` and `archiveAvailableMany` shapes. Keeping the lifecycle guard in the same statement as the write is what makes spec edge case 4 true — two administrators confirming concurrently produce exactly one success and exactly one `ALREADY_ARCHIVED`, and only one archival context is recorded. In the bulk path the `forUpdate` lock plus the affected-row assertion is what makes FR-030 true: a company is either fully archived with its metadata or untouched, never half-written, and an unexpected concurrent change aborts the transaction rather than silently reporting a success that did not happen. The pre-checks in the use cases are therefore not the guarantee; they exist to produce clear reasons without wasted writes.

**Alternatives considered**:

- Load, guard in the use case, then `save()` per company: rejected because the guard would not be atomic with the write and the concurrency edge cases would be untestable.
- Run the bulk path as N single archivals in a loop: rejected. It would take N round trips, would not lock the selection, and would let the shared archival time drift across the request, breaking FR-029.
- Make the whole bulk request atomic — roll everything back if any company is blocked: rejected against FR-026 and the delivered customer contract; see Decision 11.
- Wrap the single write in an explicit transaction: rejected as unnecessary for a single-row, single-statement write.
- Throw persistence exceptions from the repositories: rejected because it inverts the boundary — the use cases own domain meaning.

## Decision 5: Model the contracts as `POST /:id/archive` and `POST /archive`

**Decision**: Expose `POST /api/v1/transport-companies/:id/archive` accepting `{ "comment"?: string | null }` and `POST /api/v1/transport-companies/archive` accepting `{ "ids": string[], "comment"?: string | null }`. Single success returns `200` with the full company representation, `archivedBy` preloaded. Bulk success returns `200` with `{ "data": { "updatedCompanies": [...], "blockedCompanies": [...] } }`.

**Rationale**: This is the delivered lifecycle route pair for customers — `POST /customers/:id/archive` and `POST /customers/archive` — so the Tuyau client, the web panel, and `parseApiError` need no new shapes. A lifecycle transition is a named action rather than a partial field write, which is why neither is folded into `PATCH /:id`: the update contract must remain unable to express `status`. Returning complete records means the panel can render the archival context — including who archived it — without a follow-up read. The two paths are separate endpoints rather than one polymorphic endpoint because their responses genuinely differ: one record versus a partitioned outcome.

**Alternatives considered**:

- One endpoint accepting either an id or a list: rejected because the response shape would have to vary with the request shape, which is worse for a typed client than two honest contracts.
- `DELETE /:id` with soft-delete semantics: rejected because site references are never deleted (FR-017) and the verb would misdescribe a reversible transition.
- `PATCH /:id` with `{ status: 'ARCHIVED' }`: rejected because it would let a rename and a lifecycle transition share a contract, and FR-036 and the update slice's FR-011 both depend on them being separable.
- Returning `204 No Content`: rejected because the panel needs the new lifecycle context and the delivered lifecycle endpoints all return records.

## Decision 6: Reuse the established lifecycle validation rules, hoisted to the shared site-reference validator

**Decision**: Move `lifecycleComment()` — `vine.string().trim().maxLength(1000).nullable().optional()` — and `lifecycleIds()` with its `distinctUuids` rule — `vine.array(vine.string().uuid().toLowerCase()).minLength(1).use(distinctUuids())` — from `apps/api/app/customers/shared/customer_validator.ts` into `apps/api/app/site_references/shared/site_reference_validator.ts`. Use them for `archiveTransportCompanyValidator` and `archiveTransportCompaniesValidator`. Update the customer validator to import them.

**Rationale**: FR-009 to FR-011 and FR-031 are exactly these rules, and both are already written down — copying them would create a second place to fix a future change. `site_reference_validator.ts` already exists as the home for cross-resource reference validation (`nonBlank` lives there), so this fills an existing home rather than creating one, satisfying constitution principle VI. Switching customers to the shared imports is a mechanical no-behavior change that removes the duplicates at their source.

`lifecycleIds()` is hoisted **as-is**, with no maximum length, so customers' observable validation does not change. That is also why the spec records "no maximum selection size" as an assumption rather than as a requirement: it is a property inherited from the shared rule, not a decision this slice made.

**Note on scope**: `dock_validator.ts` and `weighing_area_validator.ts` declare their lifecycle comment as `vine.string().nullable().optional()` — no trim, no maximum length. That is a real inconsistency with customers, and it is **not** fixed here: changing it would alter the observable validation behavior of two endpoints this issue does not own. It is worth its own issue.

**Alternatives considered**:

- Declare local copies in `transport_company_validator.ts`: rejected as a third copy of rules that already exist twice.
- Add a maximum selection size while hoisting: rejected because it would silently tighten the customer contract, which no reviewed spec covers. If a cap is wanted, it belongs in an issue that owns both resources.
- Align docks and weighing areas in the same commit: rejected as scope creep into two other resources' contracts, with observable behavior changes that no reviewed spec covers.

## Decision 7: Accept the create-truck race, and record it

**Decision**: Do not attempt to make "archive a company" and "create a truck for that company" mutually exclusive. Document the residual window.

**Rationale**: Both operations are read-then-write across two tables in opposite orders: archival reads truck availability then writes the company; creation reads company availability then writes the truck. Interleaved, they can leave one available truck under a just-archived company. The bulk path narrows the window — it holds the company rows `forUpdate` while it reads trucks and writes — but does not close it, because truck creation never reads the company under that lock. Closing it properly needs both sides to take the same lock, realistically truck creation locking the company row, which is a change to the delivered #223 write path that this issue does not own and whose spec does not mention it. The window is narrow, the result is self-correcting the next time either record is written, and it is the same shape as the accepted window in the delivered customer, dock, and weighing-area archive journeys. The honest engineering position is to name it, not to half-fix it.

**Alternatives considered**:

- Lock the company row `forUpdate` during single archival too: rejected as security theatre for this hazard — truck creation never reads the company under that lock, so nothing is actually serialized.
- Add a database constraint forbidding an available truck under an archived company: rejected because it cannot be expressed as a simple check constraint across two tables, and a trigger would put business rules somewhere no ADR sanctions.
- Re-verify truck availability after the company write and roll back: rejected as a compensating transaction that would still have its own window, at the cost of a much more complex write path.

## Decision 8: Keep eligibility decisions on the server; the interface never pre-empts them

**Decision**: The details panel offers the archive action to any administrator viewing an available company, and the directory lets an administrator select any available company. Neither inspects the loaded truck collection to disable a control or predict a conflict. Refusals are surfaced from the API's own messages — in the dialog for a single archival, in the per-company blocked list for a bulk one.

**Rationale**: FR-006 and FR-035 require eligibility to be evaluated at submission time and FR-022 makes the API authoritative. The workspace does hold a truck collection, but it is a cached snapshot: gating on it would both falsely block (a truck archived elsewhere moments ago) and falsely enable (a truck created moments ago), and the user would still have to be told the real answer after submitting. This matters more for bulk than for single archival — pre-filtering a selection against stale data would silently drop companies the administrator deliberately chose, which is precisely the confusion the per-company blocked list exists to prevent.

**Alternatives considered**:

- Disable selection or the archive button when cached trucks show an available one: rejected per the above; a disabled control with a stale reason is worse than an accurate refusal.
- Pre-flight eligibility with a dedicated read endpoint before opening the dialog: rejected as a new contract that still cannot be current at submission time.
- Show an advisory hint (not a block) when cached trucks suggest a conflict: rejected for this slice as unrequested surface; it can be added if the refusal proves confusing in use.

## Decision 9: Follow the archived companies after a successful archival

**Decision**: On a successful single archival, show a confirmation toast, keep the details sheet open on the same company, and navigate the workspace to `companyStatus: 'archived'`, clearing `transportCompanyId` and `truckId` as every other tab change already does. On a successful bulk archival, show an aggregate toast, keep the administrator on the Available tab, replace the selection with the blocked companies, and leave the blocked list visible for retry.

**Rationale**: For a single archival, the left directory is filtered by lifecycle tab, so archiving from the Available tab makes the company vanish from the visible list; a confirmation toast over an apparently unchanged directory is exactly the confusion the delivered creation flow already avoids by switching to the tab that shows the new record. Following the company is the same reasoning applied to the opposite transition.

For a bulk archival the reasoning inverts. Jumping to the Archived tab would abandon the blocked companies, which are the only ones still needing attention and which are still on the Available tab. Staying put and narrowing the selection to exactly what failed is what makes FR-033 usable, and it is what the delivered customer bulk toolbar does.

**Alternatives considered**:

- Jump to the Archived tab after a bulk archival too: rejected as above — it hides the work that remains.
- Clear the selection entirely after a bulk archival: rejected because retrying the blocked companies would then require reselecting them, contradicting FR-033.
- Close the details sheet after a single archival: rejected because the archival context — when, by whom, and the comment — is the thing the administrator most wants to confirm, and it is readable in the panel they already have open.

## Decision 10: Leave the seeded fixtures untouched

**Decision**: Add no transport-company or truck fixture. Prove "archived trucks do not block archival" in automated tests, which build their own data through `TruckFactory.apply('archived')`.

**Rationale**: The delivered dataset already covers the cases a reviewer needs to see in a browser: *Grand Ouest Camions* is available with no truck (archives successfully), *Atlantique Transport Routier* and *Armor Fret Services* are available with one available truck each (refused), and *Loire Vrac Transport* is already archived. That is enough to demonstrate a mixed bulk selection producing both an archived company and two distinct blocker reasons. The remaining case — an available company whose only trucks are archived — has no fixture, and adding one would append to `TRUCK_FIXTURES`, which `discharge_preparation.ts` indexes positionally and other slices' seed assertions depend on. That is real risk taken on behalf of another issue's data.

**Alternatives considered**:

- Append an archived truck under *Grand Ouest Camions* so the third case is manually demonstrable: a defensible call, and the one to take if plan review wants the browser flow complete. Rejected by default because it changes shared seed data for a case the automated suite already proves, and because after #225 ships the case becomes manually reachable without any fixture change.

## Decision 11: Bulk archival is a partial success, not an atomic all-or-nothing request

**Decision**: `POST /transport-companies/archive` returns `200` whenever the request itself is well-formed and authorized, partitioning the outcome into `updatedCompanies` and `blockedCompanies`. It returns `200` with an empty `updatedCompanies` when every company is blocked. Only authentication, authorization, and payload validation produce a non-`2xx` status.

**Rationale**: This is the delivered customer bulk contract, and it is the right model for the behavior. A selection is an administrator's convenience, not a business transaction: failing forty valid archivals because a forty-first company gained a truck a second earlier would be hostile and would leave the administrator no way forward except bisecting their own selection. FR-026 states this directly. Atomicity is preserved where it actually matters — per company, inside one database transaction (FR-030) — so no company is ever half-archived.

Returning `200` for the all-blocked case is deliberate: nothing about the *request* was wrong, and the administrator needs the per-company reasons that only the success envelope carries. FR-032 makes the interface responsible for saying plainly that nothing changed.

**Alternatives considered**:

- `207 Multi-Status`: rejected as a status no other endpoint in this API uses and that no client here interprets; the partition in the body already carries the information.
- `409` when every company is blocked: rejected because it would force the blocker reasons into an error envelope that has no place for them, and because "all blocked" and "some blocked" would then need two different client code paths for the same information.
- All-or-nothing rollback on any blocker: rejected per the above.

## Decision 12: Compute the per-company blocking decision in one shared module

**Decision**: Add `apps/api/app/transport_companies/shared/transport_company_lifecycle_blockers.ts` exporting the blocker type, an id-indexing helper, an ordering helper, and `findBulkArchiveBlockers(ids, companiesById, companyIdsWithAvailableTrucks)`. The bulk repository write uses it to partition the requested ids; the reasons it produces are the same three the single use case maps to exceptions.

**Rationale**: This mirrors the delivered `customer_lifecycle_blockers.ts`, which exists for the same reason: the partition rule is pure logic over already-fetched state, so it should be unit-testable without a database and impossible to state twice. Keeping it beside the repository write that consumes it — rather than inside the use case — is what lets the decision happen inside the transaction, after the rows are locked.

The helper is scoped to archival (`findBulkArchiveBlockers`) rather than parameterised by an expected status the way the customer version is. Reactivation does not exist for transport companies yet, and inventing an `ALREADY_AVAILABLE` reason this slice can never produce would be dead code shipped on speculation. #221 can generalise it when it has a second caller.

**Alternatives considered**:

- Inline the partition inside `archiveAvailableMany`: rejected because it would only be reachable through a database transaction, making the mixed, all-blocked, and unknown-id cases awkward to unit-test.
- Put it in the use case and pass the partition down to the repository: rejected because the decision must be made after the rows are locked, which only the repository can do.
- Reuse `customer_lifecycle_blockers.ts` generically: rejected as premature cross-resource abstraction over two blocker vocabularies that only partly overlap.

## Decision 13: Express multi-selection as opt-in checkboxes on the existing directory list

**Decision**: `TransportCompanyList` accepts optional `selectedIds`, `onToggleSelection`, and `onToggleVisible` props and renders a leading checkbox per row only when they are provided. The workspace provides them only for administrators and only on the Available tab. Selection state lives in the workspace, alongside the blocked-companies state, and is cleared when the lifecycle tab changes. A row's checkbox joins the archive selection; a row's body still scopes the embedded trucks panel; neither clears the other.

**Rationale**: The transport-company directory is a compact list in a 19–22rem column, not the data table customers use, so the checkbox column has to be earned rather than assumed. Making it conditional on the handlers keeps consultation — the delivered #217 behavior, and everything an observer sees — byte-identical, which is what lets the existing consultation tests stand unchanged. Restricting it to the Available tab avoids inventing an answer to "what does bulk archive mean here?" on the Archived tab before #221 defines bulk reactivation. Keeping the two selections independent is FR-034: an administrator inspecting one company's trucks should not lose their archive selection, and vice versa.

**Alternatives considered**:

- A "selection mode" toggle that swaps the list into a multi-select variant: rejected as an extra mode to discover and exit for no gain over always-visible checkboxes, which the administrator can simply ignore.
- Reusing the single `transportCompanyId` selection as the archive selection: rejected because it is load-bearing for the trucks panel; overloading it would make scoping trucks and choosing what to archive the same gesture.
- Showing checkboxes on both tabs and refusing archived rows server-side: rejected because offering an action that is guaranteed to be blocked is a worse interface than not offering it, and the per-row `ALREADY_ARCHIVED` reason exists for genuine races, not for a selection the interface invited.
- Adding a "select all matching the current search" affordance: rejected as unrequested surface for this slice; the visible-rows toggle covers the realistic cleanup case.
