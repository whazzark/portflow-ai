# Research: Update a Truck

No `NEEDS CLARIFICATION` items were carried into planning. The spec's Assumptions section resolved
the open product decisions from `CONTEXT.md` and established site-reference precedent; the decisions
below resolve the technical ones.

## Decision 1: Extend the delivered truck slice with an `update/` workflow

**Decision**: Add `apps/api/app/trucks/update/update_truck_use_case.ts` alongside the existing
`create/`, `list/`, and `available/` workflows. Extend the existing shared `truck_validator.ts` with
`updateTruckValidator`, the existing `truck_exceptions.ts` with the new refusal types, the existing
`TruckPolicy` with an `update` ability, and the existing `TrucksController` with an `update` action.

**Rationale**: `transport_companies` and `docks` already prove this exact shape for update behavior:
one workflow directory per behavior, one shared validator and exception module per resource, a
resource policy ability per action, and a controller that only adapts HTTP. Reusing it satisfies
constitution principle V and leaves `#225` and `#226` able to add `archive/` and `reactivate/`
workflows without restructuring anything this slice touches.

**Alternatives considered**:

- A generic site-reference update service shared across resources: rejected as cross-domain
  refactoring with no demonstrated need; each resource's mutable fields and lifecycle blockers
  differ, and trucks are the only one with a provider-reassignment rule.
- Update directly from the controller through Lucid: rejected because it bypasses the required
  use-case/repository boundary.
- A separate `reassign/` workflow for the transport company: rejected because the spec treats the
  provider as one of four mutable fields on a single submission (FR-003), and splitting it would
  force two round trips and two failure surfaces for one administrator intent.

## Decision 2: Reuse the delivered `SiteReferenceUsageChecker` for the discharge-commitment rule

**Decision**: Inject `SiteReferenceUsageChecker` into `UpdateTruckUseCase` and call
`findUsedByPlannedOrActiveDischarge({ referenceType: 'TRUCK', referenceIds: [id] })` only when the
submitted `transportCompanyId` differs from the truck's stored one. A hit raises the new
`TruckTransportCompanyLockedException`.

**Rationale**: The checker already declares `'TRUCK'` in `SITE_REFERENCE_TYPES`, and
`LucidDischargeUsageRepository` already implements that branch — joining `discharge_truck_assignments`
to `discharges` on `status IN ('PLANNED','ACTIVE')` and filtering `released_at IS NULL`. The binding
is registered in `providers/repositories_provider.ts`. So FR-012 needs no new query, no new
repository, and no new table access: it needs one guarded call. `ArchiveDockUseCase`,
`ArchiveCustomerUseCase`, and `ArchiveWeighingAreaUseCase` already use precisely this call shape for
their own blockers, which also makes the semantics of "committed to a discharge" identical across
every site reference.

**Alternatives considered**:

- A truck-specific `DischargeTruckAssignmentRepository`: rejected as a duplicate of a delivered,
  registered, cross-resource abstraction whose `'TRUCK'` branch is already written and tested by
  the query's other callers.
- Checking assignments regardless of whether the provider actually changes: rejected because it
  would cost an unnecessary join on every registration or capacity correction and could not change
  the outcome — FR-013 requires those updates to succeed on a committed truck.
- A database trigger or foreign-key rule: rejected because the constraint is conditional on
  discharge status and on which field changed, which is a business decision the use case owns.

## Decision 3: Guard the lifecycle in the write statement, and re-read only on failure

**Decision**: Add `findById(id)` and `updateAvailable(command)` to `TruckRepository`. `updateAvailable`
returns a discriminated `TruckWriteResult` extended with `UPDATED | NOT_FOUND | ARCHIVED |
DUPLICATE_REGISTRATION`. The Lucid implementation issues
`UPDATE ... WHERE id = ? AND status = 'AVAILABLE'`, and only when zero rows are affected does it
re-read the row to distinguish missing from archived. A unique violation naming
`trucks_registration_unique` maps to `DUPLICATE_REGISTRATION`.

