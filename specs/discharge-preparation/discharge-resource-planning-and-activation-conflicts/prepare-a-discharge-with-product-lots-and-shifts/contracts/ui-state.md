# Contract: Discharge Preparation UI State

This contract covers the creation page and the correction actions on the discharge detail. The
detail page's layout, sections, and read states stay as GH-58's
[`ui-state.md`](../../consult-a-prepared-discharge-in-the-web-workbench/contracts/ui-state.md)
defines them. This contract only adds to them.

"Preparer" below means an active operations lead, operations admin, or organization admin
(`canPrepareDischarges`). "Observer" means an active observer.

## Routes

| Route | File | Owner of search | Breadcrumb |
|---|---|---|---|
| `/discharges` (layout) | `routes/_authenticated/discharges.tsx` | `status`, `search` (unchanged) | `Discharges` |
| `/discharges/` | `routes/_authenticated/discharges.index.tsx` | inherited | none |
| `/discharges/new` | `routes/_authenticated/discharges.new.tsx` (new) | inherited | `New discharge` |
| `/discharges/$dischargeId` | `routes/_authenticated/discharges.$dischargeId.tsx` | inherited | vessel name |

The static `new` segment takes precedence over `$dischargeId`. `new` is not a UUID, so it could
never name a discharge anyway.

## URL state

- The creation page adds no search parameter. Its in-progress values are form state, and they are
  discarded when the user leaves the page (spec Assumptions: no draft).
- The correction sheets are not reflected in the address. A detail address always opens the
  detail, never a sheet. A sheet holds a short edit of a record already on screen, and GH-58's
  detail address must keep opening the detail alone.

## Reaching the creation page

| Viewer | Discharges list | Empty list or tab | Direct `/discharges/new` |
|---|---|---|---|
| Preparer | `Create discharge` button beside the search, linking to `/discharges/new` with the current search | `Create discharge` inside the empty state | Page opens |
| Observer | No button | No button | `beforeLoad` redirects, replacing the entry, to `/discharges` with the same search |

A non-active or unauthenticated visitor never reaches the page: the authenticated layout already
redirects them to login or password renewal.

## Creation page states

| State | Shown when | Content |
|---|---|---|
| Pending | The session is being resolved (`beforeLoad`) | Heading `New discharge` and form-shaped skeletons |
| Options loading | Available docks, available customers, or eligible responsibles still loading | The form is shown at once and usable. Each field fed by that list is read-only with `aria-busy`, placeholder `Loading…`, and a spinner inside the input |
| Options failed | One of those lists fails | Only the fields fed by it are read-only with placeholder `Unable to load` and a `Retry loading {field}` button inside the input, which fetches that list again; the rest of the form stays usable |
| No options | A list loaded empty: no available dock, no available customer, or no eligible responsible | Alert `A discharge cannot be created yet` listing `No available dock`, `No available customer`, or `No eligible responsible`. The form still renders, but the submit button stays disabled |
| Ready | Options loaded | Fields open their list, filtered by typing |
| Saving | Submission in flight | Submit button disabled, label `Creating…`; the form cannot be submitted again (FR-032) |
| Refused on values | `422` | Errors under each offending field (paths from the API mapped to fields); a detail naming no rendered field is appended to the form-level error; focus moves to the first field in error; every entered value is kept (FR-029) |
| Failed | Network failure, `5xx`, or an unexpected code | Toast `Unable to create discharge “{vesselName}”` with the API message; values kept; submitting again resends the same creation identity (FR-031, research.md Decision 2) |
| Created | `201`, or `200` on a replay | Toast `Discharge “{vesselName}” created`; navigate to `/discharges/{id}` with `status: 'planned'` and the search kept |

## Creation form layout

The creation walks through three steps, and shows one section card at a time. From top to bottom, the page is:
- `Back to discharges`, the heading `New discharge`, and a one-line description;
- the missing-collection alert, when a list loaded empty;
- the step indicator;
- the card of the current step;
- a footer resting on the bottom of the page.

The content column is at most `max-w-5xl` wide, and the page fills the height under the header.

