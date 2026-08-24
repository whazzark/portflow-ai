# Phase 0 Research: Create a Weighing Area

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-24

All research was conducted against the current codebase on `feat/203-create-weighing-area`. The
Technical Context in `plan.md` carries no `NEEDS CLARIFICATION` markers; every unknown below was
resolved by reading existing code and tests rather than by assumption.

---

## R1. Does the weighing-area create API already exist, and does it satisfy the spec?

**Decision**: Yes — reuse it unmodified. This is a frontend-only slice.

**Rationale**: Every layer is present and already enforces the spec's backend-owned rules:

| Layer | File | What it already does |
|---|---|---|
| Route | `apps/api/start/routes.ts` | `POST /api/v1/weighing-areas` → `WeighingAreas.store`, inside the `auth` middleware group |
| Middleware | `apps/api/app/middleware/auth_middleware.ts` | Rejects any user whose `accessStatus !== 'ACTIVE'` — covers the "inactive user" half of FR-005 |
| Policy | `weighing_areas/shared/weighing_area_policy.ts` | `create` allows only `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` — the permission half of FR-005 |
| Validator | `weighing_areas/shared/weighing_area_validator.ts` | `nonBlank()`, `minLength(1)`, `maxLength(255)`, `latitude` −90..90, `longitude` −180..180 — FR-006, FR-010 |
| Use case | `weighing_areas/create/create_weighing_area_use_case.ts` | `assertValidSiteReferenceName` (trims — FR-007), coordinate assertions, maps `DUPLICATE_NAME` → `DuplicateWeighingAreaNameException` (409) — FR-008 |
| Repository | `shared/repositories/lucid_weighing_area_repository.ts` | Inserts with `status: 'AVAILABLE'` hard-coded (FR-011), converts a unique violation into `DUPLICATE_NAME` (FR-008, SC-005) |
| Schema | `database/migrations/1784600000000_create_weighing_areas_table.ts` | `CREATE UNIQUE INDEX … ON weighing_areas (LOWER(name))` plus latitude/longitude CHECK constraints |

**FR-011 (auto Available)** is structurally guaranteed: `CreateWeighingAreaCommand` has no `status`
field, so the API cannot accept one.

**FR-012 (creation time)** is satisfied by Lucid's `createdAt` timestamp, already serialized by
`WeighingAreaTransformer` (the list-endpoint DTO shape is pinned by an existing integration test).

**Alternatives considered**: Rebuilding or extending the API slice — rejected, nothing is missing.
Adding an `accessStatus` check to `WeighingAreaPolicy.create` for defence in depth — rejected as
out of scope and inconsistent with `DockPolicy`, which delegates the same check to the middleware;
changing it here would be an unrelated cross-cutting change to every site reference's policy.

---

## R2. Is name uniqueness scoped to weighing areas, or shared with docks?

**Decision**: Scoped to weighing areas only. Spec FR-009 already matches reality; no work required.

**Rationale**: The unique index is `weighing_areas (LOWER(name))` — a per-table index. Docks have
their own table and their own index. A weighing area named "North" can coexist with a dock named
"North", and the create path has no cross-table lookup. The `DuplicateWeighingAreaNameException`
carries its own code, `E_WEIGHING_AREA_NAME_CONFLICT`, distinct from `E_DOCK_NAME_CONFLICT`.

