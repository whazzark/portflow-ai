# Data Model: Create a Truck

This slice writes to the `trucks` table already defined by List Trucks (`#222`, migration
`1784900000000_create_trucks_table.ts`) and its `Truck` model (`apps/api/app/models/truck.ts`).
No schema change is introduced. See
`specs/site-references/transport-resources/trucks/list-trucks/data-model.md` for the full column
reference; this document covers only the fields and rules exercised by creation.

## Truck (write path)

| Field | Type | Required on create | Rules |
|---|---|---:|---|
| `id` | UUID | No (system-assigned) | Assigned by `Truck.assignId()` before insert; never accepted from the client |
| `registration` | String, max 255 | Yes | Trimmed; non-blank after trim; case-insensitively unique across available and archived trucks via `trucks_registration_unique` |
| `vehicleModel` | String, max 255 | No | Trimmed when present; omitted or explicit `null` creates the truck without one; a present but blank/whitespace-only value is rejected |
| `capacityTonnes` | Decimal `(12,3)` | Yes | Positive; at most 3 fractional digits; validated before the DB `capacity_tonnes > 0` check is ever reached |
| `transportCompanyId` | UUID | Yes | Must reference an existing transport company whose current `status` is `AVAILABLE` |
| `status` | `AVAILABLE` \| `ARCHIVED` | No (system-assigned) | Always `AVAILABLE` on creation; this slice never creates a truck directly into `ARCHIVED` |
| `archivedAt`, `archivedByUserId`, `archiveComment` | — | No (system-assigned) | Always `null` on creation |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | — | No (system-assigned) | Always `null` on creation |
| `createdAt`, `updatedAt` | Timestamp | No (system-assigned) | Server-managed |

### Validation order

1. Authorization: the requesting user must be an active `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN` (`TruckPolicy.create`, new method alongside the existing `list`/`listAvailable`).
2. Payload shape: `createTruckValidator` (registration non-blank/max length, vehicle model optional non-blank/max length, capacity positive with ≤3 fractional digits, transport company id a UUID).
3. Referenced transport company: must exist and currently be `AVAILABLE` (`InvalidTransportCompanyException`, `422`) — enforced in the use case via `TransportCompanyRepository.findById`, because the database can only enforce existence, not current availability.
4. Persisted uniqueness: the insert may still race with a concurrent submission; a unique-index violation on `trucks_registration_unique` is caught and reported as `DuplicateTruckRegistrationException` (`409`).

### Result type

```ts
type CreateTruckCommand = {
  registration: string
  vehicleModel: string | null
  capacityTonnes: Decimal
  transportCompanyId: string
}

type TruckWriteResult =
  | { kind: 'CREATED'; truck: Truck }
  | { kind: 'DUPLICATE_REGISTRATION' }
```

`TruckRepository` gains `abstract create(command: CreateTruckCommand): Promise<TruckWriteResult>` alongside the existing `list()`/`listAvailable()`.

### Invariants preserved from List Trucks (`#222`)

- A newly created truck is always `AVAILABLE` and therefore must reference an `AVAILABLE` transport company (the cross-table invariant the prior slice's data model deferred to this create workflow).
- Registration uniqueness is case-insensitive and whitespace-trimmed across both lifecycle states, using the same functional index the read slice already orders by.
- Capacity remains a positive `NUMERIC(12,3)` value serialized as a JSON number by `TruckTransformer`, unchanged from the read contract.

## Transport Company (read for validation)

No new table. `TransportCompanyRepository` gains `abstract findById(id: string): Promise<TransportCompany | null>`, mirroring `CustomerRepository.findById`, used only to confirm existence and `status === 'AVAILABLE'` before a truck is written.

## Authorized Administrator

No new table. Authorization reuses the existing `User.role` values (`ORGANIZATION_ADMIN`, `OPERATIONS_ADMIN`) already checked by `TruckPolicy.list` for archived consultation; `TruckPolicy.create` applies the identical role check to the write path.
