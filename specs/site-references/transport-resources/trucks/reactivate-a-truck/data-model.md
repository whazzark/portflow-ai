# Data Model: Reactivate a Truck

This slice writes to the `trucks` table already defined by List Trucks (`#222`, migration
`1784900000000_create_trucks_table.ts`) and its `Truck` model (`apps/api/app/models/truck.ts`).
**No schema change is introduced** — every column this feature writes already exists and is already
read by the truck consultation contract. See
`specs/site-references/transport-resources/trucks/list-trucks/data-model.md` for the full column
reference; this document covers only the fields, rules, and transitions exercised by reactivation.

## Truck (lifecycle write path)

| Field | Written by this slice | Rules |
|---|---|---|
| `id` | No | Addressed as the URL resource; never modified |
| `registration` | No | Preserved unchanged by reactivation (FR-011) |
| `vehicleModel` | No | Preserved unchanged by reactivation (FR-011) |
| `capacityTonnes` | No | Preserved unchanged by reactivation (FR-011) |
| `transportCompanyId` | No | Preserved unchanged; **read** to gate eligibility — its company must be `AVAILABLE` (FR-005) |
| `status` | Yes | `ARCHIVED` → `AVAILABLE`; the update is guarded by `WHERE status = 'ARCHIVED'` so the transition is atomic |
| `reactivatedAt` | Yes | Server time (`DateTime.now()` in the controller), never client-supplied |
| `reactivatedByUserId` | Yes | The authenticated caller's id, taken from the session, never client-supplied |
| `reactivationComment` | Yes | Trimmed; `null` when absent, empty, or whitespace-only; max 1000 characters |
| `archivedAt`, `archivedByUserId`, `archiveComment` | No | Preserved unchanged — the archive context of the archival being reversed stays readable as history (FR-012) |
| `updatedAt` | Yes | Set to the same instant as `reactivatedAt` |

A truck that is archived and reactivated repeatedly keeps only the **latest** context of each kind:
the next archival overwrites `archived*`, the next reactivation overwrites `reactivated*`. That is
the existing column shape, not a new rule, and FR-012 states it explicitly.

### State transitions

```text
ARCHIVED  ──reactivate (this slice, #226)──▶ AVAILABLE
ARCHIVED  ──reactivate, company ARCHIVED───▶ refused: TRANSPORT_COMPANY_ARCHIVED (no write)
AVAILABLE ──reactivate again──────────────▶ refused: ALREADY_AVAILABLE (no write)
AVAILABLE ──archive (#225, not here)──────▶ ARCHIVED
```

`AVAILABLE` and `ARCHIVED` remain the only truck lifecycle states (`TRUCK_STATUSES` in
`apps/api/app/models/truck.ts`). This slice implements the one edge `#225` left open, closing the
cycle; a truck may traverse it any number of times.

### Eligibility and validation order

1. **Authorization**: the requesting user must be an active `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN` (`TruckPolicy.reactivate`, a new method applying the same role check as the existing `archive`). Bouncer denies with `403`.
2. **Payload shape**: `reactivateTruckValidator` — a single optional, nullable, trimmed `comment` of at most 1000 characters.
3. **Existence**: the truck must exist (`TruckNotFoundException`, `404`).
4. **Current state**: the truck must be `ARCHIVED` (`TruckAlreadyAvailableException`, `409`).
5. **Provider eligibility**: the truck's current transport company must be `AVAILABLE` (`TruckTransportCompanyArchivedException`, `409`), assessed at submission time under a row lock.
6. **Atomic transition**: the status-guarded `UPDATE` may still find the row already available through a concurrent request; a zero-row result is re-mapped to `NOT_FOUND` or `ALREADY_AVAILABLE`.

Steps 3–5 perform no write, so any refusal leaves the row unchanged, archive context included
(FR-018).

**Not checked**: current discharge usage. An archived truck cannot be reserved by a planned or
active discharge — archival refuses exactly that (`#225`, FR-005) — so there is no usage question to
ask on the way back, and this slice calls no usage checker. Reactivation also never creates,
restores, or reopens any discharge involvement (FR-015): it only makes the truck selectable again.

**Not checked**: registration uniqueness. `trucks_registration_unique` is a unique index over
`LOWER(registration)` across *all* trucks regardless of status, so an archived truck keeps its
registration reserved and no other truck can have taken it. Reactivation therefore cannot collide
and needs no resolution step.

### The transport-company gate

The rule is recorded in `CONTEXT.md`: a transport company "cannot be archived while it still
provides available trucks". Two paths already enforce it in the other direction:

- `LucidTransportCompanyRepository#archiveAvailable` locks the company row `FOR UPDATE`, then
  refuses with `HAS_AVAILABLE_TRUCKS` if it still provides an available truck.
