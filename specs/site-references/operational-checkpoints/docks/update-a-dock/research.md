# Research: Update a Dock

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

Phase 0 output. Every open question from the Technical Context is resolved below; no
NEEDS CLARIFICATION remains.

---

## D1 — The update write path already exists and already satisfies the backend requirements

**Decision**: Change no backend production file. Treat `PATCH /api/v1/docks/:id` as the contract to
build against, and close its *test* gaps instead.

**Rationale**: Every backend-enforced FR in the spec already has a working implementation:

| Spec requirement | Already enforced by | Location |
|---|---|---|
| FR-001 admin may update | `DockPolicy.update` → `ORGANIZATION_ADMIN \| OPERATIONS_ADMIN` | `app/docks/shared/dock_policy.ts` |
| FR-002 deny unauthenticated | Bouncer + auth guard → 401 `E_UNAUTHORIZED_ACCESS` | `docks_controller.ts:update` |
| FR-002 deny inactive | `auth_middleware.ts:58` rejects `accessStatus !== 'ACTIVE'` before any policy runs | `app/middleware/auth_middleware.ts` |
| FR-003 only name/lat/lng mutable | `UpdateDockInput` accepts exactly those three; `updateAvailable` writes exactly those | `update_dock_use_case.ts` |
| FR-004 partial or combined update | `updateDockValidator` — `requiredWhen` per key, `requiredIfMissing` on name | `dock_validator.ts` |
| FR-007/008/009 name blank / >255 / trimmed | `assertValidSiteReferenceName` + Vine `nonBlank().minLength(1).maxLength(255)` | `normalize_site_reference.ts` |
| FR-010 duplicate, case-insensitive, cross-status | `CREATE UNIQUE INDEX docks_name_unique ON docks (LOWER(name))` — no partial `WHERE`, so archived names collide too | `1784500000000_create_docks_table.ts` |
| FR-011 own name accepted | A Postgres `UPDATE` setting a row's indexed value to its current value does not violate the index | (index semantics) |
| FR-012 coordinate ranges | Vine `.min/.max` + `assertLegal*` + table `CHECK` constraints | `dock_validator.ts`, `normalize_site_reference.ts`, migration |
| FR-013 archived read-only | `updateAvailable` scopes the `UPDATE` to `.where('status','AVAILABLE')`, then distinguishes NOT_FOUND from ARCHIVED → 409 `E_DOCK_ARCHIVED` | `lucid_dock_repository.ts:44` |
| FR-014 not found | → 404 `E_DOCK_NOT_FOUND` | `dock_exceptions.ts` |
| FR-015 identity/status/createdAt preserved | The `UPDATE` touches only the three fields plus `updated_at` | `lucid_dock_repository.ts:45` |
| FR-016 refused leaves unchanged | Single-statement update; a rejected validation never reaches the repository | — |

**Test gaps found** (the real backend work of this slice — five behaviors with an implementation
but no test):

1. Duplicate name on update → 409 `E_DOCK_NAME_CONFLICT`, including a case-only/whitespace-only
   difference and a collision against an **archived** dock's name.
2. Resubmitting the dock's own current name → 200, **not** a duplicate (FR-011).
3. Updating an archived dock → 409 `E_DOCK_ARCHIVED`.
4. Updating a non-existent id → 404 `E_DOCK_NOT_FOUND`.
5. Out-of-range coordinate over HTTP → 422. The existing integration test only asserts the
   `required` rule for empty coordinates; the `min`/`max` rules are unexercised at the HTTP
   boundary. Boundary values (±90, ±180) accepted.

**Alternatives considered**: Rewriting the update slice to add optimistic locking or a usage check.
Rejected — both would be scope expansion beyond the issue, and D6/D7 explain why neither is wanted.

---

## D2 — Edit mode is a URL-addressable mode on `/checkpoints`, not a new page or local-only state

**Decision**: Add `edit: z.enum(['dock']).optional().catch(undefined)` to the checkpoints search
schema, mirroring the existing `create` param. Editing is expressed as
`?checkpoint=dock:<id>&edit=dock`.

**Rationale**: The dock being edited is already identified by the existing `checkpoint` param, so
`edit` only needs to say *which mode*, not *which record* — the same shape as `create=dock`, and it
keeps a single source of truth for the selection. Putting the mode in the URL gives reload
survival, shareable links, and browser-back cancellation for free, exactly as #198 got them.
`checkpoint-sheet.tsx` already reserves the mode name in a comment: `/** 'edit' is intentionally
not modeled yet — see issue #199. */`

**Alternatives considered**:
- `useState` in `CheckpointsPage` — rejected: a reload would silently drop the edit mode while
  leaving the dock selected, and back-button would leave the page instead of leaving edit mode.
- A dedicated `/checkpoints/docks/:id/edit` route — rejected: the map is the editing surface, and a
  route change would unmount and refit it.

