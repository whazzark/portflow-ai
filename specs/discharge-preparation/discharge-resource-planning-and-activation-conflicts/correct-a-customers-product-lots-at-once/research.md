# Phase 0 Research: Correct a Customer's Product Lots at Once

The spec's clarifications settled the product questions: the correction adds and removes lots, the
group may move to another customer, and the single-lot correction stays. What remained unknown was
technical:
- the route and request shape;
- how to judge lot identity on the state after the change when the database checks it row by row;
- how refusals stay compatible with GH-53's scheme;
- how the web reuses the customer-block editor.

Every decision below extends a GH-53 or GH-55 precedent unless it says otherwise.

## Decision 1 — One `PATCH` nested under the discharge's customer

| Route name | Method and path | Purpose | Success |
|---|---|---|---|
| `discharges.customer_product_lots.update` | `PATCH /api/v1/discharges/:dischargeId/customers/:customerId/product-lots` | Correct, add, and remove one customer's lots, optionally moving the group | 200 |

A new `DischargeCustomerProductLotsController.update` serves it. Tuyau exposes it as
`tuyauQuery.discharges.customerProductLots.update`.

**Rationale**:
- **`PATCH`, not `PUT`.** The request lists what changes, not the whole group. A lot the request
  names neither as corrected nor as removed is left untouched (FR-012). A `PUT` of the full set
  would remove a lot that another user added while the sheet was open. That contradicts the spec's
  edge case, and the contract could not tell such a lot from one the user deleted.
- **Nested under the customer.** The path names the group being corrected, the way GH-55 nests a
  shift's trucks under the shift. The body's `customerId` is the customer afterwards, so a move is
  explicit and needs no second route.
- **Its own controller.** The route nests under a customer, as GH-55's shift trucks got their own
  controller for nesting under a shift. `DischargeProductLotsController` stays one-lot.

**Alternatives considered**:
- Sending one `PATCH` per lot and one `DELETE` per removal from the web. Rejected: not atomic
  (FR-005), and a refusal halfway leaves a half-corrected customer, which is the problem the
  feature solves.
- A generic `POST …/product-lots/batch` of operations. Rejected: it can span several customers,
  which is out of scope, and it names no group to authorize and refuse against.

## Decision 2 — Request shape and bounds

```json
{
  "customerId": "<customer after the change>",
  "productLots": [{ "id": "<lot to correct, absent to add>", "productName": "…", "expectedQuantityTonnes": "…", "description": null }],
  "removedProductLotIds": ["<lot to remove>"]
}
```

- **Validator**: `customerProductLotsCorrectionValidator` in
  `app/discharges/product_lots/product_lot_validator.ts`. It reuses `productLotFields()` without
  `customerId` and adds an optional `id: vine.string().uuid()`.
- **Bounds**: `productLots` and `removedProductLotIds` each allow 0 to 100 entries, the same bound
  as `addProductLotsValidator`. An empty request is valid and changes nothing but the discharge's
  `updatedAt`, as a GH-53 correction saved unchanged does.
- **Normalization**: `normalizeProductLot` in the use case, as GH-53 does (AGENTS: normalize in use
  cases, not validators).

**Rationale**:
- Entries carry an id only when they correct, so the web posts its rows in their visible order. The
  API index is then the form's row index (Decision 9).
- Removals are ids, not flags on entries, so a removed lot sends no values that would need
  validating.

**Alternatives considered**: A `removed: true` flag on entries. Rejected: a removed row would still
have to carry valid values, and a lot could be both corrected and removed in one entry.

## Decision 3 — A pure rules module decides refusals and the write plan

`app/discharges/product_lots/customer_product_lots_rules.ts` exports
`planCustomerProductLotsCorrection(request, lots, lotIdsWithDoorAssignments, targetCustomer)`. It
follows `truck_pool_rules.ts`: it reads nothing, and returns one of:

| Outcome | Becomes |
|---|---|
| `{ kind: 'LOT_NOT_FOUND' }` | `404 E_PRODUCT_LOT_NOT_FOUND` |
| `{ kind: 'ISSUES', issues }` | `422 E_VALIDATION_ERROR` |
| `{ kind: 'LAST_LOT' }` | `409 E_DISCHARGE_LAST_PRODUCT_LOT` |
| `{ kind: 'PLAN', removals, corrections, insertions }` | the write |