### Step indicator

A `nav` named `Discharge preparation steps`, holding one numbered button per step: `1 Vessel and dock`, `2 Product lots`, and `3 Planned shifts`.
- The current step carries `aria-current="step"`.
- A step already reached shows a check mark, is announced as completed, and opens on a click, back or forward, without validation.
- A step not reached yet is disabled.
- Below `md`, only the numbers are visible, followed by `Step {n} of 3 · {label}`.

### Moving between steps

- The primary footer action reads `Next: Product lots`, then `Next: Planned shifts`, then `Create discharge`.
- A `Next` action is disabled until every value of the current step is valid, including the rules across its lots.
- Pressing Enter in a field submits in the same way: the step moves on when it is valid, and otherwise focus goes to its first field in error.
- `Back` appears from step 2 onward.
- Every value is kept when moving between steps.
- On a step change, the page scrolls back and focus moves to the new card's heading.
- When the API refuses values, the earliest step holding a refused, rendered field opens, and focus goes to the first field in error. Refusals on other steps show as soon as those steps are opened, until the next submission.
- The missing-collection alert disables the primary action on every step.

### Section cards

The cards are unchanged from the single-page layout. Each has a title, a description, and a live count in its header (`2 lots`, `2 shifts`).

1. **Vessel and dock**, a two-column grid that stacks below `sm`:
   - `Vessel name` (required) and `IMO number` (optional; placeholder `7 digits, when known`);
   - `Dock` (required searchable select) and `Expected start` (required date and time);
   - `Vessel comment` (optional, two rows, full width).
2. **Product lots**: column headers `Customer · Product · Quantity (t)`, shown from `md` up and `aria-hidden`, then one row per lot, separated by dividers.
   - Each row is a `fieldset` whose `sr-only` legend is `Product lot {n}`. It holds `Customer` (required searchable select), `Product name` (required), `Expected quantity (t)` (required, right-aligned), and a trash icon button `Remove product lot {n}`, disabled while only one lot remains.
   - Labels are visually hidden from `md` up.
   - `Add description` opens the optional `Description` below the row and moves focus into it.
   - Below `md`, the fields stack with their labels, and the row shows a `Product lot {n}` title with its remove button beside it.
   - Below the rows: `Add product lot`.
3. **Planned shifts**: column headers `Planned start · Planned end · Responsible · Duration`, then one row per shift, with the same row rules.
   - Each row holds `Planned start`, `Planned end`, `Responsible` (required searchable select), the computed duration (`8 h`, `7 h 30`, `45 min`, or `—`), and `Remove shift {n}`.
   - `Add shift` adds a row that starts when the last shift ends and lasts as long, with its responsible empty.

### Footer

A `region` named `Discharge summary`, sticky at the bottom of the page and spanning the content area.
- On wide screens it is 64px tall under a 1px top border, so that border lines up with the separator above the sidebar's profile.
- It holds:
  - `{n} lots · {expected tonnage} · {n} shifts · {earliest start} → {latest end}`, with times to the minute, or `No planned period yet`;
  - `Cancel`, `Back` (from step 2), and the primary action.
- The form-level error, when any, shows at the end of the content column, just above the footer.

The page opens on step 1 with one empty lot row and one empty shift row waiting in their steps.

Each field's own rules run on every change, so an error always reflects the current value. An
error recorded while a field was still empty is never revealed once the field is typed with a
valid value.

The dock, customer, and responsible fields are searchable selects (`ComboboxField`):
- typing narrows the options to those containing the text, ignoring case and accents;
- `No dock matches`, `No customer matches`, or `No responsible matches` is shown when nothing does;
- the chevron button (`Show … options`) opens the full list without typing.

The same fields, with the same loading and retry states, are used in the correction sheets. There, the current dock or customer is offered from the first frame, so its pre-filled value shows while the list loads.

Client-side validation mirrors the API and never replaces it:
- Required fields, formats, and bounds are checked on every change and on submit.
- Duplicate lots (same customer and product name, ignoring case and surrounding spaces), a planned
  end not after its start, and overlapping shifts are first checked on submit, then on every change
  once a submission was attempted, so fixing one shift clears the error it caused on another. They
  are reported on `productLots[i].productName`, `shifts[i].plannedEndAt`, and
  `shifts[i].plannedStartAt`.

