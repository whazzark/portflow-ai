# Phase 0 Research: Consult a Prepared Discharge in the Web Workbench

All Technical Context entries are resolved and no `NEEDS CLARIFICATION` remains. The spec's
`## Clarifications` section already settled the two product questions: a dedicated page, and full
assignment history. This document records the design decisions the plan made on top of them.

## Decision 1 — One detail endpoint returning the whole preparation graph

**Decision**: `GET /api/v1/discharges/:id` (`discharges.show`) returns one discharge in one response:
- its identity and vessel description;
- its dock;
- its product lots, with their customers and warehouse door assignments;
- its truck pool;
- its shifts, with their responsible and their truck, warehouse door, and weighing area
  memberships.

**Rationale**: The page shows every section at once. The spec's performance target (SC-004) sets
one scale for the whole detail, and a refresh or retry must replace every stale section together
(FR-024). A single response gives one loading state, one failure state, and one cache entry to
invalidate. Lucid resolves the nested preloads with one query per relation level, so the query
count does not depend on how many lots, trucks, or shifts the discharge holds.

**Alternatives considered**:
- One endpoint per section (`/discharges/:id/product-lots`, `/shifts`, `/truck-pool`). Rejected:
  it gives three loading and failure states for one page, and a retry could leave the sections
  out of step with each other.
- Widening the list payload so the detail reads from the loaded collection, as the customer
  sheet does. Rejected: the list would carry every discharge's full graph on every visit. It also
  breaks direct opening of an address (FR-020) and contradicts the list transformer's documented
  intent to stay light.

## Decision 2 — The detail carries every label and status it shows

**Decision**: Each site reference in the payload arrives with its display label and its current
status. That covers the dock, customers, warehouses, warehouse doors, weighing areas, trucks, and
transport companies. The shift responsible arrives with their first and last name.

**Rationale**: FR-015 and FR-016 require archived references to stay readable, with a marker, for
every role. The site-reference policies make the full `list` of docks, trucks, and weighing areas
administrator-only; everyone else reads `listAvailable`, which excludes archived records. So the
web cannot resolve those labels from its own collections for an observer. It has to receive them
here, and one transformer serves every role.

**Alternatives considered**: Sending identifiers only and resolving them in the web from
site-reference queries. Rejected: an observer would see blanks wherever a reference was archived,
which is the exact case FR-015 protects.

## Decision 3 — A truck is named by its captured registration, resolved in the API

**Decision**: A shift's truck membership stores only `truck_id`. The transformer resolves its
registration from the discharge's own truck pool entry for that truck (`registration_snapshot`).
Only when the discharge has no pool entry for that truck does it fall back to the truck's current
registration. The web never makes this join.

**Rationale**: FR-013 requires the captured registration everywhere, and `CONTEXT.md` states that
historical assignments keep the registration captured at reservation. The pool is the only place
that capture lives. Joining in the transformer keeps one authoritative answer. The fallback
exists because no database constraint ties a shift membership to a pool entry, and a blank
registration would be worse than the current one. Seeded data never takes that branch, and a unit
test pins both paths.

**Alternatives considered**: Sending both registrations and letting the web choose. Rejected: it
exposes a choice the domain has already made.

## Decision 4 — "In effect" means an open period on a live discharge

**Decision**:
- A warehouse door assignment or a shift membership is in effect when its `effective_to` is null
  **and** its discharge is Planned or Active. It is ended otherwise.
- A pool entry is held when its `released_at` is null and its discharge is Planned or Active. It is
  released otherwise.
- On a Closed discharge, a period or reservation left without an end is shown as ended with its end
  "not recorded", never as current.
- The API sends the raw periods. The web derives the in-effect or ended split, so every period is
  shown on its own (FR-014).

**Rationale**: This is the rule the delivered site-reference usage checks apply when deciding
whether a discharge holds a door, a truck, or a weighing area (`lucid_discharge_usage_repository.ts`):
an open row counts only on a Planned or Active discharge. Applying both conditions means the
detail never claims a discharge holds a resource that the archival guards consider free, or the
reverse.

*Corrected on 2026-09-11 during implementation.* The first version dropped the status condition.
The seeded Closed discharge `MV Loire Star` still has open door and shift periods, so it was
presented as holding them, which contradicts the spec's closed-discharge edge case. The fresh
review caught this.

Comparing `effective_to` with the clock was rejected: the persisted model has no future-dated end,
so the comparison would add a time dependency without changing any answer.

**Alternatives considered**: Having the API split the history into `current` and `ended` arrays.
Rejected: two arrays per resource type double the contract's surface. The split is a one-line
predicate in a pure, unit-tested web helper.

## Decision 5 — Quantities travel as fixed-precision strings; the expected tonnage is summed in the API

