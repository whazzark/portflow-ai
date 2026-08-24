# Contract: Dock Edit UI State

**Feature**: [../spec.md](../spec.md) | **Status**: New. Defines the URL contract, the sheet's mode
machine, and the map's behavior while a dock is being edited.

## URL contract

`apps/web/src/routes/_authenticated/checkpoints.tsx` gains one key:

```ts
const checkpointSearchSchema = z.object({
  checkpoint: z.string().optional().catch(undefined),
  create: z.enum(['dock']).optional().catch(undefined),
  edit: z.enum(['dock']).optional().catch(undefined),   // NEW
  kinds: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
  search: z.string().catch(''),
  status: z.enum(['all', 'available', 'archived']).catch('available'),
})
```

Editing is `?checkpoint=dock:<id>&edit=dock`. The `edit` param names the *mode*; the record comes
from the existing `checkpoint` param, so there is one source of truth for which dock is in play.

`edit` is honoured only when all of the following hold; otherwise it is ignored and the sheet falls
back to `view`:

- `isAdministrator(user)`
- `checkpoint` resolves to a dock present in the loaded collection
- the edit session latched `editable: true` (research D5)

`create` and `edit` are mutually exclusive. If both appear, `create` wins and `edit` is dropped —
creation owns the map's placement arming, and two draft markers must never coexist.

## Sheet mode machine

`checkpoint-sheet.tsx` currently declares `mode?: 'view' | 'create'` with the comment
`/** 'edit' is intentionally not modeled yet — see issue #199. */`. That comment is removed and the
union becomes `'view' | 'create' | 'edit'`.

| Mode | Content | `modal` | `disablePointerDismissal` |
|---|---|---|---|
| `view` | `DockDetails` / `WeighingAreaDetails` | `true` | `false` |
| `create` | `CreateDockPanel` | `false` | `true` |
| `edit` | `EditDockPanel` | `false` | `true` |

Edit shares create's modality because the map is the editing surface: an overlay would swallow the
map clicks and marker drags the feature depends on, and pointer-dismissal would discard an
in-progress edit on the first click aimed at the map (research D9).

## Transitions

| From | Trigger | To | Side effects |
|---|---|---|---|
| `view` (dock, AVAILABLE, admin) | "Edit dock" | `edit` | Open edit session `{ id, editable: true }`; seed draft placement from stored coordinates |
| `edit` | "Back to dock details" / sheet close / browser back | `view` | Discard session and draft; dock unchanged (FR-022) |
| `edit` | Save succeeds | `view` | Invalidate dock list; success toast; keep the dock selected |
| `edit` | Save fails, 404 | `view`, then deselect | Toast; clear `checkpoint` and `edit` from the URL |
| `edit` | Save fails, any other code | `edit` | Error surfaced per research D7; form values and draft marker preserved |
| `view` (ARCHIVED or non-admin) | — | — | No "Edit dock" action rendered (FR-006, US3 AC3/AC5) |

## Map behavior while editing

`CheckpointsPage` passes the same `placement` prop it already passes during creation:

```ts
placement={
  isEditingDock
    ? {
        armed: true,
        pending: draftPlacement,          // never null in edit mode
        onPlace: setDraftPlacement,
        onMove: setDraftPlacement,
        label: dock.name,                 // the dock's own name, not "New dock"
        icon: <AnchorIcon aria-hidden="true" className="size-3.5" />,
      }
    : /* creation, or undefined */
}
```

Everything else follows from `armed: true` and needs no new code: crosshair cursor, sibling markers
muted and non-selectable, zoom controls relocated to the free middle-left strip so the sheet does
not cover them.

One addition specific to editing — the edited dock's own marker is filtered out of the array passed
to `<CheckpointMap checkpoints={…}>`, so the draft marker is the only representation of that dock on
the map (research D3):

```ts
const mapCheckpoints = isEditingDock
  ? checkpoints.filter((c) => !(c.kind === 'DOCK' && c.id === editingDockId))
  : checkpoints
```

The filter applies to the map's array **only**. `checkpoints` also feeds `hasMatches` and
`emptyMessage`; filtering there would make the page under-report how many checkpoints it has.

## `EditDockPanel` surface

```ts
type EditDockPanelProps = {
  dock: DockDto
  draft: PendingDockPlacement            // never null
  onDraftChange: (point: PendingDockPlacement) => void
  onRestorePosition: () => void          // reset draft to the dock's stored coordinates
  onCancel: () => void
  onUpdate: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onSuccess: (dock: DockDto) => void
}
```

Mirrors `EditCustomerPanel` / `EditTransportCompanyPanel`: a "Back to dock details" ghost button in
the header, title, description, then the form.

**Position-modified affordance** (research D10): when
`draft.latitude !== dock.latitude || draft.longitude !== dock.longitude`, the panel renders a
`role="status"` line reading that the position has been modified, alongside a control invoking
`onRestorePosition`. A stray drag while panning is easy; without this, the only recovery is
abandoning the whole edit and retyping the name.

## Generalized `DockForm` surface

```ts
type DockFormProps = {
  initialValues: { name: string; latitude: number; longitude: number } | null  // null = create
  pending: PendingDockPlacement | null
  onPendingChange: (point: PendingDockPlacement) => void
  onSubmit: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onSuccess: (dock: DockDto) => void
  submitLabel: string        // "Create dock" | "Save changes"
  pendingLabel: string       // "Creating…"   | "Saving…"
  errorTitle: string         // "Unable to create dock" | "Unable to update dock"
}
```

`useCoordinateFields` is consumed unchanged. The create path passes `initialValues: null` and keeps
its `Boolean(pending)` submit gate plus the "A location must be placed…" hint; the edit path passes
real initial values, and its gate reduces to `!hasCoordinateError`.

`Save` is **not** disabled when the form is pristine — a no-change submission must succeed (spec
US1 AC7 / FR-011, research D6).

## Accessibility

- The "Edit dock" trigger is a real `<button>` in the details header, adjacent to the status badge.
- The "Position modified" line is `role="status"` so a drag-driven change is announced without
  stealing focus, matching how the create form announces its placement hints.
- Both coordinate inputs stay always-rendered and keyboard-editable, which is what lets an
  administrator with no pointing device reposition a dock at all (edge case in spec).
- Entering edit mode moves focus to the name field; leaving it returns focus to the "Edit dock"
  trigger.
