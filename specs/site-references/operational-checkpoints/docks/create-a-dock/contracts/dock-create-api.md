# Dock Create API Contract (existing, unmodified)

This documents the endpoint this feature's UI calls. It already exists in
`apps/api/app/controllers/docks_controller.ts` (`store` action), is already routed, already
authorized, already validated, and is already covered by
`apps/api/tests/integration/docks.spec.ts` and `apps/api/tests/unit/docks/*.spec.ts`. No backend
change is part of this feature; this file exists for traceability between spec.md's requirements
and the implementation, not as a new contract to build.

## `POST /api/v1/docks`

Requires an authenticated, active user whose role is `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`
(`DockPolicy#create`).

**Request body**

```json
{
  "name": "string, required, trimmed non-blank, max 255 chars",
  "latitude": "number, required, -90..90",
  "longitude": "number, required, -180..180"
}
```

**Responses**

| Status | Condition | Body |
|---|---|---|
| 201 | Created | `{ "data": Dock }` — see field table below; `status` is always `"AVAILABLE"` |
| 401 | No authenticated session | `{ "error": { "code": "E_UNAUTHORIZED_ACCESS", "message": "..." } }` |
| 403 | Authenticated but not an administrator | `{ "error": { "code": "E_AUTHORIZATION_FAILURE", "message": "..." } }` |
| 422 | Blank name, name >255 chars, or latitude/longitude missing, non-numeric, or out of range | `{ "error": { "code": "E_VALIDATION_ERROR", "message": "...", "details": [{ "field": "name" \| "latitude" \| "longitude", "rule": "...", "message": "..." }] } }` |
| 409 | Name duplicates an existing dock (case-insensitive, trimmed, any status) | `{ "error": { "code": "E_DOCK_NAME_CONFLICT", "message": "Dock name is already in use" } }` |

**Created `Dock` shape** (matches `../list-docks/contracts/docks.openapi.yaml`'s `Dock` schema):
`id`, `name`, `latitude`, `longitude`, `status` (`"AVAILABLE"`), `createdAt`, `updatedAt`. The
integration test additionally documents that only these seven keys are present on the response
(`archivedAt`, `archivedByUserId`, `archiveComment`, `reactivatedAt`, `reactivatedByUserId`,
`reactivationComment` are included as `null` per the shared `Dock` schema, present but empty).

## Mapping to spec.md requirements

Note: the client determines `latitude`/`longitude` from the map-placement flow (spec FR-002,
FR-003); the API itself is location-source-agnostic and only validates the numbers it receives.

| spec.md requirement | Enforced by (existing code) |
|---|---|
| FR-001, FR-005 (authorized creation / refuse unauthorized) | `DocksController#store` + `DockPolicy#create` — 401/403 as documented above |
| FR-006, FR-007 (name blank/whitespace, trim) | `createDockValidator` (`nonBlank`) + `CreateDockUseCase`/`assertValidSiteReferenceName` |
| FR-008 (duplicate name, case-insensitive, cross-status) | DB unique index `docks_name_unique ON docks (LOWER(name))` + `DuplicateDockNameException` |
| FR-009 (coordinate range, incl. manually-edited values) | `createDockValidator` (`vine.number().min().max()`) |
| FR-010 (always `AVAILABLE`, no client-set status) | `LucidDockRepository#create` hardcodes `status: 'AVAILABLE'`; request body has no `status` field |
| FR-011 (creation time recorded, final pending coordinates used, immediately listable) | `createdAt` column; request body carries whatever coordinates the client's Pending Dock Placement held at submit time; `GET /api/v1/docks` already includes all docks ordered by name |
| FR-013 (no dock created on failed/partial submission) | Single-statement insert; VineJS/policy rejections happen before any write |
