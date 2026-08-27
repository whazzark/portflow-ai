# UI State Contract: Reactivate a Warehouse

> **Superseded in part (2026-08-25)** — the lifecycle UI this contract describes has been unified.
> The component names and the exact confirmation copy below are historical: every site reference now
> renders `ResourceLifecycleActions` / `BulkResourceLifecycleActions`, and every lifecycle string
> comes from `apps/web/src/components/lifecycle/lifecycle-copy.ts`. Reactivation now reads
> "…becomes available again for new operations", and lifecycle buttons carry the action alone
> (`Reactivate`, not `Reactivate warehouse`). The behavioral requirements in the sibling `spec.md`
> still hold; only their rendering moved.


**Feature**: `GH-211` | **Spec**: [../spec.md](../spec.md) | **API**: [warehouse-reactivate-api.md](./warehouse-reactivate-api.md)

Phase 1 output. Describes the states the warehouse map surface must express for reactivation, and
what already exists. Reactivation adds **no new screen, no new route, and no new URL parameter** —
it is a second direction on the surface `#207` introduced and `#210` extended.

---

## What is already delivered

Worth stating first, because it bounds the work:

| Capability | Where | Status |
|---|---|---|
| `intent: 'ARCHIVE' \| 'REACTIVATE'` driving every bulk label, tense, and toast | `bulk-resource-lifecycle-actions.tsx` | ✅ delivered by `#210` |
| `ALREADY_AVAILABLE` blocker label ("already available") | `DEFAULT_BLOCKER_REASON_LABELS` | ✅ delivered |
| Select mode, checkable polygons, action bar, Ctrl/Cmd+A and Escape shortcuts | `warehouses-page.tsx` + `resource-map/` | ✅ delivered |
| Pruning checked ids when the lifecycle filter moves, keeping search-hidden ones | `warehouses-page.tsx:106-116` | ✅ delivered |
| Restored door renders as available with no stale archive line | `warehouse-doors-panel.tsx:82-90` | ✅ delivered (research **D11**) |
| Archived lifecycle-status filter | `warehouse-map-controls.tsx` | ✅ delivered |

---

## Single-warehouse reactivation

### Entry point

`WarehouseDetails` currently renders its footer only when `canArchive && status === 'AVAILABLE'`.
It must render for both statuses, with the prop renamed `canManageLifecycle` to say what it now
gates (research **D8**).

`WarehouseLifecycleActions` currently returns `null` for an archived warehouse. It becomes
two-directional, keeping one dialog, one comment field, and one error path.

| Warehouse status | Administrator | Non-administrator |
|---|---|---|
| `AVAILABLE` | "Archive warehouse" (destructive) | no action |
| `ARCHIVED` | "Reactivate warehouse" (default variant) | no action |

The reactivate button is **not** `variant="destructive"` — returning a building to service is not a
destructive act, and the sibling reactivation actions use the default variant.

### Confirmation dialog

| Element | Archive (delivered) | Reactivate (new) |
|---|---|---|
| Title | "Archive warehouse?" | "Reactivate warehouse?" |
| Body | name + `describeDoorCascade(availableDoors)` | name + `describeDoorRestore(restorableDoors)` |
| Comment field | optional, `maxLength={1000}` | identical, same id prefix |
| Confirm | "Archive" | "Reactivate" |
| Cancel | leaves everything unchanged (FR-019) | identical |

`describeDoorRestore(count)` mirrors `describeDoorCascade`, with correct agreement at 0 / 1 / n:

- `0` → "No door returns to service with it."
- `1` → "Its 1 door returns to service."
- `n` → "Its {n} doors return to service."

The count comes from `countDoors(warehouse)` — every door the warehouse holds, since #216 made both
directions take all of them — and is **advisory**, exactly as the archive count is (research
**D10**). The success toast reports `reactivatedDoorCount` from the
response, so a stale advisory count never becomes a false claim about what happened.

### Outcome

| Outcome | Presentation |
|---|---|
| Success, 0 doors | toast "Warehouse reactivated" |
| Success, n doors | toast "Warehouse reactivated with {n} door(s)" |
| `404` | toast error, dialog **stays open** |
| `409 ALREADY_AVAILABLE` | toast error, dialog stays open |
| `422` | toast error with `error.details?.[0]?.message` — the field-level detail, since a validation failure's top-level message is only "Validation failure" |
| Transient | toast error, dialog stays open, retry re-submits |

The dialog staying open on failure is deliberate and already implemented for archival: the typed
comment survives a refusal so the administrator can correct and resubmit without reopening the
warehouse.

---

## Bulk reactivation

