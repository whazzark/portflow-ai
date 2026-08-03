# Research: List Trucks

## Decision 1: Follow the existing site-reference consultation slice

**Decision**: Implement dedicated Truck complete-list and available-list use cases behind one abstract repository, Lucid repository, policy, transformer, and thin controller, following the existing Docks and Weighing Areas slices. Add the web behavior as a `features/trucks` module composed by the existing Transport resources route.

**Rationale**: Transport companies and customers establish the required lifecycle-list boundaries, while the transport-company screen was deliberately shaped as the master-detail shell that the truck slice can extend. Dedicated slices keep future truck assignment and lifecycle rules independent without inventing a generic site-reference framework.

**Alternatives considered**:

- Reuse transport-company or customer domain code directly: rejected because Truck has distinct capacity, registration, provider, and future assignment invariants.
- Query Lucid in the controller: rejected because it bypasses the constitution's use-case/repository boundary.
- Build a generic site-reference framework first: rejected as premature cross-domain scope.

## Decision 2: Persist trucks as single-site lifecycle references

**Decision**: Add a `trucks` table and Lucid model with application-assigned UUID identity, current registration, optional vehicle model, exact capacity in tonnes, required current transport-company relationship, authoritative `AVAILABLE | ARCHIVED` status, latest archive/reactivation context, and timestamps. Add no site or organization key.

**Rationale**: Consultation must read authoritative business state, and issue #222 is independently deliverable before create/update work. ADR 0003 defines one implicit operating organization and site, while API ADR 0014 requires schema behavior that works in PostgreSQL and in-memory SQLite tests.

**Alternatives considered**:

- Keep only frontend fixtures until issue #223: rejected because the list would not be a complete product behavior.
- Add `site_id` or `organization_id`: rejected as an inconsistent partial multi-tenancy change.
- Store lifecycle events in a separate history table: rejected because this contract needs only the current archive and latest reactivation context, matching adjacent references.

## Decision 3: Enforce durable identity and exact capacity at persistence

**Decision**: Preserve registration display casing in a string column, enforce case-insensitive uniqueness across available and archived trucks with a unique `LOWER(registration)` index, and sort by case-folded registration, display registration, then UUID. Store capacity as `decimal(12,3)`, require it to be positive, and explicitly serialize it as a JSON number.

**Rationale**: `CONTEXT.md` defines registration as the mandatory site-wide business identifier and capacity as an authorized payload in tonnes. A functional unique index prevents case variants from representing two trucks. Exact decimal storage avoids floating-point drift in future capacity comparisons, while transformer conversion keeps the Tuyau response stable across PostgreSQL and SQLite numeric behavior. A 255-character storage ceiling follows existing reference strings without inventing country-specific plate validation that belongs to issue #223.

**Alternatives considered**:

- Case-sensitive uniqueness: rejected because it would allow registrations differing only by case.
- A normalized duplicate registration column: rejected because the database can enforce the required case-folded identity directly.
- Floating-point capacity: rejected because later compliance comparisons require exact values.
- A shorter country-specific registration limit or capacity maximum: deferred to the create/update contracts because the current spec does not define them.

## Decision 4: Resolve the current provider relationship in the authoritative list

**Decision**: Each truck belongs to one transport company through a required foreign key. The list query preloads both optional lifecycle actors; the DTO exposes the required `transportCompanyId` and resolves company name/status from the transport-company collection rather than duplicating company data in every truck row.

**Rationale**: Refresh and retry must show the authoritative current provider and allow a truck's lifecycle state to be understood independently from its company's lifecycle state. Relational data avoids stale duplicated names, and preloading prevents an N+1 query at the 1,000-truck acceptance scale.

**Alternatives considered**:

- Copy company name/status into the truck table: rejected because later company changes would make consultation stale.
- Return only `transportCompanyId`: rejected because the feature must display the current company without a second frontend request.
- Add a database trigger for cross-resource lifecycle rules: rejected because company archival, truck reactivation, and provider changes require workflow-level locking and typed outcomes in their future use cases.

## Decision 5: Expose separate complete and available HTTP collections

**Decision**: Follow Docks and Weighing Areas by adding `GET /api/v1/trucks` (`trucks.index`) for the complete available-and-archived collection and `GET /api/v1/trucks/available` (`trucks.available`) for the available-only collection. Both return the same deterministic Truck DTO without parameters or an item-detail route. Administrators use the complete response for both lifecycle views; other active roles use the available response for their single permitted view.

**Rationale**: This reuses the repository's established site-reference contract shape and makes authorization explicit at the route/policy boundary. Non-administrators never call or receive the complete collection, and the available query enforces `AVAILABLE` before serialization. Each role still receives one coherent snapshot from which its visible count, search, and details are derived.

**Alternatives considered**:

