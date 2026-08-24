# Contract: Weighing Area Creation UI State

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Defines the URL contract, component boundaries, and observable states the creation flow adds to the
existing `/checkpoints` workspace. It extends the contract #197/#198 established; nothing here
replaces it.

---

## 1. URL contract

`apps/web/src/routes/_authenticated/checkpoints.tsx` — one changed field:

```diff
- create: z.enum(['dock']).optional().catch(undefined),
+ create: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
```

| Param | Values | Meaning |
|---|---|---|
| `create` | `dock` \| `weighing-area` \| absent | Which creation flow is active. A single value makes the flows mutually exclusive by construction (FR-017). An unknown value falls back to `undefined` via `.catch`. |
| `checkpoint` | `<KIND>:<id>` | Unchanged. Set to the new area on success (FR-013). |
| `kinds`, `status`, `search` | Unchanged | `kinds` and `status` may be widened by a successful creation (FR-013). |

**Permission gate**: `create` is honored only when `isAdministrator(user)` — a non-administrator
loading `/checkpoints?create=weighing-area` directly sees the normal consultation view, no panel
and no armed placement (FR-005, FR-018). This mirrors the existing dock behavior, which has a test.

---

## 2. Page state

`CheckpointsPage` replaces its dock-specific booleans with one creation kind and one pending
placement:

| State | Type | Rules |
|---|---|---|
| creation kind | `'DOCK' \| 'WEIGHING_AREA' \| null` | Derived from `create` **and** the administrator check. Never two at once. |
| pending placement | `LatLng \| null` | Reset whenever the creation kind changes or becomes `null` — which delivers cancel (FR-016) and flow-switch discard (FR-017) from one rule. |

**Placement props passed to `CheckpointMap`** (the component itself is unchanged):

| Creation kind | `label` | `icon` |
|---|---|---|
| `DOCK` | `New dock` | anchor icon (existing) |
| `WEIGHING_AREA` | `New weighing area` | the weighing-area checkpoint icon, matching its map marker |

---

## 3. Create actions

The page's create-actions array gains a second entry, both gated on `isAdministrator(user)`:

```ts
[
  { key: 'DOCK',           label: 'New dock',           icon: …, onSelect: … },
  { key: 'WEIGHING_AREA',  label: 'New weighing area',  icon: …, onSelect: … },
]
```

`ResourceMapCreateControl` automatically switches from a single icon button to a dropdown at two
actions. The same array continues to feed `mapUnavailableActions`, so both kinds stay creatable
when the map itself fails to load.

---

## 4. Panel and form

| Component | Responsibility |
|---|---|
| `CreateWeighingAreaPanel` | Sheet header ("Create weighing area") + description telling the administrator to click the map, then renders the form. Mirrors `CreateDockPanel`. |
| `WeighingAreaForm` | Name field (TanStack Form, Zod: trimmed, 1–255), the shared coordinate fields, submit button, and error handling. |
| `resource-placement-fields.tsx` (shared, new) | The coordinate fields: per-axis text state, parsing, range/NaN messages, touched-gating, and two-way sync with the pending placement. Takes `idPrefix` (`weighing-area` / `dock`); knows nothing about either resource. |

`CheckpointSheet` needs no change — it already renders an opaque `createPanel` in `create` mode.

**Submit gating**: the submit button is disabled while there is no pending placement or a
coordinate field is in error, and the panel shows "A location must be placed before this weighing
area can be created." (FR-004).

**Error handling on submit**, in order:

1. `applyValidationError(formApi, error)` maps any 422 `details[].field` onto the matching field.
2. Otherwise, `parseApiError(error).code === 'E_WEIGHING_AREA_NAME_CONFLICT'` → inline error on the
   name field (FR-008).
3. Otherwise → `toast.error('Unable to create weighing area', { description })` (FR-015).

In all three cases the entered name and the pending marker are preserved (FR-014).

---

## 5. Success path

1. `useWeighingAreaMutations().create` posts the body and, `onSuccess`, invalidates
   `weighingAreaQueries.list()` — the new area enters the checkpoint collection with no page reload
   (FR-012).
2. The page clears the pending placement, shows `toast.success('Weighing area created')`, and
   navigates (`replace: true`) with:
   - `checkpoint` = `WEIGHING_AREA:<new id>` — the new area becomes the selected detail;
   - `create` = `undefined` — the flow closes;
   - `kinds` = `undefined` when it was `dock`, otherwise unchanged (FR-013);
   - `status` = `available` when it was `archived`, otherwise unchanged (FR-013).

Steps 3–4 exist because a filtered-out new record is dropped again by the page's stale-selection
effect; the dock handler carries the same widening and the same reasoning.

---

## 6. Observable states

| State | Trigger | Observable |
|---|---|---|
| Not offered | Non-administrator | No "New weighing area" action anywhere; `?create=weighing-area` is inert |
| Armed, unplaced | Action selected | Panel open, map cursor crosshair, existing markers muted, submit disabled with the placement hint |
| Armed, placed | Map click, or both coordinates typed | Draggable pending marker labeled "New weighing area"; coordinate fields show its values; submit enabled |
| Adjusting | Marker dragged, new point clicked, or a coordinate edited | Marker and fields stay in sync; exactly one pending marker exists |
| Submitting | Submit pressed | Button shows "Creating…" and is disabled |
| Rejected | 422 / 409 / network / server error | Message per §4; name and marker preserved |
| Created | 201 | Toast, panel closes, new area selected and visible per §5 |
| Cancelled | Sheet closed or dismissed | Marker removed, `create` cleared, map returns to consultation |
| Switched | Other creation action selected | This flow's marker discarded; the other flow arms |
