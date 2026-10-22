# Research: Truck pool floating bulk actions

No item of the Technical Context was left as NEEDS CLARIFICATION. The decisions below settle the
design choices the spec leaves to planning.

## R1. Where the floating bar comes from

- **Decision**: Add a presentational `FloatingSelectionBar` under `apps/web/src/components/lifecycle/`
  (props: the count label, the action buttons as children, `onClear`, an accessible name). The
  truck pool uses it; `BulkResourceLifecycleActions` is left untouched in this slice.
- **Rationale**: The existing floating toolbar inside `BulkResourceLifecycleActions` is welded to
  the lifecycle dialog (archive/reactivate with comment and partial outcomes) and labels its action
  « Archive selected »; the truck pool needs Withdraw with its own confirmation. #318 (Customers) and
  #319 (Transport resources) are restyling that same toolbar to V2 (« n selected », Archive, Clear)
  on separate branches; editing it here would collide. A standalone primitive gives both a shared
  target without a merge conflict. A hand-over note in the shared session notes tells #318/#319.
- **Alternatives considered**: Reuse `BulkResourceLifecycleActions` (wrong dialog and copy);
  refactor it to extract the bar now (conflicts with #318/#319 in flight); a truck-pool-only bar
  inside the feature (third copy of the same chrome, against apps/web/AGENTS.md's guidance to file
  shared bulk-action primitives under `components/lifecycle`).

## R2. Anchoring the bar "at the bottom of the content"

- **Decision**: `position: sticky; bottom: 1rem` (plus `env(safe-area-inset-bottom)`) as the last
  child of the Truck pool section, centered within the content column. While the bar is shown the
  section reserves bottom space so the last table row can scroll clear of it.
- **Rationale**: The discharge detail scrolls the document, not an inner container (unlike the
  directories, whose `md:absolute` toolbar sits in a fixed-height `relative` workspace). Sticky keeps
  the bar in the viewport while the pool is on screen, inside the `SidebarInset` column so it never
  covers the sidebar, and needs no knowledge of the sidebar's width or collapsed state. Because the
  Truck pool is the only content of its tab, "while the pool is in view" is "while the tab is open".
- **Alternatives considered**: `position: fixed` with a sidebar-width offset (couples to sidebar
  state and widths); the directories' `absolute` pattern (requires a fixed-height scroll container
  the detail page does not have).

## R3. Visibility and focus semantics of the bar

- **Decision**: Render the bar only while the selection is non-empty (mounted/unmounted, with an
  enter transition), as `role="toolbar"` named « Selected trucks » — the name used by the V2
  artboard. Clear is a text button « Clear » with an X icon; Withdraw is the destructive button
  « Withdraw ». After Clear, focus moves to the « Select all trucks » checkbox so it is not lost.
- **Rationale**: FR-006 requires a hidden bar to be unfocusable; unmounting is the simplest
  guarantee. Labels follow the design and the "action only" button-label convention.
- **Alternatives considered**: Always-mounted bar with `inert` (the directories' approach; useful
  for an exit animation, not worth the complexity here).

## R4. Selection lifetime

- **Decision**: Keep `useBulkSelection` in the card and the existing `retainOnly` effect that drops
  trucks no longer held. Leaving the tab unmounts the Base UI tab panel (`keepMounted` is false), so
  the selection is cleared on tab change and on leaving the discharge without extra code. Per-row
  Withdraw of a selected truck removes it from the selection on success through the same effect.
- **Rationale**: Matches the spec's edge cases with behavior that already exists; adds a test to
  pin it.

## R5. « Also held by » popover

- **Decision**: Replace the `Tooltip` in `TruckHoldings` with the Base UI `Popover` (trigger: the
  warning icon button, named « Also held by <vessel · status, …> » as today). Content: title « Also
  held by », the list of « vessel · status », and the existing settling sentence. Escape/outside
  click close it and focus returns to the trigger (Base UI default). Add an `inline` variant
  rendering « Held by <vessels> · <status> » text for the Add trucks sheet, grouping vessels that
  share a status.
- **Rationale**: A tooltip is unreachable on touch and dismisses on pointer leave; the spec asks for
  click and keyboard activation. One component keeps the holding labels consistent.

## R6. Summary line and hint

- **Decision**: Pure helper `poolSummary(detail)` returns `{ heldCount, suspendedCount,
  contested }` over held entries only. The line reads « n truck(s) reserved » plus « · n suspended »
  when `suspendedCount > 0`. The hint renders when `contested` is true, with the design copy « Also
  held by planned discharges: the first to start keeps the truck ».
- **Open review point**: a planned pool may contain a truck held by an *active* discharge (the
  candidates read offers it), for which "the first to start keeps the truck" is inaccurate. Plan:
  show the design copy when every contesting holding is Planned; when any is Active, use « Also
  held by other discharges: a truck can serve only one active discharge ». The per-row popover
  always lists the exact holders and statuses.
- **Rationale**: Counting held trucks only keeps released history out of the totals (spec edge
  case).

## R7. Shifts column

- **Decision**: Pure helper `shiftCountByTruck(detail)` counts, for each truck, the planned shifts
  whose current trucks include it (reusing `currentTruckIds`). Held rows show the number (0 shows
  « 0 »); released rows show « — ».
- **Rationale**: Derived from the shifts already in the detail; same source as the withdraw dialog's
  affected shifts, so the column and the dialog never disagree.

## R8. Withdraw confirmation copy

- **Decision**: Title unchanged (« Withdraw AA-101-PF? » / « Withdraw n trucks? »). Description:
  « <registrations> leave(s) the pool of <vessel>. » followed, when shifts are affected, by « It is
  also removed from the n shift(s) that use it: » / « They are also removed from the n shifts that
  use them: » and the chronological list. Refusal and error handling unchanged.
- **Rationale**: Matches the V2 artboard and FR-013 while keeping the existing tested behavior.

## R9. Add trucks sheet grouping

- **Decision**: Pure helper `candidateGroups(candidates, selectedIds)` groups visible candidates by
  `transportCompany.id`, ordered by company name then registration, each with `total` and
  `selected`. Group header shows the name and « m », or « n of m » when n > 0. A line above the list
  states « n trucks not in the pool » (n = all candidates, not only those matching the search).
  « Select all » keeps its current visible-only semantics; no per-group checkbox (the artboard has
  none). Footer keeps « n selected », Cancel, Add trucks.
- **Rationale**: Mirrors the artboard without adding behaviors the design doesn't show; existing
  refusal/remembered-candidate logic stays as is (remembered refused candidates join their
  company's group).
