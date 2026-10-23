---

description: "Task list for the V2 restyle of Transport resources (GH-319)"
---

# Tasks: Restyle Transport Resources

**Input**: Design documents from `specs/site-references/transport-resources/restyle-transport-resources/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/url-state.md](./contracts/url-state.md),
[contracts/ui-contract.md](./contracts/ui-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The constitution (IV) mandates RED → GREEN → REFACTOR: each story's test
tasks are written first and must fail before its implementation tasks.

**Organization**: Tasks are grouped by user story. Paths are relative to `apps/web/src/` unless
they start with `specs/`. Run web tests with
`pnpm --filter @portflow/web test -- <path>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story from spec.md (US1–US7)

## Conventions for every task

- Copy, roles and accessible names come from `contracts/ui-contract.md`; address state from
  `contracts/url-state.md`; grouping/filter/count rules from `data-model.md`.
- Colours only through theme tokens (`bg-card`, `border-border`, `text-muted-foreground`,
  `bg-success`/`bg-warning`, `text-indicator`, …); never hex values.
- Visible button labels carry the action only (`Archive`, not `Archive truck`); accessible names
  name the resource where the contract says so.
- Do not change the defaults of `components/lifecycle/*` or `BulkResourceLifecycleActions`; only
  add optional props (sibling branches #318/#326 depend on them).
- No API change. If a task seems to need one, stop and raise it.

---

## Phase 1: Setup (shared test support)

**Purpose**: One test harness for the new screen, built on the existing fixtures.

- [X] T001 Create `features/transport-resources/__tests__/support/fleet-test-helpers.ts` exporting `mockFleet({ user, companies, trucks })` (MSW handlers for `GET /api/v1/session` user, `/transport-companies`, `/transport-companies/available`, `/trucks` for administrators, `/trucks/available` and `/trucks/suspended` without actors for others — reuse the handler shapes in `features/trucks/__tests__/support/test-helpers.ts` `mockTrucks` and `features/transport-companies/__tests__/support/test-helpers.ts` `mockTransportCompanies`), `renderFleet(initialPath = '/transport-resources')` (reuse `renderTrucks`' router setup), and query helpers `fleetTable()`, `groupHeader(companyName)`, `truckRow(registration)`, `statusPill(name)`.
- [X] T002 [P] Create `features/transport-resources/__tests__/support/fleet-fixtures.ts` with the canvas data set: companies Atlantic Transport, Bretagne Vrac, Loire Logistique (available, with phone/email) and Transports Morvan (archived, comment "Company closed its bulk activity"); trucks AB-123-CD, CD-456-EF, NP-901-QR (suspended, "Tyre replacement, back on Friday"), JK-345-LM, LM-678-NP, EF-789-GH, GH-012-JK (suspended, "Brake inspection after a warning light", returned-to-service context "Gearbox repaired"), QR-234-ST (archived, "Sold", company Transports Morvan), typed as `TruckDto` / `TransportCompanyDto`, plus `toAvailableDto` / `toSuspendedDto` helpers that strip actors.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Shared seams, the view model, the address state, and form hooks every story uses.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

### Tests first

- [X] T003 [P] Write failing unit tests in `features/transport-resources/helpers/fleet-view.test.ts` for every rule of `data-model.md`: status membership (incl. archived companies, pinned new company), search on registration / vehicle model / company name, company filter + `hiddenCompanyCount`, unknown company id, sort per column with null vehicle model last and registration tie-break, status order, fleet-wide counts ignoring search/filter, administrator vs non-administrator `archived` count, group summary unaffected by filters, `archiveBlockedBy`, `canReactivate`, `showArchivedNotice`, `isEmpty`, group order by company name.
- [X] T004 [P] Write failing tests in `routes/_authenticated/__tests__/transport-resources-search.test.ts` for the search schema in `contracts/url-state.md`: defaults, `.catch` fallbacks, de-duplicated non-empty `status`, the four invariants (create clears details; truck and company details exclusive; `createTruckCompanyId` only with `create=truck`), and the `/transport-companies` mapping (`status=archived` → `['archived']`, `search`, `transportCompanyId`). Export the schema and the legacy mapping function from their route files so they are testable.
- [X] T005 [P] Write failing tests in `helpers/dates.test.ts` for `formatDate` (`2026-09-23T07:48:00Z` → `23/09/2026`, `null` → `—`).
- [ ] T006 [P] Write failing tests in `components/lifecycle/__tests__/resource-lifecycle-dialog.test.tsx` proving the new optional props: `describeTitle` replaces the title, `commentPlaceholder` sets the textarea placeholder, `describeSuccessDetail` becomes the success toast description; without them the existing title, placeholder-less textarea and toast are unchanged.

### Implementation

- [X] T007 [P] Add `formatDate` to `helpers/dates.ts` (`Intl.DateTimeFormat('en-GB', { dateStyle: 'short' })`, `—` for null) — T005 green.
- [X] T008 Add optional `describeTitle?: (action) => string`, `commentPlaceholder?: (action) => string` and `describeSuccessDetail?: (action, result) => string | undefined` to `ResourceLifecycleConfig` and use them in `ResourceLifecycleDialog` in `components/lifecycle/resource-lifecycle-actions.tsx` — T006 green. If #318 has merged `describeTitle`/`commentPlaceholder`, rebase and add only `describeSuccessDetail`.
- [X] T009 [P] Provide `components/lifecycle/resource-lifecycle-history.tsx` (`ResourceLifecycleHistory`: "History" heading, `orderLifecycleBlocks` newest first, past-tense action, `formatDateTime`, optional actor via `ResourceActor`, comment in curly quotes, "No lifecycle history yet." when empty) and `components/resource/resource-actor.tsx` (`ResourceActor`: `UserAvatar size="sm" aria-hidden` + full name, optional trailing date) to the contract of #318 `research.md` R3/R4. Skip whatever #318 already merged; add a small test in `components/lifecycle/__tests__/resource-lifecycle-history.test.tsx` if none exists.
- [X] T010 Implement `buildFleetView` and its types (`FleetView`, `FleetGroup`, `FleetTruck`, `FleetSort`) in `features/transport-resources/helpers/fleet-view.ts` — T003 green. Reuse `truckMatchesSearch` from `features/trucks/helpers/truck-search.ts` after extending it to vehicle model (update `truck-search.test.ts` first).
- [X] T011 Replace the search schema in `routes/_authenticated/transport-resources.tsx` with `contracts/url-state.md` (keep the loader, pending and error components); remap `routes/_authenticated/transport-companies.tsx` — T004 green.
- [X] T012 [P] Create `features/trucks/ui/truck-status-pill.tsx` (`TruckStatusPill` for `AVAILABLE`/`SUSPENDED`/`ARCHIVED` → Available/Suspended/Archived, pill with `StatusIndicator` dot variants success/warning/neutral) with a render test in `features/trucks/ui/truck-status-pill.test.tsx`.
- [X] T013 [P] Extract `truckFormSchema`, the submit mapping and error handling of `features/trucks/ui/truck-form.tsx` into an exported `useTruckForm({ truck?, onCreate, onUpdate, onSuccess })` hook in the same file; add refusal-to-field mapping (`E_TRUCK_REGISTRATION_CONFLICT` → `registration`; `E_TRUCK_TRANSPORT_COMPANY_LOCKED`, `E_TRUCK_TRANSPORT_COMPANY_INVALID` → `transportCompanyId` with "The company cannot change while this truck is used by a planned or active discharge." for the lock; other refusals → form-level error) instead of the toast. Keep `TruckForm` rendering through the hook until US4 deletes it. Confirm the codes in `apps/api/app/trucks/` before mapping.
- [X] T014 [P] Same extraction for `features/transport-companies/ui/transport-company-form.tsx` → `useTransportCompanyForm` (`E_TRANSPORT_COMPANY_NAME_CONFLICT` → `name`; phone and email stay required). Confirm the code in `apps/api/app/transport_companies/`.

**Checkpoint**: `pnpm --filter @portflow/web test` green (old screen still in place); foundation ready.

**Implementation notes (2026-10-22)** — adjustments to `apps/web/AGENTS.md`, which the plan missed:
- URL state keeps `<resource>Mode` with `view | edit | create` and still reads the former parameter
  names (rewritten in the transform); `contracts/url-state.md` was updated accordingly. The schema
  lives in `features/transport-resources/helpers/transport-resources-search.ts` (route stays thin)
  and is unit-tested there, not under `routes/`.
- Unit tests never render React: T006's dialog-seam assertions move into the US5 feature suite
  (T028), and T012 has no standalone render test (covered by US1/US5 feature suites).
- T011 (route wiring) lands with T020, since the new schema and the old page cannot coexist.
- T009 is deferred to US3 (only the History needs it); T013/T014 to US4 (only the inline forms
  need them, and moving refusals out of toasts would break the old panels' suites before US1).

---

## Phase 3: User Story 1 — Read the fleet grouped by transport company (P1) 🎯 MVP

**Goal**: The grouped table replaces the two directories.

**Independent Test**: Seed the canvas data set, open `/transport-resources`, compare with *Transport resources · Retenue* (quickstart #1).

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T015 [P] [US1] Write `features/transport-resources/__tests__/list.test.tsx`: table "Trucks by transport company" with headers Registration, Vehicle model, Capacity, Suspension, Status, Actions; one group header per company with name, "2 available · 1 suspended" / "2 available", phone, email; truck rows with registration, model or "—", "32.5 t", suspension cell "comment · actor, dd/mm/yyyy" or "—", status pill; default pills Available+Suspended pressed with counts 5/2/1; collapse/expand toggles `aria-expanded` and hides rows; sorting each sortable column toggles `aria-sort` and reorders rows within groups; loading and load-error-with-retry states (port from `features/trucks/__tests__/feedback/{states,retry}.test.tsx` and `features/transport-companies/__tests__/feedback/*`).

### Implementation for User Story 1

- [X] T016 [P] [US1] Create `features/transport-resources/ui/fleet-table.tsx`: bordered rounded frame with horizontal scroll, `table` "Trucks by transport company", sortable `columnheader`s with `aria-sort` and sort icons, `tbody` rendering groups from `FleetView`, empty slot for the no-match row.
- [X] T017 [P] [US1] Create `features/transport-resources/ui/company-group-rows.tsx`: group header row (collapse/expand button "Collapse «company»"/"Expand «company»", name, summary, phone, email, actions slot) and its truck rows; collapse state passed in.
- [X] T018 [P] [US1] Create `features/transport-resources/ui/truck-row.tsx`: registration (activatable cell "View truck «registration»"), model or "—", capacity "N t", suspension cell (`suspensionComment` · actor name when present · `formatDate(suspendedAt)`), `TruckStatusPill`, actions slot.
- [X] T019 [P] [US1] Create `features/transport-resources/ui/fleet-toolbar.tsx` with the search field (label "Search transport resources", placeholder "Search registration, model or company") and the status pill group "Filter by truck status" (toggle buttons with dot and count; last pressed pill cannot be released); Create slot left empty for US4.
- [X] T020 [US1] Rewrite `features/transport-resources/ui/transport-resources-page.tsx`: load data as the current `TrucksPage` does (admin: `truckQueries.all()`; others: `available()` + `suspended()`; `transportCompanyQueries.all()`), read/write route search, memoise `buildFleetView`, keep local collapsed-group state, render toolbar + table; error and loading states via `TrucksError` / skeleton. Delete `features/transport-resources/ui/transport-resources-workspace.tsx` and `features/trucks/ui/trucks-page.tsx`.
- [X] T021 [US1] Delete the test suites bound to the removed layout and record, in this task's PR description, which new suite re-covers each business assertion: `features/transport-resources/__tests__/{integrated-workspace,keyboard-shortcuts,resource-navigation,side-panels}.test.tsx`, `features/trucks/__tests__/{list,details,selection,bulk,lifecycle,administration,access,feedback}/**`, `features/transport-companies/__tests__/{list,details,lifecycle,administration,feedback}/**`. Keep `support/` folders (still used) and `helpers/*.test.ts`. Update `components/layout/__tests__/authenticated-layout/transport-companies-navigation.test.tsx` to the new landing assertions.

**Checkpoint**: US1 green; screen reads like the default artboard.

---

## Phase 4: User Story 2 — Narrow the fleet (P1)

**Goal**: Status pills, company filter, search, no-match, addressable view.

**Independent Test**: quickstart #2–#5, #14, #17.

### Tests for User Story 2 ⚠️

- [X] T022 [P] [US2] Write `features/transport-resources/__tests__/filters.test.tsx`: only Suspended → suspended trucks under their companies only; only Archived (admin) → Transports Morvan "Archived" with comment, actor, date and `Reactivate` slot, QR-234-ST row, notice "Reactivate the company first to reactivate one of its trucks."; "Show only Loire Logistique" → banner "Showing Loire Logistique", "2 other companies hidden", "Show all companies" restores; search by registration, model, company name; "ZZ-999" → no-match copy, "Clear search" empties the field, "Include archived" presses Archived and disappears; reload with search params restores the view; `/transport-companies?status=archived&search=Morvan` lands with Archived pressed and the search applied (port from `features/trucks/__tests__/list/search-and-sort.test.tsx`, `features/transport-companies/__tests__/list/search-and-sort.test.tsx`).

### Implementation for User Story 2

- [X] T023 [P] [US2] Create `features/transport-resources/ui/fleet-banners.tsx`: `CompanyFilterBanner` and `ArchivedNotice`.
- [X] T024 [P] [US2] Add the no-match row to `features/transport-resources/ui/fleet-table.tsx` (search icon tile, title, explanation, "Clear search", conditional "Include archived").
- [X] T025 [US2] Wire pills, search, "Show only «company»" (company name button in `company-group-rows.tsx`), banners, no-match actions and archived company header (Archived pill, “comment” · actor, date) in `transport-resources-page.tsx` / `company-group-rows.tsx`, all through route search navigation (`replace` for typing).

**Checkpoint**: US1 + US2 green.

---

## Phase 5: User Story 6 — Read-only fleet (P1)

**Goal**: Non-administrators get the fleet with no write controls and today's read access.

**Independent Test**: quickstart #15.

### Tests for User Story 6 ⚠️

- [X] T026 [P] [US6] Write `features/transport-resources/__tests__/read-only.test.tsx` as `ACTIVE_OPERATIONS_LEAD`: no "Create", no "Actions for …", no "Return … to service" / "Reactivate …" buttons, no form rows even with `?create=truck` or `?truckMode=edit` in the URL (they are reset); `/trucks` (complete) is never requested; suspension cells show comment and date without actor; Archived pill count = archived companies and pressing it lists Transports Morvan only; company archive context still shows its actor (port from `features/trucks/__tests__/{access/authorization,administration/permissions}.test.tsx` and `features/transport-companies/__tests__/administration/permissions.test.tsx`).

### Implementation for User Story 6

- [X] T027 [US6] Gate every administrator slot on `isAdministrator(user)` in `transport-resources-page.tsx`, `company-group-rows.tsx`, `truck-row.tsx`; reset administrator-only search modes with `replace` (as `TrucksPage` did); pass `administrator` to `buildFleetView`.

**Checkpoint**: All P1 reading stories green.

---

## Phase 6: User Story 5 — Suspend, return to service, archive, reactivate (P1)

**Goal**: Menus, direct row actions, V2 dialogs and the suspension toast.

**Independent Test**: quickstart #6, #12, #13.

### Tests for User Story 5 ⚠️

- [X] T028 [P] [US5] Write `features/transport-resources/__tests__/lifecycle.test.tsx`: truck menu items per status (available: View, Edit, Suspend, Archive; suspended: View, Return to service; archived: View, Reactivate); Suspend dialog title "Suspend EF-789-GH?", V2 effect sentence, placeholder, comment sent, row becomes Suspended with comment/actor/date, Loire Logistique summary "0 available · 2 suspended", pill counts update, toast "Truck “EF-789-GH” suspended" (shared confirmation format) with description "It stays in its current discharges."; direct "Return GH-012-JK to service" dialog and result; Archive dialog for LM-678-NP; Reactivate QR-234-ST disabled while Transports Morvan is archived, enabled after the company is reactivated; company menu (View details, Edit, Add truck, Archive disabled "Still provides 1 available truck") and archival allowed when 0 available; refusals (`E_TRUCK_IN_USE`, company archived, 409) keep the dialog open, show the refusal toast and refresh the list (port from `features/trucks/__tests__/lifecycle/*.test.tsx`, `features/trucks/__tests__/list/{lifecycle,row-actions}.test.tsx`, `features/transport-companies/__tests__/lifecycle/{archive,reactivate}.test.tsx`).

### Implementation for User Story 5

- [X] T029 [P] [US5] In `features/trucks/truck-lifecycle.tsx`: supply `describeTitle`, `commentPlaceholder`, V2 `describeEffect` sentences and `describeSuccessDetail` (suspend → "It stays in its current discharges.") in `useTruckLifecycleConfig`, copy from `contracts/ui-contract.md`; remove `TRUCK_BLOCKER_REASON_LABELS`, `TRUCK_PLURAL`, `toBulkTruckLifecycleOutcome` and `TruckLifecycleActions` if unused. Remove `archiveMany`/`reactivateMany` from `features/trucks/mutations/use-truck-mutations.ts`.
- [X] T030 [P] [US5] Remove bulk helpers and bulk mutations from `features/transport-companies/transport-company-lifecycle.tsx` and `features/transport-companies/mutations/use-transport-company-mutations.ts` once nothing imports them.
- [X] T031 [P] [US5] Create `features/transport-resources/ui/truck-row-actions.tsx`: "Actions for «registration»" `DropdownMenu` per status, direct row buttons "Return «registration» to service" and "Reactivate «registration»" (disabled with tooltip when the company is archived), mounting `TruckLifecycleDialog` on demand.
- [X] T032 [P] [US5] Create `features/transport-resources/ui/company-group-actions.tsx`: "Actions for «company»" menu (View details, Edit, Add truck, separator, Archive disabled with "Still provides N available truck(s)" from `archiveBlockedBy`; archived company: View details, Reactivate) and header "Reactivate" button, mounting the transport-company lifecycle dialog.
- [X] T033 [US5] Mount both in `truck-row.tsx` / `company-group-rows.tsx` for administrators; Edit / View details / Add truck navigate to the URL states used by US3/US4 (no-op until those land is acceptable only within this phase's commit).

**Checkpoint**: P1 complete — MVP reviewable against 11 of 18 artboards.

**Implementation notes (MVP, 2026-10-22)**:
- T020/T021: besides the workspace and `trucks-page.tsx`, the directory-only components
  (`truck-section`, `truck-list`, `truck-row-actions`, `transport-company-section`,
  `transport-company-list`, `transport-company-row-actions`, `transport-companies-error`) were
  deleted with US1, being unreferenced. The detail and form panels stay until US3/US4 replace them.
- T021 porting record — deleted suite → re-covered by:
  `trucks/feedback/*`, `transport-companies/feedback/*` → `list.test.tsx` (load failure + retry,
  empty fleet); `trucks/list/search-and-sort`, `transport-companies/list/search-and-sort` →
  `filters.test.tsx`, `list.test.tsx` (sort), `fleet-view.test.ts`; `trucks/list/{lifecycle,row-actions}`,
  `trucks/lifecycle/*`, `transport-companies/lifecycle/{archive,reactivate}`,
  `transport-companies/list/{lifecycle,row-actions}` → `lifecycle.test.tsx`;
  `trucks/access/authorization`, `trucks/administration/permissions`,
  `transport-companies/administration/permissions` → `read-only.test.tsx`;
  `resource-navigation`, `side-panels` (address state) → `transport-resources-search.test.ts`,
  `filters.test.tsx`; selection, bulk and keyboard-shortcut suites → removed with the feature (Q3).
  Still to re-cover in US3/US4: `trucks/details/*`, `trucks/administration/update`,
  `transport-companies/details/*`, `transport-companies/administration/{create,update,contact-details}`,
  `trucks/lifecycle/recovery`, `trucks/list/scale` (T046).
- Edit, View details and Add truck already write their address state, but open nothing until
  US3/US4 land; the MVP review should ignore them.
- T028: dialog-seam assertions (T006) are covered here. Lifecycle journeys carry a 15 s test
  timeout, the repository's pattern for multi-step flows (`discharges/__tests__/detail/tabs`).

---

## Phase 7: User Story 3 — Inspect a truck and a company in place (P2)

**Goal**: Inline truck and company details.

**Independent Test**: quickstart #7, #8.

### Tests for User Story 3 ⚠️

- [X] T034 [P] [US3] Write `features/transport-resources/__tests__/details.test.tsx`: clicking "View truck GH-012-JK" (and menu View) expands region "Truck GH-012-JK" with Transport company, Company status, Created, Last updated, History newest first (Suspended 22/09/2026, 07:48 · Thomas Bernard · “Brake inspection…”; Returned to service · Claire Martin · “Gearbox repaired”), hint "Return it to service before editing or archiving it." + Return to service; "Hide details for GH-012-JK" and Escape close it and return focus to the row; `?truckId=` deep link opens it, unknown id is cleared; non-administrator sees History without actors; company View details expands region "Transport company Loire Logistique" with contact, timestamps, "Never archived", Edit, Archive disabled with "Can be archived once it provides no available truck (1 today)." (port from `features/trucks/__tests__/details/open.test.tsx`, `features/transport-companies/__tests__/details/{open,contact}.test.tsx`).

### Implementation for User Story 3

- [X] T035 [P] [US3] Create `features/transport-resources/ui/truck-detail-row.tsx` (full-width row under the truck: detail fields, `ResourceLifecycleHistory` from `truckLifecycleBlocks(truck, administrator)`, suspended hint + Return to service, Edit/Suspend/Archive buttons for available trucks via the lifecycle config).
- [X] T036 [P] [US3] Add the company detail expansion to `company-group-rows.tsx` (status, contact fields, timestamps, archival context or "Never archived", archive availability sentence, Edit / Archive / Reactivate for administrators).
- [X] T037 [US3] Wire `truckId`/`companyDetailsId` + `view` mode, Escape handling and focus return in `transport-resources-page.tsx`; clear unknown ids with `replace`. Delete `features/trucks/ui/truck-details.tsx` and `features/transport-companies/ui/transport-company-details.tsx`.

**Checkpoint**: US3 green.

---

## Phase 8: User Story 4 — Create and edit inline (P2)

**Goal**: Create split button, inline create/edit rows for trucks and companies.

**Independent Test**: quickstart #9–#11.

### Tests for User Story 4 ⚠️

- [X] T038 [P] [US4] Write `features/transport-resources/__tests__/create-edit.test.tsx`: "Create" and "Choose what to create" open the menu Truck / Transport company; create company row (fields, required validation, name conflict on the name field, success toast, new company appears as an expanded empty group with Add truck); Add truck in Loire Logistique → row "Added to Loire Logistique", Available pill, Save adds EF-like truck, registration conflict on the registration field, capacity validation; Create → Truck shows a company combobox limited to available companies, defaulting to the filtered company; Edit EF-789-GH inline (fields prefilled, Save updates, Escape/Cancel edit restores the row); company change refused with `E_TRUCK_TRANSPORT_COMPANY_LOCKED` shows the lock sentence on the company field and keeps values; while a form is open Create/Edit/Add truck are disabled; company Edit inline (port from `features/trucks/__tests__/{details/create,details/create-url,administration/update}.test.tsx`, `features/transport-companies/__tests__/administration/{create,update,contact-details}.test.tsx`).

### Implementation for User Story 4

- [X] T039 [P] [US4] Create `features/transport-resources/ui/truck-form-row.tsx` on `useTruckForm`: create (fixed company "Added to «company»" or company combobox) and edit (company combobox with available companies + current company) variants, Save, "Cancel new truck"/"Cancel edit", Escape cancels, field errors and form-level `alert` in the row.
- [X] T040 [P] [US4] Create `features/transport-resources/ui/company-form-row.tsx` on `useTransportCompanyForm`: create row at the top of the table and edit variant replacing the group header; Create/Save, "Cancel new company"/"Cancel edit".
- [X] T041 [US4] Add the Create split button (primary + chevron, both opening the menu) to `fleet-toolbar.tsx`; wire `create`, `createTruckCompanyId`, `truckMode=edit`, `companyDetailsMode=edit` in `transport-resources-page.tsx`, pin the newly created company in `buildFleetView`, open the new truck's group, disable other entry points while a form is open, success toasts via `resourceSuccessMessage`.
- [X] T042 [US4] Delete `features/trucks/ui/{create-truck-panel,edit-truck-panel,truck-section,truck-list,truck-row-actions}.tsx`, `features/transport-companies/ui/{create-transport-company-panel,edit-transport-company-panel,transport-company-section,transport-company-list,transport-company-row-actions}.tsx`, and the `TruckForm` / `TransportCompanyForm` components if nothing imports them (keep the hooks and schemas).

**Checkpoint**: All stories but the theme pass green.

---

## Phase 9: User Story 7 — Light theme (P3)

**Goal**: Every state legible in the light palette.

**Independent Test**: quickstart #16.

- [X] T043 [US7] Audit `features/transport-resources/ui/*`, `features/trucks/ui/truck-status-pill.tsx` and the new shared components for hard-coded colours or dark-only classes (`rg -n '#[0-9a-fA-F]{3,6}|bg-black|text-white' apps/web/src/features/transport-resources apps/web/src/features/trucks/ui`) and replace them with tokens.
- [X] T044 [US7] Walk every state of `quickstart.md` in light and dark against the *Thème clair* and default artboards; check pill and muted text contrast ≥ 4.5:1 with the browser's contrast tool; fix token usage where needed.

---

**Implementation notes (US7, 2026-10-23)**: no hard-coded colour in the slice. Contrast was
measured on the running app (seeded data, administrator) from computed colours, after a reload in
each theme: lowest sampled text 4.6:1 in light (amber "N suspended" on the group header) and
4.82:1 in dark (pressed pill count). Screenshots were not possible (the session had no visible
window), so the side-by-side visual comparison with the artboards remains for the human review.

## Phase 10: Polish & cross-cutting

- [ ] T045 Confirm no import remains of removed modules (`rg -n "trucks-page|transport-resources-workspace|truck-section|transport-company-section|archiveMany|reactivateMany|useSelectAllShortcut" apps/web/src/features/{trucks,transport-companies,transport-resources}`) and that `components/lifecycle` bulk code is untouched (`git diff master -- apps/web/src/components/lifecycle/bulk-resource-lifecycle-actions.tsx` empty).
- [ ] T046 Verify the porting record of T021: every deleted suite's business assertion (validation, conflicts, refusals + refresh, retry, permissions, scale) maps to a passing test in the new suites; add any missing one. Keep `features/trucks/__tests__/list/scale.test.tsx`'s scenario as a `fleet-view` or list test with a few hundred trucks.
- [ ] T047 [P] Update `specs/site-references/transport-resources/roadmap.md` with a row for GH-319 pointing at this feature directory.
- [ ] T048 Run `pnpm check`, `pnpm typecheck`, `pnpm test` from the repository root; all green (API suites unchanged).
- [ ] T049 Run the full `quickstart.md` walkthrough as an administrator and as an operations lead, including phone width; note results in the PR.
- [ ] T050 Obtain a fresh read-only Claude Code review of the final diff (new session `/code-review` or read-only subagent) and resolve every confirmed finding; open the Draft PR for #319.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** → user stories.
- **US1 (3)** blocks every other story (it replaces the page and the old suites).
- **US2 (4)**, **US6 (5)** depend on US1; independent of each other.
- **US5 (6)** depends on US1 (rows/headers to mount actions); its Edit/View/Add truck entries
  become functional with US3/US4.
- **US3 (7)** depends on US1; independent of US5 except the detail's lifecycle buttons reuse
  T029's config.
- **US4 (8)** depends on US1 and T013/T014.
- **US7 (9)** after all UI stories. **Polish (10)** last.

### Within each story

Tests first (must fail) → components → page wiring → deletions → story checkpoint green.

### Parallel opportunities

- Phase 1: T002 alongside T001.
- Phase 2: T003–T006 together; then T007, T009, T012, T013, T014 together; T008, T010, T011 after
  their tests.
- US1: T016–T019 together after T015; then T020, T021.
- US2 and US6 can be worked in parallel after US1 (different files except
  `transport-resources-page.tsx` — sequence their page edits T025 → T027).
- US5: T029–T032 together; then T033.
- US3: T035, T036 together; then T037. US4: T039, T040 together; then T041, T042.

## Parallel Example: User Story 5

```text
Task: "T029 [US5] Truck V2 lifecycle copy in features/trucks/truck-lifecycle.tsx"
Task: "T030 [US5] Remove company bulk helpers in features/transport-companies/transport-company-lifecycle.tsx"
Task: "T031 [US5] Truck row actions in features/transport-resources/ui/truck-row-actions.tsx"
Task: "T032 [US5] Company group actions in features/transport-resources/ui/company-group-actions.tsx"
```

## Implementation Strategy

### MVP (P1)

Phases 1–6: the grouped, filterable, read-only-aware fleet with all lifecycle actions. Stop and
compare with the default, suspended, archived, filter, no-match, menus, suspend, toast, return to
service, archive and read-only artboards.

### Incremental delivery

1. Foundation (seams + view model + address state) — old screen still works, tests green.
2. US1 swaps the screen; US2 + US6 complete reading; US5 completes lifecycle → MVP.
3. US3 details, US4 inline forms → full parity with the artboards.
4. US7 theme pass, polish, verification, review, Draft PR.

Commit after each task or logical group with Conventional Commits, e.g.
`feat(transport-resources): Group trucks by transport company`.
