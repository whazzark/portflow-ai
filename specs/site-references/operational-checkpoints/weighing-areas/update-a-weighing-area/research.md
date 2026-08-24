# Research: Update a Weighing Area

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

Phase 0 output. Every decision below was taken against the code as it stands on
`feat/204-update-weighing-area`, after #202 (List Weighing Areas), #203 (Create a Weighing Area),
and #199 (Update a Dock) had landed. No `NEEDS CLARIFICATION` markers remained in the Technical
Context, so this file records decisions and their evidence rather than open questions.

---

## D1 — The update write path already exists and already satisfies the backend requirements

**Decision**: Change no production backend file. Treat the existing `PATCH
/api/v1/weighing-areas/:id` as the contract this slice consumes.

**Rationale**: Each backend functional requirement already maps to shipped code:

| Requirement | Already enforced by |
|---|---|
| FR-001 admin may update | `WeighingAreaPolicy.update` → `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`, applied in `WeighingAreasController.update` |
| FR-002 deny anonymous / inactive / non-admin | `auth_middleware` (authenticated + active) plus the policy above |
| FR-003 only name, latitude, longitude are updatable | `updateWeighingAreaValidator` accepts exactly those three keys |
| FR-004 partial update, all-or-nothing | `requiredIfMissing(['latitude','longitude'])` on `name` plus `requiredWhen` on each field; the write is a single-row `UPDATE` |
| FR-007 / FR-008 / FR-009 name rules | `nonBlank()` + `minLength(1)` + `maxLength(255)` in the validator, `assertValidSiteReferenceName` in the use case (trims) |
| FR-010 / FR-011 uniqueness, self-name allowed | `weighing_areas_name_unique` on `LOWER(name)`; `isUniqueViolation` → `DUPLICATE_NAME`; resubmitting the row's own name updates it to itself and violates nothing |
| FR-012 coordinate ranges | validator `min/max` plus `assertLegalSiteReferenceLatitude` / `…Longitude` in the use case |
| FR-013 archived is read-only | `LucidWeighingAreaRepository.updateAvailable` scopes the `UPDATE` to `status = 'AVAILABLE'` and disambiguates a zero-row result into `ARCHIVED` vs `NOT_FOUND` |
| FR-014 not found | same disambiguation → `WeighingAreaNotFoundException` (404) |
| FR-015 identity / status / createdAt preserved | the `UPDATE` sets only the submitted columns plus `updated_at` |
| FR-016 refusal leaves the row untouched | validation happens before the write; a unique violation aborts the statement |

**Alternatives considered**: adding an update-specific service or a dedicated conflict pre-check
query. Rejected — the unique index is the authority, and a read-then-write pre-check would introduce
the very race (FR edge case: two administrators submitting the same new name) that the index already
resolves correctly.

---

## D2 — The backend is implemented but under-tested; the gap is this slice's work

**Decision**: Add ten backend tests — seven at the HTTP boundary, three at the use-case level — and
no production code.

**Rationale**: The existing `apps/api/tests/integration/weighing_areas.spec.ts` exercises the update
endpoint only twice: one happy-path partial update inside the omnibus
"creates, lists, updates, archives, and reactivates" test, and one whitespace-only-name rejection.
The rules this spec asserts most loudly have **no** coverage. `#199` hit the identical situation for
docks and closed it in the same slice; the mapping table in
[`contracts/weighing-area-update-api.md`](./contracts/weighing-area-update-api.md) names each gap.

Two of the ten differ from the dock set, because the dock spec already had them and the weighing-area
spec does not: *unauthorized update* and *empty-body update*.

**Alternatives considered**: filing the test gap as a separate issue. Rejected — Constitution II
forbids splitting a slice into API-only and interface-only work, and these are exactly the rules a
reviewer would expect this issue to have proven.

---

## D3 — The #199 edit machinery is generalized by kind, not duplicated for weighing areas

**Decision**: Lift the dock-bound edit session in `checkpoints-page.tsx` to a kind-keyed session, and
extract it into `apps/web/src/features/checkpoints/use-checkpoint-edit-session.ts`.

**Rationale**: The current implementation names the concept "dock" seven times over
(`edit === 'dock'`, `isEditModeRequested`, `isEditingDock`, `draftDockPlacement`,
`startEditingDock`, `cancelEditingDock`, `restoreDockPosition`) but the *concept* is
checkpoint-shaped: a selected checkpoint, whether it was editable when the session opened, where it
stood then, and the draft position now. Only the panel and the mutation are resource-specific.

