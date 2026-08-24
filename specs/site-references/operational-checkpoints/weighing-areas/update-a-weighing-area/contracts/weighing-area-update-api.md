# Contract: Weighing Area Update API

**Feature**: [../spec.md](../spec.md) | **Status**: Already implemented; documented here as the
contract the frontend builds against. **No production backend change is made by this feature.**

## Endpoint

```
PATCH /api/v1/weighing-areas/:id
```

Registered at `apps/api/start/routes.ts:70`, handled by `WeighingAreasController.update`
(`apps/api/app/controllers/weighing_areas_controller.ts`).

**Authentication**: session (`auth.use('web')`). `auth_middleware.ts` rejects any user whose
`accessStatus !== 'ACTIVE'` before the controller runs — this, not the policy, is what satisfies
FR-002's "not active" clause.

**Authorization**: `WeighingAreaPolicy.update` — `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.

## Request

All three fields are optional individually, but at least one must be present. When a key **is**
present it must be valid (`requiredWhen` on each field), so `{ "name": "" }` is a 422 rather than an
ignored no-op. The web client always sends all three (research D12).

```json
{
  "name": "North Scale",
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

Body is the standard serialized weighing area (`WeighingAreaTransformer`), identical in shape to the
create and list responses.

```json
{
  "data": {
    "id": "…", "name": "North Scale", "latitude": 46.1591, "longitude": -1.2264,
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
| 404 | `E_WEIGHING_AREA_NOT_FOUND` | No weighing area with that id |
| 409 | `E_WEIGHING_AREA_NAME_CONFLICT` | Resulting name collides with another weighing area, case-insensitively, **including an archived one** |
| 409 | `E_WEIGHING_AREA_ARCHIVED` | The target weighing area is archived; reactivation (#206) is required first |
| 422 | `E_VALIDATION_ERROR` | Empty body, blank/over-long name, non-numeric or out-of-range coordinate. `error.details[]` carries `{ field, message, rule }` |

## Requirement-to-test mapping

Existing coverage in `apps/api/tests/integration/weighing_areas.spec.ts` and
`apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts`:

| Behavior | Spec | Covered today? |
|---|---|---|
| Happy path, partial body, preserves id | FR-001, FR-004, FR-015 | ✅ inside `creates, lists, updates, archives, and reactivates an area` |
| Blank name over HTTP → 422 `required` | FR-007 | ✅ `rejects whitespace-only names during update with the shared validation envelope` |
| Blank name / illegal coordinate at use-case level | FR-007, FR-012 | ✅ `rejects empty names and illegal coordinates during updates` |
| Coordinates preserved with identity at use-case level | FR-015 | ✅ `updates coordinates while preserving identity` |
| **Unauthenticated → 401, unauthorized → 403 on update** | FR-002 | ❌ **gap** (only creation and listing are covered) |
| **Empty body `{}` → 422 `required`** | FR-004 | ❌ **gap** |
| **Name is trimmed on update, not only on create** | FR-009 | ❌ **gap** |
| **Duplicate name → 409 `E_WEIGHING_AREA_NAME_CONFLICT`** | FR-010 | ❌ **gap** |
| **Duplicate against an archived area's name, and case/whitespace-insensitively** | FR-010 | ❌ **gap** |
| **Own current name resubmitted → 200, not a duplicate** | FR-011 | ❌ **gap** |
| **Out-of-range coordinate over HTTP → 422 (`min`/`max`, not `required`)** | FR-012 | ❌ **gap** |
| **Boundary coordinates ±90 / ±180 accepted** | FR-012, edge case | ❌ **gap** |
| **Archived area → 409 `E_WEIGHING_AREA_ARCHIVED`, row unchanged** | FR-013, FR-016 | ❌ **gap** |
| **Unknown id → 404 `E_WEIGHING_AREA_NOT_FOUND`** | FR-014 | ❌ **gap** |

Ten gaps, seven at the HTTP boundary and three at the use-case level (archived, not-found, duplicate
on the update path). They are this slice's backend work. They test behavior that already exists, so
most will go GREEN immediately — write each one before running it, and treat any that does **not**
pass as a real defect found rather than a test to adjust.

## What this contract does not do

- No optimistic locking, version, or `If-Match`; concurrent updates are last-write-wins
  (research D9).
- No usage check: a weighing area referenced by a planned or active shift is still updatable
  (research D10). `E_WEIGHING_AREA_IN_USE` exists but belongs to archival (#205) — the asymmetry is
  deliberate.
- No status change: `status`, `archivedAt`, `reactivatedAt` and their companions are not accepted in
  the body and are not written.
- No item-detail read route: `GET /api/v1/weighing-areas/:id` does not exist and is asserted not to.
  The UI edits from the list collection it already holds.
