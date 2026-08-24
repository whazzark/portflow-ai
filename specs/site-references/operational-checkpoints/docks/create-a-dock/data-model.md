# Data Model: Create a Dock

No persistence changes are introduced by this feature. The `Dock` entity, its columns, its unique
index, and its check constraints already exist (`apps/api/database/migrations/1784500000000_create_docks_table.ts`)
and are unchanged. This document records the entity as it applies to creation, and the transient
UI-only form model added by this feature.

## Dock (existing, unchanged)

Persisted entity created by this feature's flow. Full field list already documented in
`../list-docks/data-model.md`; the fields relevant to creation are:

| Field | Type | Creation rule |
|---|---|---|
| `id` | UUID | Server-assigned (`randomUUID()`), not submitted by the client |
| `name` | string | Required, trimmed, 1–255 chars, unique case-insensitively across all docks regardless of status |
| `latitude` | number | Required, -90 to 90 inclusive |
| `longitude` | number | Required, -180 to 180 inclusive |
| `status` | `'AVAILABLE' \| 'ARCHIVED'` | Always `AVAILABLE` on creation; not settable by the client (FR-007) |
| `createdAt` / `updatedAt` | timestamp | Server-assigned |
| `archivedAt`, `archivedByUserId`, `archiveComment`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | nullable | Always `null` on creation |

**Validation rules** (enforced server-side, already implemented — see `research.md`):

- Name: non-blank after trim, ≤255 characters, unique (case-insensitive, trimmed, cross-status).
- Latitude: numeric, -90 ≤ value ≤ 90.
- Longitude: numeric, -180 ≤ value ≤ 180.

**State transition introduced by this feature**: *(none exists)* → `AVAILABLE`. This is the only
entry point into the Dock lifecycle; every other transition (`AVAILABLE` → `ARCHIVED` → `AVAILABLE`)
belongs to #199–#201.

## Pending Dock Placement (new, client-side only, not persisted)

Transient state held by the checkpoints page while dock creation is active. Represents "where the
new dock would be created if confirmed right now." It is `undefined` until the administrator's
first map click after activating creation; from then on it holds one coordinate pair, updated by
either dragging the pending marker or editing the coordinate fields (`research.md`: both paths
write to this same state). It is discarded on cancellation, on successful creation, or on
navigating away from the create mode — it is never sent anywhere on its own, only as part of a
submission.

| Field | Type | Set by |
|---|---|---|
| `latitude` | `number` | Map click, marker drag, or field edit |
| `longitude` | `number` | Map click, marker drag, or field edit |

## Dock Creation Form (new, client-side only, not persisted)

Transient form state held by the new `dock-form.tsx` while the administrator fills in the creation
sheet. Never stored; submitted once as the `POST /api/v1/docks` request body and discarded on
success, or retained on the client for correction when the submission is rejected (spec FR-012).

| Field | Form type | Submitted as | Client-side validation (mirrors server) | Source |
|---|---|---|---|---|
| `name` | `string` | `name: string` | Trim; required (min length 1 after trim); max length 255 | Typed by the administrator |
| `latitude` | `string` (text input, always rendered, coerced at validation) | `latitude: number` | Required; must parse as a number; -90 to 90 inclusive | Synced from the Pending Dock Placement when it changes (click/drag); editable directly at any time, including before any placement exists |
| `longitude` | `string` (text input, always rendered, coerced at validation) | `longitude: number` | Required; must parse as a number; -180 to 180 inclusive | Synced from the Pending Dock Placement when it changes (click/drag); editable directly at any time, including before any placement exists |

Both coordinate fields are always visible, never hidden behind an existing placement — this is what
lets a keyboard-only administrator (no pointer to click the map) establish the Pending Dock
Placement for the first time, by typing both values. Submission is additionally blocked,
independent of the above field-level checks, when no Pending Dock Placement exists yet (spec
FR-004) — there is nothing to submit as a location. A placement is only established once *both*
fields parse to a valid, in-range number; a single valid field with the other still blank or
invalid does not create a partial placement.

Client-side validation is a UX convenience only; the server (existing `createDockValidator`)
remains authoritative per the Portflow Constraints in the constitution ("The API is the source of
truth for business state and authorization"). A rejected submission surfaces the server's
field-specific error via the existing `applyValidationError` helper (HTTP 422, `E_VALIDATION_ERROR`)
for blank-name and out-of-range-coordinate rejections; the pending marker remains on the map either
way. The uniqueness conflict (`E_DOCK_NAME_CONFLICT`, HTTP 409) is a distinct exception shape that
`applyValidationError` does not recognize (see `research.md`), so `dock-form.tsx` MUST special-case
that one code and set the inline error on the `name` field itself, so the duplicate-name rejection
reads the same as any other name-field error rather than a disconnected generic toast.