**Rationale**: This is exactly the delivered `LucidTransportCompanyRepository.updateAvailable` and
`LucidCustomerRepository.updateAvailable` shape, and it keeps the lifecycle guard atomic with the
write, so a truck archived between form load and submission is refused rather than silently updated
(spec edge case 1). `LucidTruckRepository.create` already inspects the constraint name to
distinguish the registration index from other unique violations; the update path reuses that same
`isUniqueViolation` + constraint-marker check. The extra read happens only on the failure path, and
the discriminated result keeps persistence mechanics out of the use case, which owns the mapping to
exceptions.

**Alternatives considered**:

- Load, guard in the use case, then `save()`: rejected because the guard would not be atomic with
  the write.
- Throw persistence exceptions directly from the repository: rejected because it inverts the
  boundary; the use case owns domain meaning.
- Wrap the usage check and the write in one transaction with `forUpdate()`: rejected for a
  single-row update. The delivered single-reference precedents (`ArchiveDockUseCase`,
  `ArchiveCustomerUseCase`) accept the same narrow window between check and write, and reserve the
  transactional `forUpdate` form for the bulk paths where partial eligibility must be partitioned
  atomically. The residual race is a truck being assigned to a discharge in the milliseconds after
  the check; the next lifecycle action re-evaluates it, and no invariant in `CONTEXT.md` is
  permanently broken by it.

## Decision 4: Validate the transport company only when the assignment actually changes

**Decision**: `UpdateTruckUseCase` calls `TransportCompanyRepository.findById` and requires
`status === 'AVAILABLE'` only when the submitted `transportCompanyId` differs from the truck's
stored one. Resubmitting the current company performs no company lookup.

**Rationale**: FR-011 targets the *assigned* company, and the invariant it protects — an available
truck must have an available company — can only be broken by a change. `CONTEXT.md` states a
transport company cannot be archived while it still provides available trucks, so an available
truck's current company is already guaranteed available; re-checking it would add a query that can
only ever pass. More importantly, if that invariant were ever violated by another path, re-checking
would block an administrator from fixing a typo in the registration, which contradicts FR-013's
spirit and the spec's requirement that refusals be actionable.

**Alternatives considered**:

- Always validate the submitted company: rejected as an unconditional extra query whose only
  possible new behavior is refusing an otherwise-valid correction.
- Skip validation entirely and rely on the foreign key: rejected because the foreign key cannot
  express "must be `AVAILABLE`", and an archived company would produce an opaque `5xx` instead of
  the `422 E_TRUCK_TRANSPORT_COMPANY_INVALID` the create path already returns.

## Decision 5: Model the contract as `PATCH /:id` carrying all four mutable fields

**Decision**: Expose `PATCH /api/v1/trucks/:id` accepting `registration`, `vehicleModel`,
`capacityTonnes`, and `transportCompanyId`. All four keys are required; `vehicleModel` is
`.nullable()` but not `.optional()`, so clearing it is expressed as an explicit `null`. Success
returns `200` with the full truck representation already defined by the List Trucks contract.

**Rationale**: PATCH with the resource transformer response matches the delivered transport-company,
dock, customer, and weighing-area update contracts, so the Tuyau client and the details panel need
no new response shape. Requiring all four fields matches the spec's whole-record assumption and the
`updateTransportCompanyValidator` precedent of a required mutable field; it also makes an empty body
a `422` rather than a silent no-op. Making `vehicleModel` nullable-but-required is what separates
"clear the model" from "forgot to send the field" — with `.optional()` an omission would silently
clear it, which FR-006 and the spec's Assumptions explicitly reject. Numeric bounds and the
three-decimal rule are shared with `createTruckValidator` by extracting the common field
definitions, so the two contracts cannot drift.

**Alternatives considered**:

- `PUT` with the full representation: rejected because clients would have to echo immutable
  lifecycle fields, inviting accidental lifecycle writes and contradicting FR-016.
- Dock-style all-optional partial fields: rejected because the spec's whole-record assumption makes
  the "field omitted" case meaningless for three of the four fields and dangerous for
  `vehicleModel`.
- A dedicated `POST /:id/reassign` alongside a field-only PATCH: rejected per Decision 1.

## Decision 6: Map every refusal to a distinct status and code

