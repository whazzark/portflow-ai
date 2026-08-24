# Contract: Checkpoint Edit UI State

**Feature**: [../spec.md](../spec.md) | **Status**: Generalization of an existing contract. #199
shipped this state machine bound to docks
(`../../docks/update-a-dock/contracts/dock-edit-ui-state.md`); this contract supersedes it by keying
every part on **checkpoint kind + id**, with weighing areas as the second consumer. Dock behavior is
unchanged — only the names and keys of the state carrying it.

## URL contract

`apps/web/src/routes/_authenticated/checkpoints.tsx` widens one enum:

```ts
const checkpointSearchSchema = z.object({
  checkpoint: z.string().optional().catch(undefined),
  create: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
  edit: z.enum(['dock', 'weighing-area']).optional().catch(undefined),   // WIDENED
  kinds: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
  search: z.string().catch(''),
  status: z.enum(['all', 'available', 'archived']).catch('available'),
})
```

Editing a weighing area is `?checkpoint=weighing-area:<id>&edit=weighing-area`. The `edit` param
names the *mode and its kind*; the record comes from the existing `checkpoint` param, so there is
one source of truth for which checkpoint is in play.

`edit` is honoured only when all of the following hold; otherwise it is ignored and the sheet falls
back to `view`:

- `isAdministrator(user)`
- `checkpoint` resolves to a checkpoint present in the loaded collection
- **the resolved checkpoint's kind equals the `edit` value's kind** — a mismatched pair such as
  `?checkpoint=dock:1&edit=weighing-area` is inert, not ambiguous (research D5)
- the edit session latched `editable: true` (research D7)

`create` and `edit` stay mutually exclusive. If both appear, `create` wins and `edit` is dropped —
creation owns the map's placement arming, and two draft markers must never coexist.

## Sheet mode machine

`checkpoint-sheet.tsx` keeps `mode?: 'view' | 'create' | 'edit'` and its modality rules unchanged.
What changes is its edit-affordance props, which are currently dock-specific:

```ts
// before (#199)                    // after (#204)
canEditDock: boolean                canEditCheckpoint: boolean
onEditDock: () => void              onEditCheckpoint: () => void
```

`onEditCheckpoint` needs no kind argument: the sheet only ever offers editing for the checkpoint it
is currently displaying, and the page derives the kind from the live selection. `WeighingAreaDetails`
gains the `canEdit` / `onEdit` props `DockDetails` already has, and renders the same footer button
under the same conditions.

| Mode | Content | `modal` | `disablePointerDismissal` |
|---|---|---|---|
| `view` | `DockDetails` / `WeighingAreaDetails` | `true` | `false` |
| `create` | `CreateDockPanel` / `CreateWeighingAreaPanel` | `false` | `true` |
| `edit` | `EditDockPanel` / `EditWeighingAreaPanel` | `false` | `true` |

Edit shares create's modality because the map is the editing surface: an overlay would swallow the
map clicks and marker drags the feature depends on, and pointer-dismissal would discard an
in-progress edit on the first click aimed at the map.

## Transitions

Identical to #199's table, with "dock" read as "checkpoint of the edited kind":

| From | Trigger | To | Side effects |
|---|---|---|---|
| `view` (AVAILABLE, admin) | "Edit weighing area" | `edit` | Open session `{ kind, id, editable: true, origin }`; seed draft from stored coordinates |
| `edit` | "Back to weighing area details" / sheet close / browser back | `view` | Discard session and draft; record unchanged (FR-022) |
| `edit` | Save succeeds | `view` | Invalidate the weighing-area list; success toast; keep the checkpoint selected; **filters untouched** (research D8) |
| `edit` | Save fails, 404 | `view`, then deselect | Toast; clear `checkpoint` and `edit` from the URL |
| `edit` | Save fails, any other code | `edit` | Error surfaced per research D11; form values and draft marker preserved |
| `edit` | Selection changes to another checkpoint | `view` | Session and draft discarded; `edit` cleared with `checkpoint` (FR-023) |
| `view` (ARCHIVED or non-admin) | — | — | No "Edit weighing area" action rendered (FR-006, US3 AC3/AC5) |

## Session hook surface

`apps/web/src/features/checkpoints/use-checkpoint-edit-session.ts` — new home for state that
`checkpoints-page.tsx` carries inline today (research D3):

```ts
type CheckpointEditSession = {
  kind: CheckpointKind
  id: string
  /** Snapshotted at session start — never re-derived from live query data. */
  editable: boolean
  /** Where the checkpoint stood when this session started — not its live, refetchable position. */
  origin: LatLng
}

function useCheckpointEditSession(input: {
  requestedKind: CheckpointKind | null      // from the `edit` param, null while creating
  selected: { kind: CheckpointKind; id: string; latitude: number; longitude: number; status: string } | undefined
}): {
  isEditing: boolean
  session: CheckpointEditSession | null
  draft: LatLng | null
  setDraft: (point: LatLng) => void
  restoreOrigin: () => void
  clear: () => void
}
```

