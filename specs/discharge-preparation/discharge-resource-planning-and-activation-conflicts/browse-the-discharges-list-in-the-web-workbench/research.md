# Phase 0 Research: Browse the Discharges List in the Web Workbench

All Technical Context entries resolved; no `NEEDS CLARIFICATION` remains. The spec's own
`## Clarifications` section already settled the eight product questions, so this document records
only the design decisions the plan had to make on top of them, plus the one spec ambiguity that is
escalated rather than resolved here.

## Decision 1 — One unfiltered collection endpoint

**Decision**: `GET /api/v1/discharges` returns every discharge in every status. There is no `status`
query parameter and no per-status endpoint. The web derives the three collections and the three
counts from the single response.

**Rationale**: FR-005 requires all three counts visible at once and the spec's assumptions require a
single read. A `?status=` parameter would still need three calls to populate three counts, and
per-status endpoints would make switching a tab cost a network round trip that the clarified spec
explicitly rules out. It also matches the delivered directories: `trucks-page.tsx:248` derives every
tab count client-side from one loaded collection.

**Alternatives considered**: Three endpoints (`/discharges/planned`, `/active`, `/closed`) — rejected,
three round trips for one screen and three near-identical use cases. A `?status=` filter — rejected,
same round-trip cost, and it puts a presentation concern into the transport contract. A dedicated
`/discharges/counts` endpoint — rejected, a second contract to keep consistent with the first.

**Note on the site-reference precedent**: Trucks, docks, and customers each expose a complete
administrator collection *and* a restricted available-only collection, because their archived
records are administrator-only. Discharges have no such split — every active role reads every
status — so reproducing the two-endpoint shape here would add a contract with no authorization
difference to enforce.

**What this decision costs, and when to revisit it**: the read is unbounded and the web refetches it
on every mount, so each visit carries every discharge the site has ever run, with every product lot
and customer. Planned and active are self-limiting — a site works on a handful at a time — but closed
is append-only operational history and grows for as long as the site operates. Nothing has to change
while a season fits in one read; the trigger to revisit is the closed collection reaching a size a
user would not scroll anyway, and the shape it would take is a bound on closed alone (a window, or a
lazily fetched archive), leaving the single unfiltered read that serves the three counts intact.

## Decision 2 — Payload carries product lots, not pre-computed customer or search fields

**Decision**: Each discharge carries `productLots: Array<{ id, customerId, customerName, productName }>`
and a scalar `shiftCount`. The web derives the product-lot count, the distinct customer list shown on
the row, and the search corpus from that array.

**Rationale**: FR-008 makes customer name and product name searchable, and search is client-side over
the loaded collection, so those strings must be in the payload regardless. Once they are, a separate
`productLotCount` and a separate `customers` array would be derivable duplicates that can disagree
with the array they summarize. Shifts are different: nothing in this slice reads a shift's fields, so
only the count crosses the boundary, obtained with Lucid's `withCount` rather than by loading rows.

**Alternatives considered**: Flat `productLotCount` + `customerNames: string[]` + `productNames:
string[]` — rejected, three parallel arrays whose correspondence is lost, so a row cannot show which
customer goes with which product. Loading full shift rows — rejected, the slice never reads them.

## Decision 3 — `shiftCount` counts every shift, and this refines FR-006's wording

**Decision**: `shiftCount` is the number of shifts belonging to the discharge, whatever their status.

**Rationale**: FR-006 says "its number of planned shifts". `Planned Shift` is a defined status term in
`CONTEXT.md`, so read literally the field would count only `PLANNED`-status shifts — which collapses
to zero for most Active discharges and for every Closed one, exactly where the number is supposed to
indicate how the discharge was prepared. Reading it as "the number of shifts planned for this
discharge" keeps the indicator meaningful across all three tabs.

**Escalated, not settled**: this is a wording ambiguity in an approved spec, so the plan records the
reading rather than editing the spec. **The reviewer should confirm this reading and, if it is
right, FR-006 should say "its number of shifts" before `/speckit-tasks` runs.** If instead the
literal reading is intended, the field becomes `plannedShiftCount` with a `where('status', 'PLANNED')`
count and the Closed tab shows zeros by design.

**Alternatives considered**: Exposing both counts — rejected, two numbers on a row that has no room
to explain the difference.

## Decision 4 — Deterministic base order in the API, direction per collection in the web

**Decision**: The repository returns the collection ordered by `expected_start_at` ascending with
`id` ascending as the tie-breaker. The web reverses that order for the Closed tab.

