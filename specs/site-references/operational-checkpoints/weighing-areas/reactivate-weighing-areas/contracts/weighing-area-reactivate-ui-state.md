# Contract: Weighing Area Reactivation UI State

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Date**: 2026-08-25

The surface is the existing Checkpoints map at `/checkpoints`. No new route, no new search param,
no new component. This contract states what the two entry points must do and, just as importantly,
what must not change.

---

## A. Individual reactivation — the checkpoint detail sheet

**Entry point**: select an archived weighing-area marker → the sheet's footer.

| Viewer | Weighing area status | Footer contents |
| --- | --- | --- |
| Administrator | `AVAILABLE` | `Edit weighing area` + `Archive weighing area` (unchanged) |
| Administrator | `ARCHIVED` | `Reactivate weighing area` only — **new**; no Edit, because an archived weighing area is read-only |
| Non-administrator | Either | No footer (unchanged) |

`weighing-area-details.tsx` currently renders the footer under
`canEdit && area.status === 'AVAILABLE'`. It becomes `canEdit`, with `Edit weighing area` kept
under the `AVAILABLE` condition — the shape `dock-details.tsx` already uses (FR-013, FR-018).

**Dialog** (`weighing-area-lifecycle-actions.tsx`, archived branch):

| Element | Archived branch | Available branch (unchanged) |
| --- | --- | --- |
| Trigger label | `Reactivate weighing area` | `Archive weighing area` |
| Trigger variant | `default` | `destructive` |
| Title | `Reactivate weighing area?` | `Archive weighing area?` |
| Description | `This weighing area will be offered again for new operational work.` | existing sentence |
| Comment field | optional, `maxLength={1000}`, same label and hint | same |
| Confirm label | `Reactivate` | `Archive` |
| Success toast | `Weighing area reactivated` | `Weighing area archived` |
| Failure toast | `Unable to reactivate weighing area “{name}”` | `Unable to archive weighing area “{name}”` |

**Invariants that must survive the change** (research D8):

- The confirm handler keeps `event.preventDefault()`, so the dialog stays open on refusal and the
  typed comment survives; only success calls `setOpen(false)` (FR-016, US3 scenario 3).
- The failure toast description keeps preferring `error.details?.[0]?.message ?? error.message`, so
  an over-long comment reports the field-level reason rather than a bare "Validation failure"
  (FR-034).
- Cancel leaves the weighing area untouched (FR-014, US1 scenario 7).
- On success the mutation invalidates the weighing-area list query, so the map and sheet re-render
  from authoritative state with no manual reload (FR-017).

---

## B. Multiple reactivation — the map's select mode

**Entry point**: the existing `selecting=weighing-areas` mode (map control, or shift-click a
checkable marker, or Ctrl/Cmd+A).

### State machine (existing; this feature only makes one transition reachable)

```text
selecting = 'weighing-areas', checkedIds = ∅
        │
        │  check an ARCHIVED marker          check an AVAILABLE marker
        ▼                                    ▼
selectionIntent = 'REACTIVATE'          selectionIntent = 'ARCHIVE'
checkableIds = archived weighing areas  checkableIds = available weighing areas
bulkIntent   = 'REACTIVATE'  ← new      bulkIntent   = 'ARCHIVE'
        │                                    │
        └──────── clear selection ───────────┘  → intent undefined, both statuses checkable again
```

`selectionIntent` is derived from the first checked marker's status; `checkableIds` then admits
only markers matching `STATUS_FOR_BULK_INTENT[selectionIntent]` of the selecting kind. A selection
is therefore homogeneous by construction. Before this feature, `bulkIntent` was clamped to
`BULK_LIFECYCLE_INTENTS[selectingKind]`, which for weighing areas was `['ARCHIVE']` — so archived
weighing-area markers were never checkable and the `REACTIVATE` branch was unreachable.

### The three changes

| # | File | Change |
| --- | --- | --- |
| 1 | `checkpoints/types.ts` | `BULK_LIFECYCLE_INTENTS.WEIGHING_AREA: ['ARCHIVE'] → ['ARCHIVE', 'REACTIVATE']` |
| 2 | `checkpoints/types.ts` | `BULK_LIFECYCLE_DESCRIPTIONS.WEIGHING_AREA.REACTIVATE = 'These weighing areas will be offered again for new operational work.'` |
| 3 | `checkpoints/ui/checkpoints-page.tsx` | `submitBulkLifecycle`: for `WEIGHING_AREA`, route `bulkIntent === 'REACTIVATE'` to `weighingAreaMutations.reactivateMany`, else `archiveMany` — the same branch the dock arm already has |

The four `#206` forward-references are deleted as their placeholders are filled:
`checkpoints/types.ts:84-85`, and `checkpoints-page.tsx` at the `BULK_LIFECYCLE_CAPABLE_KINDS`
comment (~72-73), the `checkableIds` comment (~156), the Ctrl/Cmd+A comment (~260-261), and the
`bulkIntent` clamp comment (~576-577). Line numbers are indicative; grep for `#206`.

### Behavior that follows with no further edit

- **Toolbar**: `BulkCheckpointLifecycleActions` derives `Reactivate selected`, `Reactivate selected
  weighing areas?`, the `default` (non-destructive) button variant, and the `… reactivated` toast
  from `intent` + the kind's labels (FR-029, FR-033).
- **Blocked reporting**: `BLOCKER_REASON_LABELS.ALREADY_AVAILABLE` is already `already available`
  and `NOT_FOUND` already `not found`; the toast description lists `name ?? id: reason` per entry
  (FR-024).
- **Post-success selection**: `onSuccess` is chosen by intent, so `REACTIVATE` gets
  `handleBulkReactivateSuccess`, which clears the whole selection (research D5, FR-030).
- **Refresh**: `refresh` is chosen by kind, so weighing areas already invalidate their own list
  query (FR-017).
- **Ctrl/Cmd+A**: with the status filter on Archived and weighing areas the visible capable kind,
  the handler's preferred intent `REACTIVATE` now passes the `supportedIntents.includes(...)` clamp
  and selects every visible archived weighing area (FR-030).
- **Scope changes**: switching the lifecycle-status or resource-kind filter drops entries that are
  no longer listed, while a search term only hides them — both are existing `checkedIds`/
  `checkableIds` behavior (FR-031, US2 scenario 8).
- **Permissions**: the whole toolbar and select mode are gated on `canManageCheckpoints`
  (FR-032).
- **Single-selection unaffected**: the `checkpoint=<kind>:<id>` param and detail sheet are
  independent of select mode (FR-032).
- **Kinds never mix**: `selectingKind` scopes `checkableIds` to one kind, so a submission carries
  only weighing-area ids.

---

## C. Regression guards

These must keep passing untouched, and are the reason this contract enumerates what does *not*
change:

- `apps/web/src/features/checkpoints/__tests__/bulk-archive/*` — #205's weighing-area and dock
  bulk-archive flows.
- `apps/web/src/features/checkpoints/__tests__/bulk-reactivate/*` — #201's dock bulk-reactivate
  flow, which shares every code path this feature enables for a second kind.
- `apps/web/src/features/weighing-areas/__tests__/archive/*` — the individual archive dialog, whose
  component gains a branch here.
- `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx` — unchanged, so the
  mock and the real map keep the same `checkableIds` contract.
