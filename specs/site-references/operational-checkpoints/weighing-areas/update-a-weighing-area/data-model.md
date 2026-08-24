# Data Model: Update a Weighing Area

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

No persisted entity is created, removed, or altered by this feature. There is **no migration**. The
`weighing_areas` table, its `LOWER(name)` unique index, and its coordinate check constraints are
consumed exactly as they exist.

What is new is entirely client-side and transient: the state that represents "an administrator is
part-way through correcting this checkpoint".

---

## Weighing Area (existing, unchanged)

Table `weighing_areas` — see `apps/api/database/migrations/1784600000000_create_weighing_areas_table.ts`.

| Field | Type | Mutable here | Notes |
|---|---|---|---|
| `id` | uuid, primary key | **no** (FR-015) | stable identity; every shift membership references it |
| `name` | string | **yes** (FR-003) | trimmed; unique case-insensitively across all statuses |
| `latitude` | double | **yes** (FR-003) | check constraint `-90 … 90` |
| `longitude` | double | **yes** (FR-003) | check constraint `-180 … 180` |
| `status` | enum `AVAILABLE` / `ARCHIVED` | **no** (FR-025) | gates the update: only `AVAILABLE` rows are writable |
| `archived_at`, `archived_by_user_id`, `archive_comment` | nullable | **no** (FR-015) | owned by #205 |
| `reactivated_at`, `reactivated_by_user_id`, `reactivation_comment` | nullable | **no** (FR-015) | owned by #206 |
| `created_at` | timestamp | **no** (FR-015) | never touched by an update |
| `updated_at` | timestamp | set by the update | the only field an update changes beyond the submitted ones |

**Invariants relied on, not re-implemented**

- `weighing_areas_name_unique` on `LOWER(name)` is the sole authority for FR-010; it spans available
  and archived rows alike, which is what makes the cross-status rule true.
- The `UPDATE` is scoped to `status = 'AVAILABLE'`, which is what makes FR-013 true without a
  separate read.
- Nothing cascades from an update: `shift_weighing_areas` rows point at `id`, so FR-018 holds by
  construction.

---

## Checkpoint Edit Session (new, client-side only, not persisted)

Owned by `use-checkpoint-edit-session.ts`. Replaces #199's dock-only session.

| Field | Type | Meaning |
|---|---|---|
| `kind` | `'DOCK' \| 'WEIGHING_AREA'` | which checkpoint kind this session edits; must match the selection's kind, or the session is not active |
| `id` | string | the checkpoint being edited; must match the selection's id |
| `editable` | boolean | snapshotted `status === 'AVAILABLE'` at session start — **never re-derived from live data** (research D7) |
| `origin` | `{ latitude, longitude }` | where the checkpoint stood when the session opened — **never re-derived from live data**; the target of "Restore original position" |

**Lifecycle**

- **Opens** when the `edit` search param names a kind, a checkpoint of that kind is selected, and no
  session exists for that `(kind, id)` pair.
- **Re-opens** (fresh snapshot) when the selected checkpoint changes identity.
- **Closes**, discarding the draft, when `edit` is absent, the selection is cleared, the selection
  moves to a different checkpoint, or a creation flow starts.
- **Never** survives a change of selection: `edit` is cleared everywhere `checkpoint` is cleared
  (FR-023).

**Derived, not stored**: `isEditing = editRequested && session !== null && session.id === selected.id
&& session.kind === selected.kind && session.editable`.

---

## Draft Placement (new, client-side only, not persisted)

| Field | Type | Meaning |
|---|---|---|
| `latitude` | number | current draft latitude — from the map, or typed into the coordinate field |
| `longitude` | number | current draft longitude — likewise |

Seeded from `origin` when the session opens. Written by map click, marker drag, and the coordinate
fields alike, which is what keeps the two input routes in sync (FR-005). Discarded on cancel, on
success, and on not-found. It is what the map renders in place of the checkpoint's real marker while
editing (research D6).

`positionModified` is derived — `draft ≠ origin` — and drives the "Position modified" notice and its
"Restore original position" action. It compares against the snapshotted origin, never against live
query data.

---

## Weighing Area Edit Form (new, client-side only, not persisted)

| Field | Source | Validation |
|---|---|---|
| `name` | seeded from the weighing area's current name | client: trimmed, non-empty, ≤ 255 (`nameSchema`); server: authoritative, including uniqueness |
| `latitude` / `longitude` | the draft placement, via `useCoordinateFields` | client: numeric and in range, per field; server: authoritative |

**Submission** always sends all three fields (research D12). On success the session closes, the list
query is invalidated, and a confirmation toast is shown. On failure the sheet stays open with every
entered value intact (FR-021), except not-found, which closes the session because the target is
gone.
