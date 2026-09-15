# Phase 0 Research: Prepare a Planned Discharge With Its Product Lots and Shifts

All Technical Context entries are resolved and no `NEEDS CLARIFICATION` remains. The spec's
Clarifications section already settled the three product questions: the scope, the roles, and a
dedicated creation page. This document records the design decisions the plan makes on top of them.

## Decision 1 — Five writes and one read, all in the vertical slices that own them

**Decision**: The API gains five discharge commands and one user query.

| Route name | Verb and path | Purpose | Success |
|---|---|---|---|
| `discharges.store` | `POST /api/v1/discharges` | Create a planned discharge with its lots and shifts | 201 |
| `discharges.update` | `PATCH /api/v1/discharges/:id` | Correct the vessel description, dock, and expected start | 200 |
| `discharges.product_lots.store` | `POST /api/v1/discharges/:dischargeId/product-lots` | Add a lot | 201 |
| `discharges.product_lots.update` | `PATCH /api/v1/discharges/:dischargeId/product-lots/:id` | Correct a lot | 200 |
| `discharges.product_lots.destroy` | `DELETE /api/v1/discharges/:dischargeId/product-lots/:id` | Remove a lot | 200 |
| `users.eligible_shift_responsibles` | `GET /api/v1/users/eligible-shift-responsibles` | Users that may be chosen as responsible | 200 |

Every discharge write answers with the whole discharge detail, in the shape `discharges.show`
already returns.

**Rationale**:
- A product lot never exists outside its discharge. Every rule on a lot is decided on the
  discharge: its status, the uniqueness of the lot's identity, and the last-lot rule. So the lot
  routes nest under the discharge whose row they lock. The warehouse door precedent of a top-level
  child resource fits a site reference that has a lifecycle of its own, which a lot does not have.
- Returning the detail lets the web replace its cached detail in one step. The expected tonnage
  and the lot order are therefore always the API's, never recomputed in the browser.
- The eligible responsibles query belongs to the users slice, because it filters users by role and
  access status. `users.index` is closed to operations leads (`UserPolicy.list`), and widening it
  would disclose e-mails and access history that a shift picker does not need.

**Alternatives considered**:
- One `PUT /discharges/:id` taking the whole preparation graph. Rejected: shifts are not
  correctable in this slice (GH-63, GH-64, and GH-66 own them), and a full replace would have to
  diff lots against their door assignments.
- Top-level `/product-lots` routes carrying `dischargeId` in the body. Rejected for the reason
  above: the discharge is the aggregate that decides.
- Letting operations leads read `users.index`. Rejected: that is administration context.

## Decision 2 — Creation is idempotent through an identity the client generates

**Decision**: The creation page generates a UUID once, when it mounts, and sends it as `id` in the
creation body. The repository inserts the discharge with that identity. When a discharge with that
identity already exists, the command does not create a second one. It answers `200` with the
existing discharge's detail, and the web treats that exactly as a `201`.

**Rationale**:
- FR-008 and SC-004 require that repeated submissions create one discharge. The submit button's
  pending state (FR-032) stops double clicks, but not a retry after a response lost in transit
  whose transaction had in fact committed. Only an identity chosen before the first attempt makes
  that retry recognizable.
- Every model already sets `selfAssignPrimaryKey` with `id ??= randomUUID()`, so a supplied
  identity needs no model change. The primary key is the uniqueness guarantee, and its unique
  violation is the signal.
- The replay does not compare payloads. The identity lives only as long as one creation page, so a
  different payload under the same identity can only come from a forged request. Such a request
  gains nothing: the caller may already read every discharge.

**Alternatives considered**:
- An `Idempotency-Key` header with a stored key table. Rejected: it is new infrastructure for one
  endpoint, and the repository has no precedent for it.
- Relying on the disabled submit button alone. Rejected: it does not cover a retry after a network
  failure.
- Refusing the replay with `409`. Rejected: the user's creation did succeed, and a refusal would
  tell them it failed.