Three rules the hook owns, each carried over from the review of #199 and each now required across
kinds by FR-023 / SC-009:

1. A session is discarded whenever the selection it belongs to goes away, changes identity, or
   changes kind. `edit` is cleared in the URL everywhere `checkpoint` is cleared — the selection
   cleanup effect, the status-filter change, and the view-mode close.
2. `editable` and `origin` are snapshotted once. A background refetch of the list must never
   silently end an in-progress edit, nor let another administrator's concurrent move masquerade as
   this administrator's unsaved change, nor become what "Restore original position" restores.
3. Starting a creation flow is not offered while an edit session is open, so a creation cannot tear
   down an edit and discard the typed name and dragged position. The map's create controls are
   hidden for the duration, for **both** kinds.

## Map behavior while editing

`CheckpointsPage` passes the same `placement` prop it already passes during creation, now sourced
from the generalized session:

```ts
placement={
  isEditing && session && draft
    ? {
        armed: true,
        pending: draft,                     // never null in edit mode
        onPlace: setDraft,
        onMove: setDraft,
        label: selectedCheckpoint.name,     // the record's own name, not "New weighing area"
        icon: <CheckpointKindIcon className="size-3.5" kind={session.kind} />,
      }
    : /* creation, or undefined */
}
```

Everything else follows from `armed: true` and needs no new code: crosshair cursor, sibling markers
muted and non-selectable, zoom controls relocated so the sheet does not cover them.

The edited checkpoint's own marker is filtered out of the array passed to `<CheckpointMap
checkpoints={…}>`, so the draft marker is its only representation on the map (research D6). The
existing dock-specific predicate generalizes:

```ts
const mapCheckpoints = isEditing && session
  ? checkpoints.filter((c) => !(c.kind === session.kind && c.id === session.id))
  : checkpoints
```

The filter applies to the map's array **only**. `checkpoints` also feeds `hasMatches` and
`emptyMessage`; filtering there would make the page under-report how many checkpoints it has.

## `EditWeighingAreaPanel` surface

```ts
type EditWeighingAreaPanelProps = {
  area: WeighingAreaDto
  draft: PendingWeighingAreaPlacement            // never null
  /** Where the area stood when this edit session started — not its live, refetchable position. */
  origin: PendingWeighingAreaPlacement
  onDraftChange: (point: PendingWeighingAreaPlacement) => void
  onRestorePosition: () => void
  onCancel: () => void
  onNotFound: () => void
  onUpdate: (value: { name: string; latitude: number; longitude: number }) => Promise<WeighingAreaDto>
  onSuccess: (area: WeighingAreaDto) => void
}
```

Mirrors `EditDockPanel` one-for-one: a "Back to weighing area details" ghost button in the header,
title, description, then the form.

**Position-modified affordance**: when `draft ≠ origin`, the panel renders a `role="status"` line
reading that the position has been modified, alongside a control invoking `onRestorePosition`. The
comparison is against the **snapshotted origin**, never against the live DTO — that distinction was
a defect fixed in #199 and must not be reintroduced here.

## Generalized `WeighingAreaForm` surface

```ts
type WeighingAreaFormProps = {
  initialValues?: { name: string; latitude: number; longitude: number } | null  // null = create
  pending: PendingWeighingAreaPlacement | null
  onPendingChange: (point: PendingWeighingAreaPlacement) => void
  onSubmit: (value: { name: string; latitude: number; longitude: number }) => Promise<WeighingAreaDto>
  onSuccess: (area: WeighingAreaDto) => void
  onNotFound?: () => void      // update-only
  submitLabel: string          // "Create weighing area" | "Save changes"
  pendingLabel: string         // "Creating…"            | "Saving…"
  errorTitle: string           // "Unable to create weighing area" | "Unable to update weighing area"
}
```

`useCoordinateFields` is consumed unchanged. The create path passes `initialValues: null` and keeps
its `Boolean(pending)` submit gate plus the "A location must be placed…" hint; the edit path passes
real initial values, and its gate reduces to `!hasCoordinateError`.

Error branches grow from one to three, matching research D11: `E_WEIGHING_AREA_NAME_CONFLICT` onto
the name field, `E_WEIGHING_AREA_ARCHIVED` as a form-level error with a reactivation hint, and
`E_WEIGHING_AREA_NOT_FOUND` as a toast plus `onNotFound()`.

`Save` is **not** disabled when the form is pristine — a no-change submission must succeed (spec
US1 AC7 / FR-011, research D9).

## Accessibility

- The "Edit weighing area" trigger is a real `<button>` in the details footer, matching
  `DockDetails`.
- The "Position modified" line is `role="status"` so a drag-driven change is announced without
  stealing focus.
- Both coordinate inputs stay always-rendered and keyboard-editable, which is what lets an
  administrator with no pointing device reposition a weighing area at all (edge case in spec).
- Entering edit mode moves focus to the name field (`autoFocus` when `isEditing`); leaving it
  returns focus to the trigger.
