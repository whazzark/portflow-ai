# UI State Contract: Reactivate a Warehouse Door

**Feature**: `GH-216` | **Surface**: `/warehouses` → Doors panel of the selected warehouse

This slice introduces **no map mode, no route, and no search parameter**. A lifecycle confirmation
is a dialog over the existing consultation surface, so the contract below is about what the row menu
offers, what the dialog says, and what changes after a submission.

## Entry point

The `Reactivate` entry lives in the per-row administration menu (`⋮`) of a door row in the Doors
panel, beside `Edit` — the container `WarehouseDoorRowActions` was introduced empty by #214 for
exactly this.

### When the entry is offered

```
warehouseDoorLifecycleActions(door, warehouseStatus) → ['reactivate']

  door.status === 'ARCHIVED'
  && warehouseStatus === 'AVAILABLE'
```

Anything else yields `[]`. With `[]` and no `Edit` available, `ResourceRowActions` renders **nothing
at all** — not a disabled entry, not an empty menu. The `⋮` trigger disappears from the row.

| Row situation | `Edit` | `Reactivate` | Menu visible? |
|---|---|---|---|
| Available door, available warehouse | yes | — | yes |
| Archived door, available warehouse (⇒ archived on its own) | — | **yes** | yes |
| Any door of an archived warehouse (⇒ archived with it) | — | — | no |
| Any door, viewer without warehouse-door management permission | — | — | no |

The last row is enforced one level up: `warehouses-page.tsx` passes `onEditDoor` only when
`canManageWarehouses`, and the same gate will withhold the lifecycle callback. The API re-decides
every one of these conditions regardless (FR-024).

### Why the third row shows nothing rather than an explanation

A door archived with its warehouse already carries the reason on its own row —
`Archived with this warehouse · <date> · <comment>` — and the remedy is a warehouse action, not a
door action. A menu entry that only opens an explanation would be a control that controls nothing.
This is the "absent, not disabled" rule recorded in the spec's Assumptions.

## The confirmation

Rendered by the shared `ResourceLifecycleDialog` with a `ResourceLifecycleConfig` whose
`singular` is `'warehouse door'` and whose `name` is the door's name. Every string below comes from
`components/lifecycle/lifecycle-copy.ts` unchanged — **no door-specific copy, and no `describeEffect`
override** (spec FR-022).

```
┌─────────────────────────────────────────────┐
│ Reactivate warehouse door?                  │  lifecycleDialogTitle
│                                             │
│ “Door 3” becomes available again for new    │  describeLifecycleEffect
│ operations.                                 │
│                                             │
│ Comment (optional)                          │  LIFECYCLE_COMMENT_LABEL
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │  Textarea, maxLength 1000
│ └─────────────────────────────────────────┘ │
│ Keep a short explanation for the lifecycle  │  LIFECYCLE_COMMENT_DESCRIPTION
│ change (maximum 1,000 characters).          │
│                                             │
│                    [ Cancel ]  [ Reactivate ] │
└─────────────────────────────────────────────┘
```

- The confirm button is the `default` variant, per `ACTION_VARIANTS.reactivate` — the destructive
  variant is archival's.
- While the mutation is in flight the button reads `Reactivating…` and is disabled
  (`LIFECYCLE_PENDING_LABELS`).
- The button label carries the action alone; the title names the resource, because a title is read
  out of context and a button is not.
- The confirmation names the door, not its containing warehouse: the panel it opens from is already
  scoped to one selected warehouse (spec Assumptions).

## After a submission

### Success

| What | Behavior |
|---|---|
| Dialog | Closes; the comment state is reset |
| Toast | `Warehouse door reactivated` (`lifecycleSuccessMessage`), success variant |
| Cache | `warehouseQueries.list()` invalidated — the one query that carries the doors |
| Panel | The door leaves the Archived tab and appears in the Available tab; both tab counts move |
| Row | Loses its `Archived …` provenance line, gains `Reactivated · <date> · <comment>` |
| Map | The door's marker switches from the archived styling to the available styling |
| Tab / selection | **Untouched.** The administrator stays on the Archived tab (research R11) |

The tab is deliberately not switched: an administrator reactivating doors is usually working through
a batch of archived ones, and following each door to the other tab would move them away from that
list once per door. The toast and the two counts are the confirmation.

### Refusal

| What | Behavior |
|---|---|
| Dialog | **Stays open**, with the typed comment intact — `event.preventDefault()` on the confirm action |
| Toast | `Unable to reactivate warehouse door “Door 3”` (`lifecycleFailureTitle`), error variant, described by the server's message |
| Cache | `warehouseQueries.list()` invalidated **on this path too** — a refusal usually means the authoritative state moved on |
| Panel | Re-renders from the refetched collection; a door reactivated by someone else in the meantime is already gone from the Archived tab |

The refetch-on-refusal is what makes the races self-correcting: after an
`E_WAREHOUSE_DOOR_ALREADY_AVAILABLE` or an `E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE`, the panel the
administrator
returns to already reflects why.

### Message shown per refusal

| Code | Description shown in the toast |
|---|---|
| `E_WAREHOUSE_DOOR_ALREADY_AVAILABLE` | Warehouse door is already available |
| `E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE` | This warehouse door was archived with its warehouse. Reactivate the warehouse and the door returns with it. |
| `E_WAREHOUSE_DOOR_NOT_FOUND` | Warehouse door not found |
| `E_WAREHOUSE_NOT_FOUND` | Warehouse not found |
| validation (422) | The field-level message, since a 422's top-level message is only "Validation failure" |

The last row is `ResourceLifecycleDialog`'s existing behavior: it reads
`error.details?.[0]?.message` ahead of `error.message` for exactly this reason.

## The row's lifecycle line

Both directions are gated on the door's **current** status, never on the presence of a timestamp:

```
door.status === 'ARCHIVED' && door.archivedAt
  → "Archived with this warehouse" | "Archived on its own" · <date> [· <comment>]

door.status === 'AVAILABLE' && door.reactivatedAt
  → "Reactivated" · <date> [· <comment>]
```

The archived line already exists and is unchanged. The available line is added by this slice
(research R10). Neither renders the actor: the embedded door DTO exposes `reactivatedByUserId` and
`archivedByUserId`, not resolved users.

Gating on the current status is what stops a reactivated door from continuing to present itself as
archived — `archivedAt` survives the transition on purpose.

## Accessibility and interaction

- The menu trigger keeps its existing `Actions for {door name}` accessible name.
- The dialog is the shared `AlertDialog`; focus moves into it on open and returns to the trigger on
  close, and `Escape` cancels — all inherited, none re-implemented.
- The comment field is labelled by `FieldLabel` and described by `FieldDescription`.
- Nothing here requires a pointing device or the map: the whole flow is a list row, a menu, and a
  dialog, so it stays usable when the map background cannot be displayed.
