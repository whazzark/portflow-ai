# Research: Enforce Persisted Site-Reference Usage Rules

## Decision 1: Extend the Existing Usage Checker and Discharge Repository Seam

**Decision**: Keep `SiteReferenceUsageChecker` as the application-facing abstraction,
`PersistedSiteReferenceUsageChecker` as its production adapter, and `DischargeUsageRepository` as
the owner of persisted Discharge relationship queries. Extend the supported reference kinds with
`TRUCK`. Remove the now-unreferenced `NoDischargeSiteReferenceUsageChecker` after the production
binding and tests prove the persisted path.

**Rationale**: Issue #236 already established the intended dependency direction and the production
provider already resolves the persisted implementation. This respects the existing vertical slices
and ADR 0013: archive use cases make the business conflict decision, while the Discharge repository
owns persistence mechanics.

**Alternatives considered**:

- Query Discharge tables directly from each archive use case: rejected because it duplicates
  cross-domain persistence knowledge and breaks the repository boundary.
- Introduce a new generic availability service: rejected because the existing typed seam already
  expresses the required behavior.
- Keep the no-op fallback for possible future deployments: rejected because persisted Discharges
  are now a required production dependency and silently returning unused is unsafe.

## Decision 2: Define Current Usage from the Owning Persisted Relationship

**Decision**: Every result also requires `discharges.status` to be `PLANNED` or `ACTIVE`. Within
that boundary, resolve each reference kind as follows:

| Reference kind | Owning relationship | Current predicate |
| --- | --- | --- |
| Customer | Product Lot | `product_lots.customer_id` matches; Closed is the only release boundary |
| Dock | Discharge current Dock | `discharges.dock_id` matches; Closed is the only release boundary |
| Weighing Area | Shift Weighing Area membership | `shift_weighing_areas.effective_to` is absent |
| Warehouse Door | Warehouse Door-to-Product-Lot assignment | `warehouse_door_product_lot_assignments.effective_to` is absent |
| Truck | Discharge Truck reservation | `discharge_truck_assignments.released_at` is absent |

Do not filter Weighing Area usage by Shift status or current clock time. Do not infer Warehouse Door
usage from Shift membership, and do not infer Truck usage from Shift membership.

**Rationale**: Planned resource memberships are reservations before execution. Warehouse Door
product assignment and Discharge Truck reservation are the domain-owning relationships defined by
`CONTEXT.md` and issue #236. End/release fields preserve history while distinguishing current usage.

**Alternatives considered**:

- Treat every historical relationship of a Planned or Active Discharge as current: rejected because
  explicit releases must stop blocking references.
- Use `shift_warehouse_doors` and `shift_trucks`: rejected because those tables describe per-Shift
  membership, not the authoritative Door-to-lot assignment or Discharge-level Truck reservation.
- Filter only Active Shifts: rejected because Planned Shifts reserve resources before execution and
  a Discharge remains Active between Shifts.

## Decision 3: Use Exhaustive, Set-Based, Stable Bulk Assessment

**Decision**: Deduplicate requested identifiers once, return immediately for empty input, dispatch
through an exhaustive `switch`, run exactly one `SELECT DISTINCT` for a non-empty request, and sort
the selected identifiers lexically before constructing the returned `Set`. Preserve the optional
query client supplied by transactional callers.

**Rationale**: One query prevents N+1 behavior. Distinct rows and a stable Set eliminate duplicate,
join-cardinality, and input-order effects. Exhaustive dispatch makes a newly added reference kind a
compile-time obligation instead of silently treating it as a Warehouse Door. The optional client is
required by atomic Customer bulk archival.

**Alternatives considered**:

- Loop over identifiers: rejected because query count would grow linearly and violate FR-012.
- Return raw query rows or an array: rejected because the established Set contract efficiently
  supports membership decisions and naturally represents uniqueness.
- Keep the final catch-all Warehouse Door branch: rejected because unsupported kinds would produce
  plausible but incorrect results.

## Decision 4: Add Two Query-Oriented Indexes Without Changing Business Data

**Decision**: Add a portable additive migration for `discharges(dock_id, status)` and
`product_lots(customer_id, discharge_id)`. Retain all existing indexes, including the current-first
resource/release indexes for Weighing Areas, Warehouse Doors, and Trucks.

**Rationale**: Dock lookup currently has no tailored index, and the existing Product Lot composite
starts with Discharge rather than the requested Customer. The two new access paths align the
1,000-identifier usage queries with their filter columns while remaining portable across PostgreSQL
and SQLite. No table or model field changes are needed.

**Alternatives considered**:

- Rely on table scans and current indexes: rejected because performance would become
  dataset-dependent despite the explicit bulk criterion.
- Add a materialized usage table: rejected because it would duplicate authoritative state and
  require synchronization on every Discharge change.
- Add indexes for every joined table: rejected because the other resource tables already lead with
  the requested reference and release columns.

## Decision 5: Test the Real Lucid Path Before the HTTP Compatibility Layer

**Decision**: Follow RED → GREEN → REFACTOR with a focused SQLite-backed persisted-usage suite,
then a query-count/scale suite, then persisted arrangements in the existing Customer, Dock, and
Weighing Area archive integration tests. Keep isolated use-case tests that use simple checker test
doubles, but do not use those doubles as evidence for issue #240.

**Rationale**: ADR 0014 requires repository behavior to be exercised against real SQL rather than
fake persistence. The focused suite proves the five-type matrix and release predicates directly;
HTTP tests prove the established external behavior through production bindings. Existing Adonis
database-query events provide a repository-native way to assert one SELECT and the two-second scale
criterion.

**Alternatives considered**:

- Test only the repository: rejected because the issue explicitly requires existing archive
  conflict outcomes against real database state.
- Test only HTTP flows: rejected because Truck and Warehouse Door have no mutation endpoints and
  the complete usage matrix is easier to diagnose at the checker boundary.
- Replace all test doubles in unrelated unit tests: rejected because narrow use-case tests still
  benefit from explicit collaborator outcomes.

## Decision 6: Preserve Existing External Contracts; Add No New Interface

**Decision**: Keep the three single-archive routes and Customer bulk-archive route unchanged.
Single in-use archives continue returning their existing `409` error codes; Customer bulk archive
continues returning `200` with an `IN_USE` blocker in request order. Document the internal usage
contract and these compatibility promises, but add no OpenAPI operation or frontend consumer.

**Rationale**: The feature changes the source of a decision, not the user interaction. Truck and
Warehouse Door readiness is intentionally internal until later lifecycle issues deliver their own
workflows.

**Alternatives considered**:

- Expose a site-reference usage endpoint: rejected as new product surface outside issue #240.
- Replace resource-specific conflicts with one generic code: rejected because existing consumers
  depend on established resource-specific outcomes.
- Add Truck or Warehouse Door archive routes now: rejected because those are independently
  deliverable future features.
