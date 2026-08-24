# Contract: Dock Reactivate API

**Feature**: [../spec.md](../spec.md) | **Status**: Individual endpoint already implemented, and
covered at use-case level plus two HTTP tests; documented here as the contract the frontend builds
against, with the coverage gaps this slice closes. Bulk endpoint is entirely new.

## Endpoint 1 — Reactivate one dock

```
POST /api/v1/docks/:id/reactivate
```

Registered at `apps/api/start/routes.ts` (existing), handled by `DocksController.reactivate`
(existing, unchanged).

**Authentication**: session (`auth.use('web')`). `auth_middleware.ts` rejects any user whose
`accessStatus !== 'ACTIVE'` before the controller runs.

**Authorization**: `DockPolicy.reactivate` — `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.

### Request

```json
{ "comment": "Quay reopened after resurfacing" }
```

| Field | Type | Rules |
|---|---|---|
| `comment` | string, optional, nullable | trimmed; empty/whitespace-only stored as `null` |

### Responses

**200 — reactivated.** Body is the standard serialized dock (`DockTransformer`), with the archive
metadata preserved alongside the new reactivation metadata:

```json
{
  "data": {
    "id": "…", "name": "North Dock", "latitude": 46.1591, "longitude": -1.2264,
    "status": "AVAILABLE",
    "archivedAt": "2026-08-20T10:00:00.000+00:00", "archivedByUserId": "…", "archiveComment": "Quay closed for resurfacing",
    "reactivatedAt": "2026-08-24T10:00:00.000+00:00", "reactivatedByUserId": "…", "reactivationComment": "Quay reopened after resurfacing",
    "createdAt": "…", "updatedAt": "…"
  }
}
```

| Status | `error.code` | Cause |
|---|---|---|
| 401 | `E_UNAUTHORIZED_ACCESS` | Not authenticated, or authenticated but not `ACTIVE` |
| 403 | `E_AUTHORIZATION_FAILURE` | Active user without an administrator role |
| 404 | `E_DOCK_NOT_FOUND` | No dock with that id |
| 409 | `E_DOCK_ALREADY_AVAILABLE` | The dock is already `AVAILABLE` |
| 422 | `E_VALIDATION_ERROR` | `comment` present but not a string |

## Endpoint 2 — Reactivate a selection of docks

```
POST /api/v1/docks/reactivate
```

**New.** Registered in `apps/api/start/routes.ts` inside the `docks` group, **before**
`/:id/reactivate` (matching the ordering already used for `/archive` and the Customer group),
handled by a new `DocksController.reactivateMany`. Route name: `docks.reactivate_many`, surfacing
in the generated Tuyau registry as `tuyauQuery.docks.reactivateMany`.

**Authentication / Authorization**: identical to Endpoint 1 (`DockPolicy.reactivate` — no separate
"bulk" policy action).

### Request

```json
{ "ids": ["11111111-…", "22222222-…"], "comment": "Quay reopened" }
```

| Field | Type | Rules |
|---|---|---|
| `ids` | string[] | non-empty; each a UUID; case-insensitively distinct. Any violation rejects the **whole** request (422) before any dock is read |
| `comment` | string, optional, nullable | trimmed, ≤1000 chars; applied to every dock this request reactivates, and to no other |

### Responses

**200 — applied, with partial success.** Every validated id appears in exactly one of the two lists,
both in request order:

```json
{
  "data": {
    "updatedDocks": [ { "id": "…", "status": "AVAILABLE", "reactivatedAt": "…", "…": "…" } ],
    "blockedDocks": [
      { "id": "22222222-…", "name": "South Dock", "reason": "ALREADY_AVAILABLE" },
      { "id": "33333333-…", "reason": "NOT_FOUND" }
    ]
  }
}
```

A request in which *every* id is blocked still returns 200 with an empty `updatedDocks` — it is not
an error, and it is not treated as an empty selection (spec Edge Cases).

| Status | `error.code` | Cause |
|---|---|---|
| 200 | — | Applied; see `blockedDocks` for per-dock outcomes |
| 401 | `E_UNAUTHORIZED_ACCESS` | Not authenticated, or authenticated but not `ACTIVE` |
| 403 | `E_AUTHORIZATION_FAILURE` | Active user without an administrator role |
| 422 | `E_VALIDATION_ERROR` | `ids` missing, empty, containing a non-UUID, or containing a duplicate (case-insensitive); `comment` longer than 1000 characters or not a string |

**Blocker reasons produced by this endpoint**: `NOT_FOUND`, `ALREADY_AVAILABLE`. `IN_USE` and
`ALREADY_ARCHIVED` are part of the shared `BulkDockLifecycleBlocker` union but are unreachable on
the reactivation path (see [../data-model.md](../data-model.md)).

**Atomicity**: the whole request runs in one transaction with `SELECT … FOR UPDATE` over the
requested ids. Blocked docks are computed inside that transaction, so a dock reactivated by a
concurrent request between selection and submission is reported `ALREADY_AVAILABLE` rather than
reactivated twice (spec FR-016). If the guarded `UPDATE` affects a different number of rows than the
eligible set, the transaction fails rather than returning a partially wrong outcome, and the client
sees a retryable failure with nothing changed.

## Requirement-to-test mapping

| Requirement | Where verified | Status |
|---|---|---|
| FR-001 individual reactivation | `tests/unit/docks/dock_use_cases.spec.ts`, `tests/integration/docks.spec.ts` | already covered |
| FR-002 bulk reactivation | `tests/unit/docks/lifecycle/bulk_reactivate.spec.ts`, `tests/integration/docks/lifecycle/bulk/reactivate.spec.ts` | **net new** |
| FR-003 authorization (both scopes) | `tests/unit/docks/dock_policy.spec.ts` (already), `tests/integration/docks.spec.ts` (individual, already), bulk cases in the new integration spec | partly new |
| FR-003 non-active user refused | `tests/integration/docks.spec.ts` | **net new** |
| FR-004 empty selection rejected | new bulk integration spec | **net new** |
| FR-005 duplicate / malformed ids rejected in full | new bulk integration spec | **net new** |
| FR-006 eligibility = `ARCHIVED` only | `tests/unit/docks/dock_use_cases.spec.ts` (individual, already), new bulk unit spec | partly new |
| FR-007 `ALREADY_AVAILABLE` | unit already; HTTP 409 case in `tests/integration/docks.spec.ts` | partly new |
| FR-008 `NOT_FOUND` | unit already; HTTP 404 case in `tests/integration/docks.spec.ts` | partly new |
| FR-009 partial success, one reason per blocked dock | new bulk integration spec | **net new** |
| FR-010 shared optional comment, applied only to reactivated docks | individual comment case (HTTP) + new bulk specs | **net new** |
| FR-011 actor and timestamp recorded | integration happy path (already) + new bulk specs | partly new |
| FR-012 identity/name/position/creation time preserved | new bulk integration spec, individual HTTP assertion | partly new |
| FR-013 archive metadata preserved through reactivation | new bulk integration spec + individual HTTP assertion | **net new** |
| FR-014 status authoritative in consultation, no reload | `apps/web` reactivate tests | **net new** |
| FR-015 historical discharge references preserved | new bulk integration spec | **net new** |
| FR-016 concurrency → exactly one success | new bulk integration spec (overlapping selections) | **net new** |
| FR-017 outcome reporting (success / blockers / unauthorized / retryable) | new bulk integration spec + `apps/web` bulk-reactivate tests | **net new** |
| FR-018 resubmission after blockers | `apps/web` bulk-reactivate tests | **net new** |
| FR-019 server-authoritative decisions | bulk integration spec (direct requests bypassing the UI) | **net new** |
| FR-020 finding and selecting archived docks | `apps/web` bulk-reactivate select-mode tests | **net new** |
| FR-021 repeated archive/reactivate cycles | new bulk unit spec | **net new** |
| FR-022 no deletion, no archiving, no name/position change | new bulk integration spec assertions | **net new** |
