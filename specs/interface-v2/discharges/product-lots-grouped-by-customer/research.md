# Research: Product Lots Grouped by Customer

All findings come from the current code on `feat/325-product-lots-grouped-by-customer` (based on
`master` at `fddae051`) and the V2 design canvas (*Retenue* artboards listed in the spec).

## R1 — What already exists

- **Decision**: Treat #325 as a restyle-and-extend of existing web components, with no API change.
- **Findings**:
  - `ui/detail/discharge-product-lots-card.tsx` already groups lots by customer
    (`groupLotsByCustomer`), shows customer rows with lot count, subtotal and Edit, lot rows with
    product, description, quantity and door chips (`LotDoorChips`), an Expected total footer, the
    lot menu (`ProductLotRowActions`: Edit, Assign doors, Remove with blocked reason), the empty
    state, and opens the add/edit/customer sheets and the Assign doors dialog.
  - `ui/planning/lot-warehouse-doors-dialog.tsx` already has the two-column transfer (available by
    warehouse with search and count; assigned with count), tabs on phone, shift locks, a live change
    summary, Cancel/Save, and refusal handling.
  - `customer-product-lots-sheet.tsx` and `add-product-lots-sheet.tsx` already show a running
    `N lots · total` in their footers; `product-lot-group-fields.tsx` shows a per-customer subtotal
    with `—` while empty.
- **Gaps against the spec/design**: no summary line above the table; a lot without door shows a quiet
  dash; held doors are not distinguished; no inline Assign doors; no "read-only while active" note;
  the dialog's description omits the quantity, "Also on N discharges" is an icon + count only, a door
  held by an active discharge is not explained, the shift lock reads "Remove it from the shift first",
  the empty change summary is blank, and the one-lot-at-a-time rule is not stated; the single-lot
  edit sheet does not show the lot's doors.

## R2 — Source of the door problems

- **Decision**: « No door » is derived from the detail (a lot without any current door assignment);
  « Held by … » comes from the existing `GET /discharges/:id/start-check`
  (`dischargeQueries.startCheck(id)`), problems `WAREHOUSE_DOOR_HELD` whose context is the lot.
- **Rationale**:
  - The start rule for `LOT_WITHOUT_WAREHOUSE_DOOR` is exactly `lot.currentDoorIds.length === 0`
    (`apps/api/app/discharges/start/discharge_start_rules.ts`), the same fact the detail carries as
    assignments with `effectiveTo === null`. Deriving it does not duplicate a business rule and works
    for every role.
  - Which door is held by which active discharge is computed only by the start check
    (`findActiveHolders`). Reusing it guarantees the tab and the Start dialog agree (FR-008, SC-003).
  - #324 (`show-the-planned-discharge-header-and-dock-timeline`, R3/D3) makes the same choice for its
    banner and tab dots. Both features read the same query key, so one request feeds both.
- **Alternatives considered**:
  - Derive « Held by » on the web from other discharges' details — duplicates the active-holder rule
    and needs reads the web does not make.
  - Add holders to the detail DTO — runs the start rules on every detail read; rejected by #324 too.
  - Open `start-check` to observers (`view` instead of `start`) — reverses GH-56's tested contract
    (`start_check.spec.ts` asserts 403 for observers) and #324's choice; out of scope for a
    presentation issue.

## R3 — Who sees « Held by … » (spec delta)

- **Decision**: « No door » is shown to every reader of a planned discharge; « Held by … » and the
  held-door count are shown to users allowed to prepare (and start) the discharge, since only they
  can read the start check. The spec's Assumption and US2/AS2 are amended accordingly.
- **Rationale**: R2. Observers cannot act on the problem either; they still see « No door ».
- **Alternative**: keep the original assumption by widening the endpoint — rejected in R2.

## R4 — Keeping indicators current

- **Decision**: Every successful lot/door/customer mutation already goes through `applyDetail` in
  `mutations/use-discharge-mutations.ts`; it also invalidates `dischargeQueries.startCheck(id)`.
  The query keeps `staleTime: 0`, so window focus and remounts refresh it.
- **Rationale**: FR-010 without a reload. #324 plans the identical invalidation; whichever PR lands
  second keeps one copy when rebasing.

## R5 — When the start check is unavailable

- **Decision**: While the check is loading, failed, or not readable (observer), held indicators and
  the held count are omitted; « No door » (from the detail) is always shown. No error is surfaced on
  the tab: the Start dialog keeps its own error and retry.
- **Rationale**: FR-011 — never present "no problem" wrongly; the « held » count is simply absent, not
  zero.

## R6 — Tone and copy

- **Decision**: Use the existing `warning` token (`text-warning`, amber in « Marine sobre ») for the
  indicators, written out in words (FR-029). Copy follows the design: « No door », « Held by
  <vessel> », summary « N lots · N customers · total » then « N lots without a door · N doors held by
  another discharge ». Button labels carry the action only (« Assign doors », « Edit »).
- **Rationale**: `apps/web/AGENTS.md` reserves amber for statuses; these are statuses of the lot.

## R7 — Test seams

- **Decision**: Pure derivation in a unit test (`__tests__/discharge-detail-view.test.ts`); behavior
  in feature tests rendered through the router with MSW
  (`__tests__/detail/product-lots.test.tsx`, `correct-product-lot.test.tsx`,
  `__tests__/planning/lot-doors.test.tsx`), using the existing start-check handler in
  `__tests__/support/test-helpers.ts`.
- **Rationale**: `apps/web/AGENTS.md` testing rules; no API change means no API test.
