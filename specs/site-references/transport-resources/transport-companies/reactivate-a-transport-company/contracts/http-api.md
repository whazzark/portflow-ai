# HTTP Contract: Reactivate a Transport Company

This slice adds two endpoints to the existing `/api/v1` authenticated route group. Both use the session cookie guard and wrap successful data as `{ "data": ... }`, like every other endpoint in the group.

The transport-company representation is unchanged from [the consultation contract](../../list-transport-companies/contracts/http-api.md); both responses reuse `TransportCompanyTransformer` exactly.

Route registration sits in the existing `transport_companies` group, in this order — the literal `/reactivate` path is declared before the parameterised one, mirroring the delivered archive pair and the delivered customer group:

```text
router.post('/archive', [controllers.TransportCompanies, 'archiveMany']).as('archive_many')
router.post('/reactivate', [controllers.TransportCompanies, 'reactivateMany']).as('reactivate_many')
router.post('/:id/archive', [controllers.TransportCompanies, 'archive']).as('archive')
router.post('/:id/reactivate', [controllers.TransportCompanies, 'reactivate']).as('reactivate')
```

Both are authorized by the same new ability, `TransportCompanyPolicy.reactivate`, which is declared separately from `archive` even though the two resolve identically today.

---

## POST `/api/v1/transport-companies/:id/reactivate`

Reactivates one archived transport company. `:id` is the company's stable UUID.

### Request

```json
{
  "comment": "Framework contract renewed for the season"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `comment` | string \| null | No | Trimmed; at most 1,000 characters after trimming; stored as `null` when absent, `null`, empty, or whitespace-only |

An empty body `{}` is valid and reactivates without a comment. `comment` is the only accepted field: the request carries no `status` and no actor, so neither can be forged — the reactivating actor is always taken from the authenticated session, and the reactivation time is always server-assigned.

The validator is `lifecycleComment()` from `#shared/validators/lifecycle_validator`, reused unchanged from the archive contract.

### Success: `200 OK`

Returns the complete reactivated company, so the caller needs no follow-up read.

```json
{
  "data": {
    "id": "ba9136ad-3304-418a-9f8a-b3575db7f107",
    "name": "Loire Vrac Transport",
    "status": "AVAILABLE",
    "archivedAt": "2026-05-26T09:41:00.000Z",
    "archivedByUserId": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f",
    "archivedBy": { "id": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f", "firstName": "Claire", "lastName": "Martin" },
    "archiveComment": "Provider no longer serves the site",
    "reactivatedAt": "2026-08-24T09:41:00.000Z",
    "reactivatedByUserId": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f",
    "reactivatedBy": { "id": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f", "firstName": "Claire", "lastName": "Martin" },
    "reactivationComment": "Framework contract renewed for the season",
    "createdAt": "2026-01-12T09:00:00.000Z",
    "updatedAt": "2026-08-24T09:41:00.000Z"
  }
}
```

Guarantees on success:

- `id`, `name`, and `createdAt` are identical to their values before the request.
- `status` is `AVAILABLE`; `reactivatedAt` and `updatedAt` are the same server instant.
- `reactivatedByUserId` is the authenticated caller and `reactivatedBy` is their preloaded summary.
- `reactivationComment` is the trimmed comment, or `null` when none was usable — including when a previous reactivation had left a comment.
- The archival context (`archivedAt`, `archivedByUserId`, `archiveComment`) is returned **unchanged** — reactivating does not clear it. It may legitimately carry `archivedByUserId: null` on a legacy row; the response returns `archivedBy: null` and the reactivation still succeeds.
- No truck row is read for writing or modified.

### Failures

