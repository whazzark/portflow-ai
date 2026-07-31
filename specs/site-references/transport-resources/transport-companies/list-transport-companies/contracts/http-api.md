# HTTP Contract: Transport Company Consultation

All endpoints are under the existing `/api/v1` authenticated route group, use the session cookie guard, and wrap successful data as `{ "data": ... }`.

## Transport company representation

```json
{
  "id": "7f6c138c-8b9f-4e1b-b1a0-fc520cfb7351",
  "name": "Atlantic Transport",
  "status": "ARCHIVED",
  "archivedAt": "2026-07-20T14:32:11.000Z",
  "archivedByUserId": "5d84a420-0c0d-4cb4-8fc5-809944cc2729",
  "archivedBy": {
    "id": "5d84a420-0c0d-4cb4-8fc5-809944cc2729",
    "firstName": "Claire",
    "lastName": "Martin"
  },
  "archiveComment": "Provider no longer serves the site",
  "reactivatedAt": null,
  "reactivatedByUserId": null,
  "reactivatedBy": null,
  "reactivationComment": null,
  "createdAt": "2026-01-12T09:00:00.000Z",
  "updatedAt": "2026-07-20T14:32:11.000Z"
}
```

Rules:

- `id`, `name`, `status`, `createdAt`, and `updatedAt` are always present.
- `status` is exactly `AVAILABLE` or `ARCHIVED`.
- `archivedAt` is present for every `ARCHIVED` company. It may be null for an `AVAILABLE` company that has never been archived.
- Reactivation timestamps, actor IDs, actor summaries, and comments are nullable; archive actor IDs, summaries, and comments are also nullable.
- An unavailable actor is represented by `null`; the API never invents an actor label.
- Collection order is deterministic by `name` ascending and then `id` ascending. The web UI may reorder the selected lifecycle collection descending without another request while retaining stable ordering for equal names.

## GET `/api/v1/transport-companies`

Returns the complete authoritative consultation collection, including available and archived companies.

### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "ba9136ad-3304-418a-9f8a-b3575db7f107",
      "name": "Atlantic Transport",
      "status": "AVAILABLE",
      "archivedAt": null,
      "archivedByUserId": null,
      "archivedBy": null,
      "archiveComment": null,
      "reactivatedAt": "2026-07-01T10:15:00.000Z",
      "reactivatedByUserId": null,
      "reactivatedBy": null,
      "reactivationComment": "Contract renewed",
      "createdAt": "2026-01-12T09:00:00.000Z",
      "updatedAt": "2026-07-01T10:15:00.000Z"
    }
  ]
}
```

An empty collection returns `200 OK` with `{ "data": [] }`.

## GET `/api/v1/transport-companies/available`

Returns only companies whose authoritative status is `AVAILABLE`. This is the contract for operational controls that select a company for new work; callers must not derive such a selector from the complete consultation response.

### Success: `200 OK`

The response shape is identical to the complete collection, but every item has `status: "AVAILABLE"`. An empty available collection returns `{ "data": [] }`.

## Authorization and failures

| Situation | Status | Response behavior |
|---|---:|---|
| Active authenticated user, any role | `200` | Requested collection is returned |
| Missing/expired session | `401` | `E_UNAUTHORIZED_ACCESS`; no transport-company data |
| User access is no longer active | `401` | Session is rejected by authentication middleware; no transport-company data |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope; no partial collection |

There are no request parameters and therefore no endpoint-specific validation or conflict responses in this read-only slice.
