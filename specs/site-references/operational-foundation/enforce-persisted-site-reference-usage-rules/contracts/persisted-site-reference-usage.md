# Contract: Persisted Site-Reference Usage and Archive Compatibility

## Internal Usage Assessment

### Purpose

Determine which requested site references are currently required by Planned or Active Discharges
without changing business state.

### Input

```text
referenceType: CUSTOMER | DOCK | WEIGHING_AREA | WAREHOUSE_DOOR | TRUCK
referenceIds: readonly collection of UUID strings
client: optional existing database transaction/query context
```

### Output

```text
Set<string> containing exactly the distinct requested IDs with current qualifying usage
```

### Behavioral Guarantees

- Empty input returns an empty Set and performs no persisted read.
- A non-empty request performs one set-based persisted read, independent of identifier count.
- Duplicate and reordered input produces the same lexically ordered Set.
- Unknown identifiers and identifiers with only historical usage are absent.
- One or many qualifying relationships produce one result entry per reference ID.
- When `client` is supplied, the assessment uses that context and does not create a separate
  transaction.
- The operation is read-only.

### Qualification Matrix

| Type | Qualifies when the owning Discharge is Planned or Active and... |
| --- | --- |
| `CUSTOMER` | a Product Lot references the Customer |
| `DOCK` | the Discharge's current Dock matches |
| `WEIGHING_AREA` | a Shift membership references the area and has not ended |
| `WAREHOUSE_DOOR` | a Product Lot assignment references the door and has not ended |
| `TRUCK` | a Discharge Truck reservation references the truck and has not been released |

Closed Discharges never qualify. Ended memberships, ended Door assignments, and released Truck
reservations never qualify, but their rows and snapshots remain unchanged.

## Existing HTTP Archive Compatibility

No route, request payload, success DTO, authorization rule, or error envelope changes.

| Journey | Current usage outcome |
| --- | --- |
| `POST /api/v1/customers/:id/archive` | HTTP `409`, error code `E_CUSTOMER_IN_USE`, reference unchanged |
| `POST /api/v1/docks/:id/archive` | HTTP `409`, error code `E_DOCK_IN_USE`, reference unchanged |
| `POST /api/v1/weighing-areas/:id/archive` | HTTP `409`, error code `E_WEIGHING_AREA_IN_USE`, reference unchanged |
| `POST /api/v1/customers/archive` | HTTP `200`; used items remain unchanged and appear in `blockedCustomers` with reason `IN_USE`; eligible items archive; blocker order follows request order |

For single archives, the established messages remain respectively:

- `Customer is used by a planned or active discharge`
- `Dock is used by a planned or active discharge`
- `Weighing area is used by a planned or active discharge`

## Explicit Non-Contract

- No usage-check endpoint is exposed.
- No Truck or Warehouse Door archive endpoint is added.
- No frontend route, screen, action, or transport DTO is added.
- No caller may use this read operation to release a reservation or end an assignment.
