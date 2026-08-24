# Research: Create a Truck

All Technical Context items are resolved from the existing codebase; no NEEDS CLARIFICATION items remain.

## Decision: Reuse the Customer/Dock/Weighing-Area create-slice shape for Truck

**Decision**: Add a `create` vertical slice to the existing `apps/api/app/trucks/` module (`create/create_truck_use_case.ts`), following the exact shape already proven by `apps/api/app/customers/create/create_customer_use_case.ts`: a thin use case delegates to a repository `create()` call that returns a discriminated `TruckWriteResult`, and the controller maps that result to HTTP status/body.

**Rationale**: `TruckPolicy`, `TruckTransformer`, the `trucks` table, and the `Truck` model already exist from List Trucks (`#222`); only the write path is missing. Mirroring an already-reviewed, already-tested pattern (Customer creation, `GH-193`) minimizes new architectural surface and keeps deep-boundary ownership (use case = business decision, repository = persistence, controller = HTTP adaptation) consistent with Constitution Principle V.

**Alternatives considered**: A generic "site reference create" abstraction shared across Customers/Docks/Trucks — rejected because the existing List Trucks plan already rejected a generic site-reference abstraction in favor of per-resource vertical slices matching Docks and Weighing Areas, and Truck creation additionally carries a cross-table rule (available transport company) that a generic abstraction would have to special-case anyway.

## Decision: Detect duplicate registration via the persisted unique index, not a pre-check query

**Decision**: `LucidTruckRepository.create()` attempts the insert directly and catches a unique-constraint violation on `trucks_registration_unique` (the existing case-insensitive functional index from migration `1784900000000_create_trucks_table.ts`) using the existing `isUniqueViolation` helper, returning `{ kind: 'DUPLICATE_REGISTRATION' }`.

**Rationale**: This is the exact pattern already implemented and tested in `LucidCustomerRepository.create()` (`duplicateKind` helper matching `customers_code_unique` / `customers_company_name_unique`). Relying on the database constraint rather than a separate existence check is race-safe: it is the only way to guarantee FR-012/SC-005 (at most one truck survives two near-simultaneous submissions of the same registration) without introducing application-level locking.

**Alternatives considered**: Pre-checking `findByRegistration()` before insert — rejected because it reintroduces a check-then-act race between two concurrent administrators, which the spec's Edge Cases and User Story 3 explicitly require the system to close.

## Decision: Validate the transport company as a business rule in the use case, not only a foreign-key constraint

**Decision**: `TransportCompanyRepository` gains a `findById(id): Promise<TransportCompany | null>` method (mirroring `CustomerRepository.findById`). `CreateTruckUseCase` loads the company first and rejects when it is missing or `status !== 'AVAILABLE'`, before ever attempting the truck insert.

**Rationale**: The database only enforces that `transport_company_id` references an existing row (`RESTRICT` on delete); it has no way to express "must currently be `AVAILABLE`". That cross-table invariant is already documented as deferred to "future create, update, company-archive, and truck-reactivation workflows" in the List Trucks (`#222`) data model — this plan is that create workflow. Checking in the use case keeps the rule visible as a business decision (Principle V) and produces one specific, actionable error rather than a generic foreign-key failure.

**Alternatives considered**: A database trigger enforcing the cross-table invariant — rejected as disproportionate for one create path and explicitly deferred by the prior slice's data model; a client-side-only restriction (only offering available companies in the picker) — rejected as insufficient because API authorization must remain authoritative (Constitution: "API is the source of truth for business state and authorization").

## Decision: New `createTruckValidator` with a bespoke tonnage-precision rule

**Decision**: Add `apps/api/app/trucks/shared/truck_validator.ts` using VineJS, following the `customer_validator.ts` / `site_reference_validator.ts` pattern: `registration` uses the existing `nonBlank` rule plus `maxLength(255)`; `vehicleModel` is `optional().nullable()` with `nonBlank` applied only when a non-null value is present, plus `maxLength(255)`; `capacityTonnes` is `vine.number().positive()` plus a new `maxDecimalPlaces(3)` rule (via `vine.createRule`, same construction as the existing `nonBlank`/`distinctUuids` rules) so the API rejects excess precision before it ever reaches the `NUMERIC(12,3)` column; `transportCompanyId` is `vine.string().uuid()`.

**Rationale**: No numeric-precision validator exists yet in the codebase (`capacityTonnes` is only DB-constrained today via `capacity_tonnes > 0`), so a new rule is required. Building it as a `vine.createRule` keeps it consistent with the two existing custom rules (`nonBlank`, `distinctUuids`) rather than inventing a new validation mechanism.

**Alternatives considered**: Letting the database `CHECK (capacity_tonnes > 0)` and numeric column scale silently truncate/round excess precision — rejected because FR-006 and the Edge Cases require a specific, actionable rejection rather than a silently altered value.

## Decision: New exception types follow the existing status-code convention

**Decision**: Add `apps/api/app/trucks/shared/truck_exceptions.ts` with `DuplicateTruckRegistrationException` (`409`, `E_TRUCK_REGISTRATION_CONFLICT`) and `InvalidTransportCompanyException` (`422`, `E_TRUCK_TRANSPORT_COMPANY_INVALID`).

**Rationale**: `409` for a duplicate-identity conflict matches `DuplicateCustomerCodeException`/`DuplicateCustomerCompanyNameException`/dock and weighing-area duplicate exceptions. `422` for "the submitted transport company reference is not a usable value" matches the existing `site_reference_exceptions.ts` family (`InvalidSiteReferenceNameException`, `InvalidSiteReferenceCoordinatesException`), which already uses `422` for domain-level input validity distinct from a `409` state conflict on the record being written. Authorization denial continues to rely on Bouncer's own `403` response; forbidden truck writes need no bespoke exception, matching how `trucks_controller.ts` already delegates entirely to `bouncer.with(TruckPolicy).authorize(...)`.

**Alternatives considered**: `404` for a missing transport company — rejected because the identifier is a field within the create payload, not a URL resource lookup, and a single `422` lets the client handle "not usable" (missing or archived) uniformly without leaking whether the id ever existed.

## Decision: Web creation UI follows the Customer creation panel pattern

**Decision**: Add `create-truck-panel.tsx` and `truck-form.tsx` under `apps/web/src/features/trucks/ui/`, and a `create` mutation in a new `apps/web/src/features/trucks/mutations/use-truck-mutations.ts`, mirroring `create-customer-panel.tsx` / `customer-form.tsx` / `use-customer-mutations.ts`. The transport-company picker sources its options from the existing available transport-company query already used by the integrated `/transport-resources` workspace.

**Rationale**: The trucks feature already composes into the same `/transport-resources` workspace as transport companies (built in `#222`); reusing the proven Customer create-panel composition (side panel triggered from the list workspace, TanStack Query mutation with query invalidation on success) keeps the addition consistent with Constitution Principle VI (no competing UI pattern) and requires no new web architecture.

**Alternatives considered**: A dedicated full-page truck-creation route — rejected; List Trucks already established side-panel detail/inspection as the workspace's interaction model, and introducing a second navigation pattern for creation alone would fragment that workspace.