- One role-filtered `trucks.index` endpoint: rejected because Trucks must match the existing Docks and Weighing Areas complete/available structure.
- Server-side search, status filtering, or pagination: rejected because the approved scale does not justify the additional request/URL contract, and client search must remain immediate.
- Add `GET /trucks/:id`: rejected because the complete DTO already supports in-context details.
- Treat `/trucks/available` as an operational assignment selector: rejected because this issue exposes lifecycle-filtered consultation data but does not define assignment eligibility or a selection control.

## Decision 6: Enforce lifecycle visibility by role at both boundaries

**Decision**: Keep both endpoints in the authenticated API group. Authorize `trucks.index` only for active organization administrators and operations administrators, and authorize `trucks.available` for every active role, exactly like Docks and Weighing Areas. In the web application, request `trucks.index` for administrators and `trucks.available` for other active roles, show Archived controls/counts only to administrators, and normalize a crafted non-admin archived URL to Available.

**Rationale**: This directly implements the corrected access model while keeping the API authoritative and the vertical slices consistent. Non-administrators can use the available-truck directory without receiving archived records, counts, or lifecycle context; the UI chooses an authorized contract but does not create the protection.

**Alternatives considered**:

- Return the complete collection to every active role and hide archived rows in the browser: rejected because archived data would already be disclosed.
- Permit every active role to call `trucks.index` and filter its response dynamically: rejected in favor of the established split policy surface.
- Restrict both truck endpoints to administrators: rejected because every active role must consult available trucks through `trucks.available`.
- Accept a client `includeArchived` or status parameter: rejected because callers must not be able to elevate lifecycle visibility.

## Decision 7: Extend `/transport-resources` with URL-backed resource state

**Decision**: Keep `/transport-resources` as the sole canonical screen. Add `resource=companies|trucks` (default `companies`) plus `truckStatus=available|archived`, `truckSearch`, and optional `truckId`, while retaining the existing company parameters. Compose concrete company and truck workspaces under accessible resource tabs for every active role. Truck rows show registration and company name; selection opens an adjacent read-only detail panel and toggles closed when selected again. Non-administrators receive only the Available lifecycle control and any restored archived state is replaced with Available.

**Rationale**: The default preserves current links and all-role company behavior. URL state restores the resource, lifecycle, search, and exact selection through reload/history. The established two-card layout supports keyboard and pointer interaction, desktop containment, and narrow-screen stacking without a separate route or details page.

**Alternatives considered**:

- Add a standalone `/trucks` screen: rejected because the established product category and shell are Transport resources.
- Show company and truck directories simultaneously: rejected because it clutters the screen, complicates mobile use, and conflicts with different access rules.
- Store tabs/search/selection only in component state: rejected because refresh and navigation would lose consultation context.
- Extract a generic directory system: rejected because two concrete resource workspaces do not yet justify that abstraction.

## Decision 8: Search and present one role-appropriate client snapshot

**Decision**: For administrators, split the complete response by status and calculate both unfiltered counts client-side. For other active roles, treat the available response as the sole lifecycle collection and calculate only its count. Filter the selected permitted lifecycle using trimmed, case- and diacritic-insensitive matching across registration or current company name; order results by registration with UUID tie-breaking; render only the active list. A valid selection remains open during search, while lifecycle changes clear it and refresh removes stale identities without substitution.

**Rationale**: This meets the specified search and stale-state behavior without per-keystroke requests. Each user loads only one role-authorized snapshot, and rendering one active lifecycle list with memoized derivation is sufficient for 1,000 records. Showing the provider name/status in both rows/details makes archived-truck and archived-company states independently understandable.

**Alternatives considered**:

- Search vehicle model, UUID, or lifecycle comments: rejected because the approved search contract is registration and company name.
- Clear details whenever search has no match: rejected because search does not invalidate the selected truck's authoritative identity.
- Add virtualization or TanStack Table: rejected as unnecessary complexity at the approved scale.

## Decision 9: Test real boundaries with existing tooling

**Decision**: Drive both API list contracts with Japa using the real Lucid repository against in-memory SQLite, including persistence constraints, complete/available filtering, authorization, and bounded relational loading. Drive web behavior through the real TanStack router/providers with MSW intercepting HTTP. Use the manual affected-browser flow because no Playwright suite/script is currently configured.

**Rationale**: API ADR 0014 rejects repository fakes for behavior that depends on queries and constraints. The web testing ADR makes router-level Vitest/jsdom feature tests the primary TDD seam and requires MSW instead of mocking Tuyau or `fetch`.

**Alternatives considered**:

- Fake repository tests: rejected because they do not prove ordering, foreign keys, constraints, or relation preloads.
- Mock the Tuyau client: rejected because it bypasses the real transport adapter and error behavior.
- Add Playwright infrastructure in this issue: rejected as unrelated tooling expansion.