## Decision 3 — Every refusal of an entered value uses the validation error shape

**Decision**: There are three layers, and all of them answer
`422 { error: { code: 'E_VALIDATION_ERROR', message, details: [{ field, message, rule }] } }`, with
`field` a dotted path such as `productLots.1.productName`.

1. **VineJS validators** check the request shape: required fields, blank strings, lengths, the IMO
   format, the quantity format, ISO date-times, and array bounds.
2. **A pure rules module**, `discharge_preparation_rules.ts`, checks rules across items:
   - a lot identity duplicated by customer and product name, compared without regard to case or
     surrounding spaces;
   - a shift whose end is not after its start;
   - overlapping shifts. Contiguous shifts are accepted.

   It returns issues. The use case throws Vine's `E_VALIDATION_ERROR` with them.
3. **Checks made under lock inside the transaction** refuse a dock or customer that is missing or
   not available, and a responsible who is missing, not active, or not an operations lead,
   operations admin, or organization admin. They are reported on `dockId`,
   `productLots.N.customerId`, and `shifts.N.responsibleUserId`, with rules `availableDock`,
   `availableCustomer`, and `eligibleShiftResponsible`.

**Rationale**:
- FR-029 and FR-030 require every offending value to be identified, and several can be wrong at
  once. The web already maps `E_VALIDATION_ERROR` details onto fields (`applyValidationError`).
  One wire shape means one mapping, whether the value broke a format, a cross-item rule, or went
  unavailable in the meantime.
- A reference archived in the meantime is still a refusal of the value the user entered, and the
  fix is to choose another value. That is why it is `422` on a field, not a state `409`. The truck
  slice's `E_TRUCK_TRANSPORT_COMPANY_INVALID` is the same answer, without the field.
- Keeping the rules in a pure module lets unit tests pin every rule at the edges, including
  contiguous shifts, trimmed case-insensitive names, and out-of-order input.
- The database stays the backstop. A unique violation on `product_lots_identity_unique` maps to
  the same duplicate issue, and the `planned_start_at < planned_end_at` check can no longer fire
  once the rules have run.

**Alternatives considered**:
- One slice-specific code per rule, such as `E_DISCHARGE_SHIFTS_OVERLAP` returning `422` with
  `meta`. Rejected: the web would need a second mapping, and a submission can break several rules
  at once.
- Vine custom rules at the array level. Rejected: Vine reports them on the array rather than on
  the offending item. They would also mix database-independent rules with request parsing, and
  would be harder to unit-test.

## Decision 4 — State refusals are `409` codes of the discharge slice

**Decision**:

| Status | Code | When |
|---|---|---|
| 404 | `E_DISCHARGE_NOT_FOUND` (exists) | Unknown or malformed discharge identity |
| 404 | `E_PRODUCT_LOT_NOT_FOUND` | Lot unknown, malformed, or not in that discharge |
| 409 | `E_DISCHARGE_NOT_PLANNED` | Any correction on an active or closed discharge |
| 409 | `E_DISCHARGE_LAST_PRODUCT_LOT` | Removing the discharge's only lot |
| 409 | `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS` | Removing a lot that has or had a warehouse door assignment |
| 403 | `E_AUTHORIZATION_FAILURE` | Observer |
| 401 | `E_UNAUTHORIZED_ACCESS` | Unauthenticated or not active |

**Rationale**: These refusals are about the discharge's current state, not about a value the user
can change on the form. Codes follow the repository's `E_<ENTITY>_<REASON>` convention. The foreign
key from door assignments to product lots is `RESTRICT`, so a foreign-key violation on removal maps
to `E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS` as a backstop.

## Decision 5 — The discharge row is the lock; references are locked for share

**Decision**: Every write runs in one transaction, and the use case owns it (pattern B, as in the
users slices). Locks are taken in a fixed order:

1. **Corrections only**: the discharge row, `FOR UPDATE`. The use case then checks that the
   discharge exists and is planned, and that the lot belongs to it. Concurrent corrections of one
   discharge therefore queue, and the last-lot rule and the uniqueness rule are decided on
   committed state.