### Intent derivation

The gap is two lines in `warehouses-page.tsx`: `intent="ARCHIVE"` is hard-coded and `checkableIds`
admits only available warehouses. Both are replaced by the Checkpoints model (research **D9**):

```ts
// Undefined while nothing is checked, so any warehouse may start either kind of selection.
const selectionIntent: BulkLifecycleIntent | undefined = useMemo(() => {
  if (checkedIds.size === 0) return undefined
  const [firstCheckedId] = checkedIds
  return warehouses.find((w) => w.id === firstCheckedId)?.status === 'ARCHIVED'
    ? 'REACTIVATE'
    : 'ARCHIVE'
}, [checkedIds, warehouses])

const bulkIntent = selectionIntent ?? (status === 'archived' ? 'REACTIVATE' : 'ARCHIVE')
```

`checkableIds` then admits warehouses whose status matches the current intent, or either status
while nothing is checked:

| State | Checkable |
|---|---|
| Nothing checked | every visible warehouse an administrator may act on, either status |
| First checked is `AVAILABLE` | visible `AVAILABLE` warehouses only |
| First checked is `ARCHIVED` | visible `ARCHIVED` warehouses only |

**A selection is therefore homogeneous by construction** — a mixed-status submission is
unrepresentable, which is what lets one intent drive the whole action bar. This is the same
invariant `checkpoints-page.tsx:145-152` records.

Select-all (Ctrl/Cmd+A) uses the lifecycle filter as tie-breaker when nothing is checked yet, as
`checkpoints-page.tsx:288` does: `status === 'archived'` prefers `REACTIVATE`.

### Action bar

`BulkResourceLifecycleActions` needs no change. It receives:

| Prop | Value for reactivation |
|---|---|
| `intent` | `bulkIntent` |
| `singular` / `plural` | `"warehouse"` / `"warehouses"` — unchanged |
| `description` | `describeBulkDoorRestore(warehouseCount, restorableDoors)` |
| `blockerReasonLabels` | **omit the `IN_USE` override** — unreachable here, and the archive-specific wording ("a door is used by…") would be wrong if it ever surfaced |
| `submit` | `reactivateMany` → `toBulkLifecycleOutcome` (already direction-agnostic) |
| `onSuccess` | narrow `checkedIds` to `outcome.blocked` ids — same as archival |
| `refresh` | `mutations.refreshWarehouses` — unchanged |

Narrowing to the blocked ids rather than clearing is what delivers FR-037: the administrator retries
exactly the unchanged ones without reselecting them.

### Outcome presentation

Produced by the shared component from `intent`, so it is fixed rather than a choice:

| Case | Toast |
|---|---|
| All reactivated | "{n} warehouse(s) reactivated" |
| Partial | "{n} warehouse(s) reactivated; {m} unchanged" + per-entry reasons |
| All blocked | "0 warehouses reactivated; {m} unchanged" + per-entry reasons |
| Request failed | "Unable to reactivate warehouses" + parsed message |

Each blocked entry renders as `{name ?? id}: {reason label}`, where the label comes from
`DEFAULT_BLOCKER_REASON_LABELS` — "not found" or "already available".

---

## Mutations

```ts
// use-warehouse-mutations.ts
const reactivate = useMutation(
  tuyauQuery.warehouses.reactivate.mutationOptions({ onSuccess: () => invalidateWarehouses() }),
)
// Bulk reports partial success, so the action bar owns when to refresh — no onSuccess here.
const reactivateMany = useMutation(tuyauQuery.warehouses.reactivateMany.mutationOptions())
```

Symmetric with `archive` / `archiveMany`. The existing `invalidateWarehouses` comment already
explains why one invalidation suffices: the warehouse collection embeds every door, so the
warehouse's status and every door the restore touched refresh together.

---

## URL state

Unchanged. `status`, `search`, `selecting`, `warehouseId`, `doorId`, `doorStatus`, and `create` all
keep their current meaning. Reactivation introduces no parameter of its own — the intent is derived
from the checked set, not stored.

One existing behavior now matters more: `defaultDoorStatus(warehouse.status)` picks the doors panel's
default filter from the warehouse's status, so a warehouse that has just been reactivated defaults
to showing its available doors — including the ones just restored — without the administrator
changing the filter.

---

## Accessibility

Inherited, not re-specified: the dialog is an `AlertDialog` with a labelled `Textarea` and
`FieldDescription`, focus returns to the trigger on dismissal, and the action bar is the same
delivered component. The only new obligation is that the reactivate trigger carries an accessible
name distinct from the archive trigger, which the visible label already provides.
