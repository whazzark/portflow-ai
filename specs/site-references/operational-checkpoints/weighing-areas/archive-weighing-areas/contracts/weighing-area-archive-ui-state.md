# Contract: Weighing Area Archive UI State

**Feature**: `GH-205` | **Date**: 2026-08-24

Covers the Checkpoints page and the weighing-area archive actions.

**Baseline**: Archive Docks (`#200`) delivered this whole interaction for dock markers on this same
map. This contract specifies the **weighing-area half of a now kind-parameterized model**, and
every row below is the delivered dock behavior applied to the other kind (FR-038). Where behavior is
unchanged from the dock implementation, that is stated rather than restated.

---

## A. Single archive

Offered from the weighing-area detail sheet, mirroring `dock-details.tsx` → `DockLifecycleActions`:
rendered only when the viewer may manage checkpoints **and** `status === 'AVAILABLE'`. Nothing
lifecycle-related renders for an archived weighing area, and no action is offered to
non-administrators (FR-023).

`WeighingAreaLifecycleActions` mirrors `DockLifecycleActions`: a destructive trigger, an
`AlertDialog` titled "Archive weighing area?", a statement that it stays readable but is no longer
offered for new operational work, and an optional comment (`maxLength={1000}`, "Maximum 1,000
characters"). Cancel changes nothing (FR-018).

Outcomes: success closes the dialog, invalidates the weighing-area list so the map updates without a
reload (FR-022), and confirms with `toast.success('Weighing area archived')`. A failure surfaces as
`toast.error('Unable to archive weighing area “{name}”', { description })` carrying the parsed
reason — distinguishing not-found, already-archived, in-use, and validation failures (FR-019). The
title names the weighing area (typographic quotes, matching the repo's convention for quoting a
value in a message) so a refusal is attributable when several archivals are in flight; the
description prefers the API error's field-level detail over its top-level message, since a
validation failure's top-level message is only "Validation failure".

**A failure leaves the dialog open**, with the typed comment intact — the dialog closes only on
success. That is what makes US3 scenario 6 work: the toast says what went wrong, and the still-open
dialog lets the administrator shorten an over-long comment and resubmit without reopening the
weighing area.

**Archive-only, not bidirectional** (`#200` D6): this component offers Archive and nothing else.
Reactivation is #206's, and pre-building it here would ship UI ahead of its own spec and tests.

---

## B. Select mode

The delivered dock mode, widened to take a kind.

| | Docks (delivered) | Weighing areas (this slice) |
|---|---|---|
| Toggle in map controls | `Select docks` | `Select weighing areas` |
| Toggle while active | `Stop selecting docks` | `Stop selecting weighing areas` |
| URL | `?selecting=docks` | `?selecting=weighing-areas` |

Offered only to administrators (FR-037). While a mode is active:

- Markers **of the selecting kind** that are `AVAILABLE` become checkable: clicking toggles instead
  of opening details.
- Markers of the **other** kind keep opening their details sheet, unchanged.
- **Archived** markers of either kind are not checkable and keep opening details.
- Create actions ("New dock", "New weighing area") are hidden.
- The single-selection `checkpoint=<kind>:<id>` param is cleared on entry and untouched thereafter.

Leaving the mode clears the checked set.

`CheckpointMarker` requires **no change**: its `checked` prop already drives `aria-pressed`,
`data-checked`, a `ring-2` selected style, and an accessible name derived from
`CHECKPOINT_KIND_LABELS` — so `Select weighing area Alpha Scale` / `Deselect weighing area Alpha
Scale` are produced automatically.

---

## C. Selection shortcuts

Inherited from `#200`, applied to the selecting kind (FR-038):

| Gesture | Behavior |
|---|---|
| Shift-click an available marker, not yet selecting | Enters select mode **and** checks that marker |
| Shift-click while already selecting | Plain toggle — shift adds nothing further |
| Plain click, not selecting | Opens details, unchanged |
| Ctrl/Cmd+A | Checks every visible available weighing area, entering select mode on the fly |
| Ctrl/Cmd+A while focus is in an input, textarea, or contenteditable | Ignored — native select-all preserved |

The Ctrl/Cmd+A handler must filter on the **selecting kind**, replacing the delivered
`kind === 'DOCK'` predicate; a no-op when nothing eligible is visible.

---

## D. Selection scoping (FR-036)

Mode in the URL, checked ids in ephemeral `useState<Set<string>>` (research D5).

| Change | Effect |
|---|---|
| Status filter leaves `available` | Nothing checkable; actionable set empties |
| Resource-kind filter hides weighing areas | Actionable set empties |
| Search term hides a checked marker | **Stays checked** — search dims (`isSearchMatch`), it does not remove |
| A checked weighing area is archived elsewhere | Drops out on refresh |

Only visible available markers are ever checkable, so scope changes prune the actionable set as a
consequence of what the map renders rather than through separate bookkeeping.

---

## E. Bulk action bar

Rendered by `BulkArchiveCheckpointsActions` — the delivered `BulkArchiveDocksActions` generalized to
take a `kind` (research D8), serving both checkpoint kinds. `role="toolbar"`,
`aria-label="Bulk weighing area actions"`, `inert` + `aria-hidden` when empty so it never traps
focus. Visible once at least one weighing area is checked. Contents: `{n} selected`, a destructive
**"Archive selected"**, and a ghost **"Clear selection"** (`aria-label`).

The dock rendering must stay byte-identical through the generalization —
`aria-label="Bulk dock actions"`, `Archive selected docks?`, `1 dock archived` — so the delivered
dock suites pass unchanged and act as the regression guard.

Dialog: "Archive selected weighing areas?", stating they remain readable but will no longer be
offered for new operational work, with one optional comment (`maxLength={1000}`) applying to every
weighing area in the submission (FR-030). The confirm action disables while submitting, so a
double-click cannot produce two submissions.

**No dedicated retry control** (research D6): archived weighing areas leave the available scope and
drop out of the selection, while blocked ones stay checked — so pressing "Archive selected" again
resubmits exactly the blocked set, satisfying FR-035.

---

## F. Outcome reporting (FR-029, FR-034)

| Result | Toast | Message |
|---|---|---|
| All archived | success | `{n} weighing areas archived` |
| Some blocked | success with description | `{n} archived; {m} unchanged` |
| Request failed | error | `Unable to archive weighing areas` + parsed reason |

Description lists each blocked weighing area as `{name ?? id}: {reason}`, reusing the delivered
labels: `IN_USE` → "used by an active or planned discharge", `ALREADY_ARCHIVED` → "already
archived", `NOT_FOUND` → "not found" (`ALREADY_AVAILABLE` exists in the union for #206 and is never
produced here). Counts are pluralized. The list is invalidated afterwards so the map reflects
authoritative state without a reload (FR-022).

