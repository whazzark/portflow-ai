# Research: Complete and Seed Operational Site References

## Storage lifecycle schema

**Decision**: Add one forward-only feature migration that adds the six nullable lifecycle columns
to both `warehouses` and `warehouse_doors`: archive/reactivation timestamps, comments and User actor
IDs. Actor FKs use `ON DELETE SET NULL`; existing status indexes and containment FKs remain intact.

**Rationale**: Customer, Dock, Weighing Area, Transport Company and Truck already use this schema.
`SET NULL` preserves the historical occurrence and comment when an actor disappears. A new
migration is safe for databases that already applied the delivered storage migrations. Lifecycle
coherence is enforced by the managed dataset contract and tests, matching the additive Customer
lifecycle precedent on both PostgreSQL and SQLite.

**Alternatives considered**: Editing historical create-table migrations was rejected because it
would not update existing databases. Actor indexes were rejected because no query uses them. A
cross-column lifecycle check was rejected for this additive migration because SQLite cannot add it
portably; moreover, requiring `reactivated_at > archived_at` globally would reject a legitimate
later archival that coexists with an older retained reactivation occurrence.

## Model and factory alignment

**Decision**: Type all six fields on Warehouse and WarehouseDoor with Luxon `DateTime | null` and
nullable string IDs/comments, add `archivedBy` and `reactivatedBy` relations to User, and align
their factory states with Transport Company/Truck: available has null context, archived records an
archive occurrence, and reactivated is available while retaining an earlier archive occurrence.
Complete missing reactivated factory states for the other seeded references where necessary.

**Rationale**: This makes reload behavior uniform without adding mutation use cases or changing
transport DTOs. Factories remain the supported seam for persistence tests.

**Alternatives considered**: A generic SiteReference base model or lifecycle service was rejected
as broader architecture work. Copying Customer/Dock reactivated factory behavior was rejected
because those states currently erase the prior archive occurrence required by this specification.

## Managed dataset identity and convergence

**Decision**: Keep declarative records in their resource seeders and match them by normalized
business key: Customer code, Truck registration, names for Dock/Weighing Area/Warehouse/Transport
Company, and Warehouse ID plus door name for Warehouse Door. On a match, merge the declared managed
fields into the same row; on absence, create it. Warehouse footprints are replaced by their exact
ordered declared point set. Fixed ISO occurrences and a demo actor resolved by exact email make
reruns deterministic.

**Rationale**: The current `continue` pattern prevents repair and time-relative occurrences drift
on every run. Business-key convergence preserves generated UUIDs while allowing an incomplete
managed environment to repair itself. Exact parent resolution protects permanent containment.

**Alternatives considered**: Blind insertion was rejected because it duplicates logical records.
Hard-coded UUIDs were rejected because stable identity is required across reruns, not across fresh
databases. `updateOrCreate` without a prior ambiguity check was rejected for Transport Company,
whose database currently has no case-insensitive unique name index.

## Parent and geographic integrity

**Decision**: A missing declared Truck company or Door warehouse fails initialization. Reruns may
restore the declared parent of managed children but never claim or modify unrelated children.
Warehouse footprints are declared before doors; every managed door point is tested as inside or on
its parent's polygon. All doors of an archived managed warehouse are archived.

**Rationale**: Silent omission produces a superficially successful but unusable foundation.
Parent-first ordering and explicit failure make relation defects observable and satisfy the domain
rules without weakening permanent `RESTRICT` FKs.

**Alternatives considered**: Skipping missing parents was rejected as partial initialization.
Database triggers for polygon containment and parent lifecycle were rejected because the project
does not use PostGIS and this feature only initializes a bounded dataset.

## Seeder execution and verification seam

**Decision**: Give each seeder a unique numeric prefix so users, parents and children run in a
deterministic order. Add a Japa database integration test that runs the complete chain twice,
captures identities/relations/lifecycle/geometry, introduces unrelated records and repairable
drift, then proves exact convergence and preservation. Keep a disposable PostgreSQL `db:fresh`
plus `db:seed` rerun in the validation guide.

**Rationale**: There are currently two `07` seeders and no seeder tests. SQLite provides a fast
repeatable automated seam; PostgreSQL validation covers the runtime dialect and generated schema.

**Alternatives considered**: Testing each seeder only in isolation was rejected because ordering
and parent resolution are system behaviors. Treating a second no-op execution as sufficient was
rejected because convergence must also repair managed drift.

## External interface compatibility

**Decision**: Do not change routes, controllers, policies, consultation use cases, repositories,
transformers, Tuyau types or web code. Preserve the existing GET behavior for all seven reference
kinds and document only an internal managed-initialization contract.

**Rationale**: All seven references already have a delivered read path. Warehouse exposes its full
collection (with nested doors), while Warehouse Door exposes its available-only selector. The new
lifecycle storage context is intentionally not added to their current DTOs in issue #235.

**Alternatives considered**: New read endpoints or expanded storage DTOs were rejected because
they are separate independently deliverable consultation contracts. Skipping a contract artifact
entirely was rejected because the seeder command has durable preconditions and convergence
postconditions that need an implementation target.