- `LucidTruckRepository#create` locks the company row `FOR UPDATE`, then refuses with
  `INVALID_TRANSPORT_COMPANY` unless the company is `AVAILABLE`, before inserting an available
  truck. `UpdateTruckUseCase` applies the same rule to a provider reassignment.

Reactivation is the third path that can create an available truck, so it takes the same lock:

```text
transaction
  SELECT ... FROM trucks WHERE id = ? FOR UPDATE          -- truck state, authoritative company id
  SELECT ... FROM transport_companies WHERE id = ? FOR UPDATE
  → status <> 'AVAILABLE'  ⇒  TRANSPORT_COMPANY_ARCHIVED  (no write)
  UPDATE trucks SET status = 'AVAILABLE', ... WHERE id = ? AND status = 'ARCHIVED'
commit
```

Reading the company after taking the truck lock is safe: an archived truck's `transportCompanyId`
cannot change, because `updateAvailable` is guarded by `WHERE status = 'AVAILABLE'` and
`UpdateTruckUseCase` refuses an archived truck with `ArchivedTruckReadOnlyException`.

Whichever transaction acquires the company lock first commits before the other observes the state,
so the invariant holds in both directions with no possible interleaving that produces an available
truck under an archived company (SC-011).

### Multiple reactivation

A multiple reactivation applies the identical rules to every submitted truck, with three differences
in mechanics rather than in rule:

- **Classification instead of exceptions**: an ineligible truck does not raise; it is recorded as a
  blocker so the rest of the submission can proceed (FR-024). The reason vocabulary for this
  direction is `NOT_FOUND`, `ALREADY_AVAILABLE`, and `TRANSPORT_COMPANY_ARCHIVED`. (`IN_USE` and
  `ALREADY_ARCHIVED` belong to archival, `#225`.)
- **One transaction, two lock classes**: the submitted trucks are loaded `forUpdate()` ordered by
  `id`, the distinct companies of the archived ones are loaded `forUpdate()` ordered by `id`, and
  the eligible subset is updated by a single guarded statement. Either all eligible reactivations
  commit or none do (FR-027).
- **Shared metadata**: `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment` are
  computed once per submission and written identically to every reactivated truck (FR-026).

Payload rules: at least one id, no duplicate ids (compared case-insensitively), each a UUID
(`lifecycleIds()`); the comment follows the same rule as the single path.

### Result types

```ts
export type ReactivateTruckCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type ReactivateTruckResult =
  | { kind: 'REACTIVATED'; truck: Truck }
  | { kind: 'ALREADY_AVAILABLE' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'TRANSPORT_COMPANY_ARCHIVED' }

export type ReactivateTrucksCommand = {
  ids: string[]
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

// Unchanged, already exported by truck_repository.ts for the archive path.
export type BulkTruckLifecycleResult = {
  updatedTrucks: Truck[]
  blockedTrucks: BulkTruckLifecycleBlocker[]
}
```

### Blocker classification (generalized in place)

`apps/api/app/trucks/shared/truck_lifecycle_blockers.ts` currently hardcodes `AVAILABLE` as the
expected status. It gains an `expectedStatus` argument and two reasons, converging on the shape
`customer_lifecycle_blockers.ts` already has:

```ts
export type BulkTruckLifecycleBlocker = {
  id: string
  registration?: string
  reason:
    | 'NOT_FOUND'
    | 'IN_USE'                        // archive only
    | 'ALREADY_ARCHIVED'              // archive only
    | 'ALREADY_AVAILABLE'             // reactivate only
    | 'TRANSPORT_COMPANY_ARCHIVED'    // reactivate only
}

export function findBulkBlockers(
  ids: string[],
  trucksById: Map<string, TruckLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  usedIds?: Set<string>,                     // archive only
  archivedCompanyIds?: Set<string>,          // reactivate only
): BulkTruckLifecycleBlocker[]
```

`TruckLifecycleRecord` gains `transportCompanyId` so the classifier can resolve the company reason
without a second lookup. A `NOT_FOUND` blocker carries no `registration`, because no record exists
to read it from; every other blocker carries it. The existing `archiveAvailableMany` call site
passes `'AVAILABLE'` and keeps its current behavior.

## Transport Company (read-only in this slice)

| Field | Written by this slice | Rules |
|---|---|---|
| `id` | No | Read from the truck's `transportCompanyId` |
| `status` | No | Read under `FOR UPDATE`; must be `AVAILABLE` for the truck to be reactivated |

No transport company row is modified by this feature (FR-021). The company's own lifecycle is owned
by Archive a Transport Company (`#220`) and Reactivate a Transport Company (`#221`); the latter is
the slice an administrator uses to clear a `TRANSPORT_COMPANY_ARCHIVED` refusal.

## Out of scope for this data model

Permanent deletion, archival (`#225`), creation, provider reassignment (`#224`), and any change to
discharge, rotation, or report records. Reactivation writes three lifecycle columns and a status on
one table.