The use case checks these in order:
1. **Unknown lot.** Every listed or removed id must be a current lot of the discharge whose customer
   is the path customer. Otherwise the result is `LOT_NOT_FOUND`: unknown, malformed, removed
   meanwhile, another customer's lot, or another discharge's lot.
2. **Listed once.** An id listed twice across both arrays gives `productLotListedOnce` at its second
   position.
3. **Decided issues**, collected together:
   - `availableCustomer` at `customerId`, when the group moves to a customer that is not
     `AVAILABLE`.
   - `removableProductLot` at `removedProductLotIds.N`, when that lot is in
     `lotIdsWithDoorAssignments`.
   - `productLotIdentityUnique` at `productLots.N.productName`, for each listed entry whose identity
     (target customer, trimmed lower-case name) is shared by another lot of the discharge after the
     change. The state after the change is built from: the discharge's lots neither listed nor
     removed, unchanged; plus every corrected and added entry under the target customer.
4. **Last lot.** When lots before − removals + insertions = 0, the result is `LAST_LOT`.

**Rationale**:
- Judging identity on the state after the change is what makes a swap, or a removal and re-add
  under the same name, legal (spec US1-6, US3-7). It still refuses a clash with the target
  customer's existing lots (US4-3) and with a lot added meanwhile.
- The pure module pins every rule at its edges without a database, as GH-55 does.
- The precedence mirrors the single-lot use cases: not found first, then value issues, then the
  whole-change refusal. Value issues are reported all at once, as GH-53's creation does.
- A lot of another customer is `404`, not `422`: from this group's point of view the lot does not
  exist, and the web handles it as stale lots (Decision 10).

## Decision 4 — Locks, reads, and concurrency

Inside one transaction:
1. `lockPlannedDischarge`, which gives `404` or `409 E_DISCHARGE_NOT_PLANNED`.
2. `listProductLots` under that lock.
3. `lockCustomers([targetCustomerId])` only when the group moves.
4. The new `listLotIdsWithDoorAssignments(removedIds)`: one batched read, empty when nothing is
   removed.
5. The plan, then the write (Decision 5).

**Rationale**:
- The lock order stays discharge, then customers, as `DischargePreparationRepository` documents, so
  no deadlock with other preparation writes.
- The current customer takes no lock: a customer in use by a planned discharge cannot be archived,
  as the single-lot correction already relies on (spec edge case).
- A door assignment written by GH-54 must lock the discharge first, so the read in step 4 stays true
  until commit. The foreign key's `RESTRICT` remains the last resort.
- Concurrent corrections of the same lot queue behind the discharge lock. The last one saved wins,
  as today (spec assumption). No version column is added.
- Row locks are not exercised in tests: the test database is SQLite, where Knex ignores them, as
  GH-55 notes.

## Decision 5 — The write parks renamed lots before writing final identities

A new repository method, `writeCustomerProductLotsCorrection(command, client)`, runs in one
savepoint:
1. **Delete** the removed lots.
2. **Park** every corrected lot whose identity changes (customer, or lower-cased name) by setting
   its `product_name` to a value unique to that lot: its own id. This satisfies the non-blank check
   and the 255-character limit, and cannot equal another lot's parked or real name in practice.
3. **Update** every corrected lot to its final customer, name, quantity, and description.
4. **Insert** the added lots.
5. **Touch** the discharge's `updated_at`.

It returns `WRITTEN`, `DUPLICATE_LOT_IDENTITY`, or `HAS_DOOR_ASSIGNMENTS`, using the existing
`isDuplicateLotIdentity` and `isForeignKeyViolation` detection.

**Rationale**:
- `product_lots_identity_unique` is a unique **expression** index on
  `(discharge_id, customer_id, LOWER(product_name))`.
  - PostgreSQL cannot make an index deferrable, and checks it row by row.
  - SQLite, the test database, does the same.
  - So an in-place swap violates it midway, even though the final state is valid.
- Parking only the lots whose identity changes keeps the statement count bounded by the request
  size (at most 100 lots, per Decision 2).
- Deleting before parking and inserting lets a removed lot's name be reused by an added one.
- The rules already refuse every clash (Decision 3). A `DUPLICATE_LOT_IDENTITY` outcome can only
  come from a write that bypassed the discharge lock. The use case maps it as the add use case does,
  to `productLotIdentityUnique` at `productLots.0.productName`, and maps `HAS_DOOR_ASSIGNMENTS` to
  `ProductLotHasDoorAssignmentsException` (409).