The decisive argument is not tidiness, it is FR-023. The session effect in `checkpoints-page.tsx`
carries three fixes made after review of #199, each recorded in its comments:

1. `edit` is cleared everywhere `checkpoint` is cleared, so an edit session cannot outlive the
   selection it belonged to and arm the map for the next checkpoint merely being viewed.
2. The creation control is hidden while an edit is in progress, so starting a creation cannot tear
   down an edit session and silently discard the typed name and dragged position.
3. `editable` and `origin` are snapshotted at session start rather than re-derived from live query
   data, so a background refetch of another administrator's concurrent move cannot masquerade as
   this administrator's unsaved change — nor become what "Restore original position" restores.

A parallel weighing-area edit path would have to rediscover all three. Generalizing inherits them,
which is why FR-023 and SC-009 are cheap in this slice and would have been expensive in the other
design.

**Extraction, specifically**: the session state plus its effect move to a hook. The effect is the
most delicate code in the feature, it grows a `kind` dimension here, and `checkpoints-page.tsx` is
already ~460 lines. One testable home beats an inline block that a third and fourth checkpoint kind
(warehouses, warehouse doors) will each be tempted to copy.

**Alternatives considered**:
- *Duplicate the dock wiring under weighing-area names.* Rejected — two copies of the three fixes
  above, guaranteed to drift, and FR-023 would need re-proving per kind.
- *Generalize in place without extracting a hook.* Rejected as the weaker half-measure: it delivers
  the same behavior but leaves the kind-keyed effect inline in an already-long component, with no
  seam for the checkpoint kinds still to come.

---

## D4 — `weighing-area-form.tsx` is generalized the way `dock-form.tsx` was; the two are not merged

**Decision**: Give `WeighingAreaForm` the same shape `DockForm` already has — `initialValues`,
`onSubmit`, `submitLabel`, `pendingLabel`, `errorTitle`, `onNotFound` — and leave the two forms as
siblings.

**Rationale**: The generalization itself is settled precedent: `dock-form.tsx` took exactly this
shape in #199, and `customer-form.tsx` did before it. Mirroring it keeps the two checkpoint forms
readable side by side and keeps this slice's diff inside its own feature directory.

Merging them into one cross-resource form is genuinely tempting — they differ today only in labels,
placeholder, `idPrefix`, and the three resource-specific error codes. It is nonetheless rejected
*here*: it would rewrite the dock create and edit flows that shipped days ago in service of a
feature that does not need it, and the error-code branching would have to become data passed in,
which is a design worth doing deliberately rather than as a side effect.

**Revisit trigger**: the third consumer. Warehouses and warehouse doors are both map-placed site
references with the same create/edit shape; when the first of them needs this form, extract
`SiteReferencePlacementForm` and migrate all consumers at once.

---

## D5 — Edit mode stays a URL-addressable mode on `/checkpoints`

**Decision**: Widen the existing search param — `edit: 'dock' | 'weighing-area'` — rather than
adding a second param or a standalone edit route.

**Rationale**: `/checkpoints?checkpoint=weighing-area:<id>&edit=weighing-area` is self-describing,
survives reload, and keeps the map (where the position is edited) on screen. It also keeps the
invariant that the edited checkpoint's kind must match the selected checkpoint's kind — a mismatched
pair is simply not an edit session, which the hook enforces by comparing both against the selection.

A second boolean param (`edit=true`) would have read the kind off the selection instead. Rejected:
`edit=<kind>` makes an inconsistent URL inert rather than ambiguous, and matches the shape `create`
already uses.

**Precedence**: a creation flow still wins if both `create` and `edit` are present, so two draft
markers can never coexist. That rule is unchanged from #199, now applied per kind.

---

## D6 — The edited weighing area's real marker is replaced by the draft marker

**Decision**: While editing, filter the edited checkpoint out of the map's checkpoint list — for any
kind — and let the pending-placement marker stand in for it.

**Rationale**: Otherwise two markers claim to be the same weighing area: the saved one and the
draft. The existing dock implementation already does this and scopes the filter to the map only, so
`hasMatches` and the empty-state message keep counting the full collection. Generalizing means
changing the filter's predicate from "is the dock being edited" to "is the checkpoint being edited",
which is a one-line change once the session carries its kind.

---

## D7 — Editability and origin are decided once, at session start

**Decision**: Keep #199's rule, now per kind: when a session opens for `(kind, id)`, snapshot
`editable = status === 'AVAILABLE'` and `origin = { latitude, longitude }`, and never re-derive
either from live query data.

