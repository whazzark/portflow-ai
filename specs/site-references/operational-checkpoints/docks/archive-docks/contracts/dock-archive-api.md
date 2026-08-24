# Contract: Dock Archive API

**Feature**: [../spec.md](../spec.md) | **Status**: Individual endpoint already implemented and
unit-tested; documented here as the contract the frontend builds against, with the gap this slice
closes (HTTP-level tests). Bulk endpoint is entirely new.

## Endpoint 1 — Archive one dock

```
POST /api/v1/docks/:id/archive
```

Registered at `apps/api/start/routes.ts` (existing), handled by `DocksController.archive`
(existing, unchanged).

**Authentication**: session (`auth.use('web')`). `auth_middleware.ts` rejects any user whose
`accessStatus !== 'ACTIVE'` before the controller runs.

**Authorization**: `DockPolicy.archive` — `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.

### Request

```json
{ "comment": "Quay closed for resurfacing" }
```

| Field | Type | Rules |
|---|---|---|
| `comment` | string, optional, nullable | trimmed; empty/whitespace-only stored as `null` |

### Responses

**200 — archived.** Body is the standard serialized dock (`DockTransformer`):

```json
{
  "data": {
    "id": "…", "name": "North Dock", "latitude": 46.1591, "longitude": -1.2264,
    "status": "ARCHIVED",
    "archivedAt": "2026-08-24T10:00:00.000+00:00", "archivedByUserId": "…", "archiveComment": "Quay closed for resurfacing",
    "reactivatedAt": null, "reactivatedByUserId": null, "reactivationComment": null,
    "createdAt": "…", "updatedAt": "…"
  }
}
```

| Status | `error.code` | Cause |
|---|---|---|
| 401 | `E_UNAUTHORIZED_ACCESS` | Not authenticated, or authenticated but not `ACTIVE` |
| 403 | `E_AUTHORIZATION_FAILURE` | Active user without an administrator role |
| 404 | `E_DOCK_NOT_FOUND` | No dock with that id |
| 409 | `E_DOCK_IN_USE` | The dock is the current dock of a Planned or Active discharge |
| 409 | `E_DOCK_ALREADY_ARCHIVED` | The dock is already `ARCHIVED` |
| 422 | `E_VALIDATION_ERROR` | `comment` present but not a string |

## Endpoint 2 — Archive a selection of docks

```
POST /api/v1/docks/archive
```

**New.** Registered in `apps/api/start/routes.ts` inside the `docks` group, **before** `/:id/archive`
(matching the Customer group's ordering), handled by a new `DocksController.archiveMany`.

**Authentication / Authorization**: identical to Endpoint 1 (`DockPolicy.archive` — no separate
"bulk" policy action).

### Request

```json
{ "ids": ["11111111-…", "22222222-…"], "comment": "Site reorganization" }
```

| Field | Type | Rules |
|---|---|---|
| `ids` | string[] | non-empty; each a UUID; case-insensitively distinct. Any violation rejects the **whole** request (422) before any dock is read |
| `comment` | string, optional, nullable | trimmed, ≤1000 chars; applied to every dock this request archives |

### Responses

**200 — processed** (partial success is still a 200; the response body carries the per-dock
outcome):

```json
{
  "data": {
    "updatedDocks": [
      { "id": "11111111-…", "name": "North Dock", "status": "ARCHIVED", "archiveComment": "Site reorganization", "...": "..." }
    ],
    "blockedDocks": [
      { "id": "22222222-…", "name": "South Dock", "reason": "IN_USE" }
    ]
  }
}
```

`updatedDocks` uses the full `DockTransformer` shape (same as endpoint 1's `data`).
`blockedDocks[].reason` is exactly one of `NOT_FOUND` | `IN_USE` | `ALREADY_ARCHIVED`.
Both lists preserve request order (see `data-model.md`).

| Status | `error.code` | Cause |
|---|---|---|
| 401 | `E_UNAUTHORIZED_ACCESS` | Not authenticated, or authenticated but not `ACTIVE` |
| 403 | `E_AUTHORIZATION_FAILURE` | Active user without an administrator role |
| 422 | `E_VALIDATION_ERROR` | `ids` empty, missing, containing a non-UUID entry, or containing a duplicate (case-insensitive); `comment` over 1000 chars |

A malformed or duplicate id in the array is a whole-request 422, never a per-item `NOT_FOUND` or a
silently dropped entry (spec FR-004, FR-005). A syntactically valid but non-existent id **is** a
per-item `NOT_FOUND` blocker inside a 200 (spec FR-009) — the distinction is "is this a valid
request" (422) versus "does every valid id resolve" (200 with blockers).

## Requirement-to-test mapping

| Behavior | Spec | Covered today? |
|---|---|---|
| Individual: happy path, comment trimmed/stored, lifecycle metadata | FR-001, FR-011, FR-012, FR-013 | ✅ unit (`dock_use_cases.spec.ts`) — ❌ **no HTTP-level test** |
| Individual: already-archived → 409 | FR-007 | ✅ unit — ❌ **no HTTP-level test** |
| Individual: in-use → 409 | FR-008 | ✅ unit — ❌ **no HTTP-level test** |
| Individual: not-found → 404 | FR-009 | ✅ unit — ❌ **no HTTP-level test** |
| Individual: unauthenticated/unauthorized | FR-003 | ✅ HTTP-level (`docks.spec.ts` line ~356) |
| **Bulk: happy path, shared comment applied to every archived dock** | FR-002, FR-011 | ❌ **gap — net new** |
| **Bulk: mixed selection → partial success with all three reasons, in request order** | FR-010 | ❌ **gap — net new** |
| **Bulk: empty selection → 422, zero docks touched** | FR-004 | ❌ **gap — net new** |
| **Bulk: duplicate id (incl. case-differing) → 422, zero docks touched** | FR-005 | ❌ **gap — net new** |
| **Bulk: malformed id → 422, zero docks touched** | FR-005 | ❌ **gap — net new** |
| **Bulk: unauthenticated → 401, unauthorized → 403** | FR-003 | ❌ **gap — net new** |
| **Bulk: concurrent overlapping requests for the same dock → exactly one archive** | FR-016 | ❌ **gap — net new** |
| **Bulk: resubmitting the reduced selection after a partial success does not re-touch already-archived docks** | FR-018 | ❌ **gap — net new** |

The individual-path gaps are small (HTTP-level top-up on already-correct behavior, same category as
#199's five gaps). The bulk-path rows are this slice's primary backend deliverable, built to the
same requirement set the Customer bulk-archive suite already proves out.

## What this contract does not do

- No bulk *reactivate* endpoint (`POST /docks/reactivate`) — that is #201's contract to define.
- No optimistic locking on either endpoint; concurrency is resolved by row locking inside the
  transaction (research D5), not by a version/If-Match header.
- No change to `PATCH /api/v1/docks/:id` or `POST /api/v1/docks/:id/reactivate` — both are
  untouched by this feature.
