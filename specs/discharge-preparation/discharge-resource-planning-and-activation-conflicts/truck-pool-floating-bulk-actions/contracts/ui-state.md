# UI Contract: Planned truck pool (V2)

The observable contract feature tests assert. No HTTP contract changes: the slice reuses
`GET /api/v1/discharges/:id`, `GET .../truck-pool/candidates`, and the existing reserve and withdraw
mutations unchanged.

## Truck pool section (`region` « Truck pool »)

| Element | Role / name | Content | Shown when |
|---------|-------------|---------|------------|
| Add trucks | `button` « Add trucks » | — | preparer can correct |
| Summary | text | « 1 truck reserved » / « n trucks reserved », then « · n suspended » if any | pool has held trucks |
| Hint | text with warning icon | « Also held by planned discharges: the first to start keeps the truck », or « Also held by other discharges: a truck can serve only one active discharge » when a holder is Active | some held truck is contested |
| Table | `table` « Truck pool » | columns: [select], Registration, Transport company, Shifts, Reserved, Released, [actions] | pool not empty |
| Select all | `checkbox` « Select all trucks » | checked / mixed / unchecked | can correct and some truck held |
| Row select | `checkbox` « Select <registration> » | — | can correct and row held |
| Suspended marker | text « Suspended » beside registration | — | held truck is suspended |
| Holdings trigger | `button` « Also held by <vessel · Status>, … » | opens popover | held row has other holdings |
| Row withdraw | `button` « Withdraw <registration> » | — | can correct and row held |
| Shifts cell | number of planned shifts using the truck; « — » for released rows | — | always |

The section header no longer has a `Withdraw (n)` button.

## Holdings popover (`dialog` « Also held by »)

Lists « <vessel> · Planned|Active » per holder and « Only one active discharge can hold a truck, so
starting a discharge settles it. » Closes on Escape or outside click; focus returns to the trigger.

## Floating selection bar (`toolbar` « Selected trucks »)

| Element | Role / name | Behavior |
|---------|-------------|----------|
| Count | text « 1 truck selected » / « n trucks selected » | never lists registrations |
| Clear | `button` « Clear » | empties the selection; bar unmounts; focus to « Select all trucks » |
| Withdraw | `button` « Withdraw » | opens the confirmation for exactly the selected held trucks |

Absent from the DOM when nothing is selected. Sticky at the bottom of the content column.

## Withdraw confirmation (`alertdialog`)

- Title: « Withdraw <registration>? » (one) / « Withdraw n trucks? » (several).
- Description: « <registration(s), comma-separated> leave(s) the pool of <vessel>. »
- When shifts are affected: « It is also removed from the n shift(s) that use it: » (one truck) /
  « They are also removed from the n shift(s) that use them: » (several), then a `list` of shift
  periods in chronological order.
- Actions: « Cancel », « Withdraw » (pending « Withdrawing… »). Refusals unchanged.

## Add trucks sheet (`dialog` « Add trucks »)

- « n trucks not in the pool » above the list (all candidates, independent of the search).
- Groups per transport company: header « <company> » with « m » or « n of m » selected.
- Each company is a `group` named after it. Candidate row: `checkbox` « Select <registration> »; when held elsewhere, inline text
  « Held by <vessel>, <vessel> · <Status> » (one segment per status).
- Search, « Select all » (visible candidates), refusal alert, retry, footer « n selected »,
  « Cancel » unchanged; the submit button reads « Add trucks » (pending « Adding… »), as spec US3 asks.