2. **Newly chosen docks**, then **customers**, then **users**, each ordered by identity and locked
   `FOR SHARE`. Their status, access status, and role are checked after the lock is held.
   References a correction keeps unchanged are not re-checked: `CONTEXT.md` forbids archiving a
   reference while a planned discharge uses it.

**Rationale**:
- `FOR SHARE` conflicts with the `FOR UPDATE` and `FOR NO KEY UPDATE` locks that bulk archives and
  user deactivations take, and with a plain `UPDATE`. An archive or a deactivation running at the
  same moment therefore either waits for the discharge to commit, and then sees it as a usage, or
  commits first, and then this slice sees the archived status. Share locks do not block each other,
  so two discharges using one customer proceed in parallel.
- The fixed order, discharge then docks then customers then users, prevents deadlocks between two
  preparation writes.
- The GH-236 warehouse repository notes that a row lock on a reference does not block an insert
  into a referencing table, and that the first real writer must close that race. This is that
  writer.

**Consequence, in scope**: The single archives of a dock and of a customer check usage in the use
case and then run an unguarded conditional `UPDATE`. That leaves a window: this slice's check can
pass, the discharge can commit, and the archive can then proceed on a stale usage answer. The plan
moves both single archives to the bulk pattern, with the row locked `FOR UPDATE` and usage checked
through the same transaction client. This is the only change outside the discharge and user
slices, and it keeps "a reference cannot be archived while a planned discharge uses it" true under
concurrency.

**Consequence, recorded for later slices**: GH-54 (door assignments) and GH-56 (activation) must
lock the discharge row `FOR UPDATE` before they write. Removing a lot then cannot race a new
assignment, and a correction cannot race activation. The test database is SQLite, where Knex
ignores row locks, so these races are guaranteed by design and review, as they are in the existing
archive slices, rather than by an automated test.

## Decision 6 — Wire formats: decimal strings and ISO date-times with an offset

**Decision**:
- `expectedQuantityTonnes` is a string matching `^\d{1,9}(\.\d{1,3})?$` and strictly above zero.
  The repository builds a `Decimal` from it.
- `expectedStartAt`, `plannedStartAt`, and `plannedEndAt` are ISO 8601 date-times that must carry
  an offset. A shared Vine rule parses them with Luxon (`setZone: true`), and the use case receives
  `DateTime` values.
- On the web, a new `DateTimeField` wraps `<input type="datetime-local" step="60">`. A pair of
  helpers in `helpers/dates.ts` converts between the input's local value and an ISO string with
  the browser's offset.

**Rationale**:
- The detail already returns quantities as fixed-precision strings, because the browser has no
  decimal arithmetic. Accepting a string keeps `1000.1` from becoming `1000.0999…` before the
  database and mirrors the response. The truck slice's number input was fine for a capacity that
  is never summed, but lots are summed into the expected tonnage.
- `NUMERIC(12,3)` bounds the whole part to nine digits.
- Requiring an offset means the instant the user meant is never reinterpreted in the server's
  zone. The web already formats timestamps in the browser's local zone (`formatDateTime`), so
  entering in that same zone keeps entry and display consistent.
- Luxon is already an API dependency. The web does not need it for two conversions, and native
  `Date` parses `YYYY-MM-DDTHH:mm` as local time.

**Alternatives considered**:
- A site time zone setting. Rejected: no such configuration exists, the list and detail already
  use the browser zone, and adding a zone setting is a cross-cutting change outside this slice.
- A date picker library. Rejected: the native input is accessible and testable, and the repository
  has no picker to reuse.

## Decision 7 — Shift sequence follows planned start at creation

**Decision**: At creation, the rules module sorts shifts by planned start and assigns `sequence`
from 1 to N in that order. The response lists shifts in planned start order, as GH-58 already does.

**Rationale**: `shifts.sequence` is required and unique per discharge. FR-021 orders shifts by
planned start regardless of entry order. The planned shifts do not overlap, so this order is total.
GH-63 and GH-64, which add and replan shifts later, own renumbering.

