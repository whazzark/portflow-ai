# Research: Restyle Transport Resources

**Feature**: [spec.md](./spec.md) · **Date**: 2026-10-22

Sources: the current screen (`apps/web/src/features/transport-resources/`, `features/trucks/`,
`features/transport-companies/`, `components/lifecycle/`), the truck and transport-company API
transformers, validators and use cases, the 18 *Retenue* artboards of the design canvas, and the
sibling #318 (Customers restyle) plan, which defines shared primitives this slice also needs.

## R1 — Web-only change; no API contract change

- **Decision**: Deliver the V2 entirely in `apps/web`. The API, its DTOs, policies and error codes
  stay as they are.
- **Rationale**: The clarifications removed the only two candidates for API work: the
  company lock stays a save-time refusal (`E_TRUCK_TRANSPORT_COMPANY_LOCKED`), and read access
  stays as today. Everything else the V2 draws is already in the DTOs:
  - trucks: registration, vehicle model, capacity, company id, status, and the latest
    suspension / return-to-service / archive / reactivation (time, actor, comment), created and
    updated timestamps (`GET /trucks` for administrators; `GET /trucks/available` and
    `GET /trucks/suspended`, without actors, for everyone else);
  - companies: name, phone, email, status, archive / reactivation context, timestamps
    (`GET /transport-companies`, readable by every active user).
- **Alternatives considered**: An up-front lock flag on the truck DTO and widened read access —
  both rejected by the 2026-10-22 clarifications.

## R2 — One grouped table built from a pure view model

- **Decision**: Add `features/transport-resources/helpers/fleet-view.ts` exporting
  `buildFleetView(input) → FleetView` (see [data-model.md](./data-model.md)). It joins trucks to
  companies, applies status pills, company filter and search, sorts, computes group summaries and
  pill counts, and decides which groups are visible. The UI renders `FleetView` and holds no
  filtering logic.
- **Rationale**: Grouping, filtering and counting are the riskiest rules of the slice and are
  plain data transformations — fast unit tests (TDD) instead of rendering tests for each
  combination. Matches the constitution's "UI adapters own transport-to-view translation".
- **Alternatives considered**: Filtering inline in components (today's approach, split across two
  directories) — rejected: the grouped table merges both collections, so the rules must live in one
  place.

## R3 — Address state

- **Decision**: Replace the route's search schema with the V2 state:
  `status[]`, `search`, `transportCompanyId`, `sort`, `order`, `truckId` + `truckMode`
  (`view`|`edit`), `companyDetailsId` + `companyDetailsMode` (`view`|`edit`), and `create`
  (`truck`|`company`) + `createTruckCompanyId`. Group collapse is local, non-addressable state.
  Contract: [contracts/url-state.md](./contracts/url-state.md).
- **Rationale**: FR-010 requires filters, sort and the open detail or form to survive a reload.
  Collapse is a momentary reading aid; putting it in the URL would bloat shared links.
- **Former parameters**: `companyStatus`, `companySearch`, `truckStatus`, `truckSearch` are
  dropped. The `/transport-companies` redirect is updated to map its `status`, `search` and
  `transportCompanyId` onto the new names; a stale `/transport-resources` link with old parameter
  names falls back to the default view (Zod `.catch`), which is acceptable for an internal tool.
- **Alternatives considered**: Keep both old and new names — rejected: two names for one state
  would contradict each other.

## R4 — Status pills and counts

- **Decision**: Pills are toggle buttons (`aria-pressed`) in a group named "Filter by truck
  status". At least one stays pressed. Counts are fleet-wide for the readable collections and
  ignore search and company filter (as drawn: "Available 5 / Suspended 2 / Archived 1" stays the
  same in the company-filter and no-match artboards).
- **Non-administrators** (clarification Q2): the Archived pill is shown and lists archived
  companies only, its count being the number of archived companies; archived trucks are never
  requested (`GET /trucks` stays administrator-only).
- **Status colours**: `success` (Available), `warning` (Suspended), `muted-foreground`
  (Archived) through the existing `StatusIndicator` dot tokens, so both themes come from #314.

## R5 — Inline forms reuse the existing schemas and submit logic

- **Decision**: Extract the Zod schemas and submit/error mapping of `TruckForm` and
  `TransportCompanyForm` into `useTruckForm` / `useTransportCompanyForm` hooks (same files), and
  render them through new inline row components. The side-panel components are deleted.
- **Error placement (FR-018, Q1)**: `E_VALIDATION_ERROR` keeps mapping onto fields
  (`applyValidationError`). In addition the inline forms map known refusals onto fields instead of
  a toast: `E_TRUCK_REGISTRATION_CONFLICT` → registration, `E_TRUCK_TRANSPORT_COMPANY_LOCKED` and
  `E_TRUCK_TRANSPORT_COMPANY_INVALID` → company, `E_TRANSPORT_COMPANY_NAME_CONFLICT` → name; any
  other refusal becomes the row's form-level error. Values are kept.
