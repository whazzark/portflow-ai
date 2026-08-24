# HTTP Contract: Maintain Transport Company Contact Details

This slice adds **no endpoint**. It widens the request body of the two delivered write endpoints and adds two fields to the transport-company representation returned by all four endpoints of the resource.

Route registration in `start/routes.ts` is unchanged.

## Breaking change to delivered contracts

`POST /api/v1/transport-companies` and `PATCH /api/v1/transport-companies/:id` previously accepted `{ "name": string }` and nothing else. After this slice, a body without `contactPhone` and `contactEmail` is refused with `422 E_VALIDATION_ERROR`. This is required by FR-004 and is safe here because ADR 0005 makes the web client generated from this contract inside the same monorepo — there is no external consumer. The web form and both delivered API test suites are updated in the same change.

## Representation

Every endpoint returning a transport company now carries two additional fields. The transformer change applies uniformly, so `index`, `available`, `store`, and `update` all return the same shape.

```json
{
  "id": "ba9136ad-3304-418a-9f8a-b3575db7f107",
  "name": "Atlantique Transport Routier",
  "contactPhone": "+33 2 40 12 34 56",
  "contactEmail": "dispatch@atlantique-transport.test",
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
  "updatedAt": "2026-08-24T09:41:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `contactPhone` | `string \| null` | `null` only for a company registered before this slice |
| `contactEmail` | `string \| null` | `null` only for a company registered before this slice |

The two are always both `null` or both non-null; the database check constraint makes any other combination unrepresentable. Consumers may rely on that.

Both fields are returned to **every active user**, including non-administrators and for archived companies (FR-019). They are business reference data, not restricted information.

## Request fields

The same two fields are added to both write bodies, with identical rules.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `contactPhone` | string | Yes | Trimmed; must not be blank; only digits and `+ - . ( )` and spaces; `+` only as the first character; 6–20 digits; at most 32 characters |
| `contactEmail` | string | Yes | Trimmed; must not be blank; syntactically valid email address; at most 255 characters |

Neither field accepts `null` and neither may be omitted. There is no way to clear a recorded contact detail through this contract — a value can only be replaced (FR-004).

The request body still carries no lifecycle field, so status, archive context, and reactivation context remain unwritable through either endpoint.

## POST `/api/v1/transport-companies`

### Request

```json
{
  "name": "Atlantique Transport Routier",
  "contactPhone": "+33 2 40 12 34 56",
  "contactEmail": "dispatch@atlantique-transport.test"
}
```

### Success: `201 Created`

Returns the complete created company, wrapped as `{ "data": ... }`, with both contact fields populated from the trimmed submission.

## PATCH `/api/v1/transport-companies/:id`

Updates the mutable information of one transport company: its name and its contact details. `:id` is the company's stable UUID.

### Request

```json
{
  "name": "Atlantique Transport Routier",
  "contactPhone": "+33 2 40 12 34 56",
  "contactEmail": "dispatch@atlantique-transport.test"
}
```

Updating a company that currently has no contact details recorded requires supplying both, exactly like any other update (FR-018).

### Success: `200 OK`

Returns the complete updated company, so the caller needs no follow-up read.

Guarantees on success:

- `id`, `status`, `createdAt`, and every archive and reactivation field are identical to their values before the request.
- `name`, `contactPhone`, and `contactEmail` are the submitted values with surrounding whitespace removed.
- `updatedAt` is refreshed, including when every submitted value equals its stored counterpart.
- Submitting the company's own current name is a success, not a conflict.
- Submitting a phone number or email address already used by another company is a success — contact details carry no uniqueness rule (FR-014).

## Failures

Both endpoints share the same failure vocabulary; `404` and `409 ARCHIVED` apply to `PATCH` only.

| Situation | Status | Error code |
|---|---:|---|
| Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS` |
| User access is no longer active | `401` | Rejected by authentication middleware |
| Authenticated user without an administration role | `403` | `E_AUTHORIZATION_FAILURE` |
| Missing, blank, or over-long `name` | `422` | `E_VALIDATION_ERROR` |
| Missing, blank, malformed, or over-long `contactPhone` | `422` | `E_VALIDATION_ERROR` |
| Missing, blank, malformed, or over-long `contactEmail` | `422` | `E_VALIDATION_ERROR` |
| Invalid name reaching the domain directly | `422` | `E_SITE_REFERENCE_NAME_INVALID` |
| Invalid phone reaching the domain directly | `422` | `E_TRANSPORT_COMPANY_CONTACT_PHONE_INVALID` |
| Invalid email reaching the domain directly | `422` | `E_TRANSPORT_COMPANY_CONTACT_EMAIL_INVALID` |
| No company with this id (`PATCH`) | `404` | `E_TRANSPORT_COMPANY_NOT_FOUND` |
| Company is archived (`PATCH`) | `409` | `E_TRANSPORT_COMPANY_ARCHIVED` |
| Name already used by another company | `409` | `E_TRANSPORT_COMPANY_NAME_CONFLICT` |
| Unexpected persistence/service failure | `5xx` | Standard API error envelope |

Every failure leaves the stored company byte-for-byte unchanged, including any contact details recorded before the attempt (FR-013).

Validation failures use the framework's standard field-error envelope, and **report every offending field at once** (FR-012), so the web form can attach a message to each input:

```json
{
  "error": {
    "code": "E_VALIDATION_ERROR",
    "message": "Validation failure",
    "details": [
      { "field": "contactPhone", "rule": "phoneNumber", "message": "The contactPhone field must be a valid phone number" },
      { "field": "contactEmail", "rule": "email", "message": "The contactEmail field must be a valid email address" }
    ]
  }
}
```

Domain conflicts keep the flat error envelope:

```json
{
  "error": {
    "code": "E_TRANSPORT_COMPANY_NAME_CONFLICT",
    "message": "Transport company name is already in use"
  }
}
```

## Ordering of checks

Unchanged from the delivered update contract, and still observable:

1. Authentication middleware — `401` before anything else is read.
2. `TransportCompanyPolicy.create` / `.update` — `403` before the body is validated, so an unauthorized caller learns nothing about validity.
3. Vine validator — `422` before any row is read, reporting all offending fields together.
4. Repository conditional write — `404` / `409 ARCHIVED` / `409 NAME_CONFLICT`.

A non-administrator submitting a malformed phone number for an archived company receives `403`.

## Unchanged endpoints

`GET /api/v1/transport-companies` and `GET /api/v1/transport-companies/available` keep their paths, parameters, authorization, ordering, and filtering. Their payloads gain the two fields described above and nothing else.