## Decision 8 — Eligibility for shift responsibility is defined once

**Decision**: `app/users/shared/shift_responsible_eligibility.ts` exports
`SHIFT_RESPONSIBLE_ROLES = ['OPERATIONS_LEAD', 'OPERATIONS_ADMIN', 'ORGANIZATION_ADMIN']` and an
`isEligibleShiftResponsible(user)` predicate: active access and one of those roles. The eligible
responsibles query and the discharge commands both use it. The query returns
`{ id, firstName, lastName }`, ordered by last name, first name, and identity, through the
existing `UserTransformer` summary variant.

**Rationale**: `CONTEXT.md` defines a Shift Responsible by these roles. GH-66, which protects a
responsible from losing eligibility, will import the same predicate, so the rule cannot drift
between the picker, the command, and the later protection.

## Decision 9 — Authorization: `create` and `update` on `DischargePolicy`

**Decision**:
- `DischargePolicy.create(user)` and `DischargePolicy.update(user)` both require active access and
  a role among operations lead, operations admin, and organization admin. `update` authorizes the
  identity and lot corrections.
- `UserPolicy.listEligibleShiftResponsibles(user)` uses the same predicate.
- The web mirrors it in `features/discharges/discharge-permissions.ts` as `canPrepareDischarges`,
  with the users-slice comment convention: it mirrors the API rule and is not a security boundary.

**Rationale**:
- The spec gives one role set for creation and correction (FR-001). Two method names keep the
  policy readable in controllers, as the site-reference policies do.
- The predicate is shared with the users slice by importing one constant, not by calling one
  policy from another.
- `isAdministrator` in `features/auth` excludes operations leads, so it cannot be reused.

## Decision 10 — A dedicated creation route that redirects those who may not prepare

**Decision**:
- `routes/_authenticated/discharges.new.tsx` is a child of the discharges layout, so it inherits
  the list's `status` and `search`. TanStack Router ranks the static `new` segment above
  `$dischargeId`.
- Its loader ensures the session user. For a user who may not prepare discharges, it throws
  `redirect({ to: '/discharges', search: (previous) => previous, replace: true })`. For everyone
  else, it preloads available docks, available customers, and eligible responsibles.
- Its breadcrumb is `New discharge`.
- After a successful creation, the page seeds the detail cache with the response, invalidates the
  list, shows a success toast, and navigates to `/discharges/$dischargeId` with
  `status: 'planned'` and the search kept. The way back from the detail then lands on the tab
  showing the new discharge.
- Cancel returns to the list with its status and search.

**Rationale**:
- The spec requires a dedicated page (Clarifications). The layout already owns the list state
  (GH-58 Decision 8), so the page gets the way back for free.
- Redirecting in the loader avoids a `403` from the responsibles preload and a flash of a form the
  user cannot submit. The API remains authoritative (FR-002).
- The trucks page clears a create mode the viewer may not use in the same spirit.

**Alternatives considered**: A not-authorized component. Rejected: no such component exists in the
application, and `apps/web/AGENTS.md` gates modes in the component or by clearing them.

## Decision 11 — Corrections open in a `Sheet` from the detail's cards

**Decision**:
- **Identity card**: its header gains an `Edit` action that opens `EditDischargeIdentitySheet`.
- **Product lots card**: its header and its empty state gain `Add product lot`, which opens
  `ProductLotSheet` in add mode. Each lot's header row gains `Edit` (the same sheet in edit mode)
  and `Remove`, which opens a destructive `AlertDialog`.
- Actions render only when `canPrepareDischarges(user)` and the discharge is `PLANNED`.
- `DetailSection` gains an optional `actions` prop, rendered in the existing unused `CardAction`
  slot.