**Alternatives considered**:
- **Delete and reinsert every corrected lot.** Rejected: it changes lot identities and breaks door
  assignments (FR-011), which `RESTRICT` would refuse anyway.
- **Order the updates to avoid collisions.** Rejected: a cycle, such as a swap, has no valid order.
- **A migration to a deferrable constraint on a stored normalized name column.** Rejected: it needs
  a migration and a backfill to serve one write path, when the parking step needs neither.

## Decision 6 — Refusals keep GH-53's scheme

| Situation | Status and code | Field or detail |
|---|---|---|
| Unauthenticated or not active | 401 `E_UNAUTHORIZED_ACCESS` | — |
| Observer | 403 `E_AUTHORIZATION_FAILURE` | — |
| Unknown or malformed discharge | 404 `E_DISCHARGE_NOT_FOUND` | — |
| A listed or removed lot is not a current lot of the path customer | 404 `E_PRODUCT_LOT_NOT_FOUND` | — |
| Discharge active or closed | 409 `E_DISCHARGE_NOT_PLANNED` | — |
| No lot left on the discharge | 409 `E_DISCHARGE_LAST_PRODUCT_LOT` | — |
| Request shape (blank name, quantity, lengths, uuids, bounds) | 422 `E_VALIDATION_ERROR` | VineJS rules at `productLots.N.*`, `removedProductLotIds.N`, `customerId` |
| Same lot listed twice | 422 | `productLotListedOnce` |
| Target customer unavailable | 422 | `availableCustomer` at `customerId` |
| Removed lot has or had doors | 422 | `removableProductLot` at `removedProductLotIds.N`, message `This product lot has warehouse door assignments` |
| Identity clash after the change | 422 | `productLotIdentityUnique` at `productLots.N.productName` |

**Rationale**:
- Every existing code keeps its meaning.
- The door-assignment refusal becomes a `422` issue rather than GH-53's single-lot `409`, because a
  group change can refuse several removals at once and the web points at each (Decision 10). Its
  message is the text the web already shows in `LOT_REMOVAL_REASONS`.

## Decision 7 — Authorization and response reuse GH-53 and GH-55

- **Authorization**: `DischargePolicy.update` authorizes the route before validation, so observers
  get `403` without their body being read.
- **Response**: `DischargeDetailTransformer.transform(await discharges.findDetail(id))`, the
  `DischargeDetailRead` GH-55 introduced.
- No policy, transformer, or detail change.

## Decision 8 — Web: an `Edit` action on the customer's group opens a sheet

- **Where**: in `discharge-product-lots-card.tsx`, the customer header row's last cell gets a ghost
  `Edit` button when `canCorrect`.
  - Its accessible name is `Edit Cargill France`: the visible label is the action alone (repository
    convention), and the name tells the groups apart.
  - The header row keeps its `rowgroup` name.
- **What it opens**: `CustomerProductLotsSheet` (`ui/detail/customer-product-lots-sheet.tsx`), a
  `Sheet` with `size="lg"` titled `Edit product lots`, whose description names the customer.
- **State**: the open group lives in local state, keyed by customer id, as `editing` and `adding` do
  today. The group is derived from the fresh `discharge` on each render, so refreshed door
  assignments reach the sheet.
  - `apps/web/AGENTS.md` asks for URL state for open panels. The lot sheets already deviate
    deliberately: an address to a half-edited correction is not useful. This sheet follows its
    siblings.
- The single-lot `Edit` in each row's menu is unchanged (FR-017).

## Decision 9 — Web: one customer block extracted from the groups editor

- **Extraction**: `ProductLotGroupsEditor`'s block body moves into `ProductLotGroupFields`
  (`ui/preparation/product-lot-group-fields.tsx`), a `withFieldGroup` over
  `{ customerId, products }`. `ProductLotGroupsEditor` maps its blocks onto it and keeps its
  behavior and tests: `Add customer`, the taken-customer filter, and removable blocks.
- **New optional props** used by the correction sheet:
  - `rowRemoval(productIndex)` returns `{ canRemove, blockedReason }`.
  - `allowEmpty` lets the last product row be removed.
