# Phase 0 Research: Reactivate Weighing Areas

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-25

All Technical Context entries were resolvable from the codebase and the two neighbouring delivered
slices; no `NEEDS CLARIFICATION` remained after this pass. What follows are the decisions that
shape the implementation, each with what was actually found in the tree.

---

## D1 — The individual reactivate backend is reused, not rebuilt

**Decision**: Ship this slice's individual path by wiring the frontend to the existing
`POST /api/v1/weighing-areas/:id/reactivate`. Do not touch `ReactivateWeighingAreaUseCase`,
`WeighingAreaPolicy.reactivate`, `LucidWeighingAreaRepository.reactivateArchived`, or
`WeighingAreaAlreadyAvailableException`.

**Rationale**: The endpoint already implements every individual functional requirement:

- `ReactivateWeighingAreaUseCase` loads the area, throws `WeighingAreaNotFoundException` when it is
  missing (FR-005) and `WeighingAreaAlreadyAvailableException` when it is already available
  (FR-004), trims the comment and stores `null` for empty or whitespace-only values (FR-007), and
  records actor and timestamp (FR-006).
- `reactivateArchived` performs a status-guarded `UPDATE … WHERE id = ? AND status = 'ARCHIVED'`
  and, on zero affected rows, re-reads the row to distinguish `NOT_FOUND` from `ALREADY_AVAILABLE`.
  That guard is what makes concurrent individual reactivations resolve to exactly one winner
  (FR-015) without an optimistic-locking prompt.
- `WeighingAreaPolicy.reactivate` is already `ORGANIZATION_ADMIN || OPERATIONS_ADMIN` (FR-001), and
  the route sits inside the authenticated group, so unauthenticated and non-active users never
  reach it (FR-002).
- The `weighing_areas` table keeps the archive and reactivation contexts in two separate column
  groups, and `reactivateArchived` writes only the reactivation group. Preserving archive context
  (FR-010) is therefore a schema property, not something the code has to remember to do.

**Alternatives considered**: Rewriting the individual path to share code with the new bulk path.
Rejected — the two have genuinely different shapes (throw-on-blocker versus report-per-blocker),
which is exactly how docks and customers already model the same pair, and collapsing them would
force one of the two to carry the other's error handling.

**Consequence for testing**: this surface gets *characterization* tests, not RED tests. The
distinction is recorded per requirement in `contracts/weighing-area-reactivate-api.md`.

---

## D2 — Align `reactivateWeighingAreaValidator` with the shared lifecycle comment rule

**Decision**: Change `reactivateWeighingAreaValidator` from
`vine.create({ comment: vine.string().nullable().optional() })` to
`vine.create({ comment: lifecycleComment() })`, i.e. `vine.string().trim().maxLength(1000)
.nullable().optional()`. This is the only change this slice makes to already-shipped backend
behavior.

**Rationale**: Spec FR-008 requires a 1,000-character limit on the reactivation comment and
FR-007 requires trimming, and the issue puts individual reactivate behavior inside this slice's
delivery boundary. The weighing-area resource is *internally inconsistent* today: #205 gave both
`archiveWeighingAreaValidator` and `archiveWeighingAreasValidator` the shared `lifecycleComment()`,
while the reactivate validator — written earlier — kept the loose form. So an administrator can be
refused an over-long archive comment and silently accepted for an identical reactivation comment on
the same weighing area. Leaving that in place would mean the new bulk endpoint (which will use
`lifecycleComment()` for consistency with every other bulk validator) enforces a limit its
individual sibling does not, which is a worse inconsistency than the one being fixed.

Note that the trim is belt-and-braces rather than a behavior change: `ReactivateWeighingAreaUseCase`
already does `input.comment?.trim() || null`. The observable change is confined to over-long
comments, which move from accepted to refused with a field-level validation message.

**Alternatives considered**:

- *Leave it alone and let the bulk endpoint be stricter.* Rejected: it contradicts FR-008, and the
  UI already advertises "maximum 1,000 characters" under the comment field it will reuse for
  reactivation, so the interface would be describing a rule the individual endpoint does not have.
- *Also align the two dock validators, which have the same loose form.* Rejected as out of scope —
  those belong to #200/#201, and touching them would widen this slice's diff into another
  resource's behavior for no benefit to this issue.

**Flagged for plan review**: this is a deliberate behavior change to shipped code, called out in
the Constitution Check so it can be rejected knowingly rather than discovered in a diff.

---

## D3 — The bulk backend needs no new abstraction, only the reactivation direction

**Decision**: Add exactly five things — `reactivate_weighing_areas_use_case.ts`,
`reactivateWeighingAreasValidator`, `ReactivateWeighingAreasCommand` +
`reactivateArchivedMany` on the repository interface, its Lucid implementation, and
`WeighingAreasController.reactivateMany` plus its route. Introduce no helper, no shared type, and
no new blocker vocabulary.

**Rationale**: Everything the bulk path needs already exists, because #205 built the archive
direction on primitives that were written to take a direction:

- `findBulkBlockers(ids, weighingAreasById, expectedStatus, usedIds)` already accepts
  `expectedStatus: 'ARCHIVED'` and already emits `ALREADY_AVAILABLE` on that branch.
- Its usage check is guarded by `expectedStatus === 'AVAILABLE'`, so passing `'ARCHIVED'` skips the
  usage lookup entirely. This is precisely the "no `IN_USE` on the reactivation path" property the
  spec asserts (FR-003), and it falls out of the existing code rather than needing a new rule.
- `BulkWeighingAreaLifecycleBlocker['reason']` already includes `ALREADY_AVAILABLE`, and
  `BulkWeighingAreaLifecycleResult` is direction-agnostic (`updatedWeighingAreas` /
  `blockedWeighingAreas`).
- `lifecycleIds()` already enforces non-empty, UUID-shaped, duplicate-free selections (FR-028), and
  `lifecycleComment()` the comment rule (FR-007, FR-008).

The Lucid method is therefore `archiveAvailableMany` minus the usage lookup, with the reactivation
columns — which is byte-for-byte the shape of `LucidDockRepository.reactivateArchivedMany`,
including its `affectedRows !== eligibleIds.length` guard that turns a mid-transaction race into a
rollback rather than a silently partial write (FR-026, FR-027).

**Alternatives considered**: A single `applyBulkLifecycle(direction)` repository method
parameterized over both directions. Rejected — it would collapse two `UPDATE` column sets, two
blocker directions, and one conditional usage lookup into one branching method, and no other site
reference in the codebase does this. Constitution VI favours consuming the existing seam over
inventing a second one.

**Route ordering note**: `router.post('/reactivate', …)` must be registered *before*
`router.post('/:id/reactivate', …)`, exactly as `/archive` precedes `/:id/archive` today, or the
literal path would be captured as an `:id`.

---

## D4 — The frontend select mode is already generalized; this slice fills three placeholders

**Decision**: Enable weighing-area bulk reactivation by (1) adding `'REACTIVATE'` to
`BULK_LIFECYCLE_INTENTS.WEIGHING_AREA`, (2) adding the `REACTIVATE` sentence to
`BULK_LIFECYCLE_DESCRIPTIONS.WEIGHING_AREA`, and (3) routing weighing-area `REACTIVATE` submissions
to `reactivateMany` in `submitBulkLifecycle`. Change no component, no prop, and no shared rule.

**Rationale**: This is the payoff of #201's and #205's design work, and the codebase says so in
three explicit forward-references to this issue:

- `types.ts`: *"Weighing-area reactivation is #206's, so it is deliberately absent until that slice
  ships."*