A successful correction closes the sheet or dialog, replaces the detail cache with the response,
invalidates the list, and toasts. Refusals are handled by kind:
- A `422` stays in the sheet, mapped onto its fields.
- `E_DISCHARGE_NOT_PLANNED`, `E_PRODUCT_LOT_NOT_FOUND`, and `E_DISCHARGE_NOT_FOUND` close the
  sheet, refetch the detail, and toast the reason (FR-028, and the spec's edge case of two users correcting one discharge).
- The two removal refusals keep the dialog open with its reason and refetch.

**Rationale**:
- The application has no `Dialog` primitive. `Sheet` is its form panel and `AlertDialog` its
  destructive confirmation (`UserAccessDialog`).
- Button labels carry the action only, and creation labels name the resource, as the repository's
  copy convention requires.
- The detail page itself stays a page, as GH-58 decided.

## Decision 12 — One form model per concern, reused between creation and correction

**Decision**:
- `discharge-preparation-schema.ts` holds the Zod schemas as pure, unit-tested modules:
  - `dischargeIdentitySchema` for vessel name, IMO, comment, dock, and expected start;
  - `productLotSchema`;
  - `plannedShiftSchema`;
  - `createDischargeSchema`, which combines them. Its `superRefine` runs at submit only and adds
    the duplicate-lot and overlap rules at `productLots[i].productName` and
    `shifts[i].plannedStartAt`, following the `own-profile-form` precedent.
- The field groups `DischargeIdentityFields`, `ProductLotFields`, and `PlannedShiftFields` render
  inside the creation form and inside the correction sheets.
- The lots and shifts lists are TanStack Form array fields (`mode="array"`, `pushValue`,
  `removeValue`). The creation page starts with one empty lot and one empty shift.

**Rationale**: The same rules apply at creation and correction (FR-023 and FR-024). Duplicating
the fields would let their validation drift. The client rules are a convenience; the API's rules in
Decision 3 are authoritative, and the form maps them back.

## Decision 13 — `applyValidationError` learns indexed paths

**Decision**: `libraries/forms/api-error.ts` translates Vine's dotted numeric segments into
TanStack Form's bracket notation before setting field errors. For example,
`productLots.1.productName` becomes `productLots[1].productName`. A path that matches no mounted
field is appended to the form-level error, so no refusal is ever silent.

**Rationale**: This is the first form with array fields, and Vine reports array items with dotted
indices. The change leaves every existing flat path unchanged, which the helper's new unit test
pins alongside the existing form tests.

## Decision 14 — No activity log, no seed change, no migration

**Decision**: No Activity Log Entry is written, and no table or seed changes.

**Rationale**:
- GH-102 establishes the typed activity log append contract and depends on this slice (spec
  Assumptions).
- Every column this slice writes exists since GH-236: `discharges`, `product_lots`, and `shifts`.
- The product lot identity index and the shift checks already exist.
- The seeded scenarios keep serving GH-58, and the creation flow is tested through factories.

## Resolved technical unknowns

| Unknown | Resolution |
|---|---|
| How to pick a responsible as an operations lead | New `users.eligible_shift_responsibles` query (Decisions 1 and 8) |
| Duplicate submission protection | Client-generated discharge identity with replay (Decision 2) |
| Error shape for rules across items and for references unavailable in the meantime | `E_VALIDATION_ERROR` with dotted field paths (Decision 3) |
| Race with archives and deactivations | Discharge `FOR UPDATE` plus references `FOR SHARE`; single dock and customer archives hardened (Decision 5) |
| Decimal and date input on the wire | Decimal strings; ISO date-times with an offset (Decision 6) |
| Date-time entry in the web | Native `datetime-local` in the browser zone (Decision 6) |
| `shifts.sequence` | Assigned by planned start at creation (Decision 7) |
| Field arrays and their error mapping | TanStack Form array fields; bracket path translation (Decisions 12 and 13) |
| Forbidden creation route | Loader redirect to the list (Decision 10) |
| Where corrections live | Sheets and an `AlertDialog` from the detail's cards (Decision 11) |
| E2E coverage | None: `apps/web/e2e` is not set up. Feature tests go through the real router with MSW, as GH-58 and GH-61 did |