- **`RemoveRowButton`** gains an optional `blockedReason`. With a reason, it renders `aria-disabled`,
  a tooltip, and `aria-describedby` to an sr-only reason, the pattern of `ProductLotRowActions`.
  Without one, it behaves as today. The shift rows of `create-discharge-form.tsx` do not change.
- **Form model**: `customerProductLotsFormValues(group)` in `discharge-preparation-schema.ts` gives
  `{ customerId, products: [{ lotId, productName, expectedQuantityTonnes, description }], removedProductLotIds: [] }`.
  - `lotId` is a form value but not a rendered field.
  - `Add product` pushes `lotId: null`.
  - Removing a row that has a `lotId` appends that id to `removedProductLotIds`.
- **Client rules** in `customerProductLotsCrossRulesSchema(otherLots)`, where `otherLots` is the
  discharge's lots outside the group, mirror the API:
  - identity clashes among the rows and against `otherLots` under the chosen customer;
  - at least one product row when `otherLots` is empty.
- **Row removal blocks**, computed from the fresh detail:
  - a row whose lot has door assignments: `LOT_REMOVAL_REASONS.E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS`;
  - the last row when `otherLots` is empty: `LOT_REMOVAL_REASONS.E_DISCHARGE_LAST_PRODUCT_LOT`.
- **Empty block**: when `otherLots` is not empty and every row is removed, the block shows `Saving
  removes every product lot of this customer.` above `Add product`.
- **Customer options**: `useCustomerOptions(group.customer)`. The combobox description says when the
  chosen customer already has lots, for example `Joins the 2 product lots of Soufflet Négoce.`
  (spec US4-2).
- **Body**: `toCustomerProductLotsBody(values)` sends rows in order (id only when `lotId` is set),
  the chosen customer, and the removed ids.
- **Error mapping**: `customerProductLotsFieldOf(apiField)` maps:
  - `productLots.N.<field>` to `products[N].<field>`;
  - `customerId` to `customerId`;
  - anything else (`removedProductLotIds.N`, `productLots.N.id`) to the form-level error, through
    `applyValidationError`'s unmatched fallback.

**Rationale**: The spec assumes the add editor is reused, and ADR 0008 allows a separate form model.
Extracting the block keeps one implementation of the product rows, their description on demand, and
the subtotal. A flag-laden `ProductLotGroupsEditor` would be harder to test.

## Decision 10 — Web: outcomes and stale state

- **Success**: toast `Product lots updated`, the sheet closes, and `applyDetail` writes the response
  into the detail cache and invalidates the list.
- **`422`**: issues land on their rows or the form error, and the sheet stays open with what was
  typed. The mutation also invalidates the detail on `E_VALIDATION_ERROR`, as `selectShiftTrucks`
  does, so a door assigned meanwhile turns into a visible removal block.
- **`E_DISCHARGE_NOT_PLANNED` or `E_DISCHARGE_NOT_FOUND`**: toast `STARTED_REFUSAL_MESSAGE`, and the
  sheet closes.
- **`E_PRODUCT_LOT_NOT_FOUND`**: toast `This customer's product lots changed`, and the sheet closes.
  The detail refreshes through `STALE_DETAIL_CODES`.
- **`E_DISCHARGE_LAST_PRODUCT_LOT`**: form error `A discharge needs at least one product lot`, and
  the sheet stays open. The code joins `STALE_DETAIL_CODES`, since it can only follow another user's
  removal.
- **Anything else**: toast `Unable to update the product lots`, with the API message.

## Decision 11 — No migration, no seed, no vocabulary change

- **No schema change**: the parking step (Decision 5) avoids a migration.
- **No seed change**: the quickstart creates the lots it needs through the existing add route.
- **No `CONTEXT.md` change**: `Product Lot` already defines the identity this feature judges. A
  correction grouped by customer is not a new domain concept.
- **No activity log entry**: GH-102 is not delivered.

## Resolved technical unknowns

| Unknown | Resolution |
|---|---|
| Route and verb | Decision 1 |
| Keeping unlisted and concurrently added lots | Decisions 1, 2, 3 |
| Swaps against a row-checked unique index | Decision 5 |
| Removal blocks inside a group change | Decisions 3, 6, 9 |
| Web editor reuse | Decision 9 |
| Stale and concurrent outcomes | Decisions 4, 10 |
