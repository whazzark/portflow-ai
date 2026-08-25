# Research: Archive Weighing Areas

**Feature**: `GH-205` | **Date**: 2026-08-24 | **Plan**: [plan.md](./plan.md)

The Technical Context carried no `NEEDS CLARIFICATION` markers. This document records design
decisions.

**The decisive finding**: Archive Docks (`#200`, commit `f3f814a5`) has already delivered this exact
capability for the **other checkpoint kind on the same map** — select mode, checkable markers, a
bulk action bar, selection shortcuts, and the whole bulk API. It reached this branch by
fast-forwarding onto `origin/master`. Weighing areas are therefore a **generalization of delivered
dock code from one kind to two**, not a new build, and the truck slice (a table with a checkbox
column) is the wrong precedent for the interface.

Three facts about the starting point:

- The **API single-archive path already exists** for weighing areas
  (`ArchiveWeighingAreaUseCase` + `POST /weighing-areas/:id/archive`).
- The **bulk API** does not (`archiveMany` exists for customers, transport companies, trucks, and
  now docks — not weighing areas).
- The **archive UI exists for docks only**. `weighing-area-details.tsx` already *renders* archive
  time and comment but offers no action, and `use-weighing-area-mutations.ts` has no archive
  mutation.

---

## D1: Reuse the existing single-archive backend verbatim

**Decision**: Wire the interface to the existing `POST /weighing-areas/:id/archive`. Do not touch
`archive_weighing_area_use_case.ts`, `weighing_area_policy.ts`, or
`LucidWeighingAreaRepository.archiveAvailable`.

**Rationale**: That endpoint already enforces every rule this spec restates — existence,
already-archived, `SiteReferenceUsageChecker` with `referenceType: 'WEIGHING_AREA'`, optional
trimmed comment, and lifecycle metadata. Editing correct, tested code for a spec asking for the same
behavior is pure risk. This mirrors `#200` D1 exactly.

**Alternatives considered**: Fold the single path into the bulk shape (`ids: [id]`) — rejected;
`#200`, trucks, and customers all keep `/:id/archive` and `/archive` separate.

---

## D2: Comment validation gap on the existing single path

**Decision**: Replace `archiveWeighingAreaValidator`'s bare
`comment: vine.string().nullable().optional()` with the shared `lifecycleComment()`, and build
`archiveWeighingAreasValidator` from `lifecycleIds()` + `lifecycleComment()`.

**Rationale**: The current rule **neither trims nor caps length**, while FR-009 requires trimming
(blank → absent) and FR-010 requires the 1,000-character cap. `lifecycleComment()` is exactly
`vine.string().trim().maxLength(1000).nullable().optional()`. `lifecycleIds()` delivers all three of
FR-033's rejections in one rule: `minLength(1)` (empty), `.uuid()` (malformed), `distinctUuids()`
(duplicates) — all during validation, i.e. before any weighing area changes.

Both helpers live in `#shared/validators/lifecycle_validator`, which is what `dock_validator.ts`
imports. (The `#200` research proposed moving them to a `site_reference_validator` module; the
delivered code converged on the `#shared` path instead — worth knowing when reading that document.)

**Note for review**: this changes behavior on the **already-delivered single path** — an over-long
comment starts returning 422. Spec-required (FR-009/FR-010), not scope creep, but it is the one
behavior change to shipped functionality here, so it belongs in the PR description.
`reactivateWeighingAreaValidator` has the identical gap and is **deliberately left alone**: that is
#206's to fix.

---

## D3: The bulk backend transposes the dock bulk archive

**Decision**: Mirror `#200`'s backend file-for-file, substituting the weighing area's fields and
`WEIGHING_AREA` reference type: `weighing_area_lifecycle_blockers.ts`,
`ArchiveWeighingAreasUseCase`, `LucidWeighingAreaRepository.archiveAvailableMany`, and
`WeighingAreasController.archiveMany` reusing the existing `WeighingAreaPolicy.archive`.

`findBulkBlockers` takes the **dock signature**, not the truck one:

```ts
findBulkBlockers(ids, byId, expectedStatus: 'AVAILABLE' | 'ARCHIVED', usedIds?)
```

**Rationale**: The `expectedStatus` parameter is what lets the same function serve reactivation, so
#206 inherits it instead of writing a second one — the reason `#200` chose it over the truck shape.
The reason union therefore includes `ALREADY_AVAILABLE` even though this slice only ever produces
`NOT_FOUND`, `IN_USE`, and `ALREADY_ARCHIVED`.

The generic `indexById`/`orderByIds` in `#shared/lifecycle/bulk_lifecycle_records` are reused rather
than redeclared locally (the dock module predates them and declares its own).

