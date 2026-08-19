# Research: Persist and Seed Discharge Preparation and Resource Reservations

## 1. Persistence topology and application boundary

**Decision**: Add the Discharge preparation persistence slice inside the existing AdonisJS
application, using UUID Lucid models, migrations, factories, development/test seeders, and
integration tests. Do not add a controller, mutation route, or frontend surface in this issue.

**Rationale**: Issue #236 explicitly establishes durable business state for later consultation and
workflow slices. Existing site-reference models and seeders already define the repository's
conventions, and keeping this slice in the API preserves the API as the authority for state and
authorization.

**Alternatives considered**:

- Add a separate preparation service: rejected because it would duplicate persistence boundaries
  and complicate the single Adonis deployment.
- Add creation endpoints or a preparation UI now: rejected because the source issue explicitly
  excludes new mutation endpoints and interfaces.
- Persist only seed fixtures without domain models: rejected because later Discharge, Shift,
  Rotation, and resource-usage slices need durable relationships and constraints.

## 2. Relational model and historical boundaries

**Decision**: Use normalized tables for Discharges, Product Lots, Discharge Truck Assignments,
Shifts, Warehouse Door-to-Product-Lot assignments, and one explicit membership table per Shift
resource kind (Trucks, Warehouse Doors, and Weighing Areas). Keep vessel description fields on the
Discharge. Keep the Dock on the Discharge, not on the Shift.

**Rationale**: Separate foreign-keyed membership tables preserve referential integrity and make
  future queries safe without a polymorphic resource column. Discharge-level truck assignments
  capture registration and Transport Company values at reservation time, while current site
  references remain available for navigation and authorization. Product Lot identity follows the
  domain rule of one Customer and product name within a Discharge.

**Alternatives considered**:

- One polymorphic `shift_resources` table: rejected because it weakens database foreign keys and
  makes invalid resource kinds easier to persist.
- Resolve historical truck/provider values from current references: rejected because later edits
  would rewrite the meaning of a past reservation.
- Attach the Dock to every Shift: rejected because the domain states that the Dock belongs to the
  Discharge.

## 3. Constraint portability

**Decision**: Use constraints portable across PostgreSQL and the in-memory SQLite test database:
  foreign keys, required columns, check constraints for scalar validity, and unique business keys.
  Validate cross-row overlap and reservation conflicts in the persistence/application boundary
  within a transaction, with regression tests on the supported database configurations.

**Rationale**: PostgreSQL is the production database, while integration tests enable SQLite foreign
  keys. PostgreSQL-only exclusion constraints or partial indexes would make the test and production
  contracts diverge. Scalar checks can enforce positive quantities and ordered time ranges; overlap
  and active-reservation checks require comparing multiple rows and must be protected by an atomic
  operation until a future workflow introduces broader concurrency controls.

**Alternatives considered**:

- PostgreSQL exclusion constraints for all planned periods: rejected for this cross-database slice
  because SQLite has no equivalent behavior.
- No persistence validation: rejected because invalid preparation graphs would be accepted and
  later workflows would need to repair them.
- Database triggers: rejected because they are harder to test portably and would hide business rules
  outside the existing use-case/repository seams.

## 4. Stable identities and managed initialization

**Decision**: Give each managed Discharge scenario a stable business key (scenario code), then use
  natural keys for Product Lots, Shift positions, assignments, and memberships. Implement one
  deterministic feature seeder after the existing site-reference seeders. Resolve all dependencies
  explicitly, upsert managed records by stable keys, and never delete or claim unrelated records.

**Rationale**: Random UUIDs cannot support idempotent repeated initialization. Existing seeders use
  fixed values, case-insensitive business-key lookup, merge/save repair, and explicit failures for
  missing or ambiguous parents. A scenario-level transaction prevents a failed graph from leaving
  silently accepted relationships while allowing already accepted scenarios to remain available on
  a later rerun.

**Alternatives considered**:

- Truncate and reseed all preparation data: rejected because managed initialization must preserve
  unrelated records and historical identities.
- Use generated UUIDs as seed identity: rejected because reruns could not converge.
- One transaction for every managed scenario together: rejected because a failure in one scenario
  would unnecessarily roll back already valid independent scenarios.

## 5. Canonical seeded graphs

**Decision**: Seed three explicit graphs in a fixed order: Planned, Active, and Closed. Planned and
Active use disjoint resources wherever the domain prohibits simultaneous reservation. Closed keeps
its historical assignments but releases current reservations so it cannot block new Planned or
Active usage.

**Rationale**: The three lifecycle states are the minimum acceptance surface and exercise both
  reserved and released resource behavior. Explicit fixed graphs make tests and demonstrations
  reproducible and expose the historical snapshot rules before mutation workflows exist.

**Alternatives considered**:

- Seed only Planned data: rejected because Active/Closed lifecycle and release behavior would remain
  untested.
- Share all resources between graphs: rejected because it would create artificial reservation
  conflicts and obscure scenario intent.
- Generate random graph data: rejected because it makes repeatability and drift detection unreliable.

## 6. Site-reference usage integration

**Decision**: Replace the transitional no-op site-reference usage checker with a persistence-backed
  query over Discharge preparation records. Planned and Active Discharge references block archival;
  Closed-only historical references remain readable but do not block new use.

**Rationale**: Existing archive use cases currently depend on a no-op adapter explicitly marked as a
  transition until Discharge usage becomes durable. Leaving it in place after #236 would make the
  newly persisted reservations invisible to established lifecycle protection.

**Alternatives considered**:

- Keep the no-op checker until a later workflow issue: rejected because it would allow archiving
  resources that the new persisted Planned/Active graphs depend on.
- Teach each site-reference use case to query Discharge tables directly: rejected because it would
  duplicate cross-domain usage logic and violate the existing checker boundary.

## 7. Verification strategy

**Decision**: Add migration/model persistence tests, focused factory tests, and integration tests for
  initial seeding, idempotent reruns, historical snapshots, missing/ambiguous parents, reservation
  conflicts, and partial scenario failure. Run the full fast API suite plus repository checks.

**Rationale**: The feature is primarily persistence and data integrity. Integration tests prove the
  public seed and relationship behavior, while unit tests keep focused factories and invariant
  validation fast. Existing seeder tests provide the closest project precedent.

**Alternatives considered**:

- Seed smoke test only: rejected because it would not detect snapshot drift, duplicate identities,
  or invalid cross-resource relationships.
- Browser tests: deferred because this issue adds no UI or browser behavior.
