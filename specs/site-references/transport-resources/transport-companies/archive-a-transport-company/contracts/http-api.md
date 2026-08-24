# HTTP Contract: Archive a Transport Company

**Last Updated**: 2026-08-24 — bulk archival endpoint added.

This slice adds two endpoints to the existing `/api/v1` authenticated route group. Both use the session cookie guard and wrap successful data as `{ "data": ... }`, like every other endpoint in the group.

The transport-company representation is unchanged from [the consultation contract](../../list-transport-companies/contracts/http-api.md); both responses reuse `TransportCompanyTransformer` exactly.

Route registration sits in the existing `transport_companies` group, in this order — the literal `/archive` path is declared before the parameterised one, mirroring the delivered customer group:

```text
router.post('/archive', [controllers.TransportCompanies, 'archiveMany']).as('archive_many')
router.post('/:id/archive', [controllers.TransportCompanies, 'archive']).as('archive')
```

Both are authorized by the same new ability, `TransportCompanyPolicy.archive`.

---

## POST `/api/v1/transport-companies/:id/archive`

Archives one available transport company. `:id` is the company's stable UUID.

### Request

```json
{
  "comment": "Provider no longer serves the site"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `comment` | string \| null | No | Trimmed; at most 1,000 characters after trimming; stored as `null` when absent, `null`, empty, or whitespace-only |

An empty body `{}` is valid and archives without a comment. `comment` is the only accepted field: the request carries no `status` and no actor, so neither can be forged — the archiving actor is always taken from the authenticated session, and the archival time is always server-assigned.

### Success: `200 OK`

Returns the complete archived company, so the caller needs no follow-up read.

```json
{
  "data": {
    "id": "ba9136ad-3304-418a-9f8a-b3575db7f107",
    "name": "Grand Ouest Camions",
    "status": "ARCHIVED",
    "archivedAt": "2026-08-24T09:41:00.000Z",
    "archivedByUserId": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f",
    "archivedBy": { "id": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f", "firstName": "Claire", "lastName": "Martin" },
    "archiveComment": "Provider no longer serves the site",
    "reactivatedAt": null,
    "reactivatedByUserId": null,
    "reactivatedBy": null,
    "reactivationComment": null,
    "createdAt": "2026-01-12T09:00:00.000Z",
    "updatedAt": "2026-08-24T09:41:00.000Z"
  }
}
```

Guarantees on success:

- `id`, `name`, and `createdAt` are identical to their values before the request.
- `status` is `ARCHIVED`; `archivedAt` and `updatedAt` are the same server instant.
- `archivedByUserId` is the authenticated caller and `archivedBy` is their preloaded summary.
- `archiveComment` is the trimmed comment, or `null` when none was usable.
- Any pre-existing reactivation context is returned unchanged — archiving does not clear it.
- No truck row is read for writing or modified.

### Failures

| Situation | Status | Error code |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS` |
| User access is no longer active | `401` | Rejected by authentication middleware |
| Authenticated user without an administration role | `403` | `E_AUTHORIZATION_FAILURE` |
| `comment` over 1,000 characters or not a string | `422` | `E_VALIDATION_ERROR` |
| No company with this id | `404` | `E_TRANSPORT_COMPANY_NOT_FOUND` |
| Company is already archived | `409` | `E_TRANSPORT_COMPANY_ALREADY_ARCHIVED` |
| Company still provides at least one available truck | `409` | `E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope |

Every failure leaves the stored company, its lifecycle context, and every truck byte-for-byte unchanged.

### Ordering of checks

The order is observable and must be stable, because it decides which refusal a caller sees when several apply at once:

1. Authentication middleware — `401` before anything else is read.
2. `TransportCompanyPolicy.archive` — `403` before the body is validated, so an unauthorized caller learns nothing about validity or about the company's existence.
3. Vine validator — `422` before any row is read.
4. Company lookup — `404`.
5. Lifecycle state — `409 ALREADY_ARCHIVED`.
6. Available-truck rule — `409 HAS_AVAILABLE_TRUCKS`.
7. Conditional write — re-reports `404` or `409 ALREADY_ARCHIVED` when the row changed underneath.

Consequences worth stating:

- An already-archived company that still has available trucks reports `ALREADY_ARCHIVED`, not the truck conflict.
- A non-administrator submitting a 2,000-character comment for a non-existent company receives `403`.
- Two administrators archiving the same company concurrently: exactly one receives `200`, the other `409 ALREADY_ARCHIVED`, and only the first one's actor, time, and comment are stored.

### Idempotency

The endpoint is deliberately **not** idempotent. Re-archiving an archived company is a `409`, not a silent `200`, because succeeding would overwrite the original archival actor, time, and comment with a second transition that never really happened.

---

## POST `/api/v1/transport-companies/archive`

Archives a selection of transport companies in one action, reporting each company's outcome individually.

### Request

```json
{
  "ids": [
    "ba9136ad-3304-418a-9f8a-b3575db7f107",
    "1f4d2b6e-0c3a-4d8b-9e21-77c0a5d9e310"
  ],
  "comment": "Contract review Q3"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `ids` | string[] | **Yes** | At least one UUID; lower-cased; no duplicates |
| `comment` | string \| null | No | Same rule as the single endpoint; applies to every company archived by this request |

No maximum selection size is imposed. This follows the shared `lifecycleIds()` rule already used by the customer bulk lifecycle endpoints; see [research.md](./research.md) Decision 6.

### Success: `200 OK`

The request succeeds whenever it is well-formed and authorized. The outcome is partitioned: eligible companies are archived, everything else is reported with an individual reason.

```json
{
  "data": {
    "updatedCompanies": [
      {
        "id": "ba9136ad-3304-418a-9f8a-b3575db7f107",
        "name": "Grand Ouest Camions",
        "status": "ARCHIVED",
        "archivedAt": "2026-08-24T09:41:00.000Z",
        "archivedByUserId": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f",
        "archivedBy": { "id": "8f0f0f5e-1f2b-4a1e-9c0e-1a2b3c4d5e6f", "firstName": "Claire", "lastName": "Martin" },
        "archiveComment": "Contract review Q3",
        "reactivatedAt": null,
        "reactivatedByUserId": null,
        "reactivatedBy": null,
        "reactivationComment": null,
        "createdAt": "2026-01-12T09:00:00.000Z",
        "updatedAt": "2026-08-24T09:41:00.000Z"
      }
    ],
    "blockedCompanies": [
      {
        "id": "1f4d2b6e-0c3a-4d8b-9e21-77c0a5d9e310",
        "name": "Atlantique Transport Routier",
        "reason": "HAS_AVAILABLE_TRUCKS"
      }
    ]
  }
}
```

| Blocker reason | Meaning |
|---|---|
| `NOT_FOUND` | No company with this id. `name` is omitted — the response never invents or discloses data for an unknown id |
| `ALREADY_ARCHIVED` | The company exists but was already archived; its original archival context is untouched |
| `HAS_AVAILABLE_TRUCKS` | The company still provides at least one available truck |

Guarantees on success:

- `updatedCompanies` and `blockedCompanies` **partition** the requested ids: every requested id appears in exactly one collection, exactly once, and no other id appears.
- Both collections preserve the order of `ids`.
- Every entry of `updatedCompanies` carries the same `archivedAt`, `archivedByUserId`, and `archiveComment`.
- Every entry of `blockedCompanies` is byte-for-byte unchanged in storage, along with its lifecycle context and its trucks.
- Each archived company satisfies exactly the guarantees of the single endpoint.
- No truck row is modified.

**Every company blocked** is still `200`, with an empty `updatedCompanies`:

```json
{ "data": { "updatedCompanies": [], "blockedCompanies": [ /* … */ ] } }
```

Nothing about the request was wrong, and the per-company reasons are exactly what the administrator needs. The interface is responsible for saying plainly that nothing changed (FR-032). See [research.md](./research.md) Decision 11 for why this is not a `409` or a `207`.

### Failures

| Situation | Status | Error code |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS` |
| User access is no longer active | `401` | Rejected by authentication middleware |
| Authenticated user without an administration role | `403` | `E_AUTHORIZATION_FAILURE` |
| `ids` missing, empty, containing a non-UUID, or containing a duplicate | `422` | `E_VALIDATION_ERROR` |
| `comment` over 1,000 characters or not a string | `422` | `E_VALIDATION_ERROR` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope |

A `422` changes nothing at all: no company in the request is archived, not even the eligible ones.

There is deliberately **no** `404` and no `409` on this endpoint. An unknown id, an already-archived company, and a truck-blocked company are per-company outcomes inside a `200`, not request-level failures.

### Ordering of checks

1. Authentication middleware — `401`.
2. `TransportCompanyPolicy.archive` — `403`, the same ability as the single endpoint.
3. Vine validator — `422` on `ids` and `comment` before any row is read.
4. Inside one transaction: lock the requested rows, read which of them still provide available trucks, partition, write the eligible ones in one statement.

Per company, the partition applies the same order as the single path: `NOT_FOUND`, then `ALREADY_ARCHIVED`, then `HAS_AVAILABLE_TRUCKS`. A company blocked in a selection therefore reports the same reason it would report alone — which is what makes retrying it individually comprehensible.

### Concurrency

The requested rows are locked `forUpdate` for the duration of the transaction, and the number of rows actually updated is asserted to equal the number found eligible. A company archived by someone else between the lock and the write is reported as `ALREADY_ARCHIVED`; an unexpected row count aborts the transaction rather than reporting a success that did not happen. Two administrators archiving overlapping selections concurrently therefore produce exactly one archival per company, with exactly one stored context.

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
    "code": "E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS",
    "message": "Transport company still provides available trucks"
  }
}
```

New exceptions introduced by this slice, alongside the delivered `TransportCompanyNotFoundException`:

```text
TransportCompanyAlreadyArchivedException
  status  409
  code    E_TRANSPORT_COMPANY_ALREADY_ARCHIVED
  message Transport company is already archived

TransportCompanyHasAvailableTrucksException
  status  409
  code    E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS
  message Transport company still provides available trucks
```

The message on the truck conflict is what the administrator reads, so it names the blocker rather than restating the refusal. The bulk endpoint raises neither exception — it reports the same two conditions as `blockedCompanies` reasons — but they share one vocabulary so the web layer renders one set of messages for both paths.

---

## Unchanged endpoints

`GET /api/v1/transport-companies`, `GET /api/v1/transport-companies/available`, `POST /api/v1/transport-companies`, and `PATCH /api/v1/transport-companies/:id` are untouched by this slice. After a successful archival, single or bulk:

- the full collection still returns the archived companies, now `ARCHIVED` with their archive context;
- the available-only collection stops returning them;
- `PATCH /:id` on one of them now refuses with the delivered `409 E_TRANSPORT_COMPANY_ARCHIVED`, which is the read-only rule the update slice already ships;
- `POST /api/v1/trucks` naming one of them as provider now refuses with the delivered `422 E_TRUCK_TRANSPORT_COMPANY_INVALID`.

None of those four behaviors is new code; they follow from the status change alone, and the integration suite asserts them so the coupling stays honest.