**Decision**:
- Each lot's `expectedQuantityTonnes` is serialized as a decimal string with exactly three
  decimals, for example `"1250.500"`.
- The discharge's `expectedTonnage` is summed in the API with `decimal.js` and serialized the
  same way.
- The web formats both through one pure `formatTonnes` helper.

**Rationale**:
- FR-007 requires three decimals, and `CONTEXT.md` defines a Tonnage Measurement as three decimals
  at most. Converting to a JavaScript number before summing would let floating-point error reach
  the third decimal.
- `decimal.js` is an API dependency the `ProductLot` model already uses, and the web has no
  decimal library.
- The sum is technically derivable, which the list slice avoided sending. It is sent anyway
  because deriving it correctly needs decimal arithmetic, and that belongs where the decimal
  library already lives.

**Alternatives considered**:
- `Number(...)`, as the truck capacity does. Rejected: capacity is a single value that is never
  summed.
- Summing in the web from strings. Rejected: it would add a decimal dependency to the web for one
  addition.

## Decision 6 — Deterministic reading order, set by the API

**Decision**:
- Lots are ordered by customer name, then product name, then `id`.
- Door assignments and shift memberships are ordered by `effective_from`, then `id`.
- Shifts are ordered by `planned_start_at`, then `id`.
- The truck pool is ordered by captured registration, then `id`.

**Rationale**: FR-009 fixes the shift order. For the other sections the spec asks only that
nothing be missing or duplicated, but an order that changes between two reads makes a refresh
look like a data change. The list slice sorted lots by `id` purely for determinism. Here the lots
are the page's main content, so they get a reading order a user can scan by customer. Putting the
order in SQL keeps the tie-break authoritative, as the list slice's Decision 4 argued.

## Decision 7 — Unknown and malformed identifiers are one not-found outcome

**Decision**: The repository returns `null` for an id that is not a UUID, using
`#shared/database/is_uuid`, and for an id that matches no discharge. The use case turns either
into `DischargeNotFoundException` (404, `E_DISCHARGE_NOT_FOUND`). In the web, the route loader
converts that 404 into TanStack Router's `notFound()`, and the route's `notFoundComponent` shows
the not-found state with a way back to the list (FR-022). Every other failure reaches the
`errorComponent` with its retry action.

**Rationale**: The warehouse door repository already guards malformed ids this way, so the client
sees one outcome for "no such discharge". Passing a malformed id to PostgreSQL would raise a cast
error and surface as a 500, which the web would show as a retryable failure that no retry can fix.
Keeping not-found out of the error path is what makes FR-022's "no failure or retry is offered"
true.

**Alternatives considered**:
- A router-level UUID matcher on `:id`. Rejected: it answers with the router's generic 404 rather
  than the domain's code, and no other route in `start/routes.ts` uses matchers.
- Validating the id in the web before requesting. Rejected: the API has to guard anyway, so the
  check would exist twice.

## Decision 8 — A nested route whose parent owns the list's address state

**Decision**: The discharges routes are restructured into three files:

| File | Role |
|---|---|
| `routes/_authenticated/discharges.tsx` | Layout route. Keeps the `Discharges` breadcrumb and the `status` and `search` schema. Renders only an `<Outlet />`. |
| `routes/_authenticated/discharges.index.tsx` | The list. Takes over the loader and the pending and error components. |
| `routes/_authenticated/discharges.$dischargeId.tsx` | The detail page. Has its own loader and pending, error, and not-found components. |

Because the parent owns `status` and `search`:
- A detail address such as `/discharges/<id>?status=closed&search=loire` carries the list state
  it was opened from.
- The page's "Back to discharges" link returns to exactly that list (FR-021).
- An address with no parameters opens the discharge on its own, and the way back lands on the
  default Active list (FR-020).

**Rationale**:
- The address carries the open discharge, as `apps/web/AGENTS.md` requires, and the list state
  survives a reload and a shared link.
- A flat, un-nested `discharges_.$dischargeId.tsx` would lose the `Discharges` breadcrumb. It
  would also have to duplicate the list's search schema.
- Relying on browser history for the way back breaks as soon as the detail is reloaded or opened
  from a shared link.

**Consequence for the shared header**: The breadcrumb currently links each ancestor crumb to its
bare pathname, which drops the search. Only a nested route has an ancestor crumb, and this slice
introduces the first one. `authenticated-header.tsx` therefore keeps the current search on an
ancestor crumb's link, so the `Discharges` crumb returns to the list the user came from, like the
back link does. Every existing page has a single crumb, which renders as the current page and not
as a link, so none of them changes.

**Alternatives considered**: A `dischargeId` search parameter on the list route, as GH-61's
planning notes expected. Rejected: that shape assumed a panel over the list, which the product
owner turned down on 2026-09-11.

## Decision 9 — A deliberate departure from the side-panel convention