Whole-request rejections — over-long comment, duplicate or malformed ids — surface the same way, as
a toast, with the dialog left open and the selection intact so the submission can be corrected and
retried. No divergence from the dock component (research D7).

---

## G. Accessibility

Unchanged from the delivered dock behavior: markers stay keyboard-reachable `button`s in both modes,
toggling with Enter/Space via `aria-pressed`; dialogs use the existing `AlertDialog` focus-trap and
return-focus; the toolbar is `inert` when hidden; copy follows the established application language.

---

## H. Test surface (Vitest + Testing Library + MSW)

Mirror `#200`'s layout, which splits map-level selection from resource-level archiving:

```text
features/checkpoints/__tests__/bulk-archive/
  select-mode.test.tsx        # + weighing-area cases, and the symmetry assertion:
                              #   while selecting weighing areas, dock markers open details
  keyboard-shortcuts.test.tsx # shift-click and Ctrl/Cmd+A for the weighing-area kind
  bulk-archive-actions.test.tsx
  resubmission.test.tsx       # blocked stay checked; assert the two request bodies
features/weighing-areas/__tests__/archive/
  individual.test.tsx
  permissions.test.tsx        # no action, no toggle for non-administrators
```

The symmetry assertions matter most: the delivered dock tests already assert that weighing-area
markers keep opening details while selecting docks, and the mirror of that — dock markers keeping
their details behavior while selecting weighing areas — is what proves the generalization did not
break the other kind.
