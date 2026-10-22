# Research: Restyle the Customers workbench

All decisions below are grounded in the current `apps/web` code (`src/features/customers`,
`src/components/lifecycle`, `src/components/resource`) and the 16 *Retenue* boards of the design
canvas page **Site references · Customers**. The Technical Context has no open unknowns; the
research is about *where* each change lives and how to stay compatible with the sibling V2
restyles that run in parallel (#317 Users, #319 Transport resources, #320/#321 maps, #326 truck
pool bulk bar).

## R1 — Shared lifecycle primitives: extend additively, do not rewrite in place

- **Decision**: Keep every existing export of `src/components/lifecycle` and its default copy.
  Add *optional* seams that Customers opts into:
  - `ResourceLifecycleConfig.describeTitle?: (action) => string` beside the existing
    `describeEffect`, so the single confirmation can read "Archive Loire Minerals?".
  - `ResourceLifecycleConfig.commentPlaceholder?: (action) => string` and the same prop on the bulk
    dialog ("Why is this customer archived?", "Why are these customers archived?").
  - Bulk dialog `selection?: { id: string; primary: string; secondary?: string }[]`, rendered as a
    list under the description, and `describeConfirm?: (action, count) => string` for
    "Archive 3 customers".
- **Rationale**: `lifecycle-copy.ts` is deliberately the single source of lifecycle wording for
  every site reference, and 40+ feature tests (checkpoints, docks, trucks, warehouses, transport
  companies, warehouse doors, weighing areas) assert today's titles and labels. Changing defaults
  in place would ripple into features owned by parallel sibling branches and cause merge conflicts
  and unrelated test churn. Optional props mirror the established `describeEffect` /
  `describeSuccess` pattern, so the seam is already idiomatic.
- **Alternatives considered**: (a) Change the canonical title to name the record for every
  resource — rejected for this issue: it is a cross-resource product decision, and each sibling
  restyle can adopt the seam, after which a later cleanup can make it the default. (b) Fork
  customer-specific dialogs — rejected: duplicates refusal handling, pending labels and comment
  limits.

## R2 — Bulk action bar: V2 visuals in place, stable accessible names

- **Decision**: Restyle `BulkResourceLifecycleActions` in place to the V2 bar (raised popover
  surface, border, shadow, "{n} selected", a vertical rule, a destructive "Archive" or default
  "Reactivate" button with its icon, and a text "Clear" button). Visible labels become the action
  alone ("Archive", "Clear"); accessible names stay "Archive selected" / "Reactivate selected" /
  "Clear selection", and the toolbar keeps its `role="toolbar"` and "Bulk {singular} actions" name.
- **Rationale**: The bar is the same floating pattern for every directory and #326 explicitly
  reuses it, so a V2 look belongs in the shared component. Keeping accessible names (each contains
  its visible text, satisfying WCAG 2.5.3 *label in name*) avoids touching ~40 test files across
  other features. Visible labels carrying the action only follows the repository's button-label
  rule.
- **Alternatives considered**: Rename the toolbar to a `region` named "Bulk actions" as drawn —
  rejected: changes semantics and names for every resource; the spec is aligned to the toolbar name
  (see Spec adjustments in `plan.md`).

## R3 — Detail History as a new shared timeline primitive

- **Decision**: Add `src/components/lifecycle/resource-lifecycle-history.tsx`
  (`ResourceLifecycleHistory`): a "History" section rendering `orderLifecycleBlocks(blocks)` as an
  ordered timeline — action in the past tense ("Archived", "Reactivated"), date and time, an actor
  chip (initials badge + full name), the comment in curly quotes — or a "No lifecycle history yet."
  line when empty. It reuses `LifecycleBlock` and `orderLifecycleBlocks` from
  `resource-lifecycle-summary.tsx`. Customers switches to it; `ResourceLifecycleSummary` stays for
  screens not yet restyled.
- **Rationale**: #319 also draws a History of lifecycle events, so the timeline must be shared to
  avoid two implementations. Adding a sibling component leaves the 8 test files asserting
  "Archive context" untouched.
- **Alternatives considered**: Restyle `ResourceLifecycleSummary` in place — rejected for the same
  ripple reasons as R1.

## R4 — Actor chip and short dates

- **Decision**: Add `src/components/resource/resource-actor.tsx` (`ResourceActor`): the existing
  `UserAvatar` (`size="sm"`, `aria-hidden`) + full name, with an optional trailing muted date. Add
  `formatShortDate(iso)` to `src/helpers/dates.ts` producing "14 Aug 2026" (`en-GB`, day numeric,
  month short, year numeric). Lifecycle table cells become "{actor} · {date}" (Available) and
  "{actor} {date}" (Archived) as drawn, or "—" when the transition never happened.
- **Rationale**: Today `lifecycleUserCell` is private to `customer-table.tsx` and other directories
  render the same cell; a shared chip is what Users/Transport restyles will need too.
- **Alternatives considered**: Keep the cell private — rejected, it is the third copy-in-waiting.

## R5 — No-match state with cross-tab hint

- **Decision**: A feature-local `CustomerNoMatch` rendered by `CustomerSection` in place of the
  table when a search is active and the active tab has no match. It counts matches in the other tab
  with the existing `customerMatchesSearch` over the already-loaded list, and offers "Clear search"
  (sets `search` to `''`) and, when the other tab matches, "Show archived" / "Show available"
  (switches `status`, keeps `search`, clears the selection like any tab change). The empty state
  without search keeps `Empty` and, for administrators on the Available tab, offers "Create
  customer" (web AGENTS rule).
- **Rationale**: All data is client-side already (`customerQueries.list()` returns every customer);
  no API change. Built on the `Empty` primitive (`EmptyMedia` icon, title, description, actions) so
  it inherits the V2 tokens.