## Detail page additions

Correction actions render only for a preparer when the discharge's status is `PLANNED`. For an
observer, and for an active or closed discharge, the detail is exactly GH-58's.

| Location | Action | Opens |
|---|---|---|
| `Overview` card header | `Edit` | `Edit discharge` sheet |
| `Product lots` card header | `Add product lot` | `Add product lot` sheet |
| `Product lots` empty state | `Add product lot` | same |
| Each lot's header row | `Edit` | `Edit product lot` sheet, pre-filled |
| Each lot's header row | `Remove` | `Remove product lot` confirmation |

Accessible names include the lot, because several lots share a page. `Edit` and `Remove` carry
`aria-label="Edit {customer} · {product}"` and `aria-label="Remove {customer} · {product}"`, while
their visible labels stay `Edit` and `Remove`.

### Sheets (`Sheet`, right side)

| Sheet | Fields | Submit label (pending) |
|---|---|---|
| `Edit discharge` | the Vessel and dock fields, pre-filled; the dock options include the current dock | `Save` (`Saving…`) |
| `Add product lot` | the lot fields, empty | `Add product lot` (`Adding…`) |
| `Edit product lot` | the lot fields, pre-filled; the customer options include the lot's current customer | `Save` (`Saving…`) |

| Outcome | Behavior |
|---|---|
| Success | Sheet closes; the detail cache is replaced with the response; the list is invalidated; toast `Discharge “{vesselName}” updated`, `Product lot added`, or `Product lot updated` |
| `422` | Sheet stays open with field errors; values kept |
| `409 E_DISCHARGE_NOT_PLANNED` | Sheet closes; detail refetched; toast `This discharge has started and can no longer be corrected` |
| `404` (discharge or lot) | Sheet closes; detail refetched, or the not-found state if the discharge itself is gone; toast `This product lot no longer exists` for a lot |
| Other failure | Sheet stays open; toast with the API message; values kept |

Closing a sheet with unsaved values discards them without confirmation, as the other application
sheets do.

### Remove confirmation (`AlertDialog`, destructive)

- Title: `Remove product lot?`
- Description: `{customer} · {product}, {quantity}, will be removed from this discharge.`
- Buttons: `Cancel` and `Remove` (`Removing…`, disabled while pending)

| Outcome | Behavior |
|---|---|
| Success | Dialog closes; detail cache replaced; list invalidated; toast `Product lot removed` |
| `409 E_DISCHARGE_LAST_PRODUCT_LOT` | Dialog stays open with an inline alert `A discharge needs at least one product lot`; `Remove` disabled |
| `409 E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS` | Dialog stays open with an inline alert `This product lot has warehouse door assignments`; `Remove` disabled; detail refetched |
| `409 E_DISCHARGE_NOT_PLANNED`, or `404` | Dialog closes; detail refetched; toast as for the sheets |

The last-lot case is also prevented up front: when a discharge has one lot, its `Remove` action is disabled. A visible note, `A discharge needs at least one product lot`, is tied to it with `aria-describedby`. A disabled button receives no pointer or focus events, so a tooltip on it could never be shown. The API refusal remains for a concurrent removal.

## Accessibility

- Every field has a visible label. Required fields are marked, and errors are linked through
  `aria-describedby` (`${name}-error`), as `libraries/forms` already provides.
- Lot and shift groups are `fieldset`s with numbered legends. `Remove` inside a group is named
  `Remove product lot {n}` or `Remove shift {n}`.
- After a refused submission, focus moves to the first field in error.
- Date and time fields are native `datetime-local` inputs with minute steps.

## Out of this contract

- Adding, replanning, or removing shifts and reassigning a responsible after creation (GH-63,
  GH-64, and GH-66).
- Truck pool, door, and checkpoint planning (GH-54 and GH-55).
- Removing a whole planned discharge, and correcting a discharge after it started.