**Alternatives considered**: Enforcing site-wide checkpoint name uniqueness — rejected. It would
require a new cross-table constraint, would break existing data and the `Checkpoint` vocabulary in
`CONTEXT.md` (which states a checkpoint "does not replace the distinct identities or business rules
of docks and weighing areas"), and no requirement asks for it.

---

## R3. How is the map-click placement mechanism reused?

**Decision**: Consume `useResourceMapPlacement` and `PendingPlacementMarker` from
`apps/web/src/components/resource-map/resource-map-placement.tsx` unmodified, through the existing
`CheckpointMapPlacement` prop on `CheckpointMap`.

**Rationale**: #198 built the primitive resource-agnostic on purpose, and its plan named this issue
as the intended second consumer. `CheckpointMapPlacement` already takes `label: string` and
`icon: ReactNode`, so switching from "New dock" + `AnchorIcon` to "New weighing area" + the
weighing-area icon requires no change to `checkpoint-map.tsx` at all — only the values the page
passes. Verified by reading `checkpoint-map.tsx`: nothing in `CheckpointPlacementLayer` mentions
docks.

**Alternatives considered**: A weighing-area-specific placement layer — rejected, it would fork a
primitive that was deliberately built to be shared.

---

## R4. How does a second create action reach the map's control cluster?

**Decision**: Append a second entry to the `createActions` array the page already passes.

**Rationale**: `ResourceMapCreateControl` renders a single icon button for one action and a
dropdown menu for two or more — its own doc comment says this exists "so adding a second creatable
resource kind later only means adding an entry to `actions`". The page's `mapUnavailableActions`
fallback maps over the same array, so the map-unavailable path gains the second action for free.

**Alternatives considered**: A separate button per kind in the control cluster — rejected, it
duplicates what the control already handles and crowds the cluster.

---

## R5. How should the checkpoints page model "which kind is being created"?

**Decision**: Replace the boolean `isCreatingDock` and `pendingDockPlacement` state with a single
derived creation kind plus one pending placement, keyed so that changing kind resets the placement.

**Rationale**: The page currently derives `isCreatingDock = canCreateDock && create === 'dock'` and
holds `pendingDockPlacement`, resetting it in an effect when creation stops. Widening the `create`
search param to `'dock' | 'weighing-area'` and deriving `createKind` from it gives FR-017 (at most
one active flow, and switching discards the abandoned pending marker) directly from the state
shape: the existing reset effect depends on the creation kind rather than a boolean, so a switch
from dock to weighing area clears the marker exactly like a cancel does. The URL stays the single
source of truth for which flow is active, preserving reload and browser-history behavior.

**Alternatives considered**: Two independent booleans and two pending-placement states — rejected;
it makes mutual exclusivity an invariant to hand-maintain rather than a consequence of the shape,
and would let both panels try to render at once.

---

## R6. Where does the success handler's filter widening come from?

**Decision**: Mirror the dock handler, widening `kinds` when it would hide the new area and
resetting `status` away from `archived`.

**Rationale**: `handleDockCreated` already widens `kinds: previous.kinds === 'weighing-area' ? undefined : previous.kinds`
and `status: previous.status === 'archived' ? 'available' : previous.status`, with a comment
explaining that otherwise the new record never reaches `checkpoints` and the stale-selection effect
immediately drops the selection — "leaving the administrator with a success toast and nothing to
show for it". The weighing-area handler needs the mirror image: widen when `previous.kinds === 'dock'`.
This is exactly spec FR-013 and SC-007, which were written from this observed behavior.

**Alternatives considered**: Leaving the filter alone and relying on the toast — rejected; it
reproduces the known failure the dock comment documents.

---

## R7. Should the dock form's coordinate-field logic be duplicated or extracted?

**Decision**: Extract `useCoordinateFields` + `CoordinateField` from `dock-form.tsx` into a shared,
resource-agnostic `apps/web/src/components/resource-map/resource-placement-fields.tsx`, parameterized
by an `idPrefix`. Each feature keeps its own thin form shell.

**Rationale**: That logic is ~120 lines carrying two non-obvious, hard-won behaviors documented in
`dock-form.tsx`'s comments: (1) the keyboard-only accessibility fallback that lets an administrator
without a pointing device place a site reference by typing both axes, and (2) the guard preventing
each parsing keystroke from round-tripping through `onPendingChange` and canonicalizing the text
(which otherwise makes decimals and trailing zeros untypable). Copying it into a weighing-area form
would duplicate both subtleties and guarantee they drift; the warehouse and warehouse-door creation
issues would then make it four copies. Extracting it now, while the dock create tests exist as a
regression guard, is the cheapest moment to do it. The only dock-specific things in the extracted
code are the element ids (`dock-latitude`), which the `idPrefix` parameter absorbs.

**Alternatives considered**:
- *Duplicate into `weighing-area-form.tsx`* — rejected for the drift reason above.
- *Extract the whole form into one generic `SiteReferencePlacementForm`* — rejected for now. The
  name label, placeholder, submit label, success type, and API conflict error code all differ per
  resource, so a fully generic form would take six configuration props and hide each feature's
  error handling behind indirection. Extracting only the genuinely identical part (coordinate
  parsing and syncing) keeps the boundary honest. If the warehouse issues show the shells are also
  identical, that extraction can happen then with three call sites to justify it.

---

## R8. Do the existing frontend test doubles support a second creation flow?

**Decision**: Generalize the checkpoint map test double's placement affordances to be kind-agnostic,
and update the three dock create test files that reference them.

**Rationale**: `apps/web/src/features/checkpoints/__tests__/support/mock-checkpoint-map.tsx` hard-codes
dock wording — the button "Simulate map click to place dock", the testid `pending-dock-marker`, and
the text "Pending dock at …". A weighing-area test cannot use those without either asserting the
wrong resource name or adding a parallel set of dock/weighing-area affordances to the same double.
Making them kind-agnostic ("Simulate map click to place checkpoint", `pending-checkpoint-marker`)
keeps one double for one map. The cost is a mechanical rename inside
`apps/web/src/features/docks/__tests__/create/*.test.tsx`; those tests' assertions about dock
behavior are unchanged, which is what makes them a valid regression guard for R7's extraction.

**Alternatives considered**: Parameterizing the double by resource label so each test asserts its
own wording — rejected as more machinery than the value it adds; the double's affordances are test
scaffolding, not user-facing copy.

---

## R9. Does the frontend need any new backend test coverage?

**Decision**: One optional, small integration test — pin the HTTP-level duplicate-name response.

**Rationale**: The weighing-area form must key its inline conflict message on the exact error code
`E_WEIGHING_AREA_NAME_CONFLICT` returned with HTTP 409, the same way `dock-form.tsx` keys on
`E_DOCK_NAME_CONFLICT`. That mapping is currently proven only at the use-case level
(`weighing_area_use_cases.spec.ts` asserts the exception type); no integration test asserts that a
duplicate `POST /api/v1/weighing-areas` produces a 409 with that code over HTTP. Since the UI now
depends on it, pinning it costs one short test and prevents a silent break. Every other backend
behavior this feature relies on is already covered.

**Alternatives considered**: Relying on the existing unit coverage — defensible (this is exactly
what #198 did for docks), which is why the test is proposed as recommended rather than required.
Adding broader API tests — rejected, nothing else is unpinned.