- **Alternatives considered**: A shared no-match primitive — deferred until a second directory
  needs the cross-tab hint.

## R6 — Search scope and copy

- **Decision**: Keep `customerMatchesSearch` unchanged (code, company name, archive and
  reactivation comments). Placeholder: "Search by code, company name or comment". No-match
  explanation: "Search looks in customer codes, company names and lifecycle comments."
- **Rationale**: Clarification Q2.

## R7 — Create and edit sheets

- **Decision**:
  - Create sheet: header "Create customer" / "Available as soon as it is created", close control,
    the two fields, the hint under the form ("The code identifies the customer in discharges and
    reports. It is stored in uppercase and can be changed later."), footer "Create customer"
    (primary) and "Cancel" (closes the sheet). On success the sheet moves to the new customer's
    detail and the existing "Customer “…” created" toast fires (unchanged behavior).
  - Edit sheet: header "Edit customer" / "{company name} · {code}", the code field description
    "Stored in uppercase. Reports already generated keep the previous code.", footer "Save changes"
    and "Cancel" (returns to the detail, replacing the "Back to details" header button). On success
    the sheet returns to the detail with the existing "Customer “…” updated" toast.
  - Conflicts: `CustomerForm` maps `E_CUSTOMER_CODE_CONFLICT` to a `code` field error and
    `E_CUSTOMER_COMPANY_NAME_CONFLICT` to a `companyName` field error. The code message is
    "Already used by {company name}." where the owner is found in the loaded list (normalized code
    comparison), else "Already used by another customer."; the company-name message is "Already
    used by {code}." with the same fallback.
- **Rationale**: Matches the V2 boards while keeping the post-write navigation of the
  `create-a-customer` / `update-a-customer` contracts. Today a conflict surfaces only as a toast;
  a field error keeps the sheet open with the entered values (FR-016). The API stays authoritative:
  the message is resolved from its error code, not from a client-side pre-check.
- **Alternatives considered**: Client-side uniqueness pre-check on blur — rejected: duplicates a
  business rule the API owns and can be stale.
- **Convention impact**: `apps/web/AGENTS.md` says an edit panel is left through "Back to details"
  and a creation panel adds Cancel only over a map. The V2 sheets put "Cancel" in the footer of
  both. The plan updates that rule to the V2 convention (footer "Cancel": back to details when
  editing, closes when creating) so sibling restyles inherit one rule.

## R8 — Detail sheet

- **Decision**: Header with a 44px muted icon tile, company name (`SheetTitle`), monospaced code,
  close control. Body: a two-column `dl` (Status with a status dot, Customer code, Created, Last
  updated), a separator, then `ResourceLifecycleHistory`. Footer for administrators: "Edit" +
  "Archive" on an available customer, "Reactivate" on an archived one. No Discharges section
  (#180). The status dot uses the status tokens (green for Available, muted for Archived), never
  the accent.
- **Rationale**: FR-011–FR-013; reuses `ResourceDetailField` for each pair.

## R9 — Toasts

- **Decision**: Keep the shared toast copy. Single archive already reads "Customer “Loire
  Minerals” archived" (`lifecycleSuccessMessage`). The partial bulk outcome keeps
  "2 customers archived; 1 customer unchanged" with the description
  "NORDENG: used by an active or planned discharge"; it states the count changed, names each
  skipped customer by code and gives a plain-language reason, which is what FR-021 requires.
  Toast visuals come from the shared `Toaster` already themed by #314.
- **Rationale**: The partial-outcome sentence is shared by every bulk directory; rewording it to
  the board's "NORDENG was skipped: a planned discharge uses it." would change every resource's
  tests for a phrasing difference. Recorded as a documented copy deviation.
- **Alternatives considered**: `describeOutcome` override on the bulk dialog — rejected as a knob
  with no behavioral value.

## R10 — Table

- **Decision**: Restyle in `customer-table.tsx`: bordered rounded frame on the card surface, header
  row in muted foreground at 13px semibold, 52px rows, monospaced code link (`View customer
  {code}`), visible "Actions" header (still not sortable), lifecycle actor cells per R4, row
  selection indicator kept, archived rows no longer dimmed as a whole (the board shows regular
  text). Sorting, column ids and URL sort keys are unchanged (`code`, `companyName`,
  `reactivationComment`, `archiveComment`). Unsorted sortable headers show the neutral
  `SortIcon`, the sorted one its direction.
- **Rationale**: FR-003–FR-005, FR-024.

## R11 — Light theme and contrast

- **Decision**: Use only theme tokens from `src/styles/globals.css` (`background`, `card`,
  `popover`, `muted-foreground`, `border`, `primary`, `indicator`, `destructive`, status colors).
  No hard-coded hex values. Verification walks both themes in the browser and checks contrast of
  any new pair with the tokens #314 already validated at ≥ 4.5:1.
- **Rationale**: FR-023; tokens were tuned in #333 for both themes.

## R12 — Verification approach

- **Decision**: Feature tests (Vitest + Testing Library through the real router, MSW) remain the
  primary TDD seam: update existing customer tests for changed copy and structure, add tests for
  no-match cross-tab, conflict field errors, sheet Cancel, History timeline, bulk dialog list and
  confirm label, read-only rendering. Unit test for `formatShortDate` (unit tests never render
  React). The shared lifecycle components have no tests of their own today; their new optional
  seams are exercised through the Customers feature tests, and the unchanged defaults stay covered
  by the other features' existing suites, which must remain green untouched. There is no
  Playwright suite in the repository; browser verification is a manual walk-through of
  `quickstart.md` in both themes.