**Decision**: Add `TruckNotFoundException` (`404`, `E_TRUCK_NOT_FOUND`),
`ArchivedTruckReadOnlyException` (`409`, `E_TRUCK_ARCHIVED`), and
`TruckTransportCompanyLockedException` (`409`, `E_TRUCK_TRANSPORT_COMPANY_LOCKED`) to the existing
`truck_exceptions.ts`, reusing the delivered `DuplicateTruckRegistrationException`
(`409`, `E_TRUCK_REGISTRATION_CONFLICT`) and `InvalidTransportCompanyException`
(`422`, `E_TRUCK_TRANSPORT_COMPANY_INVALID`). Blank, over-long, or over-precise values surface as the
framework's `422 E_VALIDATION_ERROR`; invalid names reaching the domain raise the shared
`422 E_SITE_REFERENCE_NAME_INVALID`. Authentication middleware yields `401 E_UNAUTHORIZED_ACCESS` and
the policy yields `403 E_AUTHORIZATION_FAILURE`.

**Rationale**: FR-022 requires ten distinguishable outcomes, and the web layer needs stable codes to
render distinct messages. The new codes mirror the delivered transport-company and dock vocabularies
(`E_*_NOT_FOUND`, `E_*_ARCHIVED`, `E_*_IN_USE`), so `parseApiError` and `applyValidationError` work
unchanged: field-level validation errors land on the form input, domain conflicts land in a toast.
`E_TRUCK_TRANSPORT_COMPANY_LOCKED` is deliberately not named `E_TRUCK_IN_USE`: the truck being in use
does not block the update, only the provider change, and `#225` will need the plain in-use code for
archival.

**Alternatives considered**:

- Reuse `DockInUseException`-style naming: rejected because it would collide semantically with the
  archival blocker `#225` needs, and would misdescribe an update that partly succeeds in intent.
- Return `404` for archived trucks to hide their existence: rejected because archived trucks are
  already readable by both administration roles through consultation, so a distinct `409` is both
  truthful and more actionable.
- Return `422` for a duplicate registration: rejected because the value is well-formed and the
  failure is a state conflict; `409` matches the delivered create path.

## Decision 7: Treat an unchanged submission as a normal success

**Decision**: Perform no equality short-circuit. Resubmitted current values are trimmed, validated,
and written; the `LOWER(registration)` unique index does not conflict with the row against itself, so
the result is `UPDATED` with `updatedAt` refreshed.

**Rationale**: FR-010 requires that this succeed and not be reported as a duplicate, which falls out
of the index semantics without special-casing — the same reasoning the transport-company slice
recorded. Adding a short-circuit would introduce a second code path whose only observable difference
is a stale `updatedAt`, and would hide a concurrent change made by another administrator. Note that
"unchanged provider" is still short-circuited for the *checks* in Decisions 2 and 4; that is a guard
on which rules apply, not on whether the row is written.

**Alternatives considered**:

- Detect a no-op and return the loaded record untouched: rejected as an untestable optimization that
  complicates the use case.
- Reject an unchanged submission: rejected because it contradicts FR-010 and would make a
  resubmitted form fail confusingly.

## Decision 8: Make edit a URL-addressable mode of the existing truck detail panel

**Decision**: Add `truckMode: z.enum(['view', 'edit']).catch('view')` to the transport-resources route
search schema, alongside the delivered `companyDetailsMode`. `TruckDetails` gains an **Edit truck**
action rendered only when the viewer is an administrator and the truck is `AVAILABLE`; choosing it
sets `truckMode=edit`, which renders the new `EditTruckPanel` in place of `TruckDetails` in both the
embedded sheet and the standalone detail card. Cancel and successful save both return to
`truckMode=view`. Edit eligibility is captured once when the edit session starts, mirroring the
`editSession` guard in `TransportResourcesWorkspace`, so a background refetch cannot discard an
in-progress edit.

