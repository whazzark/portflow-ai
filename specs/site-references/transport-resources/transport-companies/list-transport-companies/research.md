# Research: List Transport Companies

## Decision 1: Reuse the site-reference consultation vertical slice

**Decision**: Implement dedicated `transport_companies` list and available workflows behind an abstract repository, a Lucid repository, a policy, a transformer, and a thin controller. Implement the UI as a thin authenticated route plus a `features/transport-companies` module.

**Rationale**: Customers are the closest delivered lifecycle reference: the API returns a complete authoritative collection for consultation and an available-only collection for operational selection, while the UI owns lifecycle tabs, counts, search, sorting, and in-context details. This also satisfies the repository's vertical-slice and boundary ADRs.

**Alternatives considered**:

- Reuse customer domain code directly: rejected because transport companies are an independent domain resource whose later lifecycle rules and truck relationships will evolve separately.
- Query Lucid directly from the controller: rejected because it bypasses the required use-case/repository boundary.
- Build a generic site-reference framework first: rejected as cross-domain scope without a demonstrated need.

## Decision 2: Persist the lifecycle reference now, without tenant keys

**Decision**: Add a `transport_companies` table and Lucid model with UUID identity, current name, authoritative `AVAILABLE`/`ARCHIVED` status, latest archive/reactivation context, timestamps, nullable actor relationships, and a status index. Do not add `site_id` or `organization_id`, and do not introduce an unstated duplicate-name rule in this read-only slice.

**Rationale**: Consultation needs real persisted records and lifecycle context. Existing site-reference tables establish the lifecycle shape, portable UUIDs, and nullable actor foreign keys. The feature contract distinguishes stable UUID identity from current name but does not state that names are unique, so issue #218 must own any write-time duplicate policy. Repository ADR 0003 defines the MVP dataset as one operating organization with exactly one implicit site, so adding tenant scope only here would be misleading and unusable.

**Alternatives considered**:

- Add a site or organization table and foreign keys: rejected because it is a cross-cutting multi-tenancy change contrary to the current architecture and far beyond issue #217.
- Store lifecycle events in a separate history table: rejected because this feature requires only the current archive context and latest reactivation context, matching existing site references.
- Keep fixtures only and defer persistence to create-company work: rejected because the list behavior must be independently deliverable against authoritative business state.
- Enforce case-insensitive name uniqueness now: deferred because duplicate-name behavior is not part of the approved consultation contract and belongs to the create-company slice.

## Decision 3: Expose complete and available-only read contracts

**Decision**: Add `GET /api/v1/transport-companies` for both lifecycle states and `GET /api/v1/transport-companies/available` for selector-safe records. Both return deterministic name-ascending collections with UUID as the tie-breaker. The consultation DTO includes lifecycle actor summaries so the UI can open details from the same authoritative list payload.

**Rationale**: One complete payload gives both tab counts and both lifecycle views from one snapshot, while the dedicated available endpoint enforces the invariant that archived companies cannot be offered for new work. Opening details from the list matches the closest customer precedent and avoids an otherwise redundant show workflow.

**Alternatives considered**:

- Separate available and archived consultation endpoints: rejected because counts and tab switching could reflect different snapshots and would require multiple requests.
- Add server-side status/search/sort parameters: rejected because the current low-cardinality reference pattern loads the full collection and the UI must search/sort only the selected tab.
- Add `GET /transport-companies/:id`: rejected for this slice because every inspectable field is already present in the complete consultation payload; a show contract can be added later if a distinct use case needs it.
- Derive operational selections from the all-status response: rejected because downstream consumers could accidentally expose archived records.

## Decision 4: Authorize reads for every active role at the API boundary

**Decision**: Keep both routes inside the existing authentication middleware and authorize `list` and `listAvailable` when `user.accessStatus === 'ACTIVE'`, independent of role.

**Rationale**: The middleware re-reads the user and rejects unauthenticated or non-active sessions before data is returned. A resource policy makes the active-user consultation rule explicit and keeps the API authoritative. All four active roles—including observers—need read access, while no UI mutation control exists in this slice.

**Alternatives considered**:

- Gate the route or sidebar to administrators: rejected because administration permission is not required for consultation.
- Rely only on the web authenticated layout: rejected because it cannot protect direct API requests.

## Decision 5: Keep lifecycle state, search, and selection in the URL

**Decision**: Use URL state for `companyStatus`, normalized `companySearch`, and optional `transportCompanyId`. Default to available and no selected company so the aggregate overview is visible. Both lifecycle lists use automatic ascending name order with UUID tie-breaking; no visible list header or manual ordering control is shown. Counts remain unfiltered totals; search filters only the selected lifecycle and only by current name. Keep `/transport-companies` as a compatibility redirect to the canonical `/transport-resources` route.

**Rationale**: URL-backed state is reloadable, shareable, testable through the real router, and already established by customer consultation. Automatic deterministic ordering keeps the compact selector predictable without a redundant column header or ordering action. The shared search helper trims, case-folds, and removes diacritics while preserving stored display casing.

**Alternatives considered**:

- Local-only component state: rejected because navigation and refresh would lose the consultation context.
- Search identity or lifecycle comments too: rejected because FR-007 limits the behavior to current company name.
- Treat any non-empty raw string as a search: rejected because whitespace-only input must behave as no search.

## Decision 6: Use an accessible read-only master-detail directory

**Decision**: Show the stable UUID and current name in a lifecycle-filtered company selector, with the active tab providing the non-redundant status context; show an aggregate overview whenever no company is selected; provide keyboard-native toggle selection; and show current-state lifecycle details in a persistent adjacent panel without navigation away from the collection. Clicking the selected company again clears the selection. Missing optional values render as unavailable, not as fabricated actors or comments.

**Rationale**: This makes every required list field visible, preserves consultation context, supports both keyboard and pointer users, and establishes the master-detail shell that issue #222 can extend with trucks without adding truck behavior to this slice. URL-controlled selection remains reloadable and fails safely when a refreshed collection no longer contains the selected identity.

**Alternatives considered**:

- A separate details page: rejected because FR-009 requires inspection without leaving the consultation context.
- Administrator selection checkboxes or lifecycle actions: rejected because the slice is read-only.

## Decision 7: Test through real persistence and real frontend boundaries

**Decision**: Drive API behavior with Japa tests using the real Lucid repository against in-memory SQLite, and drive web behavior through the real TanStack router/providers with MSW intercepting HTTP. Add no Playwright infrastructure in this issue because none is currently configured.

**Rationale**: ADR 0014 supersedes repository fakes for API behavior, and the web testing ADR defines router-level feature tests as the primary TDD seam. MSW preserves Tuyau request behavior and permits deterministic loading, failure, retry, and stale-response scenarios.

**Alternatives considered**:

- Mock repository objects in all API unit tests: rejected because they would not prove ordering, filtering, constraints, or actor preloads.
- Mock the Tuyau client or `fetch`: rejected by web testing conventions because it bypasses the real transport adapter.
- Add an E2E framework as part of the slice: rejected as unrelated tooling expansion; the quickstart still includes a manual affected browser flow.
