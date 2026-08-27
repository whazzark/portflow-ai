# Contract: Warehouse Archive API

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

Base path `/api/v1`, behind `middleware.auth()`. Both endpoints are authorized by
`WarehousePolicy.archive` — `role === 'ORGANIZATION_ADMIN' || role === 'OPERATIONS_ADMIN'` (FR-001),
matching every other site-reference archive policy.

Routes are added to the existing `/warehouses` group in `apps/api/start/routes.ts`. **The bulk route
must be declared before the parameterized one**, exactly as the weighing-area group does, or
`/warehouses/archive` resolves as `:id = 'archive'`:

```ts
router.post('/archive',     [controllers.Warehouses, 'archiveMany']).as('archive_many')
router.post('/:id/archive', [controllers.Warehouses, 'archive']).as('archive')
```

---

## `POST /warehouses/:id/archive` — archive one warehouse

### Request

```json
{ "comment": "Building repurposed for storage of non-bulk goods" }
```

`comment` is optional and nullable; trimmed; max 1,000 characters (FR-014, FR-015).

### `200 OK`

The archived warehouse with its full lifecycle context and its doors post-cascade.

The project's `ApiSerializer` wraps every response under `data`, so the door count travels inside
that wrapper rather than beside it.

```json
{
  "data": {
   "warehouse": {
    "id": "…", "name": "Socomac - Entrepôt céréalier", "status": "ARCHIVED",
    "archivedAt": "2026-08-25T09:14:00.000Z",
    "archivedByUserId": "…",
    "archiveComment": "Building repurposed for storage of non-bulk goods",
    "reactivatedAt": null, "reactivatedByUserId": null, "reactivationComment": null,
    "createdAt": "…", "updatedAt": "2026-08-25T09:14:00.000Z",
    "footprint": { "points": [{ "latitude": 46.1551511, "longitude": -1.2223178 }] },
    "doors": [
      {
        "id": "…", "name": "Porte Quai", "status": "ARCHIVED",
        "latitude": 46.1547, "longitude": -1.2228,
        "archivedAt": "2026-08-25T09:14:00.000Z",
        "archivedByUserId": "…",
        "archiveComment": "Building repurposed for storage of non-bulk goods",
        "reactivatedAt": null, "reactivatedByUserId": null, "reactivationComment": null
      }
    ]
   },
   "archivedDoorCount": 1
  }
}
```

Response invariants, each directly testable:

- **Every** door carries **the same** `archivedAt`, `archivedByUserId`, and `archiveComment` as the
  warehouse (FR-011) — including one that was already archived on its own, whose context the archival
  replaces (amended by #216; `archivedWithWarehouse` is dropped with that amendment).
- `name`, `footprint.points` (every point, in `position` order), and `createdAt` are unchanged
  (FR-016); each door's `name`, `latitude`, `longitude` are unchanged (FR-017).
- `archivedDoorCount` counts every door this call wrote, which is every door the warehouse holds
  (amended by #216).

### Failures

| Status | Code | Cause |
|---|---|---|
| `401` | — | unauthenticated (FR-002) |
| `403` | — | active user without administration rights (FR-002) |
| `404` | `E_WAREHOUSE_NOT_FOUND` | unknown id (FR-003) |
| `409` | `E_WAREHOUSE_ALREADY_ARCHIVED` | already archived (FR-004) |
| `409` | `E_WAREHOUSE_IN_USE` | a door holds a current product lot assignment in a Planned/Active discharge (FR-005) |
| `422` | validation failure | comment > 1,000 characters (FR-015) |

Every failure leaves the warehouse **and all of its doors** untouched (FR-028). `401`/`403` disclose
nothing about whether the warehouse exists (FR-002).

---

## `POST /warehouses/archive` — archive several warehouses

### Request

```json
{ "ids": ["…", "…", "…"], "comment": "End-of-campaign cleanup" }
```

`ids`: at least one, all well-formed UUIDs (lowercased), no duplicates. Violations are rejected as
`422` **before any row changes** (FR-040) — deliberately distinct from a well-formed id that resolves
to nothing, which is reported per warehouse as `NOT_FOUND`.

### `200 OK`

```json
{
 "data": {
  "updatedWarehouses": [ { "id": "…", "status": "ARCHIVED", "doors": [] } ],
  "blockedWarehouses": [
    { "id": "…", "name": "SICA Atlantique - Silos céréaliers", "reason": "IN_USE" },
    { "id": "…", "name": "Ancien entrepôt Chef de Baie",       "reason": "ALREADY_ARCHIVED" },
    { "id": "…",                                                "reason": "NOT_FOUND" }
  ]
 }
}
```

- `updatedWarehouses` uses the same serialization as the single response, doors included.
- `blockedWarehouses[].reason` ∈ `NOT_FOUND` | `IN_USE` | `ALREADY_ARCHIVED` — exactly one per
  blocked warehouse (FR-036). `name` is absent for `NOT_FOUND`, since there is no record to name.
- Ordering follows the request's `ids`, as `orderByIds` already guarantees for the delivered bulk
  paths.

Behavioral guarantees:

- **Partial success** (FR-035): one ineligible warehouse never refuses the rest.
- **All-or-nothing for the eligible set** (FR-038) and **across both tables** (FR-027): a failure
  part-way through rolls back every warehouse *and* every door.
- **One shared context** (FR-037): every warehouse archived by one call, and every door archived with
  them, shares one `archivedAt`, one `archivedByUserId`, one `archiveComment`.
- **Assessed at submission time** (FR-034) under `forUpdate()` locks, so concurrent overlapping
  submissions archive each warehouse exactly once and the loser reports `ALREADY_ARCHIVED` without
  overwriting anything (FR-026).
- An **all-blocked** submission returns `200` with an empty `updatedWarehouses` — it is a reported
  outcome, not an error (spec US4 scenario 6).

### Failures

`401` / `403` deny the whole submission with zero lifecycle changes (FR-033). `422` covers both the
comment length and the three invalid-selection cases.

---

## Unchanged contracts

- `GET /warehouses` keeps its shape; **D8** only adds fields. `#207` and `#212` consumers are
  unaffected.
- `GET /warehouse-doors/available` is unchanged and already correct for the cascade: `#212` FR-003a
  requires a door to appear only when both the door **and** its warehouse are available, so archiving
  a warehouse withdraws its doors automatically (FR-021).
- `SITE_REFERENCE_TYPES` gains no member (research **D1**).
- No endpoint archives, reactivates, updates, or deletes a door independently (research **D11**).