**Rationale**: URL-backed panel state is the pattern `#222` established for `truckStatus`,
`truckSearch`, and `truckId`, and `#219` established for company editing in the very same workspace.
Keeping the form in the detail pane satisfies "without leaving the consultation context", makes the
edit state reloadable and shareable, and makes the mode directly assertable through the real router.
Rendering the affordance behind `isAdministrator` and an `AVAILABLE` status satisfies FR-021 and
user story 3 scenario 8, while the policy keeps the API authoritative per FR-025.

**Alternatives considered**:

- A separate edit sheet layered over the details sheet: rejected because the embedded layout already
  renders details in a sheet, and stacking two would trap focus and hide the directory.
- Local component state for edit mode: rejected because a refresh would drop the form and the mode
  could not be asserted through the real router.
- A dedicated `/trucks/:id/edit` route: rejected because the workspace is a single master-detail
  route by design, and a new route would break the embedded composition with the companies pane.

## Decision 9: Generalize the delivered `TruckForm` rather than fork it

**Decision**: Give `TruckForm` an optional `truck?: TruckDto` prop plus `onCreate` and `onUpdate`
handlers, deriving `defaultValues` from the truck when present and dispatching on its presence in
`onSubmit`, exactly as `CustomerForm` does. The Zod schema, capacity bounds, and decimal rule are
shared unchanged. `useTruckMutations` gains an `update` mutation invalidating both
`truckQueries.all()` and `truckQueries.available()`.

**Rationale**: `CustomerForm` is the delivered precedent for one form serving both create and edit in
this codebase, and the truck schema — including the capacity pattern and the three-decimal
refinement — is non-trivial enough that a fork would guarantee drift between the two paths.
Invalidating both truck queries keeps the corrected truck authoritative everywhere it appears
(FR-018), including the available-only endpoint that backs operational selectors. The edit form
additionally offers the truck's own current company in the select even though the create form filters
to available companies only, so the pre-filled value is always selectable.

**Alternatives considered**:

- A separate `EditTruckForm`: rejected because it would duplicate the capacity validation rules,
  which are the part most likely to drift from the server.
- Optimistic cache updates: rejected because a refused write would have to be rolled back, and
  FR-017 is easier to demonstrate when the client only ever shows server-confirmed state.
- Client-side duplicate checking against the loaded collection: rejected because it would duplicate
  an invariant the database owns and would be wrong against a stale snapshot.

## Decision 10: Test through real persistence and the real router

**Decision**: Drive API behavior with Japa unit specs (use case against the real Lucid repository on
in-memory SQLite) and integration specs (HTTP through the real middleware, policy, and validator)
under `tests/*/trucks/administration/update.spec.ts`. Add
`tests/support/persisted_truck_usage.ts`, mirroring `persisted_dock_usage.ts`, to build a truck
assigned to a discharge of a given status via `DischargeTruckAssignmentFactory`. Drive web behavior
through the real TanStack router with MSW intercepting the PATCH, adding
`__tests__/administration/update.test.tsx` and `__tests__/administration/permissions.test.tsx` plus
PATCH interception in the existing `__tests__/support/test-helpers.ts`.

**Rationale**: This follows the seams `#222` and `#223` established for this resource and the
repository's frontend testing strategy. Real persistence is what proves the unique index, the
`WHERE status = 'AVAILABLE'` guard, the trimming rule, and — critically — that the usage checker's
`'TRUCK'` branch resolves a real `discharge_truck_assignments` row with `released_at IS NULL` against
a `PLANNED` or `ACTIVE` discharge. A support helper is required because no truck-usage scenario
builder exists yet; the three delivered ones show the exact shape. MSW preserves the real Tuyau
request so refusal responses are exercised as the browser would receive them. No Playwright suite is
configured, so the quickstart retains a manual browser flow.

**Alternatives considered**:

- Fake the repository or the usage checker in unit tests: rejected because the constraint, the
  lifecycle guard, and the `released_at`/status filtering are precisely what must be proven.
- Mock the Tuyau client or `fetch`: rejected by the web testing conventions because it bypasses the
  transport adapter.
- Reuse `persisted_dock_usage.ts` with a cast: rejected because the truck scenario needs a
  `DischargeTruckAssignment` row, not a `dock_id` column, and the released/unreleased distinction
  has no dock equivalent.
