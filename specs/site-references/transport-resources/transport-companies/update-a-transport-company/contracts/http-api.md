# HTTP Contract: Update a Transport Company

This slice adds one endpoint to the existing `/api/v1` authenticated route group. It uses the session cookie guard and wraps successful data as `{ "data": ... }`, like every other endpoint in the group.

The transport-company representation is unchanged from [the consultation contract](../../list-transport-companies/contracts/http-api.md); the update response reuses `TransportCompanyTransformer` exactly.

## PATCH `/api/v1/transport-companies/:id`

Updates the mutable information of one transport company. `:id` is the company's stable UUID.

Route registration sits in the existing `transport_companies` group:

```text
router.patch('/:id', [controllers.TransportCompanies, 'update']).as('update')
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

`name` is the only accepted field and the only mutable one. The request body carries no lifecycle field, so status, archive context, and reactivation context cannot be written through this contract.

### Success: `200 OK`

Returns the complete updated company, so the caller needs no follow-up read.

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
    "reactivatedAt": "2026-07-01T10:15:00.000Z",
    "reactivatedByUserId": null,
    "reactivatedBy": null,
    "reactivationComment": "Contract renewed",
    "createdAt": "2026-01-12T09:00:00.000Z",
    "updatedAt": "2026-08-22T09:41:00.000Z"
  }
}
```

Guarantees on success:

- `id`, `status`, `createdAt`, and every archive and reactivation field are identical to their values before the request.
- `name` is the submitted value with surrounding whitespace removed.
- `updatedAt` is refreshed, including when the submitted name equals the stored name.
- Submitting the company's own current name is a success, not a conflict.

### Failures

| Situation | Status | Error code |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS` |
| User access is no longer active | `401` | Rejected by authentication middleware |
| Authenticated user without an administration role | `403` | `E_AUTHORIZATION_FAILURE` |
| Missing, blank, or over-long `name` | `422` | `E_VALIDATION_ERROR` |
| Invalid name reaching the domain directly | `422` | `E_SITE_REFERENCE_NAME_INVALID` |
| No company with this id | `404` | `E_TRANSPORT_COMPANY_NOT_FOUND` |
| Company is archived | `409` | `E_TRANSPORT_COMPANY_ARCHIVED` |
| Name already used by another company | `409` | `E_TRANSPORT_COMPANY_NAME_CONFLICT` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope |

Every failure leaves the stored company byte-for-byte unchanged.

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

### Ordering of checks

The order is observable and must be stable, because it decides which refusal a caller sees when several apply at once:

1. Authentication middleware — `401` before anything else is read.
2. `TransportCompanyPolicy.update` — `403` before the body is validated, so an unauthorized caller learns nothing about validity.
3. Vine validator — `422` before any row is read, so an unauthorized-shaped body never reaches persistence.
4. Repository conditional write — `404` / `409 ARCHIVED` / `409 NAME_CONFLICT`.

A non-administrator submitting a blank name for an archived company receives `403`.

## Unchanged endpoints

`GET /api/v1/transport-companies` and `GET /api/v1/transport-companies/available` are untouched by this slice. After a successful update both return the new name on their next request; the available-only collection continues to exclude archived companies.