- **Inline truck edit fields**: registration, vehicle model, capacity and the company select
  (available companies plus the truck's current company, as today). The company stays editable
  (Q1); the V2 "Company locked" notice appears only after a refused save.
- **Truck creation from Create**: the inline row also shows a company select limited to available
  companies, defaulting to the filtered company when a company filter is active. From a company's
  Add truck, the company is fixed and shown as "Added to «company»".
- **Company contact fields** stay required (spec assumption); labels have no "(optional)".
- **Alternatives considered**: Keep the forms in sheets and only restyle them — rejected by the
  V2 (inline creation and edit artboards).

## R6 — Lifecycle dialogs: additive seams shared with #318

- **Decision**: Keep `ResourceLifecycleDialog` and its defaults. Add, with the same names and
  signatures as #318's plan (whichever branch lands first provides them, the other rebases):
  - `describeTitle?: (action) => string` → "Suspend EF-789-GH?", "Return GH-012-JK to service?",
    "Archive LM-678-NP?";
  - `commentPlaceholder?: (action) => string` → "Why is this truck suspended? (breakdown,
    maintenance…)", "What was done? (optional)", "Why is this truck archived?".
  And one seam of this slice: `describeSuccessDetail?: (action, result) => string | undefined`,
  passed as the toast `description` — "It stays in its current discharges." after a suspension.
  Trucks supply V2 `describeEffect` sentences from the artboards.
- **Rationale**: Changing the shared defaults would ripple into every site-reference test suite
  owned by sibling branches (#318 R1 reasoning).

## R7 — Truck History and actor/date cells

- **Decision**: Reuse #318's `ResourceLifecycleHistory` (`components/lifecycle/
  resource-lifecycle-history.tsx`) and `ResourceActor` (`components/resource/resource-actor.tsx`)
  to the contract in #318's research R3/R4; if #318 has not merged when this slice is
  implemented, implement them at those paths to that contract. History lists the latest recorded
  events (`orderLifecycleBlocks`), newest first; actors are passed only to administrators
  (`truckLifecycleBlocks(truck, withActor)` already does this).
- **Dates**: The transport artboards use numeric dates. Suspension/archive cells use a new
  `formatDate` (`en-GB`, `dateStyle: 'short'` → `23/09/2026`) in `helpers/dates.ts`; detail
  timestamps keep `formatDateTime` (`12/03/2026, 10:05`).
- **Companies**: company archive context keeps today's visibility (actors shown to every active
  user, as today); only truck actors are withheld from non-administrators.

## R8 — Bulk selection removed from this screen

- **Decision** (Q3): Remove row checkboxes, the floating bulk toolbar and the
  `useSelectAllShortcut` / `useClearSelectionShortcut` usage from Transport resources, together
  with the now-unused web-side `archiveMany` / `reactivateMany` mutations, `toBulkTruckLifecycleOutcome`,
  `TRUCK_BLOCKER_REASON_LABELS` and their transport-company counterparts. The shared
  `components/lifecycle` bulk components and hooks stay (other directories use them; #326 and
  #318 extend them). The API bulk endpoints stay.

## R9 — Interaction details

- **Create split button**: primary "Create" opens the same menu as its chevron ("Choose what to
  create": Truck, Transport company) — the artboards never show a default action, so the primary
  segment does not guess.
- **Row activation**: clicking a truck row (or View) toggles its detail row; Escape or "Hide
  details for «registration»" closes it and returns focus to the row. At most one detail and one
  inline form are open; while a form is open, Create, Edit and Add truck are disabled until it is
  saved or cancelled (no discard prompt to design).
- **Company filter**: the artboards show the filtered state but not how it is entered. The plan
  makes the company name in each group header a button "Show only «company»" (the collapse
  chevron stays a separate control), mirroring today's "click a company to scope the trucks". The
  banner "Showing «name» · N other companies hidden" with "Show all companies" clears it.
  *Review point.*
- **No-match**: rendered when a search is active and the view has no rows; "Include archived" adds
  `archived` to `status` and appears only when it is not pressed.
- **Collapse**: per-group toggle "Collapse/Expand «company»" with `aria-expanded`.
- **Archived notice**: "Reactivate the company first to reactivate one of its trucks." shown when
  the Archived pill is pressed and an archived company has archived trucks (administrators).
- **Narrow viewports**: the table scrolls horizontally inside its bordered frame; the toolbar wraps.

## R10 — Testing approach

- **Decision**: Vitest + Testing Library + MSW, as today; no Playwright exists in the repository.
  - Unit (TDD): `fleet-view.test.ts` covers grouping, filtering, search, sort, counts, read-only
    archived behaviour.
  - Component/integration suites under `features/transport-resources/__tests__/` organised by
    user story (list, filters, details, create-edit, lifecycle, read-only), reusing the trucks and
    transport-companies `support/fixtures.ts`.
  - Existing suites that assert the removed UI (sheets, tabs, lists named "Available trucks",
    selection, bulk, keyboard shortcuts) are deleted; their business assertions (validation,
    conflicts, refusals and refresh, retry, permissions) are ported to the new suites so no rule
    loses coverage (SC-006).
  - Light theme: verified manually against the *Thème clair* artboard; components use theme tokens
    only (no hard-coded colours), checked in review.
