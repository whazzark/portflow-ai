# Data Model: Operational Site-Reference Foundation

## Shared lifecycle context

Every Site Reference has a permanent UUID, current `AVAILABLE | ARCHIVED` status and timestamps.
The managed dataset exercises three states per concrete kind:

| Scenario | Current status | Archive context | Reactivation context |
|---|---|---|---|
| Available | `AVAILABLE` | null | null |
| Archived | `ARCHIVED` | occurrence, comment, optional User actor | null or retained prior history |
| Previously reactivated | `AVAILABLE` | earlier occurrence and comment | later occurrence, comment and optional User actor |

For every archived row, `archivedAt` is non-null. For every managed reactivated row,
`archivedAt < reactivatedAt`, and both comments and resolvable actor references are populated.
Deleting an actor sets only its FK to null; status, occurrences and comments remain usable.

## Warehouse

Existing fields remain `id`, `name`, `status`, `createdAt`, and `updatedAt`. The feature adds:

- `archivedAt: DateTime | null`
- `archivedByUserId: UUID | null` → User, `ON DELETE SET NULL`
- `archiveComment: string | null`
- `reactivatedAt: DateTime | null`
- `reactivatedByUserId: UUID | null` → User, `ON DELETE SET NULL`
- `reactivationComment: string | null`

Relationships remain one ordered Warehouse Footprint and zero-to-many permanent Warehouse Doors.
Names are case-insensitively unique across lifecycle states. An archived Warehouse has no Door
eligible for new use.

## Warehouse Door

Existing fields remain `id`, permanent `warehouseId`, `name`, `latitude`, `longitude`, `status`,
`createdAt`, and `updatedAt`. It gains the same six lifecycle fields and actor relations as
Warehouse. The `(warehouseId, lower(name))` business key remains unique and `warehouseId` retains
its `ON DELETE RESTRICT` relationship. Coordinates stay in valid ranges and the managed point lies
within or on the parent's footprint.

## Warehouse Footprint Point

The composite identity remains `(warehouseId, position)`. Each point has valid latitude/longitude;
positions are contiguous from zero and their ordered set forms the Warehouse polygon. A rerun
replaces only points belonging to a managed Warehouse with the exact declared set, preventing
accumulation while retaining the Warehouse UUID.

## Existing reference entities

- **Customer**: keyed by normalized code; required company name and shared lifecycle context.
- **Dock**: keyed by normalized name; required valid geographic point and shared lifecycle context.
- **Weighing Area**: keyed by normalized name; required valid geographic point and shared lifecycle context.
- **Transport Company**: keyed by normalized managed name; shared lifecycle context; provides Trucks.
- **Truck**: keyed by normalized registration; required positive capacity, optional model, permanent
  UUID and exactly one current Transport Company FK with `ON DELETE RESTRICT`.
- **User/Lifecycle Actor**: resolved for managed history by exact normalized demo email. Actor
  deletion does not delete or rewrite lifecycle facts.

No schema change is required for these five reference tables; their seeded fields are converged to
the initialization contract.

## Managed dataset ownership and transitions

The contract's normalized business keys define membership. Initialization can perform only these
transitions on a matching managed row: create if absent, repair declared scalar/lifecycle fields,
restore its declared parent relation, and replace its declared Warehouse footprint. It preserves
the row UUID. Rows whose keys are not declared are neither deleted nor repurposed.

Initialization is not a user-facing archive/reactivate workflow. The lifecycle values represent
fixed historical scenarios and do not create event rows. A current `ARCHIVED` managed resource
must have archive context; a previously reactivated one transitions conceptually from archived to
available and retains both occurrences.