---

## D3 — The dock's real marker is replaced by the pending-placement marker while editing

**Decision**: While editing, filter the edited dock out of the checkpoint array passed to
`<CheckpointMap checkpoints={...}>` only, and render the existing `PendingPlacementMarker` at the
draft position, labelled with the dock's name.

**Rationale**: Two consequences fall out for free. First, there is exactly one marker for the dock,
so there is no moment where a stale saved position and a live draft position are both on the map
claiming to be the same dock. Second, the draft inherits the pending marker's deliberate visual
language from #198 — larger, pulsing, labelled — which already means "not yet real," which is
precisely what an unsaved edit is.

The filtering is applied to the map's array only, not to `checkpoints` as a whole: that array also
feeds `hasMatches` and `emptyMessage`, and removing the dock there would make the page claim it has
fewer checkpoints than it does.

**Alternatives considered**:
- Make `CheckpointMarker` itself draggable in edit mode — rejected: it duplicates the drag logic
  that `PendingPlacementMarker` already owns, and it erases the saved/draft visual distinction.
- Add an `excludeId` prop to `CheckpointMap` — rejected: the caller can already filter, and the prop
  would encode an edit-specific concern into a component shared with weighing areas.

---

## D4 — `dock-form.tsx` is generalized, not duplicated

**Decision**: Replace the form's `onCreate` prop and empty `defaultValues` with `initialValues`
(name + coordinates) and a single `onSubmit`, plus a `submitLabel`/`pendingLabel` pair. Keep one
form component serving both `CreateDockPanel` and the new `EditDockPanel`.

**Rationale**: `customer-form.tsx` already serves both create and edit in this codebase, so this is
the established pattern rather than a new one. The coordinate machinery is the reason it matters:
`useCoordinateFields` contains a subtle guard — it refuses to overwrite a field's text when the
incoming value already parses to the same number, which is what lets an administrator type `20.`
or a trailing zero without it being canonicalized mid-keystroke. Duplicating the form would
duplicate that guard, and a divergent copy would regress silently.

`useCoordinateFields` itself needs **no** change: it is already driven by an external `pending` in
one direction and writes back in the other, so seeding it from a stored dock position is the same
operation as seeding it from a map click.

**Behavioral difference to encode**: `canSubmit` currently includes `Boolean(pending)`. In edit
mode a placement always exists, so the gate reduces to `!hasCoordinateError`. The
"A location must be placed before this dock can be created." hint is create-only.

**Alternatives considered**: A separate `edit-dock-form.tsx`. Rejected for the divergence risk above.

---

## D5 — Editability is decided once, when the edit session opens

**Decision**: Hold an edit session as `{ id, editable }` in `CheckpointsPage`, computed when editing
starts for a given dock, rather than re-deriving `dock.status === 'AVAILABLE'` on every render.

**Rationale**: `dockQueries.list()` is invalidated and refetched in the background. Without a
latched session, another administrator archiving this dock — or any unrelated refetch that
reorders or momentarily empties the list — would yank an in-progress edit out from under the
administrator mid-typing. `transport-resources-workspace.tsx:37-52` already solved exactly this and
documents the reasoning in place; this reuses it.

The latch is a *UI continuity* device, not an authorization decision. The server is still
authoritative: submitting into a dock archived after the session opened returns 409
`E_DOCK_ARCHIVED`, which is a spec edge case and is handled by D7.

**Alternatives considered**: Recomputing editability per render — rejected, loses in-progress work.
Blocking background refetches during edit — rejected, makes the rest of the map go stale.

---

## D6 — Concurrency resolves as last-write-wins; `Save` stays enabled when nothing changed

**Decision**: No optimistic locking, no version field, no conflict prompt. The administrator sees
the saved result. `Save` is **not** disabled when the form is pristine.

**Rationale (last-write-wins)**: The entity has three mutable scalar fields and one editor
population (site administrators). Adding a version column and a merge UI would be a schema change
plus a new failure mode, to protect against two administrators editing the same dock within the
same minute. The spec's edge case asks only that the administrator not be shown a silently stale
view — which invalidating the dock list on success already guarantees.

**Rationale (pristine `Save`)**: Disabling it is the more common convention, but it directly
contradicts spec US1 AC7 and FR-011, which require a no-change submission to succeed rather than be
blocked. A greyed-out button with no explanation is also a worse failure mode than a no-op save.
**This was flagged to the user as an open arbitrage before planning and resolved in favour of the
spec.** If the product prefers the disabled-when-pristine convention, US1 AC7 must change too —
the spec and the UI cannot diverge here.

**Revisit trigger**: if dock editing is ever opened to a larger or concurrent editor population, or
if a field-level merge is ever wanted, last-write-wins is the decision to revisit first.

---

## D7 — Error-code to UI mapping

**Decision**: Extend the create flow's existing error handling with the two codes only reachable
from an update.