**Decision**: The detail is a full page built from `Card` sections. It is not the
`Sheet size="lg"` that `apps/web/AGENTS.md` prescribes for a detail panel.

**Rationale**: This is the product owner's clarified choice. About ten later slices add panels,
tabs, or actions to this detail: GH-54, GH-55, GH-75 to GH-77, the closure slices, the activity
log, and rotation adjustments. A large sheet has no room for them. The `Sheet` rule still governs
records that open over their own directory, and this departure applies to the discharge detail
only. The page reuses the resource primitives that do fit: `ResourceDetailField` for labelled
values, the italic `Not specified` placeholder, the status badge, `Empty`, and
`ResourceCollectionError`. That keeps it visually related to the sheets.

**Not done here**: Amending `apps/web/AGENTS.md`. One page does not make a new convention. If the
shift workspace (GH-65) makes the same choice, that is the point to write it down.

## Decision 10 — Detail breadcrumb label and page heading

**Decision**:
- The detail route's breadcrumb names the discharge by its vessel, so the header reads
  `Discharges › <vessel name>`. It falls back to `Discharge` while nothing has been read: while
  loading, and when the discharge is missing or failed to load.
- To support that, the shared `staticData.breadcrumb` accepts either a string or a function of the
  route's loader data. Every existing route keeps its string.
- The page still shows the vessel name as a visible heading, with the discharge's status badge
  beside it.

**Rationale**:
- A crumb reading `Details` said nothing about which discharge was open. The product owner asked
  for the name on 2026-09-11.
- The resolver receives the loader data untyped, because `staticData` is declared once for every
  route. The detail route narrows it itself, and a crumb must never be blank.
- The heading stays visible because it carries the status badge, which the crumb cannot.

*Revised on 2026-09-11.* The first version used a static `Details` label and deferred this
resolver until a second page needed one. The product owner asked for the vessel name instead.

## Decision 11 — Rows of the list become selectable, like the customer table

**Decision**: In each row, the vessel name becomes a real link to the detail that preserves the
current `status` and `search`. That link is what keyboard users, middle-click, and "open in new
tab" rely on. The row also gets `cursor-pointer` and the hover highlight, and a click anywhere on
it navigates, as `customer-table.tsx` does. The link's accessible name is
`View discharge <vessel name>`.

**Rationale**: FR-003 reverses GH-61's FR-024. A plain row click is not reachable by keyboard, so
the link carries the accessible behavior and the row click is only a pointer convenience. This
matches how the customer table pairs a code button with a row click. GH-61's `inert-rows` test is
replaced by a selection test, and the route comment that promised this change is updated.

## Decision 12 — Authorization is a second policy method with the same predicate

**Decision**: `DischargePolicy.view(user)` returns `user.accessStatus === 'ACTIVE'`, beside the
existing `list`.

**Rationale**: FR-001 opens every status to every role, so there is nothing to distinguish. A
separate method still gives later slices a named place to narrow detail access without touching
the list. The route group's auth middleware already refuses sessions whose user is not active, so
the integration suite shows those users receive a 401, not a 403, as the list contract does.

## Resolved technical unknowns

| Unknown | Resolution |
|---|---|
| Does a single-discharge read exist? | No, on either side. The API has only `discharges.index`, and the web has only the list route. |
| Does the schema need a change? | No. GH-236 delivered every table and relation this slice reads: `discharges`, `product_lots`, `discharge_truck_assignments`, `warehouse_door_product_lot_assignments`, `shifts`, `shift_trucks`, `shift_warehouse_doors`, `shift_weighing_areas`, and the site references. |
| Which timestamps exist? | `expected_start_at`; each shift's `planned_start_at` and `planned_end_at`; each assignment's `effective_from` and `effective_to`; each pool entry's `reserved_at` and `released_at`. There is no actual start or end time and no closure actor, so the detail shows none (spec, Assumptions). |
| How are malformed ids guarded elsewhere? | `#shared/database/is_uuid` in the repository, as `lucid_warehouse_door_repository.ts` does. |
| How does the web recognize a 404? | A `TuyauError` with `status === 404`. `isUnauthorizedError` in `libraries/tuyau/api-error.ts` shows the pattern; the slice adds `isNotFoundError` beside it. |
| Is seed data enough to validate? | Yes, for the success paths. `MV Atlantic Dawn` (Planned), `MV Ocean Cedar` (Active), and `MV Loire Star` (Closed) each have one lot, one door assignment, one pool truck, and one shift with one membership of each kind. The 24 historical Closed discharges add released trucks and ended periods. Archived, suspended, and re-registered references, ended assignments on an active discharge, and empty sections are built with factories in the tests. |
| How are dates rendered? | The shared `formatDateTime` in `helpers/dates.ts`, as in the list. |
