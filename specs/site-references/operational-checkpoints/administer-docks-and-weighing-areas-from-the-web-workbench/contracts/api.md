# API Contract: Operational Checkpoints Workbench

All endpoints are authenticated, live under `/api/v1`, use the shared `{ data: ... }` success envelope, and use the shared `{ error: { code, message, details?, meta? } }` error envelope. Dock and Weighing Area remain distinct named resources in Tuyau.

## Dock endpoints

| Method | Path | Authorization | Request | Success |
|---|---|---|---|---|
| GET | `/docks` | active user | none | `200`, all docks including archived |
| GET | `/docks/available` | active user | none | `200`, available docks only |
| GET | `/docks/:id` | active user | none | `200`, one existing dock |
| POST | `/docks` | organization/operations admin | `{ name, latitude, longitude }` | `201`, created dock at version `1` |
| PATCH | `/docks/:id` | organization/operations admin | `{ expectedVersion, name?, latitude?, longitude? }` with at least one editable field | `200`, updated dock with incremented version |
| POST | `/docks/:id/archive` | organization/operations admin | `{ expectedVersion, comment? }` | `200`, archived dock with incremented version |
| POST | `/docks/:id/reactivate` | organization/operations admin | `{ expectedVersion, comment? }` | `200`, available dock with incremented version |
| POST | `/docks/archive` | organization/operations admin | `{ items: { id, expectedVersion }[], comment? }` | `200`, `{ updatedDocks, blockedDocks }` |
| POST | `/docks/reactivate` | organization/operations admin | `{ items: { id, expectedVersion }[], comment? }` | `200`, `{ updatedDocks, blockedDocks }` |

## Weighing Area endpoints

| Method | Path | Authorization | Request | Success |
|---|---|---|---|---|
| GET | `/weighing-areas` | active user | none | `200`, all weighing areas including archived |
| GET | `/weighing-areas/available` | active user | none | `200`, available weighing areas only |
| GET | `/weighing-areas/:id` | active user | none | `200`, one existing weighing area |
| POST | `/weighing-areas` | organization/operations admin | `{ name, latitude, longitude }` | `201`, created weighing area at version `1` |
| PATCH | `/weighing-areas/:id` | organization/operations admin | `{ expectedVersion, name?, latitude?, longitude? }` with at least one editable field | `200`, updated area with incremented version |
| POST | `/weighing-areas/:id/archive` | organization/operations admin | `{ expectedVersion, comment? }` | `200`, archived area with incremented version |
| POST | `/weighing-areas/:id/reactivate` | organization/operations admin | `{ expectedVersion, comment? }` | `200`, available area with incremented version |
| POST | `/weighing-areas/archive` | organization/operations admin | `{ items: { id, expectedVersion }[], comment? }` | `200`, `{ updatedWeighingAreas, blockedWeighingAreas }` |
| POST | `/weighing-areas/reactivate` | organization/operations admin | `{ items: { id, expectedVersion }[], comment? }` | `200`, `{ updatedWeighingAreas, blockedWeighingAreas }` |

The workbench reads individual details from the named list payloads and does not depend on
the existing single-resource GET endpoints. Static grouped mutation paths are registered
before all existing `/:id` paths.

## Resource DTOs

Both named resource DTOs expose:

```text
id, name, latitude, longitude, status, version,
archivedAt, archivedByUserId, archivedBy, archiveComment,
reactivatedAt, reactivatedByUserId, reactivatedBy, reactivationComment,
createdAt, updatedAt
```

`archivedBy` and `reactivatedBy` are nullable user-summary DTOs. `version` is the opaque optimistic-concurrency value the client echoes for a later mutation.

## Grouped results

Grouped endpoints return `200` even when all or part of the selection is blocked. Eligible resources are committed; blocked resources are unchanged. Each result array preserves the relative request order of its members.

Each blocker contains:

```text
id
name?              // present when the resource exists
reason             // NOT_FOUND | STALE_VERSION | IN_USE |
                   // ALREADY_ARCHIVED | ALREADY_AVAILABLE
```

Input must contain at least one item. IDs must be distinct UUIDs case-insensitively, and versions must be positive integers. Request-level validation failure is `422` and changes nothing.

## Error behavior

| Status | Applies to | Contract |
|---|---|---|
| `401` | every endpoint | Missing, expired, or inactive session |
| `403` | mutation endpoints | Authenticated active user lacks an administration role |
| `404` | individual mutation | Named resource does not exist |
| `409` | create/update | Case-insensitive name conflict within that resource type |
| `409` | update | Archived resource is read-only |
| `409` | individual archive | Planned/active discharge usage blocks archive |
| `409` | individual lifecycle | Resource is already in the requested lifecycle state |
| `409` | existing-resource mutation | Submitted version is stale; error code is resource-specific and the client must refetch before retrying |
| `422` | mutation request | Missing/blank/oversized name or comment, malformed/out-of-range coordinate, invalid version, empty/duplicate grouped items, or update without an editable field |

The stale codes are `E_DOCK_STALE_VERSION` and `E_WEIGHING_AREA_STALE_VERSION`. They do not return a replacement version token. A stale mutation never changes name, coordinates, status, lifecycle metadata, `updatedAt`, or `version`.

Name conflicts remain separate: `E_DOCK_NAME_CONFLICT` and `E_WEIGHING_AREA_NAME_CONFLICT`. No cross-resource conflict exists when a dock and weighing area share the same normalized name.