| Situation | Status | Error code |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS` |
| User access is no longer active | `401` | Rejected by authentication middleware |
| Authenticated user without an administration role | `403` | `E_AUTHORIZATION_FAILURE` |
| `comment` over 1,000 characters or not a string | `422` | `E_VALIDATION_ERROR` |
| No company with this id | `404` | `E_TRANSPORT_COMPANY_NOT_FOUND` |
| Company is already available | `409` | `E_TRANSPORT_COMPANY_ALREADY_AVAILABLE` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope |

There is deliberately **no** truck-related failure on this endpoint. A company that provides no truck at all, or only archived trucks, reactivates exactly like any other; see [research.md](./research.md) Decision 3.

Every failure leaves the stored company, its lifecycle context, and every truck byte-for-byte unchanged.

### Ordering of checks

The order is observable and must be stable, because it decides which refusal a caller sees when several apply at once:

1. Authentication middleware — `401` before anything else is read.
2. `TransportCompanyPolicy.reactivate` — `403` before the body is validated, so an unauthorized caller learns nothing about validity or about the company's existence.
3. Vine validator — `422` before any row is read.
4. Company lookup — `404`.
5. Lifecycle state — `409 ALREADY_AVAILABLE`.
6. Conditional write — re-reports `404` or `409 ALREADY_AVAILABLE` when the row changed underneath.

Consequences worth stating:

- A non-administrator submitting a 2,000-character comment for a non-existent company receives `403`.
- Two administrators reactivating the same company concurrently: exactly one receives `200`, the other `409 ALREADY_AVAILABLE`, and only the first one's actor, time, and comment are stored.

### Idempotency

The endpoint is deliberately **not** idempotent. Re-reactivating an available company is a `409`, not a silent `200`, because succeeding would overwrite the original reactivation actor, time, and comment with a second transition that never really happened.

---

## POST `/api/v1/transport-companies/reactivate`

Reactivates a selection of transport companies in one action, reporting each company's outcome individually.

### Request

```json
{
  "ids": [
    "ba9136ad-3304-418a-9f8a-b3575db7f107",
    "1f4d2b6e-0c3a-4d8b-9e21-77c0a5d9e310"
  ],
  "comment": "Post-review restoration"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `ids` | string[] | **Yes** | At least one UUID; lower-cased; no duplicates |
| `comment` | string \| null | No | Same rule as the single endpoint; applies to every company reactivated by this request |

No maximum selection size is imposed. Both fields reuse `lifecycleIds()` and `lifecycleComment()` from `#shared/validators/lifecycle_validator` unchanged, so this endpoint adds no validation rule of its own.

### Success: `200 OK`

The request succeeds whenever it is well-formed and authorized. The outcome is partitioned: eligible companies are reactivated, everything else is reported with an individual reason.

```json
{
  "data": {
    "updatedCompanies": [
      {
        "id": "ba9136ad-3304-418a-9f8a-b3575db7f107",
        "name": "Loire Vrac Transport",
        "status": "AVAILABLE",
        "archivedAt": "2026-05-26T09:41:00.000Z",
        "archivedByUserId": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f",
        "archivedBy": { "id": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f", "firstName": "Claire", "lastName": "Martin" },
        "archiveComment": "Provider no longer serves the site",
        "reactivatedAt": "2026-08-24T09:41:00.000Z",
        "reactivatedByUserId": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f",
        "reactivatedBy": { "id": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f", "firstName": "Claire", "lastName": "Martin" },
        "reactivationComment": "Post-review restoration",
        "createdAt": "2026-01-12T09:00:00.000Z",
        "updatedAt": "2026-08-24T09:41:00.000Z"
      }
    ],
    "blockedCompanies": [
      {
        "id": "1f4d2b6e-0c3a-4d8b-9e21-77c0a5d9e310",
        "name": "Estuaire Bennes",
        "reason": "ALREADY_AVAILABLE"
      }
    ]
  }
}
```

| Blocker reason | Meaning |
|---|---|
| `NOT_FOUND` | No company with this id. `name` is omitted — the response never invents or discloses data for an unknown id |
| `ALREADY_AVAILABLE` | The company exists but is already available; its existing reactivation context is untouched |

`ALREADY_ARCHIVED` and `HAS_AVAILABLE_TRUCKS` are members of the shared blocker type but are **unreachable** on this endpoint: the first is the archival endpoint's mirror of `ALREADY_AVAILABLE`, and the second is evaluated only when `AVAILABLE` is the expected status. See [research.md](./research.md) Decision 2 for why the union is shared rather than split.

Guarantees on success:

- `updatedCompanies` and `blockedCompanies` **partition** the requested ids: every requested id appears in exactly one collection, exactly once, and no other id appears.
- Both collections preserve the order of `ids`.
- Every entry of `updatedCompanies` carries the same `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment`.
- Every entry of `blockedCompanies` is byte-for-byte unchanged in storage, along with its lifecycle context and its trucks.
- Each reactivated company satisfies exactly the guarantees of the single endpoint, including the preserved archival context.
- No truck row is read for writing or modified.

**Every company blocked** is still `200`, with an empty `updatedCompanies`:

```json
{ "data": { "updatedCompanies": [], "blockedCompanies": [ /* … */ ] } }
```

Nothing about the request was wrong, and the per-company reasons are exactly what the administrator needs. The interface is responsible for saying plainly that nothing changed (FR-030). See [research.md](./research.md) Decision 8.

### Failures

| Situation | Status | Error code |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS` |
| User access is no longer active | `401` | Rejected by authentication middleware |
| Authenticated user without an administration role | `403` | `E_AUTHORIZATION_FAILURE` |
| `ids` missing, empty, containing a non-UUID, or containing a duplicate | `422` | `E_VALIDATION_ERROR` |
| `comment` over 1,000 characters or not a string | `422` | `E_VALIDATION_ERROR` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope |

A `422` changes nothing at all: no company in the request is reactivated, not even the eligible ones.

There is deliberately **no** `404` and no `409` on this endpoint. An unknown id and an already-available company are per-company outcomes inside a `200`, not request-level failures.

### Ordering of checks

1. Authentication middleware — `401`.
2. `TransportCompanyPolicy.reactivate` — `403`, the same ability as the single endpoint.
3. Vine validator — `422` on `ids` and `comment` before any row is read.
4. Inside one transaction: lock the requested rows `forUpdate`, partition them with `findBulkBlockers(ids, byId, 'ARCHIVED')`, write the eligible ones in one statement.

Per company, the partition applies the same order as the single path: `NOT_FOUND`, then `ALREADY_AVAILABLE`. A company blocked in a selection therefore reports the same reason it would report alone.

### Concurrency

The requested rows are locked `forUpdate` for the duration of the transaction, and the number of rows actually updated is asserted to equal the number found eligible. A company reactivated by someone else between the lock and the write is reported as `ALREADY_AVAILABLE`; an unexpected row count aborts the transaction rather than reporting a success that did not happen. Two administrators reactivating overlapping selections concurrently therefore produce exactly one reactivation per company, with exactly one stored context.

### Error envelopes

Validation failures use the framework's standard field-error envelope:

```json
{
  "error": {
    "code": "E_VALIDATION_ERROR",
    "message": "Validation failure",
    "details": [
      { "field": "ids", "rule": "distinct", "message": "The ids field has duplicate values" }
    ]
  }
}
```

Domain conflicts on the single endpoint use the flat error envelope:

```json
{
  "error": {
    "code": "E_TRANSPORT_COMPANY_ALREADY_AVAILABLE",
    "message": "Transport company is already available"
  }
}
```

One new exception is introduced by this slice, alongside the delivered `TransportCompanyNotFoundException`:

```text
TransportCompanyAlreadyAvailableException
  status  409
  code    E_TRANSPORT_COMPANY_ALREADY_AVAILABLE
  message Transport company is already available
```

It mirrors the delivered `CustomerAlreadyAvailableException` exactly. The bulk endpoint raises it nowhere — it reports the same condition as an `ALREADY_AVAILABLE` blocker reason — but both share one vocabulary so the web layer renders one set of messages for both paths.

---

## Unchanged endpoints

`GET /api/v1/transport-companies`, `GET /api/v1/transport-companies/available`, `POST /api/v1/transport-companies`, `PATCH /api/v1/transport-companies/:id`, and both archive endpoints are untouched by this slice. After a successful reactivation, single or bulk:

- the full collection still returns the company, now `AVAILABLE` with both its preserved archive context and its new reactivation context;
- the available-only collection starts returning it again;
- `PATCH /:id` on it stops refusing with `409 E_TRANSPORT_COMPANY_ARCHIVED` and accepts a rename again;
- `POST /api/v1/trucks` naming it as provider stops refusing with `422 E_TRUCK_TRANSPORT_COMPANY_INVALID`;
- `POST /:id/archive` on it becomes possible again, subject to its own available-truck rule.

None of those five behaviors is new code; they follow from the status change alone, and the integration suite asserts them so the coupling stays honest.
