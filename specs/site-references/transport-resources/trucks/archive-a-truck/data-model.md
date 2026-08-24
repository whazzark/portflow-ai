# Data Model: Archive a Truck

This slice writes to the `trucks` table already defined by List Trucks (`#222`, migration
`1784900000000_create_trucks_table.ts`) and its `Truck` model (`apps/api/app/models/truck.ts`).
**No schema change is introduced** — every column this feature writes already exists and is already
read by the truck consultation contract. See
`specs/site-references/transport-resources/trucks/list-trucks/data-model.md` for the full column
reference; this document covers only the fields, rules, and transitions exercised by archival.

## Truck (lifecycle write path)

| Field | Written by this slice | Rules |
|---|---|---|
| `id` | No | Addressed as the URL resource; never modified |
| `registration` | No | Preserved unchanged by archival (FR-011) |
| `vehicleModel` | No | Preserved unchanged by archival (FR-011) |
| `capacityTonnes` | No | Preserved unchanged by archival (FR-011) |
| `transportCompanyId` | No | Preserved unchanged; the company's own lifecycle state neither blocks nor is affected by the truck's archival |
| `status` | Yes | `AVAILABLE` → `ARCHIVED`; the update is guarded by `WHERE status = 'AVAILABLE'` so the transition is atomic |
| `archivedAt` | Yes | Server time (`DateTime.now()` in the controller), never client-supplied |
| `archivedByUserId` | Yes | The authenticated caller's id, taken from the session, never client-supplied |
| `archiveComment` | Yes | Trimmed; `null` when absent, empty, or whitespace-only; max 1000 characters |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | No | Preserved unchanged — archiving never erases earlier reactivation history (FR-011) |
| `updatedAt` | Yes | Set to the same instant as `archivedAt` |

### State transitions

```text
AVAILABLE ──archive (this slice, #225)──▶ ARCHIVED
ARCHIVED  ──archive again───────────────▶ refused: ALREADY_ARCHIVED (no write)
ARCHIVED  ──reactivate (#226, not here)─▶ AVAILABLE
```

`AVAILABLE` and `ARCHIVED` remain the only truck lifecycle states (`TRUCK_STATUSES` in
`apps/api/app/models/truck.ts`). This slice implements exactly one edge of that graph.

### Eligibility and validation order

1. **Authorization**: the requesting user must be an active `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN` (`TruckPolicy.archive`, a new method applying the same role check as the existing `list` and `create`). Bouncer denies with `403`.
2. **Payload shape**: `archiveTruckValidator` — a single optional, nullable, trimmed `comment` of at most 1000 characters.
3. **Existence**: the truck must exist (`TruckNotFoundException`, `404`).
4. **Current state**: the truck must not already be `ARCHIVED` (`TruckAlreadyArchivedException`, `409`).
5. **Current usage**: the truck must not be reserved by a planned or active discharge (`TruckInUseException`, `409`), assessed at submission time via the shared checker.
6. **Atomic transition**: the status-guarded `UPDATE` may still find the row already archived by a concurrent request; a zero-row result is re-mapped to `NOT_FOUND` or `ALREADY_ARCHIVED`.

Steps 3–5 perform no write, so any refusal leaves the row unchanged (FR-017).

### In-use rule (consumed, not defined here)

Truck usage is **not** defined by this slice. It is resolved by the existing shared
`SiteReferenceUsageChecker` abstraction, whose `LucidDischargeUsageRepository` implementation
already handles `referenceType: 'TRUCK'`:

- **In use**: a row in `discharge_truck_assignments` for this `truck_id`, whose discharge is
  `PLANNED` or `ACTIVE`, and whose `released_at` is `NULL`. The checker accepts the whole submitted
  set at once, so a multiple archival resolves usage in one bounded query rather than one per truck.
- **Not in use**: assignments belonging to closed discharges, and assignments whose `released_at`
  is set — the two exclusions specified by FR-006 and already delivered by Enforce Persisted
  Site-Reference Usage Rules (`#240`).

A truck used by several current discharges is still reported once; the checker returns a `Set`.

### Multiple archival

A multiple archival applies the identical rules to every submitted truck, with three differences in
mechanics rather than in rule:

- **Classification instead of exceptions**: an ineligible truck does not raise; it is recorded as a
  blocker so the rest of the submission can proceed (FR-023). The reason vocabulary for this slice
  is `NOT_FOUND`, `IN_USE`, and `ALREADY_ARCHIVED`. (`ALREADY_AVAILABLE` belongs to reactivation,
  `#226`.)
- **One transaction**: the submitted trucks are loaded `forUpdate()`, usage is resolved once for the
  whole set through the shared checker with `client: trx`, and the eligible subset is updated by a
  single guarded statement. Either all eligible archivals commit or none do (FR-026).
- **Shared metadata**: `archivedAt`, `archivedByUserId`, and `archiveComment` are computed once per
  submission and written identically to every archived truck (FR-025).

Payload rules: at least one id, no duplicate ids (compared case-insensitively), each a UUID
(`lifecycleIds()`); the comment follows the same rule as the single path.

### Result types

```ts
type ArchiveTruckCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

type ArchiveTruckResult =
  | { kind: 'ARCHIVED'; truck: Truck }
  | { kind: 'ALREADY_ARCHIVED' }
  | { kind: 'NOT_FOUND' }
```

For the multiple path:

```ts
type ArchiveTrucksCommand = {
  ids: string[]
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

type BulkTruckLifecycleBlocker = {
  id: string
  registration?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED'
}

type BulkTruckLifecycleResult = {
  updatedTrucks: Truck[]
  blockedTrucks: BulkTruckLifecycleBlocker[]
}
```

`registration` is absent on a `NOT_FOUND` blocker — there is no record to read it from — so the
client falls back to the submitted identifier, as the customer bulk UI already does.
`updatedTrucks` preserves the order of the submitted ids.

`TruckRepository` gains four abstract methods alongside the existing `list()`, `listAvailable()`,
and `create()`:

```ts
abstract findById(id: string): Promise<Truck | null>
abstract archiveAvailable(command: ArchiveTruckCommand): Promise<ArchiveTruckResult>
abstract archiveAvailableMany(command: ArchiveTrucksCommand): Promise<BulkTruckLifecycleResult>
abstract findManyForLifecycle(ids: string[]): Promise<Truck[]>
```

`findManyForLifecycle` is the locked, transaction-scoped read backing the multiple path; the pure
classification of its results into eligible trucks and blockers lives in
`apps/api/app/trucks/shared/truck_lifecycle_blockers.ts` (`indexTrucksById`, `findBulkBlockers`,
`orderTrucks`), mirroring `customer_lifecycle_blockers.ts`.

`findById` preloads `archivedBy` and `reactivatedBy`, matching `list()`/`listAvailable()` and
`CustomerRepository.findById`. `archiveAvailable` reloads the updated truck with the same preloads
so the archive response carries a populated `archivedBy` summary rather than only
`archivedByUserId`.

## Discharge Truck Assignment (read only)

No new table and no change. `discharge_truck_assignments` (with its `released_at` column, from
`#236`) is read exclusively through the shared usage checker to answer the eligibility question in
step 5. This slice never writes to it — releasing a reservation is a discharge-side behavior.

## Transport Company (untouched)

No new table and no change. Archiving a truck does not alter its `transport_company_id`, and an
`ARCHIVED` transport company does not block archiving one of its trucks: the spec's edge cases
require the two lifecycle states to remain independent, and the truck consultation contract already
renders an archived truck alongside an archived company.

## Authorized Administrator

No new table. Authorization reuses the existing `User.role` values (`ORGANIZATION_ADMIN`,
`OPERATIONS_ADMIN`) already checked by `TruckPolicy.list` and `TruckPolicy.create`;
`TruckPolicy.archive` applies the identical role check to the lifecycle path. Access status is not
re-checked in the policy: a user whose access is no longer active is rejected earlier by the
authentication middleware, which is why the contract lists that case as `401` rather than `403`.

## Invariants preserved from earlier truck slices

- An archived truck keeps its `trucks_registration_unique` entry, so its registration remains
  reserved and cannot be reused by a new truck — the uniqueness scope established by List Trucks
  (`#222`) spans both lifecycle states and is unaffected by archival.
- The archived truck continues to appear in `trucks.index` (administrators only) and disappears
  from `trucks.available`, using the `status` filter already implemented in
  `LucidTruckRepository.listAvailable()`; no read-path change is needed.
- `capacityTonnes` remains a positive `NUMERIC(12,3)` value serialized as a JSON number by
  `TruckTransformer`, unchanged.