**Rationale**: Both re-derivations were real defects in review of #199 (see D3). The archived case
matters more for weighing areas than it did for docks, because a weighing area can be archived by a
colleague while a shift is being planned around it; the session must then fail closed on submission
with the server's `E_WEIGHING_AREA_ARCHIVED`, not silently re-arm.

---

## D8 — No filter widening after a successful update

**Decision**: Unlike creation, a successful update changes neither the `kinds` filter nor the
`status` filter.

**Rationale**: Creation needs `handleCreated` to widen filters because a brand-new checkpoint can
land outside the administrator's current view and would be dropped by the selection effect. Update
cannot have that problem: the weighing area had to be visible and selected to be edited at all, and
an update changes neither its kind nor its status. Spec US1 scenario 8 is therefore satisfied by
*not* acting — and the quickstart asserts the filter is untouched, so a future change that starts
widening on update is caught.

---

## D9 — Concurrency resolves as last-write-wins; `Save` stays enabled when nothing changed

**Decision**: No optimistic locking, no version token, no "this changed under you" prompt. A
no-change submission is a valid, successful request.

**Rationale**: Matches spec Assumptions and #199's decision D6, and matches the server: the `UPDATE`
writes the submitted values unconditionally. `Save` staying enabled keeps FR edge case "a submission
that contains no change at all is accepted" reachable through the UI, and avoids a dirty-checking
rule that would need its own equality semantics for floating-point coordinates.

**Revisit trigger**: if administrators report losing each other's corrections in practice, revisit
with `If-Match`/`updatedAt` preconditions — a server change, not a UI one.

---

## D10 — A weighing area in use remains updatable, even though it is not archivable

**Decision**: Run no usage check on update.

**Rationale**: This is the one place where weighing areas differ interestingly from docks, and it is
worth stating explicitly because the adjacent code does the opposite. Archival *does* check usage —
`archive` returns `E_WEIGHING_AREA_IN_USE` when a persisted current shift references the area
(`apps/api/tests/integration/weighing_areas.spec.ts`, "rejects archival when a persisted current
shift uses the area"). Update deliberately does not, because a rename or a repositioning does not
remove the area from operational use; it corrects how that same area is described. Shift memberships
in `shift_weighing_areas` reference the area by its stable identity, so every reference survives
(FR-018) and nothing downstream needs rewriting.

A reviewer reading `updateAvailable` next to `archiveAvailable` might read the missing usage check
as an oversight. It is not: blocking updates while an area is in use would make the correction
impossible exactly when it matters most — mid-operation, when the name on the map is wrong.

---

## D11 — Error-code to UI mapping

**Decision**:

| Server outcome | UI treatment |
|---|---|
| `422 E_VALIDATION_ERROR` | field-level errors via `applyValidationError` (name, latitude, longitude) |
| `409 E_WEIGHING_AREA_NAME_CONFLICT` | error on the **name** field; sheet stays open, values preserved |
| `409 E_WEIGHING_AREA_ARCHIVED` | form-level error, with "Reactivate the weighing area before editing it." appended |
| `404 E_WEIGHING_AREA_NOT_FOUND` | toast, then close the session and clear both `checkpoint` and `edit` |
| network / 5xx | toast with the parsed message; sheet stays open so the same submission can be retried |

**Rationale**: Mirrors `dock-form.tsx` exactly, with the weighing-area codes substituted, satisfying
FR-020 and FR-021. Not-found is the only outcome that closes the session, because there is nothing
left to correct.

---

## D12 — Submit all three fields, always

**Decision**: The UI always sends `{ name, latitude, longitude }`, even when only one changed.

**Rationale**: The validator supports partial payloads, but a full payload makes the request
idempotent, keeps the client free of dirty-tracking, and makes FR-004's all-or-nothing guarantee
trivially true. The partial-payload capability stays exercised by the API tests, which is where it
belongs.

---

## D13 — Test seams need no new invention

**Decision**: Reuse `mock-checkpoint-map.tsx`, `renderCheckpoints`, and `mockDocks` as they are.

**Rationale**: The mock map is already resource-agnostic — it renders whatever `checkpoints` it is
given, exposes "Simulate map click to place checkpoint" whenever placement is armed, and
"Simulate dragging pending marker" whenever a pending point exists, with no dock-specific branch.
`mockDocks` already serves both collections and accepts a user and both fixture arrays, so a
non-administrator permissions test needs only a different user argument. `#199` had to widen the
drag seam to serve edit as well as create; that work is done and this slice inherits it.

The one addition is fixture-level: the weighing-area handlers need a `PATCH` counterpart alongside
the existing list handlers, following the inline `http.patch(...)` pattern the dock update tests
already use.
