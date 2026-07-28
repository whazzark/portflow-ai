# Research: Administer Customers From the Web Workbench

## Decision: Reuse the existing customer vertical slice

**Rationale**: The repository already separates customer create, list, available-list, update, archive, and reactivate workflows, with shared policy, validation, transformer, exceptions, repository, and site-reference usage-checker seams. This matches the API architecture rules and avoids a controller-driven or cross-domain shortcut.

**Alternatives considered**: A single customer service/controller, or a new generic site-reference abstraction for this delivery. Both would weaken existing vertical boundaries and expand GH-37 beyond the customer workbench.

## Decision: Keep lifecycle authority in the API

**Rationale**: `CustomerPolicy` is the source of authorization; use cases normalize input and enforce lifecycle rules; repositories own conditional writes, locks, and transactions. The UI derives affordances from the session only as presentation.

**Alternatives considered**: Client-only role checks or direct UI state changes. These cannot protect API callers or concurrent transitions.

## Decision: Use structured partial-success bulk lifecycle outcomes

**Rationale**: The clarified spec requires valid records to transition while blocked records are reported separately. Each bulk command therefore evaluates and locks the selected records, applies the transition to eligible records, and returns a stable result containing both changed customers and per-record blockers. A blocked record must never prevent an eligible record from changing, and a blocker must never be represented as a successful mutation.

**Alternatives considered**: All-or-nothing selection writes or one request per selected customer. All-or-nothing writes violate the clarified partial-success behavior; per-record requests lose selection-level concurrency handling and create inconsistent user feedback.

## Decision: Build the screen as a TanStack Start feature slice

**Rationale**: The authenticated route, Tuyau-generated client, TanStack Query, MSW test server, `useAppForm`, shared error helpers, and shadcn primitives are already established in `apps/web`. The route owns URL search parsing while `features/customers` owns behavior.

**Alternatives considered**: Route-local components, hand-rolled fetch mocks, or a separate global customer store. These conflict with the web agent instructions and existing application patterns.

## Decision: No new persistence migration by default

**Rationale**: The customer table and lifecycle metadata migrations already exist. Planning treats persistence as a gap-audit surface and adds a migration only if implementation finds a missing contract, preserving reversible database change discipline.

**Alternatives considered**: Recreating or renaming existing customer tables as part of the workbench. That would risk existing references and is not required by GH-37.

## Decision: Treat the current grouped lifecycle implementation as a contract gap

**Rationale**: The existing GH-36 implementation preflights the full selection and returns a conflict when any customer is blocked, while the clarified GH-37 contract requires eligible customers to transition and blocked customers to be returned separately. The plan therefore changes the grouped result contract and its tests without duplicating the already-delivered individual lifecycle work.

**Alternatives considered**: Keeping all-or-nothing grouped writes would violate FR-004. Issuing one individual request per selected customer would weaken the selection-level consistency guarantee and make mixed-result reporting dependent on client orchestration.
