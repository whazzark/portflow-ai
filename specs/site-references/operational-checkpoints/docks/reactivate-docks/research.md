# Phase 0 Research: Reactivate Docks

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No `[NEEDS CLARIFICATION]` markers remain in the Technical Context; this document records the
design decisions made while resolving how the spec's requirements map onto the existing codebase.

## D1 — The individual reactivate backend is reused verbatim, not touched

**Decision**: Ship this slice's individual path by wiring the frontend to the existing
`POST /api/v1/docks/:id/reactivate` endpoint. No change to `reactivate_dock_use_case.ts`,
`dock_validator.ts`'s `reactivateDockValidator`, `dock_policy.ts`'s `reactivate`, or
`LucidDockRepository.reactivateArchived`.

**Rationale**: Issue #178 already delivered this endpoint with the rules this spec restates:
`DockNotFoundException` for an unknown id, `DockAlreadyAvailableException` for a dock that is
already `AVAILABLE`, an optional trimmed comment (`comment?.trim() || null`), and lifecycle
metadata (`reactivatedAt`, `reactivatedByUserId`, `reactivationComment`) written by a status-guarded
`UPDATE … WHERE id = ? AND status = 'ARCHIVED'` that re-reads the row's state when zero rows are
affected. `apps/api/tests/unit/docks/dock_use_cases.spec.ts` already exercises the eligible,
not-found, and already-available cases. Editing already-correct, already-tested production code for
a spec that asks for the same behavior would be pure risk with no behavioral gain.

**Gaps found**:
- `apps/web/src/features/docks/mutations/use-dock-mutations.ts` exposes `create`, `update`,
  `archive`, and `archiveMany` — **no `reactivate`**. Grepping `apps/web` for `docks.reactivate`
  returns nothing outside the generated Tuyau registry.
- `dock-details.tsx` renders its `SheetFooter` only when `canEdit && dock.status === 'AVAILABLE'`,
  so **an archived dock's sheet has no footer and no action at all** — the archived dock is a
  dead end in the UI today.
- HTTP-level coverage of the individual endpoint in `apps/api/tests/integration/docks.spec.ts` is
  two tests: unauthorized/unauthenticated, and the happy path. The 404, the 409
  (`E_DOCK_ALREADY_AVAILABLE`), and comment handling (stored, and whitespace-only → `null`) are
  covered only at use-case level or not at all.

**Alternatives considered**: Rewriting the endpoint to accept the bulk shape (`ids: [id]`) —
rejected for the same reason #200 rejected it for archiving: it would touch correct code for no
behavioral change and diverge from the Customer precedent, which keeps `/:id/reactivate` and
`/reactivate` (many) separate.

## D2 — The bulk backend needs no new abstraction, only the reactivation direction

**Decision**: Add exactly five things — `reactivate_docks_use_case.ts`, `reactivateDocksValidator`,
`ReactivateDocksCommand` + `reactivateArchivedMany` on `DockRepository`, its `LucidDockRepository`
implementation, and `DocksController.reactivateMany` behind
`POST /api/v1/docks/reactivate`. Reuse `findBulkBlockers`, `indexDocksById`, `orderDocks`,
`BulkDockLifecycleBlocker`, `BulkDockLifecycleResult`, `lifecycleIds`, and `lifecycleComment` as
they already stand. Create no shared helper, and modify none of them.

