# HTTP Contract: Truck Consultation

Both endpoints are under the existing `/api/v1` authenticated route group, use the session cookie guard, and wrap successful data as `{ "data": ... }`. The named Tuyau routes are `trucks.index` for the administrator-only complete collection and `trucks.available` for the available-only collection accessible to every active user. This matches the established Docks and Weighing Areas structure.

## Truck representation

```json
{
  "id": "1a2664cb-d2c8-4cd4-b214-0cc5f9b25bd3",
  "registration": "AB-123-CD",
  "vehicleModel": "Volvo FMX",
  "capacityTonnes": 32.5,
  "transportCompanyId": "7f6c138c-8b9f-4e1b-b1a0-fc520cfb7351",
  "status": "ARCHIVED",
  "archivedAt": "2026-07-20T14:32:11.000Z",
  "archivedByUserId": "5d84a420-0c0d-4cb4-8fc5-809944cc2729",
  "archivedBy": {
    "id": "5d84a420-0c0d-4cb4-8fc5-809944cc2729",
    "firstName": "Claire",
    "lastName": "Martin"
  },
  "archiveComment": "Vehicle retired from the fleet",
  "reactivatedAt": null,
  "reactivatedByUserId": null,
  "reactivatedBy": null,
  "reactivationComment": null,
  "createdAt": "2026-01-12T09:00:00.000Z",
  "updatedAt": "2026-07-20T14:32:11.000Z"
}
```

Rules:

- `id`, `registration`, `capacityTonnes`, `transportCompanyId`, `status`, `createdAt`, and `updatedAt` are always present.
- `vehicleModel` is a string when recorded and `null` otherwise.
- `capacityTonnes` is a positive JSON number with up to three fractional digits. The transformer normalizes the database numeric representation so the type does not vary between runtime and test storage.
- `transportCompanyId` identifies the truck's current transport company. Company name and status are resolved from the transport-company collection.
- Truck and transport-company statuses are independent. An archived truck may reference an archived company without losing the relationship.
- Truck `status` and company `status` are each exactly `AVAILABLE` or `ARCHIVED`.
- `archivedAt` is present for every `ARCHIVED` truck. It may be null for an available truck that has never been archived.
- Reactivation timestamps, actor IDs, actor summaries, and comments are nullable; archive actor IDs, summaries, and comments are also nullable.
- An unavailable lifecycle actor is represented by `null`; the API never invents an actor label.
- Collection order is case-insensitive registration ascending, then stored registration ascending, then `id` ascending.

## GET `/api/v1/trucks`

Returns the authoritative complete truck consultation collection, including available and archived trucks with each truck's current transport company.

- Only active `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` users may call this endpoint.
- The response contains every `AVAILABLE` and `ARCHIVED` truck.
- Other active roles receive `403 Forbidden` without truck, company, lifecycle, or aggregate data.

There are no request parameters. Administrator lifecycle tabs, counts, registration/company search, and selected details are derived from this response by the web application.

### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "57921e35-b19a-4719-b734-98c07cc99e7f",
      "registration": "AA-001-AA",
      "vehicleModel": null,
      "capacityTonnes": 28.75,
      "transportCompanyId": "bb7d91e7-b86f-4fd4-9583-10d5cb36c2aa",
      "status": "AVAILABLE",
      "archivedAt": null,
      "archivedByUserId": null,
      "archivedBy": null,
      "archiveComment": null,
      "reactivatedAt": null,
      "reactivatedByUserId": null,
      "reactivatedBy": null,
      "reactivationComment": null,
      "createdAt": "2026-07-01T08:00:00.000Z",
      "updatedAt": "2026-07-01T08:00:00.000Z"
    }
  ]
}
```

An empty collection returns `200 OK` with `{ "data": [] }`.

## GET `/api/v1/trucks/available`

Returns the authoritative available-only truck collection with each truck's current transport company.

- Every active authenticated role may call this endpoint.
- The repository query returns only trucks whose current status is `AVAILABLE`; archived rows and archived aggregates are never serialized.
- The response uses the same Truck representation and deterministic ordering as `trucks.index`.

There are no request parameters. Non-administrator available count, search, and selected details are derived from this response by the web application. An empty collection returns `200 OK` with `{ "data": [] }`.

## Authorization and failures

| Endpoint | Situation | Status | Response behavior |
|---|---|---:|---|
| Both | Missing or expired session | `401` | `E_UNAUTHORIZED_ACCESS`; no truck or company data |
| Both | User access is no longer active | `401` | Session is rejected by authentication middleware; no truck or company data |
| `trucks.index` | Active `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN` | `200` | Available and archived trucks are returned |
| `trucks.index` | Active `OPERATIONS_LEAD` or `OBSERVER` | `403` | Complete collection is denied; no truck or company data |
| `trucks.available` | Any active role | `200` | Available trucks only; no archived truck or archived aggregate |
| Both | Unexpected persistence/service failure | `5xx` | Standard API error envelope; no partial collection |

There are no endpoint-specific validation or conflict responses because the reads have no request parameters. There is no `GET /api/v1/trucks/:id` route; the selected detail resolves from the role-appropriate collection.

## Operational selection remains deferred

Issue #222 exposes `/api/v1/trucks/available` as an available-reference consultation contract but does not provide a truck-selection control or define assignment eligibility. Future operational behavior must independently define any additional eligibility rules before using this endpoint as a selector source.