`archiveAvailableMany` runs in one transaction: `whereIn('id', ids).forUpdate()`, one set-based
usage call with the transaction client, blockers from the locked snapshot, then a single
`UPDATE … WHERE id IN (eligible) AND status = 'AVAILABLE'`. The row locks are what give FR-020 its
guarantee: a row locked by one transaction is invisible to a second transaction's `forUpdate()`
until the first commits, so the loser's blocker computation sees `ARCHIVED` and reports
`ALREADY_ARCHIVED` rather than double-archiving.

**Alternatives considered**: Per-id independent transactions or a queue — rejected; both weaken the
partial-success and all-or-nothing guarantees at no benefit for a ≤500-record collection.

---

## D4: Select mode generalizes from one kind to two

**Decision**: Widen the delivered dock select mode to be kind-parameterized rather than adding a
parallel weighing-area mechanism:

- Route param `selecting: z.enum(['docks'])` → `z.enum(['docks', 'weighing-areas'])`.
- `isSelectingDocks` / `checkedDockIds` / `toggleDockChecked` / `startSelectingDocks` /
  `handleShiftSelectDock` in `checkpoints-page.tsx` become parameterized by the kind being selected.
- The Ctrl/Cmd+A handler filters on the selecting kind instead of hard-coded `kind === 'DOCK'`.
- `BulkArchiveDocksActions` is generalized into `BulkArchiveCheckpointsActions`, taking the kind and
  a normalized outcome — see D8.

**`CheckpointMarker` needs no change at all.** It is already kind-agnostic: its `checked` prop
drives `aria-pressed` and derives the label from `CHECKPOINT_KIND_LABELS`, so
`Select weighing area Alpha Scale` and its `Deselect` counterpart come for free.

**Rationale**: This is FR-038 — one interaction model across both checkpoint kinds. `#200`'s D4
already rejected a separate table surface, reasoning that #197–#199 made the map the one canonical
place checkpoints are consulted and edited, and that a second surface would reopen "where do I
manage this from". That argument applies unchanged to weighing areas, and adding a second,
weighing-area-specific mechanism to the *same page* would be a sharper version of the same mistake.

The delivered dock behavior this inherits, all of it kind-scoped so the other kind keeps opening
details:

| Behavior | Delivered for docks | For weighing areas |
|---|---|---|
| Mode toggle | `Select docks` / `Stop selecting docks` | `Select weighing areas` / `Stop selecting weighing areas` |
| URL | `?selecting=docks` | `?selecting=weighing-areas` |
| Marker click while selecting | Toggles checked, does not open details | Same |
| Other kind's markers | Weighing areas keep opening details | Docks keep opening details |
| Archived markers | Not checkable; keep opening details | Same |
| Create actions | Hidden while selecting | Same |
| Shift-click a marker | Enters select mode and checks it | Same |
| Ctrl/Cmd+A | Checks every visible available dock | Every visible available weighing area |
| Ctrl/Cmd+A while typing | Native select-all preserved | Same |

**Alternatives considered**:

- *A weighing-area-specific selection mechanism alongside the dock one* — rejected: two mechanisms
  on one page, violating FR-038.
- *A selection-mode toggle of my own design* (the earlier draft of this plan, written before the
  dock slice was found) — rejected: it reinvented, slightly differently, what is already delivered
  and tested.
- *Generalize `selecting` to a free-form kind list allowing both kinds at once* — rejected: the
  bulk endpoints are per-resource, so a mixed selection could not be submitted as one request, and
  the spec scopes this slice to weighing areas (FR-039).

---

## D5: Selection lifetime and scoping

**Decision**: The **mode** lives in the URL (`?selecting=weighing-areas`); the **checked ids** live
in ephemeral `useState<Set<string>>`. Only visible, available weighing areas are checkable.

**Rationale**: This is the delivered dock split and it satisfies FR-036 directly. The mode belongs in
the URL because it survives reload and is part of the page's addressable state; the ids do not,
because a 500-UUID URL is untenable. Since only available markers are ever checkable and switching
the status filter or the resource-kind filter re-renders which markers exist, scope changes prune
the actionable set naturally. Search only sets `isSearchMatch` (dimming the marker) rather than
removing it, so a search-hidden weighing area **stays checked** — exactly what FR-036 requires.

---

## D6: Retrying the blocked weighing areas

**Decision**: No dedicated retry control. Archived weighing areas leave the available scope and drop
out of the selection; blocked ones **stay checked**, so pressing "Archive selected" again resubmits
exactly the blocked set.