| Status | Code | UI treatment |
|---|---|---|
| 422 | `E_VALIDATION_ERROR` | `applyValidationError(formApi, error)` — field-level, already generic |
| 409 | `E_DOCK_NAME_CONFLICT` | Special-cased onto the `name` field, exactly as `dock-form.tsx` already does for create |
| 409 | `E_DOCK_ARCHIVED` | Form-level error naming reactivation as the prerequisite; form stays open with values intact |
| 404 | `E_DOCK_NOT_FOUND` | Toast, leave edit mode, clear `checkpoint` from the URL — the record is gone, so there is nothing to stay on |
| 401 | `E_UNAUTHORIZED_ACCESS` | Existing global session handling |
| 403 | `E_AUTHORIZATION_FAILURE` | Toast; the entry point should not have been reachable |
| — | `NETWORK_ERROR` | Toast; values and draft marker preserved so a retry costs nothing (FR-016, FR-021) |

**Rationale**: `applyValidationError` returns `false` for any non-422 code, which is the existing
seam for adding these branches. `E_DOCK_NAME_CONFLICT` must stay special-cased onto the name field
rather than falling through to a toast, or the duplicate rejection reads as a disconnected banner
while the offending field shows no error — the same reasoning already recorded for creation.

---

## D8 — A dock in use by a planned or active discharge remains updatable

**Decision**: No usage check on update.

**Rationale**: `DockInUseException` / `E_DOCK_IN_USE` exists and the site-reference usage checkers
are wired for **archival**, where the concern is real: archiving removes a dock from operational
availability while work is scheduled against it. An update does neither — discharges reference the
dock by its stable id, so a rename or repositioning is a correction to how the same berth is
described, and blocking it would mean the busiest docks are precisely the ones whose name can never
be fixed. The current implementation already takes this position by not calling a checker.

**This was flagged to the user in the requirements checklist as an assumption open to challenge.**
If the product wants updates blocked while a dock is in operational use, that is a spec change
(a new FR), not a plan change — and `DockInUseException` is already available to express it.

---

## D9 — The sheet stays non-modal while editing

**Decision**: `checkpoint-sheet.tsx` treats edit like create for modality:
`modal={!isCreating && !isEditing}` and `disablePointerDismissal` in both.

**Rationale**: The map is the editing surface. A modal overlay would swallow the map clicks and
marker drags that the feature exists to provide, and a pointer-dismissable sheet would discard an
in-progress edit on the first click aimed at the map. #198 hit this exact constraint and the same
answer applies unchanged. `checkpoint-map.tsx` also relocates its zoom controls and mutes sibling
markers off `isArmed`, both of which are wanted during edit and both of which follow automatically
from arming placement.

---

## D10 — A "restore original position" affordance is added for edit only

**Decision**: When the draft position differs from the dock's stored position, the panel shows a
"Position modified" status with a control that resets the draft to the stored coordinates.

**Rationale**: This is the one genuinely new affordance the slice needs. In creation, a stray drag
costs nothing — there is no correct prior position to lose. In editing there is, and a map drag is
easy to trigger accidentally while panning. Without an undo, the only recovery is cancelling the
whole edit and retyping the name. Cancel still resets everything (FR-022); this resets only the
position.

**Alternatives considered**: A generic form-wide "Reset" — rejected: it would also clear a
deliberately retyped name, which is not what a mis-drag calls for.

---

## D11 — Submit all three fields, always

**Decision**: The form always sends `{ name, latitude, longitude }`, even when only one changed.

**Rationale**: `updateDockValidator` supports partial bodies, but all three values are on screen
and under the administrator's control, so sending the full set makes the request describe exactly
the state the administrator is looking at. It also satisfies FR-004's all-or-nothing requirement
without the UI having to compute a diff, and it makes FR-011 (own name accepted) an every-request
concern rather than an edge case — which is why D1's test gap #2 matters.

**Alternatives considered**: Sending only changed fields. Rejected — it adds diffing logic whose
only benefit is a marginally smaller payload, and it would make the self-name path rare enough in
practice to hide a regression in it.

---

## D12 — Test seams

**Decision**: Reuse `mock-checkpoint-map.tsx`'s existing `Simulate dragging pending marker` button
for edit as well as create; it is driven by `placement.pending`, which edit mode populates from the
first render. Add update tests under `apps/web/src/features/docks/__tests__/update/`, mirroring the
existing `__tests__/create/{create,validation,permissions}.test.tsx` split, with MSW handlers for
`PATCH /api/v1/docks/:id` returning 200, 409 (both codes), 404, and 422.

**Rationale**: The mock already exposes the two seams edit needs (place and drag) because they are
placement concerns, not creation concerns. Only the `Simulate map click to place dock` label is
create-flavoured; it is left alone rather than renamed, to avoid churning the create tests.
