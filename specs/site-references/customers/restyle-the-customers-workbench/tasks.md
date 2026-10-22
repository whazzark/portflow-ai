---

description: "Task list for the V2 restyle of the Customers workbench"
---

# Tasks: Restyle the Customers workbench

**Input**: Design documents from `specs/site-references/customers/restyle-the-customers-workbench/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The constitution (IV) and `apps/web/AGENTS.md` require test-first observable
behavior: write or update the feature test first, watch it fail, then implement. Feature tests
render through the real router with MSW (`renderCustomers`, `mockCustomers` in
`apps/web/src/features/customers/__tests__/support/`); never mock the Tuyau client.

**Organization**: Tasks are grouped by user story (US numbers match spec.md) so each story can be
implemented and verified on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The spec user story the task serves
- All paths are relative to the repository root; `web/` below means `apps/web/src/`

## Reference material for every task

- Copy, roles and accessible names: [contracts/customers-workbench-ui.md](contracts/customers-workbench-ui.md)
- Shared component additions: [contracts/shared-lifecycle-seams.md](contracts/shared-lifecycle-seams.md)
- Decisions and rationale (R1–R12): [research.md](research.md)
- Visual reference: design canvas page **Site references · Customers**, *Retenue* boards
  (https://claude.ai/artifact/1RyXTf3HKkxNHBS3ZVc3iT, read with the Artifact tool; boards under
  `project/v2/site-references/customers-retenue-*.dc.html`). Use theme tokens from
  `apps/web/src/styles/globals.css`, never the boards' hex values.
- Rule: shared lifecycle defaults (titles, labels, toast sentences, accessible names) MUST NOT
  change; other features' suites must stay green without edits.

---

## Phase 1: Setup

**Purpose**: Establish a green baseline before changing anything.

- [X] T001 Run `pnpm --filter @portflow/web test` and `pnpm typecheck` on `feat/318-restyle-customers-workbench`; record any pre-existing failure in this file under "Notes" before starting (no source change)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Shared helpers used by several stories (lists and detail).

- [X] T002 [P] Add failing unit tests for `formatShortDate` ("14 Aug 2026" for `2026-08-14T10:00:00Z`, `''` for `null`) in apps/web/src/helpers/dates.test.ts
- [X] T003 Implement `formatShortDate(value: string | null): string` (en-GB, day numeric, month short, year numeric) in apps/web/src/helpers/dates.ts (depends on T002)
- [X] T004 [P] Create `ResourceActor` (`actor` | null → "—"; `UserAvatar size="sm" aria-hidden` + `formatFullName`; optional muted `at` via `formatShortDate`; `separator` '·' default or ' ') per contracts/shared-lifecycle-seams.md in apps/web/src/components/resource/resource-actor.tsx (depends on T003)

**Checkpoint**: Helpers ready; user stories can start.

---

## Phase 3: User Story 1 — Consult customers in the V2 lists (Priority: P1) 🎯 MVP

**Goal**: V2 toolbar, tabs, tables, lifecycle cells, sort affordances, no-match and empty states.

**Independent Test**: As any active user, open `/customers`, switch tabs, sort, search a term that
matches nothing in the active tab, and compare with the Available, Archived and no-match boards.

### Tests for User Story 1 (write first, must fail)

- [X] T005 [P] [US1] Update apps/web/src/features/customers/__tests__/list/list.test.tsx: search placeholder "Search by code, company name or comment"; Available headers Customer code · Company name · Reactivation comment · Reactivated · Actions (visible text) and Archived headers with Archive comment · Archived; Reactivated/Archived cells show "{First Last} · {d MMM yyyy}" / "{First Last} {d MMM yyyy}" or "—"; code link named "View customer {code}"; tab names "Available {n}" / "Archived {n}"; sort direction still reflected by `aria-sort`
- [X] T006 [P] [US1] Create apps/web/src/features/customers/__tests__/list/no-match.test.tsx: a term matching only an archived customer on Available shows "No available customer matches “{term}”", the explanation "Search looks in customer codes, company names and lifecycle comments.", "1 archived customer matches.", "Clear search" (empties the search box and URL `search`) and "Show archived" (switches to Archived, keeps the term, rows shown); a term matching nothing anywhere shows no cross-tab line nor Show button; a lifecycle-comment fragment finds its customer
- [X] T007 [US1] Add to apps/web/src/features/customers/__tests__/list/list.test.tsx empty-state cases: no customers at all → "No available customers" / "No customers have been added yet." with a "Create customer" action for an administrator only; empty Archived tab → "No archived customers" / "No customer has been archived."

### Implementation for User Story 1

- [X] T008 [US1] Restyle apps/web/src/features/customers/ui/customer-table.tsx per research R10: card-surface rounded bordered frame, muted 13px semibold headers, 52px rows, monospaced code link, visible "Actions" header (not sortable), lifecycle actor cells via `ResourceActor` with the tab's transition date (replace private `lifecycleUserCell`; "—" when no transition), archived rows no longer dimmed, neutral `SortIcon` on unsorted sortable headers; keep column ids, sort keys, row ids, selection indicator and click behavior (depends on T004)
- [X] T009 [P] [US1] Create apps/web/src/features/customers/ui/customer-no-match.tsx: `Empty` with `EmptyMedia` search icon, title, explanation, optional cross-tab count sentence ("{n} archived customer(s) match." / "{n} available customer(s) match."), "Clear search" (outline) and "Show archived"/"Show available" (ghost) buttons; props `{ term, tab, otherTabMatchCount, onClearSearch, onShowOtherTab }`
- [X] T010 [US1] Update apps/web/src/features/customers/ui/customer-section.tsx: render `CustomerNoMatch` instead of the table when a search is active and the tab has no match; keep the table's `Empty` for an empty tab without search with the copy from T007 and a "Create customer" action for administrators on Available; accept `otherTabMatchCount`, `onClearSearch`, `onShowOtherTab`, `onCreate` props (depends on T009)
- [X] T011 [US1] Update apps/web/src/features/customers/ui/customers-page.tsx: search placeholder, "Create customer" button with `PlusIcon`, tab counts styled as muted numbers, compute `otherTabMatchCount` with `customerMatchesSearch` over the loaded list, wire clear-search (`updateSearch('')`) and show-other-tab (`updateStatus(other)` keeping `search`), V2 spacing; keep URL handling, selection clearing and shortcuts unchanged (depends on T010)

**Checkpoint**: T005–T007 green; US1 matches its boards in dark theme.

---

## Phase 4: User Story 2 — Inspect a customer in the detail sheet (Priority: P1)

**Goal**: V2 detail sheet with summary grid and History timeline; Edit/Archive or Reactivate footer.

**Independent Test**: Open an available customer archived then reactivated, and an archived
customer; compare with the Detail and Archived detail boards.

### Tests for User Story 2 (write first, must fail)

- [X] T012 [P] [US2] Update apps/web/src/features/customers/__tests__/details/open.test.tsx: dialog named by company name shows the code, a "Close" button, summary terms Status ("Available"/"Archived"), Customer code, Created, Last updated; no "Discharges" section; unknown id still shows "Unable to load customer"
- [X] T013 [P] [US2] Create apps/web/src/features/customers/__tests__/details/history.test.tsx: section "History" lists "Reactivated" before "Archived" for a customer archived then reactivated, each with date-time, actor full name and the comment in curly quotes; a customer with no transition shows "No lifecycle history yet."; administrator footer offers "Edit" + "Archive" on available, only "Reactivate" on archived

### Implementation for User Story 2

- [X] T014 [P] [US2] Create `ResourceLifecycleHistory` in apps/web/src/components/lifecycle/resource-lifecycle-history.tsx per contracts/shared-lifecycle-seams.md: `section` labelled "History" (h3), ordered timeline from `orderLifecycleBlocks` (import from resource-lifecycle-summary.tsx), each item: icon disc, past-tense label from `LIFECYCLE_PAST_PARTICIPLES` capitalised ("Archived", "Reactivated", …), `formatDateTime`, `ResourceActor` when `actor` is defined, quoted comment when present; empty → "No lifecycle history yet."; leave `ResourceLifecycleSummary` untouched (depends on T004)
- [X] T015 [US2] Restyle apps/web/src/features/customers/ui/customer-details.tsx per research R8: header with 44px muted icon tile, `SheetTitle` company name, monospaced code, close control; two-column `dl` with Status (status-token dot + label), Customer code, Created, Last updated; separator; `ResourceLifecycleHistory`; footers unchanged in content (Edit + lifecycle on available, lifecycle only on archived) with V2 layout (depends on T014)

**Checkpoint**: T012–T013 green; US1 + US2 form the MVP.

---

## Phase 5: User Story 3 — Create and edit a customer in V2 sheets (Priority: P2)

**Goal**: V2 create/edit sheets with hints, footer Cancel and conflict field errors.

**Independent Test**: As an administrator, create with a duplicate code then a valid one; edit and
save; Cancel each sheet; compare with the Create and Edit boards.

### Tests for User Story 3 (write first, must fail)

- [X] T016 [P] [US3] Update apps/web/src/features/customers/__tests__/details/create.test.tsx: dialog "Create customer" with description "Available as soon as it is created", hint "The code identifies the customer in discharges and reports. It is stored in uppercase and can be changed later.", "Cancel" closes the sheet (URL `mode` cleared) without a request; success still toasts "Customer “…” created" and shows the new customer's detail
- [X] T017 [P] [US3] Update apps/web/src/features/customers/__tests__/details/update.test.tsx: dialog "Edit customer" with description "{companyName} · {code}", code field description "Stored in uppercase. Reports already generated keep the previous code.", no "Back to details" button, "Cancel" returns to the detail (`mode=view`) without a request, success returns to the detail with the update toast
- [X] T018 [P] [US3] Create apps/web/src/features/customers/__tests__/details/conflicts.test.tsx: MSW returns `E_CUSTOMER_CODE_CONFLICT` on create → Customer code field invalid with "Already used by {owner companyName}." (owner found in the list by normalized code) and values kept, no refusal toast; unknown owner → "Already used by another customer."; `E_CUSTOMER_COMPANY_NAME_CONFLICT` on edit → Company name field "Already used by {owner code}."

### Implementation for User Story 3

- [X] T019 [US3] Update apps/web/src/features/customers/ui/customer-form.tsx: accept `customers: CustomerDto[]` and `onCancel`; map `E_CUSTOMER_CODE_CONFLICT` / `E_CUSTOMER_COMPANY_NAME_CONFLICT` (via `parseApiError(error).code`) to field errors with the owner lookup (trim + uppercase for code, trim + case-insensitive for company name, excluding the edited customer) and fallback messages; show the code description for edit mode; footer with submit ("Create customer" / "Save changes") and an outline "Cancel" button calling `onCancel`; keep `applyValidationError` and refusal toast for other errors
- [X] T020 [US3] Update apps/web/src/features/customers/ui/create-customer-panel.tsx and apps/web/src/features/customers/ui/edit-customer-panel.tsx: V2 headers (titles, descriptions per contract), create hint text, remove the "Back to details" button, pass `customers` and `onCancel` through (depends on T019)
- [X] T021 [US3] Update apps/web/src/features/customers/ui/customer-sheet.tsx: accept the loaded `customers`, pass them to both panels; `onCancel` → `onChange({})` for create and `onChange({ customerId, mode: 'view' })` for edit; keep success navigation and toasts (depends on T020)
- [X] T022 [US3] Pass the loaded customers list to `CustomerSheet` in apps/web/src/features/customers/ui/customers-page.tsx (depends on T021)
- [X] T023 [P] [US3] Update the Forms and UI rule in apps/web/AGENTS.md: creation and edit sheets end with a footer "Cancel" — in an edit sheet it returns to the details, in a creation sheet it closes the sheet — replacing the "Back to details" / map-only Cancel sentence

**Checkpoint**: T016–T018 green.

---

## Phase 6: User Story 4 — Archive and reactivate one customer (Priority: P2)

**Goal**: V2 row menu and lifecycle dialog copy; archive toast.

**Independent Test**: Archive from a row menu with a comment, reactivate from the Archived tab;
compare dialogs and toast with the boards.

### Tests for User Story 4 (write first, must fail)

- [ ] T024 [P] [US4] Update apps/web/src/features/customers/__tests__/list/row-actions.test.tsx: trigger named "Actions for {code}"; available menu items View, Edit, a `separator`, Archive; archived menu View, Reactivate
- [ ] T025 [P] [US4] Update apps/web/src/features/customers/__tests__/lifecycle/lifecycle.test.tsx: archive dialog title "Archive {companyName}?", description "{code} can no longer be added to a new discharge. Past discharges and reports keep it. You can reactivate it later.", comment placeholder "Why is this customer archived?", buttons Cancel/Archive, success toast "Customer “{companyName}” archived" and counts update; reactivate dialog title "Reactivate {companyName}?", description "{code} can be added to new discharges again. Its archive stays in the history.", placeholder "Why is this customer reactivated?"; check apps/web/src/features/customers/__tests__/lifecycle/recovery.test.tsx still passes the refusal path (update only copy assertions)

### Implementation for User Story 4

- [ ] T026 [P] [US4] Add optional `describeTitle?: (action) => string` and `commentPlaceholder?: (action) => string` to `ResourceLifecycleConfig` and use them in `ResourceLifecycleDialog` (fallback to `lifecycleDialogTitle` / no placeholder) in apps/web/src/components/lifecycle/resource-lifecycle-actions.tsx
- [ ] T027 [P] [US4] Render a `DropdownMenuSeparator` between View/Edit and the lifecycle items when both groups are present in apps/web/src/components/lifecycle/resource-row-actions.tsx (no name or label change)
- [ ] T028 [US4] Supply `describeTitle`, `describeEffect` and `commentPlaceholder` with the customer copy in `useCustomerLifecycleConfig` in apps/web/src/features/customers/customer-lifecycle.tsx (depends on T026)
- [ ] T029 [US4] Name the row menu by the customer code (`name={customer.code}`) in apps/web/src/features/customers/ui/customer-row-actions.tsx (depends on T027)

**Checkpoint**: T024–T025 green; other features' lifecycle tests unchanged and green.

---

## Phase 7: User Story 6 — Read-only rendering for non-administrators (Priority: P2)

**Goal**: Observers see every V2 consultation state without any administration control.

**Independent Test**: As an Observer, open the list and a detail; compare with the read-only board.

- [ ] T030 [US6] Extend apps/web/src/features/customers/__tests__/details/permissions.test.tsx (OBSERVER fixture): no "Create customer", no checkboxes, no "Actions" column header nor row menus, detail without footer buttons, `?mode=create` and `?customerId=…&mode=edit` open no form, no-match "Show archived" still offered (consultation); fix any gating gap found in apps/web/src/features/customers/ui/customer-table.tsx or apps/web/src/features/customers/ui/customer-section.tsx (empty-state Create action must stay administrator-only)

**Checkpoint**: T030 green.

---

## Phase 8: User Story 5 — Bulk archive with a partial result (Priority: P3)

**Goal**: V2 bulk bar; bulk dialog listing the selection with a counted confirm; partial toast.

**Independent Test**: Select three available customers, one in use; bulk archive; check bar,
dialog and toast against the boards.

### Tests for User Story 5 (write first, must fail)

- [ ] T031 [P] [US5] Update apps/web/src/features/customers/__tests__/bulk/archive.test.tsx and apps/web/src/features/customers/__tests__/bulk/reactivation.test.tsx: toolbar "Bulk customer actions" shows "3 selected"; buttons keep accessible names "Archive selected"/"Reactivate selected" and "Clear selection" with visible text "Archive"/"Reactivate" and "Clear"; dialog lists each selected customer's code and company name, comment placeholder "Why are these customers archived?" / "Why are these customers reactivated?", confirm "Archive 3 customers" / "Reactivate 2 customers" (singular for one)
- [ ] T032 [P] [US5] Check apps/web/src/features/customers/__tests__/bulk/mixed-archive.test.tsx covers the partial toast ("2 customers archived; 1 customer unchanged", description naming the code and reason) and the selection narrowing to the skipped customer; add the assertions if missing; keep apps/web/src/features/customers/__tests__/bulk/filtered-archive.test.tsx, stale-blockers.test.tsx, stale-refresh.test.tsx and apps/web/src/features/customers/__tests__/selection/*.test.tsx green with copy-only updates

### Implementation for User Story 5

- [ ] T033 [US5] In apps/web/src/components/lifecycle/bulk-resource-lifecycle-actions.tsx add optional `selection`, `describeConfirm`, `commentPlaceholder` to `BulkResourceLifecycleSubmissionProps` and render them in `BulkResourceLifecycleDialog` (list under the description in a bordered scrollable box, primary monospaced + secondary muted; confirm label from `describeConfirm` with pending label unchanged); restyle the `BulkResourceLifecycleActions` toolbar to the V2 bar (popover surface, border, shadow, "{n} selected", vertical rule, action button with icon showing the action alone, text "Clear" button) keeping `role="toolbar"`, its name, and the accessible names "{Action} selected" / "Clear selection"
- [ ] T034 [US5] Wire `selection` (selected and listed customers → `{ id, primary: code, secondary: companyName }` in list order), `describeConfirm` ("Archive {n} customer(s)" / "Reactivate {n} customer(s)") and `commentPlaceholder` in apps/web/src/features/customers/ui/customers-page.tsx (depends on T033)

**Checkpoint**: T031–T032 green; checkpoints, docks, trucks, warehouses, warehouse doors,
transport companies and transport resources suites green without edits.

---

## Phase 9: User Story 7 — Light theme (Priority: P3)

**Goal**: Every state renders in the light V2 palette with ≥ 4.5:1 contrast.

**Independent Test**: Switch to light and walk the quickstart states.

- [ ] T035 [US7] Audit every file touched in Phases 2–8 for hard-coded colors or opacity-based text dimming; replace them with theme tokens (`muted-foreground`, `card`, `popover`, `border`, `primary`, `indicator`, `destructive`, status tokens) in the touched files under apps/web/src/features/customers/ui/ and apps/web/src/components/
- [ ] T036 [US7] Walk quickstart steps 1–9 in the light theme in the browser; for any new text/background pair not already validated by #333, check the contrast ratio is ≥ 4.5:1 and fix the token choice in the offending file

---

## Phase 10: Polish & cross-cutting

- [ ] T037 Run `pnpm check`, `pnpm typecheck`, `pnpm test`; fix failures (no edits to other features' tests are expected — if one is needed, stop and re-check the R1/R2 rule)
- [ ] T038 Walk the full [quickstart.md](quickstart.md) in dark and light themes and at ≈ 390px width, comparing with the 16 *Retenue* boards; note any intentional deviation beyond those in plan.md
- [ ] T039 Update the shared notes file `/Users/romain.petit/Library/Application Support/Claude/side-session-notes/local_a3463a0e-9a8b-4962-98cd-19a16b011eef/issue-318-notes.md` with the final shared component names and props as merged
- [ ] T040 Obtain a fresh read-only Claude Code review of the final diff (`/code-review` in a new session or a read-only subagent), resolve or justify every confirmed finding, then mark the Draft PR ready

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (T001) → Foundational (T002–T004) → user stories.
- US1 (Phase 3) and US2 (Phase 4) both need T004; otherwise independent of each other.
- US3 (Phase 5) is independent of US1/US2 except T022 editing `customers-page.tsx` after T011
  (same file: do sequentially).
- US4 (Phase 6) is independent; T028 edits `customer-lifecycle.tsx` only.
- US6 (Phase 7) verifies gating across US1–US4 surfaces: run after them.
- US5 (Phase 8): T034 edits `customers-page.tsx` after T011 and T022 (same file).
- US7 (Phase 9) and Polish run last.

### Within each story

Tests first (must fail) → shared component → feature component → page wiring → tests green.

### Same-file sequencing to respect

- `customers-page.tsx`: T011 → T022 → T034
- `customer-table.tsx`: T008 → (T030 fix, if any)
- `resource-lifecycle-actions.tsx`: T026 only; `bulk-resource-lifecycle-actions.tsx`: T033 only

## Parallel Opportunities

- Foundational: T002 alongside any test-writing task.
- US1: T005 and T006 in parallel (T007 follows T005, same file); T009 in parallel with T008.
- US2: T012, T013, T014 in parallel.
- US3: T016, T017, T018, T023 in parallel.
- US4: T024, T025, T026, T027 in parallel.
- US5: T031, T032 in parallel.
- Across stories after Phase 2: US2, US3 and US4 implementation can proceed in parallel by
  different people (only the page-file sequencing above applies).

### Parallel example: User Story 1

```text
T005 Update list.test.tsx (columns, cells, tabs)
T006 Create no-match.test.tsx
T008 Restyle customer-table.tsx                # after T004
T009 Create customer-no-match.tsx
```

## Implementation Strategy

### MVP first

1. Phase 1–2.
2. US1 (lists) and US2 (detail): consultation fully in V2 — reviewable as the first increment of
   the Draft PR.

### Incremental delivery

3. US3 (create/edit) → US4 (single lifecycle) → US6 (read-only check) → US5 (bulk) → US7 (light
   theme audit) → Polish. Commit after each story with a Conventional Commit such as
   `feat(customers): Restyle the customer lists to the V2` and push to the Draft PR.

## Notes

- [P] = different files, no dependency on an incomplete task.
- Shared lifecycle defaults stay as they are (R1, R2); any temptation to change them belongs to a
  later cross-resource cleanup, not this PR.
- Baseline failures found in T001: _none recorded yet_.
