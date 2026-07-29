# API Contract: Customer Workbench

All endpoints are under `/api/v1/customers` and use the shared serialized `{ data: ... }` success envelope and shared error envelope.

| Method | Path | Authorization | Request | Success |
|---|---|---|---|---|
| GET | `/` | active user | none | all customers, including archived |
| GET | `/available` | active user | none | available customers only |
| POST | `/` | organization/operations admin | `{ code, companyName }` | `201`, created customer |
| PATCH | `/:id` | organization/operations admin | one or both of `code`, `companyName` | `200`, updated customer |
| POST | `/:id/archive` | organization/operations admin | optional `{ comment }` | `200`, archived customer |
| POST | `/:id/reactivate` | organization/operations admin | optional `{ comment }` | `200`, available customer |
| POST | `/archive` | organization/operations admin | `{ ids: UUID[], comment? }` | `200`, `{ updatedCustomers, blockedCustomers }`; eligible records are committed even when blockers exist |
| POST | `/reactivate` | organization/operations admin | `{ ids: UUID[], comment? }` | `200`, `{ updatedCustomers, blockedCustomers }`; eligible records are committed even when blockers exist |

Bulk lifecycle requests return `200` even when the selection is mixed: eligible records are changed and blocked records remain unchanged. `updatedCustomers` and `blockedCustomers` preserve request order within each array. Each blocker includes the selected ID, available identifying labels where known, and exactly one reason: `NOT_FOUND`, `IN_USE`, `ALREADY_ARCHIVED`, or `ALREADY_AVAILABLE`. Malformed input (including duplicate IDs) is `422`; authentication is `401`; authorization is `403`; individual duplicate and lifecycle conflicts use the established `409` domain errors. The API must not encode a mixed bulk result as a single request-level failure.