**Rationale**: #200 built the dock bulk-lifecycle machinery generically enough to serve both
directions and said so explicitly in its own data model: `findBulkBlockers(ids, docksById,
expectedStatus, usedIds = new Set())` already takes `expectedStatus` and already returns
`ALREADY_AVAILABLE` when it is `'ARCHIVED'`; `BulkDockLifecycleBlocker['reason']` already declares
`ALREADY_AVAILABLE`; the web-side `BLOCKER_REASON_LABELS` map already carries its label. Calling
`findBulkBlockers(command.ids, docksById, 'ARCHIVED')` with no `usedIds` argument produces exactly
the two-reason blocker set spec FR-009 requires, because the `usedIds` branch is guarded by
`expectedStatus === 'AVAILABLE'`. The only genuinely new lines are the transaction body's `UPDATE`
(status, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`) — the mirror of
`archiveAvailableMany`, and character-for-character the shape of
`LucidCustomerRepository.reactivateArchivedMany`.

**Consequence for `IN_USE`**: reactivation passes no usage checker at all. This is not an omission
to revisit: an archived dock cannot be the current dock of a Planned or Active discharge, so the
reason cannot arise (spec Assumptions), and `SiteReferenceUsageChecker` is simply not a
collaborator of the reactivation path — `ReactivateDockUseCase` already has no such dependency.

**Alternatives considered**: A single `changeLifecycleMany(direction)` method on the repository
covering both directions — rejected; the two `UPDATE` payloads share no columns beyond `status` and
`updatedAt`, the customer repository keeps them separate, and collapsing them would mean a
parameterized column map that reads worse than the two explicit methods.

## D3 — One select mode, homogeneous selection, intent fixed by the first check

**Decision**: Keep the single `selecting=docks` search param and the single "Select docks" map
control. While select mode is active:

- with **nothing checked**, every dock marker is checkable, whatever its status;
- checking a dock fixes the selection's **intent** — `AVAILABLE` → Archive, `ARCHIVED` →
  Reactivate — and docks of the other status stop being checkable until the selection is emptied;
- the action bar renders Archive or Reactivate according to that intent, and submits to the
  matching endpoint;
- Ctrl/Cmd+A checks every *visible* dock matching the current intent; with an empty selection the
  intent falls back to the status filter (`status=archived` → archived docks, otherwise available
  docks);
- shift-clicking any dock marker enters select mode with that dock checked, as it does today,
  regardless of status.

**Rationale**: The two directions are two endpoints with two outcomes, so a request must never mix
statuses. Three ways to guarantee that were considered, and this one costs the least vocabulary:
it adds no search param, no second map control, and no new gesture — the administrator selects
docks exactly as #200 taught them to, and the bar tells them what will happen. It also mirrors the
Customer model, where each table section (Available / Archived) is homogeneous by construction and
`BulkLifecycleActions` is told which one it is serving via `isArchived`. Homogeneity here is
enforced by the same mechanism the customer table gets for free from its sections.

**Alternatives considered**:
- *A second mode, `selecting=archived-docks`, with a second map control* — rejected: two controls
  for one gesture, a second URL vocabulary word, and the administrator has to choose the mode
  before knowing which docks they will click. The status filter already tells them what they are
  looking at.
- *Derive the intent from the status filter alone* — rejected: it breaks under `status=all`, which
  is a legitimate everyday filter (and the default in the checkpoints test helper), where neither
  direction could be chosen. It would also make the bar's meaning change under the administrator
  while docks stay checked.
- *Allow a mixed selection and split it into two requests client-side* — rejected: two requests
  means two partial-success outcomes and an ambiguous atomicity story for one shared comment, and
  the spec describes one action with one outcome (FR-009, FR-017).

## D4 — The checkability rule moves from the map to the page

**Decision**: `CheckpointMap` stops deriving `isAvailableDock` itself and takes a
`checkableDockIds: Set<string>` prop (undefined when not in select mode). `checkpoints-page.tsx`
computes that set from the checked docks' intent, alongside the `checkedDockIds` state it already
owns. `mock-checkpoint-map.tsx` mirrors the same prop.

**Rationale**: The status rule currently lives in three places — `toggleDockChecked`'s
`dock?.status !== 'AVAILABLE'` guard, `checkpoint-map.tsx`'s `isAvailableDock`/`isSelectableDock`,
and a verbatim copy of the latter in the test mock. With intent, the rule becomes conditional on
page state the map does not have, so keeping it in the map would mean threading intent down and
re-deriving the same predicate in three places again — including in a test double, where a
divergence produces tests that pass against a map that does not exist. Passing the already-computed
set down keeps one definition, and leaves `CheckpointMap` doing what it is good at: rendering the
markers it is told to render, in the state it is told.

**Alternatives considered**: Pass `selectionIntent` down and let the map re-derive per marker —
rejected; it duplicates the predicate into the mock again and gives the map a concept (lifecycle
intent) that is not a map concern. Keep the map hard-coded to `AVAILABLE` and render archived docks
non-checkable — rejected; it makes bulk reactivation impossible, which is the feature.

## D5 — Concurrency: row locking + partial success, no optimistic-locking prompt

**Decision**: Same as #200's D5 and the Customer bulk reactivation's existing behavior: the database
transaction and `SELECT … FOR UPDATE` are the only concurrency control. No version field, no
`If-Match`, no "someone else changed this" prompt. Two overlapping requests for the same archived
dock resolve to exactly one reactivation and one `ALREADY_AVAILABLE` blocker.

**Rationale**: This is FR-016's requirement satisfied by the mechanism already shipped and reviewed
for both Customer reactivation and Dock archiving. A different concurrency story for this one
direction would be an unjustified divergence. The `affectedRows !== eligibleIds.length` guard
inside the transaction (present in both existing bulk methods) keeps a mid-transaction change from
silently under-reporting, by failing the whole request rather than returning a wrong outcome.

**Alternatives considered**: Optimistic locking with a version/`If-Match` header — rejected as
unnecessary scope; "the other administrator's change wins, and I find out by seeing my request
blocked" is the already-established outcome for every site-reference lifecycle action.

## D6 — A successful reactivation does not widen the status filter

**Decision**: After a successful reactivation, do nothing to the `status` search param. If the
administrator is filtering on `archived`, the reactivated docks leave the filtered view (and, for
the individual path, the details sheet closes through the page's existing selection effect, which
already clears a `checkpoint` param whose target is no longer in the presented collection).

**Rationale**: This is exactly what archiving already does in the mirror situation (archiving under
the default `status=available` filter), so the two directions stay symmetric and no new rule has to
be learned or tested. It is also what the filter means: the administrator asked to see archived
docks, and a reactivated dock is not one. SC-001's "visible in consultation within 2 seconds
without a manual reload" is satisfied under `status=all` and `status=available`, and the toast plus
the dock's disappearance from an `archived` filter is itself unambiguous confirmation.

**Alternatives considered**: Copy `handleCreated`'s filter-widening (`status: previous.status ===
'archived' ? 'available' : previous.status`) — rejected here, though right there: creation widens
because a brand-new checkpoint would otherwise never appear at all and the administrator would be
left with a success toast and nothing to show for it, having taken no action that explains the
absence. Reactivation is the opposite: the administrator acted *on* a dock they can see, and the
disappearance is the direct, legible consequence of that action. Silently rewriting their filter
would also fight them when they are working through a list of archived docks one at a time.

## D7 — Blocked outcomes are reported but not retryable

**Decision**: On a successful bulk reactivation, clear the whole selection, including blocked docks.
Report blockers in the success toast's description, as `BulkArchiveDocksActions` already does, and
do not offer a "retry blocked" affordance.

**Rationale**: Reactivation's two blockers are both terminal for the request that hit them:
`NOT_FOUND` (the dock does not exist) and `ALREADY_AVAILABLE` (someone else already did it, or it
was never archived). Neither becomes eligible by retrying, unlike archiving's `IN_USE`, which is
why `handleBulkArchiveSuccess` keeps exactly the `IN_USE` ids checked for a resubmission. Keeping
non-retryable blockers checked would invite the administrator into a loop that cannot succeed.
Spec FR-018's resubmission requirement is satisfied by the fact that the already-reactivated docks
are gone from the selection and would report `ALREADY_AVAILABLE` if resubmitted anyway.

**Alternatives considered**: Keep every blocked dock checked for symmetry with the archive handler —
rejected for the reason above; the symmetry that matters is "keep what a resubmission could fix",
and for reactivation that set is always empty.
