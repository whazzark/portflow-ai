# Data Model: Update a Dock

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No persistence changes are introduced by this feature. The `Dock` entity, its `LOWER(name)` unique
index, and its latitude/longitude check constraints already exist
(`apps/api/database/migrations/1784500000000_create_docks_table.ts`) and are unchanged. This
document records the entity as it applies to updating, and the transient client-side state the
edit mode adds.

## Dock (existing, unchanged)

| Field | Type | Update rule |
|---|---|---|
| `id` | UUID | Path parameter; never in the body, never modified |
| `name` | string | Mutable. Trimmed, 1–255 chars, unique case-insensitively across all docks regardless of status |
| `latitude` | number | Mutable. -90 to 90 inclusive |
| `longitude` | number | Mutable. -180 to 180 inclusive |
| `status` | `'AVAILABLE' \| 'ARCHIVED'` | **Immutable here.** The update is scoped to `AVAILABLE` rows; archived docks are refused. Transitions belong to #200/#201 |
| `createdAt` | timestamp | Immutable |
| `updatedAt` | timestamp | Server-assigned on every successful update |
| `archivedAt`, `archivedByUserId`, `archiveComment`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | nullable | **Immutable here.** An update is not a lifecycle transition and captures no actor or comment (spec FR-015) |

**Validation rules** (enforced server-side, already implemented — see `research.md` D1):

- Name: non-blank after trim, ≤255 characters, unique (case-insensitive, trimmed, cross-status).
- Latitude: numeric, -90 ≤ value ≤ 90. Longitude: numeric, -180 ≤ value ≤ 180.
- At least one of `name` / `latitude` / `longitude` must be present. The UI always sends all three
  (research D11), so this rule is a contract guarantee rather than a UI concern.

**State transitions introduced by this feature**: *none*. `AVAILABLE` → `AVAILABLE`, with field
values changed. The dock's position in the lifecycle is untouched, which is the point of FR-015.

**Uniqueness note**: the index is `CREATE UNIQUE INDEX docks_name_unique ON docks (LOWER(name))`,
with no partial `WHERE` clause. Two consequences the tests must pin down: an available dock cannot
take an **archived** dock's name, and a dock **can** be updated to its own current name because
Postgres does not treat a row's own indexed value as a collision with itself.

## Dock Edit Session (new, client-side only, not persisted)

Held by `CheckpointsPage` while edit mode is active. Its purpose is continuity: it latches whether
this dock was editable when the session opened, so a background refetch of the dock list cannot
cancel an in-progress edit (research D5).

| Field | Type | Set by |
|---|---|---|
| `id` | `string` | The dock id at the moment editing starts |
| `editable` | `boolean` | `dock.status === 'AVAILABLE'` evaluated **once**, when the session opens |

Discarded when edit mode ends (save, cancel, navigation, or a different dock being selected). It is
never sent anywhere and carries no authority — the server re-decides on submission.

## Draft Dock Placement (new, client-side only, not persisted)

The same `PendingDockPlacement` shape the create flow uses, reused verbatim. The only difference is
its initial value: creation starts at `null`, editing starts at the dock's stored coordinates, so
it is never `null` during an edit.

| Field | Type | Set by |
|---|---|---|
| `latitude` | `number` | Seeded from the stored dock; then map click, marker drag, or field edit |
| `longitude` | `number` | Seeded from the stored dock; then map click, marker drag, or field edit |

Compared against the stored coordinates to drive the "Position modified" state and its restore
control (research D10). Discarded on save, cancel, or navigation away.

## Dock Edit Form (new, client-side only, not persisted)

Transient state in the generalized `dock-form.tsx`. Submitted once as the
`PATCH /api/v1/docks/:id` body and discarded on success, or retained for correction when the
submission is rejected (spec FR-021).

| Field | Form type | Submitted as | Client-side validation (mirrors server) | Initial value |
|---|---|---|---|---|
| `name` | `string` | `name: string` | Trim; required (min length 1 after trim); max length 255 | The dock's stored name |
| `latitude` | `string` (text input, coerced at validation) | `latitude: number` | Required; must parse as a number; -90 to 90 inclusive | The dock's stored latitude |
| `longitude` | `string` (text input, coerced at validation) | `longitude: number` | Required; must parse as a number; -180 to 180 inclusive | The dock's stored longitude |

Differences from the create form, and only these:

- **Pre-filled** rather than empty.
- **`canSubmit` drops the `Boolean(pending)` gate** — a placement always exists in edit mode, so
  the gate reduces to `!hasCoordinateError`. The create-only hint "A location must be placed before
  this dock can be created." is not rendered.
- **`Save` is not disabled when pristine** — a no-change submission must succeed (spec US1 AC7,
  FR-011; see research D6).
- **Submit/pending labels** are "Save changes" / "Saving…" instead of "Create dock" / "Creating…".

Client-side validation remains a UX convenience only; the server is authoritative per the
constitution's Portflow Constraints. Error surfacing follows research D7, which extends the create
flow's existing `applyValidationError` + `E_DOCK_NAME_CONFLICT` special case with the two codes only
an update can produce (`E_DOCK_ARCHIVED`, `E_DOCK_NOT_FOUND`).
