# Contract: Dock Update API

**Feature**: [../spec.md](../spec.md) | **Status**: Already implemented; documented here as the
contract the frontend builds against. **No production backend change is made by this feature.**

## Endpoint

```
PATCH /api/v1/docks/:id
```

Registered at `apps/api/start/routes.ts:55`, handled by `DocksController.update`
(`apps/api/app/controllers/docks_controller.ts`).

**Authentication**: session (`auth.use('web')`). `auth_middleware.ts:58` rejects any user whose
`accessStatus !== 'ACTIVE'` before the controller runs — this, not the policy, is what satisfies
FR-002's "not active" clause.

**Authorization**: `DockPolicy.update` — `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.

## Request

All three fields are optional individually, but at least one must be present. When a key **is**
present it must be valid (`requiredWhen` on each field), so `{ "name": "" }` is a 422 rather than
an ignored no-op. The web client always sends all three (research D11).

```json
{
  "name": "North Dock",
  "latitude": 46.1591,
  "longitude": -1.2264
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | string, optional | non-blank after trim, 1–255 chars. Required if both coordinates are absent |
| `latitude` | number, optional | -90 ≤ v ≤ 90 |
| `longitude` | number, optional | -180 ≤ v ≤ 180 |

## Responses

### 200 — updated

Body is the standard serialized dock (`DockTransformer`), identical in shape to the create and list
responses.

```json
{
  "data": {
    "id": "…", "name": "North Dock", "latitude": 46.1591, "longitude": -1.2264,
    "status": "AVAILABLE",
    "archivedAt": null, "archivedByUserId": null, "archiveComment": null,
    "reactivatedAt": null, "reactivatedByUserId": null, "reactivationComment": null,
    "createdAt": "…", "updatedAt": "…"
  }
}
```

`id`, `status`, `createdAt`, and every lifecycle field are unchanged from before the request.
`updatedAt` is advanced.

### Failure responses

| Status | `error.code` | Cause |
|---|---|---|
| 401 | `E_UNAUTHORIZED_ACCESS` | Not authenticated, or authenticated but not `ACTIVE` |
| 403 | `E_AUTHORIZATION_FAILURE` | Active user without an administrator role |
| 404 | `E_DOCK_NOT_FOUND` | No dock with that id |
| 409 | `E_DOCK_NAME_CONFLICT` | Resulting name collides with another dock, case-insensitively, **including an archived one** |
| 409 | `E_DOCK_ARCHIVED` | The target dock is archived; reactivation (#201) is required first |
| 422 | `E_VALIDATION_ERROR` | Empty body, blank/over-long name, non-numeric or out-of-range coordinate. `error.details[]` carries `{ field, message, rule }` |

## Requirement-to-test mapping

Existing coverage in `apps/api/tests/integration/docks.spec.ts` and
`apps/api/tests/unit/docks/dock_use_cases.spec.ts`:

| Behavior | Spec | Covered today? |
|---|---|---|
| Unauthenticated → 401, unauthorized → 403 | FR-002 | ✅ `rejects unauthenticated and unauthorized dock updates` |
| Happy path, trims name, partial body, preserves id | FR-001, FR-004, FR-009, FR-015 | ✅ `updates a dock while preserving its identity` |
| Empty body / blank name / empty coordinate → 422 `required` | FR-004, FR-007 | ✅ `rejects empty dock updates with the shared validation envelope` |
| Blank name / illegal coordinate at use-case level | FR-007, FR-012 | ✅ `rejects empty names and illegal coordinates during updates` |
| **Duplicate name → 409 `E_DOCK_NAME_CONFLICT`** | FR-010 | ❌ **gap** |
| **Duplicate against an archived dock's name** | FR-010 | ❌ **gap** |
| **Own current name resubmitted → 200, not a duplicate** | FR-011 | ❌ **gap** |
| **Archived dock → 409 `E_DOCK_ARCHIVED`** | FR-013 | ❌ **gap** |
| **Unknown id → 404 `E_DOCK_NOT_FOUND`** | FR-014 | ❌ **gap** |
| **Out-of-range coordinate over HTTP → 422 (`min`/`max`, not `required`)** | FR-012 | ❌ **gap** |
| **Boundary coordinates ±90 / ±180 accepted** | FR-012, edge case | ❌ **gap** |

The seven gaps are this slice's backend work. They test behavior that already exists, so most will
go GREEN immediately — write each one before running it, and treat any that does **not** pass as a
real defect found rather than a test to adjust.

## What this contract does not do

- No optimistic locking, version, or `If-Match`; concurrent updates are last-write-wins
  (research D6).
- No usage check: a dock referenced by a planned or active discharge is still updatable
  (research D8). `E_DOCK_IN_USE` exists but belongs to archival (#200).
- No status change: `status`, `archivedAt`, `reactivatedAt` and their companions are not accepted in
  the body and are not written.