**Rationale**: FR-012 asks for determinism, which is the part that must be authoritative and is
enforced in SQL — a stable tie-break cannot be reconstructed client-side once rows arrive in an
arbitrary order. The *direction* is a per-tab presentation choice over an already-ordered list, and
a single response feeding three tabs cannot carry three different `ORDER BY` directions anyway.

**Alternatives considered**: Sorting entirely in the browser — rejected, the tie-break stops being
authoritative. Three ordered payloads — rejected, contradicts Decision 1.

## Decision 5 — Authorization is one policy method for every active role

**Decision**: `DischargePolicy.list(user)` returns `user.accessStatus === 'ACTIVE'`, with no role
check. Unauthenticated requests are already refused by the route group's auth middleware.

**Rationale**: The clarified spec opens all three statuses to all four roles, so there is nothing to
discriminate. This mirrors `TruckPolicy.listAvailable` and `listSuspended`, which use exactly this
predicate. Because no role sees less, there is no transformer variant here — unlike
`TruckTransformer`, which needs `toOperationalView` to withhold administrator-only lifecycle actors.

**Alternatives considered**: Omitting the policy and relying on the auth middleware — rejected,
authorization belongs in a policy per `apps/api/AGENTS.md`, and GH-58 onward will add methods beside
this one.

## Decision 6 — Search is client-side, case- and whitespace-insensitive, over five fields

**Decision**: A pure `discharge-search.ts` helper matches a trimmed, lower-cased query against vessel
name, vessel IMO, dock name, and every product lot's customer name and product name, returning each
discharge at most once.

**Rationale**: The whole collection is already loaded (Decision 1), so a server round trip per
keystroke would be pure latency. FR-009 and FR-010 are exactly the kind of branching rule that
`apps/web/AGENTS.md` says belongs in a unit-tested pure helper rather than in a component.

**Alternatives considered**: Server-side `?search=` — rejected, refetches a collection already in
cache and contradicts the single-read decision. Diacritic folding as in `features/checkpoints` —
deferred: vessel and product names in the seed data are unaccented, and no requirement asks for it.

## Decision 7 — No `dischargeId` in the URL schema

**Decision**: The route's Zod schema carries only `status` and `search`. No id, no mode.

**Rationale**: FR-024 forbids carrying a selected discharge in the address, and
`apps/web/AGENTS.md` warns that a `create`/`view` mode and an id that can contradict each other need
a `transform` to reconcile them. With no record ever open, neither parameter exists and there is
nothing to reconcile. GH-58 adds `dischargeId` when it adds the panel that gives it meaning.

**Alternatives considered**: Reserving `dischargeId` now — rejected, an unused parameter that
validates but does nothing is a link that silently loses its meaning.

## Decision 8 — Add the `#discharges/*` import alias before anything else

**Decision**: Add `"#discharges/*": "./app/discharges/*.js"` to `apps/api/package.json` imports and
convert the two existing relative imports in `providers/repositories_provider.ts` and
`site_references/shared/persisted_site_reference_usage_checker.ts` to use it.

**Rationale**: Every other domain has an alias; `discharges` was created by GH-236 without one, so
its two files are reached by `../../discharges/...` paths. Adding the new slice under that scheme
would spread the exception. This is the one piece of incidental cleanup the slice needs to look like
its neighbours, and it is mechanical and type-checked.

**Alternatives considered**: Using relative imports for the new slice too — rejected, entrenches the
inconsistency across six new files.

## Resolved technical unknowns

| Unknown | Resolution |
|---|---|
| Is there an existing discharge query to extend? | No. `app/discharges/` holds only the usage repository used by site-reference archival checks; `apps/web` has no discharge code at all. |
| Does the schema need a change? | No. GH-236 delivered `discharges`, `product_lots`, `shifts`, and the dock and customer relations. |
| Is seed data available for validation? | Yes. `database/fixtures/discharge_preparation.ts` seeds 1 Planned (`MV Atlantic Dawn`), 1 Active (`MV Ocean Cedar`), 1 Closed (`MV Loire Star`), plus 24 historical Closed discharges — 27 in total across all three tabs. |
| How does the web get the typed contract? | Adding the controller and route regenerates `.adonisjs/server/controllers.ts` and the Tuyau registry that `@portflow/api/registry` exports; the web then calls `tuyauQuery.discharges.index`. |
| How are dates rendered? | The existing `helpers/dates.ts` `formatDateTime` (`en-GB`, browser time zone). No new formatter, no time-zone work. |
| Where does the navigation entry come from? | `components/layout/app-sidebar.tsx` already lists `{ label: 'Discharges', icon: ShipIcon }` under Operations with no `href`; this slice supplies it. |
