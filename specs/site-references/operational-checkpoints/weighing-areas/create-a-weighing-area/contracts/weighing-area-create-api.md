# Contract: Weighing Area Creation API

**Feature**: [spec.md](../spec.md) | **Status**: Already implemented — reused unmodified

`POST /api/v1/weighing-areas`, routed to `WeighingAreasController.store`. This document pins the
contract the new UI depends on; it describes existing behavior rather than proposing new behavior.

---

## Request

Authenticated session (web guard). Body:

```json
{ "name": "Scale A", "latitude": 48.1, "longitude": 2.3 }
```

| Field | Type | Constraint |
|---|---|---|
| `name` | string | Non-blank after trimming, 1–255 characters |
| `latitude` | number | −90 … 90 |
| `longitude` | number | −180 … 180 |

`status` is **not** an accepted field and cannot be set by the caller.

---

## Responses

### 201 Created

```json
{
  "data": {
    "id": "…", "name": "Scale A", "latitude": 48.1, "longitude": 2.3,
    "status": "AVAILABLE",
    "archivedAt": null, "archivedByUserId": null, "archiveComment": null,
    "reactivatedAt": null, "reactivatedByUserId": null, "reactivationComment": null,
    "createdAt": "…", "updatedAt": "…"
  }
}
```

`name` is returned trimmed. The DTO shape matches `weighing_areas.index`, so `WeighingAreaDto`
covers it and the created record can be handed straight to the existing selection and detail paths.

### 401 Unauthorized — `E_UNAUTHORIZED_ACCESS`

Unauthenticated, or authenticated with `accessStatus !== 'ACTIVE'` (rejected by `auth` middleware).

### 403 Forbidden — `E_AUTHORIZATION_FAILURE`

Authenticated and active, but not `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`.

### 422 Unprocessable — `E_VALIDATION_ERROR`

```json
{ "error": { "code": "E_VALIDATION_ERROR", "message": "…",
  "details": [{ "field": "name", "rule": "required", "message": "…" }] } }
```

Returned for a blank/whitespace-only name, a name over 255 characters, a missing or non-numeric
coordinate, or a coordinate outside its range. `applyValidationError` maps `details[].field` onto
the matching form field.

### 409 Conflict — `E_WEIGHING_AREA_NAME_CONFLICT`

```json
{ "error": { "code": "E_WEIGHING_AREA_NAME_CONFLICT", "message": "Weighing area name is already in use" } }
```

Returned when the trimmed name matches an existing weighing area case-insensitively, whether that
area is Available or Archived. **The form keys its inline name-field conflict message on this exact
code**, mirroring how `dock-form.tsx` keys on `E_DOCK_NAME_CONFLICT`.

---

## Requirement mapping

| Requirement | Enforced by | Existing test |
|---|---|---|
| FR-005 unauthenticated / inactive refused | `auth` middleware | `weighing_areas.spec.ts` — "rejects unauthenticated and unauthorized creation" |
| FR-005 unpermitted role refused | `WeighingAreaPolicy.create` | same test (observer → 403); `weighing_area_policy.spec.ts` |
| FR-006 blank name rejected | `nonBlank()` + `assertValidSiteReferenceName` | `weighing_areas.spec.ts` — "rejects whitespace-only names during creation…"; `weighing_area_use_cases.spec.ts` — "rejects empty names and illegal coordinates during creation" |
| FR-007 name trimmed | `normalizeSiteReferenceName` | `weighing_areas.spec.ts` — `"  Scale A  "` → `"Scale A"` |
| FR-008 duplicate rejected across statuses, case-insensitively | `LOWER(name)` unique index → `DUPLICATE_NAME` → 409 | `weighing_area_use_cases.spec.ts` — "enforces normalized uniqueness across available and archived areas" |
| FR-009 uniqueness independent of docks | Per-table index; no cross-table lookup exists | Structural (separate tables/indexes) |
| FR-010 coordinate range | Validator + use case asserts + DB CHECK | `weighing_area_use_cases.spec.ts` — creation and boundary cases |
| FR-011 auto `AVAILABLE` | Repository hard-codes it; command type has no `status` | `weighing_area_use_cases.spec.ts` — "creates a normalized area with legal boundary coordinates" |
| FR-012 creation time recorded | Lucid `createdAt`, serialized by the transformer | DTO key assertion in `weighing_areas.spec.ts` |
| SC-005 concurrent duplicates | Unique index; second insert raises a unique violation | Covered structurally by the index; unit test proves the mapping |

---

## Recommended addition (small)

No backend behavior change is needed. One integration test is recommended, because the UI now
depends on a mapping that is currently only proven at the use-case level:

> `POST /api/v1/weighing-areas` with a name that duplicates an existing area (differing by case and
> surrounding whitespace) responds **409** with `error.code === 'E_WEIGHING_AREA_NAME_CONFLICT'`,
> and no second area is persisted.

Add it to `apps/api/tests/integration/weighing_areas.spec.ts`. If it is skipped, the frontend
conflict path is still covered by an MSW-stubbed test, but the client/server agreement on the code
string stays unpinned.