**Rationale**: FR-035 asks that the administrator retry the unchanged ones without reselecting them,
and this satisfies it with no extra affordance. `#200`'s `resubmission.test.tsx` pins the behavior,
asserting the two request bodies are `[beta, north]` then `[north]`. This is a genuine improvement
on the truck approach (which swaps the button's target and relabels it to "Retry blocked trucks"),
and it is what an administrator would expect from a checkbox that visibly stayed checked.

---

## D7: Reporting the outcome

**Decision**: One toast. Success when nothing was blocked; otherwise
`{n} archived; {m} unchanged` with the per-weighing-area breakdown — `{name or id}: {reason}` — in
the description. Reason labels reuse the delivered map: `IN_USE` → "used by an active or planned
discharge", `ALREADY_ARCHIVED` → "already archived", `NOT_FOUND` → "not found".

**Rationale**: Satisfies FR-029 (per-record reason) and FR-034 (aggregate counts) with the wording
administrators already meet on this map for docks (FR-038).

**Failures are reported in a toast too, for both the single and bulk paths** — matching the dock
component exactly, with no divergence.

An earlier draft of this decision proposed rendering single-archive failures *inside* the dialog,
on the belief that a toast would lose the administrator's typed comment and so break US3 scenario 6
("shorten the comment and resubmit without reopening"). **That belief was wrong.** In
`dock-lifecycle-actions.tsx` — and now in the weighing-area equivalent — `setOpen(false)` runs only
on the success path, so a refusal leaves the dialog open with the comment intact. The toast reports
*what* went wrong; the still-open dialog is what makes it recoverable. US3 scenario 6 is satisfied
either way, so there was no reason to diverge, and the divergence was removed.

One detail the weighing-area toast adds: its description prefers the API error's **field-level
detail** (`details[0].message`) over the top-level `message`, because a VineJS validation failure's
top-level message is only "Validation failure" — which would not tell the administrator that the
comment is the problem. Same structure as the dock toast, strictly more actionable text.

---

## D8: Generalize the bulk action bar rather than mirror it

**Decision**: Replace `BulkArchiveDocksActions` with one kind-parameterized
`BulkArchiveCheckpointsActions` in `features/checkpoints/ui/`, serving both kinds. Not a
weighing-area sibling component.

**Rationale**: The two would be near-identical and must never drift — and #201 and #206 each want the
same bar again, so mirroring now would mean four copies of one toolbar. Generalizing once pays for
itself immediately.

**Shape** — the component stays free of per-resource knowledge (constitution V), taking a normalized
outcome and a copy record:

```ts
export type BulkArchiveBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

export type BulkArchiveOutcome = { archivedCount: number; blocked: BulkArchiveBlocker[] }

type BulkArchiveCheckpointsActionsProps = {
  kind: CheckpointKind
  selectedIds: string[]
  onClear: () => void
  onSuccess: (outcome: BulkArchiveOutcome) => void
  archive: (input: { ids: string[]; comment: string | null }) => Promise<BulkArchiveOutcome>
  refresh: () => void | Promise<void>
}
```

**The API response keys are asymmetric** — docks return `{ updatedDocks, blockedDocks }`, weighing
areas will return `{ updatedWeighingAreas, blockedWeighingAreas }`. That asymmetry is absorbed by a
per-feature `archive` adapter, which is exactly where the codebase already puts this kind of
translation (`dock-checkpoint-adapter.ts`, `weighing-area-checkpoint-adapter.ts`). Each feature owns
a small function mapping its own response onto `BulkArchiveOutcome`.

**Copy is a per-kind record, not a template.** Most strings interpolate cleanly from a plural label,
but the dialog description does not: docks say "no longer selectable for new discharges" while
weighing areas say "no longer offered for new operational work" — different meanings, not different
nouns. So a `Record<CheckpointKind, { … }>` holds the description, the comment field id, and the
plural label, alongside the existing `CHECKPOINT_KIND_LABELS` in `checkpoints/types.ts`.

**Migration order matters, and the dock tests are the safety net**: generalize first with docks as
the only consumer and the delivered dock suites (`bulk-archive-actions`, `resubmission`,
`select-mode`, `keyboard-shortcuts`) passing **unchanged**, then add the weighing-area consumer.
Those suites assert on accessible names and toast text, so if the generalized component still emits
`aria-label="Bulk dock actions"`, `Archive selected docks?`, and `1 dock archived` byte-for-byte,
they prove the refactor was behavior-preserving for docks. Any edit to a dock test during this step
is a signal the generalization changed behavior — treat it as a defect, not as test maintenance.

**Alternatives considered**:

- *Mirror into `WeighingAreaBulkLifecycleActions`* — rejected per the rationale above.
- *Generalize by passing the mutation hook itself* — rejected: it would drag `useDockMutations` /
  `useWeighingAreaMutations` typing into the shared component and re-couple it to each resource.
- *Keep the raw result shape and branch inside the component* — rejected: that is the per-resource
  knowledge the normalized `BulkArchiveOutcome` exists to keep out.
