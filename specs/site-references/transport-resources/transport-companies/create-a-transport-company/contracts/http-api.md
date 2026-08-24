# HTTP Contract: Create a Transport Company

This slice adds one endpoint to the existing `/api/v1` authenticated route group. It uses the session cookie guard and wraps successful data as `{ "data": ... }`, like every other endpoint in the group.

The transport-company representation is unchanged from [the consultation contract](../../list-transport-companies/contracts/http-api.md); the creation response reuses `TransportCompanyTransformer` exactly, so no new response shape enters the Tuyau registry.

## POST `/api/v1/transport-companies`

Creates one transport company in the available lifecycle state.

Route registration sits in the existing `transport_companies` group, before `index` to match the customer and dock groups:

```text
router.post('/', [controllers.TransportCompanies, 'store']).as('store')
```

### Request

```json
{
  "name": "Atlantique Transport Routier"
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `name` | string | Yes | Trimmed; must not be blank; 1–255 characters after trimming |

`name` is the only accepted field. The body carries no `status` and no lifecycle field, so a company cannot be created archived and cannot be given archive or reactivation context.

### Success: `201 Created`

Returns the complete created company, so the caller needs no follow-up read.

```json
{
  "data": {
    "id": "ba9136ad-3304-418a-9f8a-b3575db7f107",
    "name": "Atlantique Transport Routier",
    "status": "AVAILABLE",
    "archivedAt": null,
    "archivedByUserId": null,
    "archivedBy": null,
    "archiveComment": null,
    "reactivatedAt": null,
    "reactivatedByUserId": null,
    "reactivatedBy": null,
    "reactivationComment": null,
    "createdAt": "2026-08-24T09:41:00.000Z",
    "updatedAt": "2026-08-24T09:41:00.000Z"
  }
}
```

Guarantees on success:

- `id` is a freshly generated UUID, unique and never reused.
- `name` is the submitted value with surrounding whitespace removed, preserving the submitted casing.
- `status` is `AVAILABLE`.
- Every archive and reactivation field is `null`.
- `createdAt` is set and `updatedAt` equals it.
- The company owns no truck.

### Failures

| Situation | Status | Error code |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS` |
| User access is no longer active | `401` | Rejected by authentication middleware |
| Authenticated user without an administration role | `403` | `E_AUTHORIZATION_FAILURE` |
| Missing, blank, or over-long `name` | `422` | `E_VALIDATION_ERROR` |
| Invalid name reaching the domain directly | `422` | `E_SITE_REFERENCE_NAME_INVALID` |
| Name already used by any company, available or archived | `409` | `E_TRANSPORT_COMPANY_NAME_CONFLICT` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope |

Every failure leaves the transport-company collection unchanged, with no partially created row.

`404 E_TRANSPORT_COMPANY_NOT_FOUND` and `409 E_TRANSPORT_COMPANY_ARCHIVED` are not reachable through this endpoint: there is no target row to be missing or archived.

Validation failures use the framework's standard field-error envelope so the web form can attach messages to the `name` input:

```json
{
  "error": {
    "code": "E_VALIDATION_ERROR",
    "message": "Validation failure",
    "details": [
      { "field": "name", "rule": "nonBlank", "message": "The name field must not be blank" }
    ]
  }
}
```

Domain conflicts use the flat error envelope:

```json
{
  "error": {
    "code": "E_TRANSPORT_COMPANY_NAME_CONFLICT",
    "message": "Transport company name is already in use"
  }
}
```

The duplicate message deliberately does not name the colliding company or reveal its lifecycle state, so a refusal discloses nothing beyond the fact that the name is taken.

### Ordering of checks

The order is observable and must be stable, because it decides which refusal a caller sees when several apply at once:

1. Authentication middleware — `401` before anything else is read.
2. `TransportCompanyPolicy.create` — `403` before the body is validated, so an unauthorized caller learns nothing about validity.
3. Vine validator — `422` before any row is written.
4. Repository insert — `409 NAME_CONFLICT` from the unique index.

A non-administrator submitting a blank duplicate name receives `403`.

### Concurrency

Two simultaneous requests carrying the same name — differing in case or surrounding whitespace or not — produce exactly one `201` and one `409`. The guarantee comes from the `transport_companies_name_unique` index delivered by #219, not from an application-level check, so it holds regardless of request interleaving.

## Unchanged endpoints

`GET /api/v1/transport-companies`, `GET /api/v1/transport-companies/available`, and `PATCH /api/v1/transport-companies/:id` are untouched by this slice. After a successful creation the two collections include the new company on their next request, in its alphabetical position; the archived collection is unaffected.