- `checkpoints-page.tsx`: *"only docks can additionally be bulk-reactivated until #206 ships
  weighing-area reactivation"*, and *"clamped to what the selecting kind actually supports so a
  weighing-area selection can never resolve to REACTIVATE (#206)"*.

Everything downstream of those three points is already kind-agnostic and needs no edit:
`checkableIds` derives eligibility from `BULK_LIFECYCLE_INTENTS[checkpoint.kind]` and
`STATUS_FOR_BULK_INTENT`; `selectionIntent` infers the direction from the first checked marker's
status; the Ctrl/Cmd+A handler clamps a preferred intent to the kind's supported intents; the
toolbar is `BulkCheckpointLifecycleActions`, which already derives every label from the kind's
labels plus the intent's verb and already renders `ALREADY_AVAILABLE` as "already available";
`CheckpointMap` already takes `checkableIds` from the page; and `refresh` and `onSuccess` are
already selected by kind and intent respectively. `toBulkLifecycleOutcome` in
`weighing-area-checkpoint-adapter.ts` normalizes the response shape and is direction-agnostic,
exactly as its dock counterpart's comment records.

**Alternatives considered**: Adding a weighing-area-specific bulk reactivate component or a second
select mode. Rejected outright — spec FR-033 requires one interaction model across both checkpoint
kinds, and the generic one already exists and is already exercised by the dock reactivate tests.

**Consequence**: the three `#206` comments are deleted as their placeholders are filled. A stale
forward-reference to a shipped issue is worse than no comment.

---

## D5 — Blocked entries are reported but not kept checked for retry

**Decision**: Reuse the delivered `handleBulkReactivateSuccess`, which clears the entire selection
after a successful bulk reactivation, rather than keeping blocked entries checked the way
`handleBulkArchiveSuccess` keeps `IN_USE` ones.

**Rationale**: The page already routes `onSuccess` by intent, not by kind, so weighing areas
inherit this behavior with no code change. The reasoning holds identically for this kind: an
archive can be blocked by `IN_USE`, a condition the administrator can resolve and retry, which is
why archive keeps those entries checked. Neither reactivation blocker works that way — a
`NOT_FOUND` weighing area will not reappear, and an `ALREADY_AVAILABLE` one already reached the
desired state — so keeping them checked would invite a retry guaranteed to be blocked again.

Spec FR-030 and US2 scenario 7 are still satisfied: the administrator narrows the selection and
resubmits, and the already-reactivated entries are simply no longer archived, so they are no longer
checkable under a `REACTIVATE` intent. The outcome toast names every blocked entry with its reason,
which is what "can identify exactly which weighing areas changed" (US2 scenario 4) requires.

**Alternatives considered**: Keeping blocked entries checked for symmetry with archive. Rejected —
symmetry of code shape is not worth an affordance that can only produce a second refusal, and
diverging here would mean overriding a handler the page already picks correctly.

---

## D6 — Concurrency: row locking plus partial success, no optimistic-locking prompt

**Decision**: Same as #205's and #201's. Bulk reactivation opens a transaction, takes
`SELECT … FOR UPDATE` on the submitted rows, computes blockers against the locked state, updates
only the eligible ones with a `WHERE status = 'ARCHIVED'` guard, and asserts the affected-row count
matches. Individual reactivation relies on its status-guarded `UPDATE` and re-read.

**Rationale**: This satisfies FR-015 (exactly one recorded reactivation under concurrency), FR-022
(state assessed at submission time, not at view time), and FR-026 (all-or-nothing across the
eligible set) without introducing a version column, an `If-Match` header, or a stale-view dialog.
The loser of a race sees `ALREADY_AVAILABLE` — which is the truth about the weighing area, not an
error about the request — and the first writer's comment is never overwritten because the guard
excludes rows that already moved.

**Alternatives considered**: Optimistic locking with a returned conflict prompt. Rejected — it is
not used by any site-reference lifecycle action in this codebase, and the spec's edge cases
explicitly describe the already-available outcome rather than a stale-view resolution flow.

---

## D7 — A successful reactivation does not widen the status filter

**Decision**: After a successful reactivation, individual or bulk, leave the `status` search param
alone. A weighing area reactivated while the map is filtered to Archived simply leaves the filtered
view.

**Rationale**: Identical to #201's D6. The administrator chose that filter; silently widening it
would move markers under their cursor mid-task, and the confirmation toast already states what
happened. The list query is invalidated (`refreshWeighingAreas`), so the map re-renders from
authoritative state within the FR-017 / SC-001 window without a manual reload.

**Alternatives considered**: Switching the filter to `all` after a successful reactivation so the
result stays visible. Rejected — it contradicts the delivered dock behavior for the same action on
the same map, which FR-033 requires this slice to match.

---

## D8 — The individual path keeps the weighing-area component's stronger error handling

**Decision**: Extend `weighing-area-lifecycle-actions.tsx` with an archived branch modelled on
`dock-lifecycle-actions.tsx`'s structure, but keep the weighing-area component's existing error
handling: the dialog stays open on refusal (only success calls `setOpen(false)`), and the toast
description prefers `error.details?.[0]?.message` over the generic top-level message.

**Rationale**: Spec US3 scenario 3 requires that an administrator refused for an over-long comment
can shorten it and resubmit "without the administrator having to reopen the weighing area or
rebuild a selection", and the existing weighing-area component already implements exactly that,
with a comment saying so. It differs from the dock component in two specific ways, both of which
this spec depends on. First, its confirm handler calls `event.preventDefault()`, so Radix's
`AlertDialogAction` does not close the dialog on click and the typed comment survives a refusal;
the dock handler omits it, so the dock dialog closes either way. Second, its toast description
prefers `error.details?.[0]?.message` over `parseApiError(cause).message`, which for a validation
failure reads only "Validation failure" with no field-level detail — precisely the message an
over-long comment produces. Copying the dock component wholesale would therefore regress against
this spec, so the direction of copying is: dock's *branching shape*, weighing-area's *error
handling*.

**Alternatives considered**: Refactoring both resources onto one shared lifecycle-actions component.
Rejected as out of scope — it would pull dock behavior into this slice's diff, and no requirement
here asks for it. Worth an issue of its own once both are branch-complete.

---

## Resolved Technical Context items

| Item | Resolution |
| --- | --- |
| Individual reactivate endpoint exists? | Yes — route, use case, policy, repository method, exception all present (D1) |
| Bulk reactivate endpoint exists? | No — five additions, no new abstraction (D3) |
| Does `findBulkBlockers` support the reactivate direction? | Yes, including skipping the usage check (D3) |
| Is a migration needed? | No — both lifecycle column groups already exist on `weighing_areas` |
| Does the map need changes? | No — `checkableIds` is already computed by the page (D4) |
| Does the bulk toolbar need changes? | No — already kind- and intent-agnostic (D4) |
| Comment limit on reactivation? | 1,000 chars via `lifecycleComment()`; requires a validator fix (D2) |
| Blocker set on this path? | `NOT_FOUND`, `ALREADY_AVAILABLE` — `IN_USE` is structurally unreachable (D3) |
| Retry affordance for blocked entries? | None; selection is cleared (D5) |
