# Contract: Customer Product Lots Correction UI State

What the discharge detail shows and does for the per-customer correction. The API refusals it
reacts to are in [`customer-product-lots.openapi.yaml`](./customer-product-lots.openapi.yaml), and
the rules and adapters in [`../data-model.md`](../data-model.md).

## Product lots card (Product lots tab)

### Customer header row

| Viewer and discharge | Header row |
|---|---|
| Can correct (preparer, planned discharge) | Icon, customer name, `· N lots`, subtotal, and a ghost `Edit` button right-aligned in the last cell. Accessible name `Edit <customer name>` |
| Observer, or active or closed discharge | Same row without `Edit` |

- The group keeps its `rowgroup` name: the customer's name alone.
- Each lot row keeps its `Actions for <customer> · <product>` menu, with `Edit` and `Remove`
  unchanged (FR-017).

## `Edit product lots` sheet (`Sheet`, `size="lg"`)

- **Title**: `Edit product lots`.
- **Description**: `Correct, add, or remove the product lots of <customer name> in one change.`
- **Mounting**: the form is mounted only while the sheet is open, so every opening starts from the
  lots as the detail reads them.

### Customer block (`ProductLotGroupFields`, one block)

| Element | Behavior |
|---|---|
| `Customer` combobox | Prefilled with the group's customer. Offers available customers plus the current one. Required |
| Combobox description | When the chosen customer differs and already has lots on the discharge: `Joins the N product lots of <customer>.` (`product lot` when N is 1). Otherwise none |
| Subtotal | Live sum of the rows' valid quantities, as in `Add product lots` |
| Product rows | One per lot, in the detail's order: `Product name`, `Expected quantity (t)`, `Add description` on demand (opened when a description exists) |
| Row remove button (`Remove product N`) | Removable: removes the row; a row with a lot id records that id for removal. Blocked: `aria-disabled`, tooltip and accessible description with the reason (below) |
| `Add product` (ghost) | Appends an empty row without a lot id |
| Empty block (every row removed, other customers' lots exist) | Text `Saving removes every product lot of this customer.` above `Add product` |

Row removal reasons, from the fresh detail:

| Condition | Reason |
|---|---|
| The row's lot has or had a warehouse door assignment | `This product lot has warehouse door assignments` |
| No other customer's lot on the discharge and this is the last row | `A discharge needs at least one product lot` |

### Footer

- A summary `N lots · X t` of the rows, as in `Add product lots`.
- An outline `Cancel`, which closes without a request.
- `Save`, with the pending label `Saving…`.

## Client-side validation (before any request)

Submit-time validation first, then after the first submit on change, as in `Add product lots`.

| Rule | Message and place |
|---|---|
| Customer missing | `Customer is required.` on `Customer` |
| Product name blank, too long; quantity missing or invalid; description too long | GH-53 messages on the row field |
| Two rows share a product name, ignoring case and surrounding spaces | `This customer already has a lot with this product name` on each of those rows' `Product name` |
| A row's name matches another lot of the chosen customer outside this group | Same message on that row |
| No row and no other customer's lot | `Add at least one product.` at form level |

A swap of two rows' names raises nothing.

## Save outcomes

| API answer | Sheet | Feedback | Detail |
|---|---|---|---|
| 200 | Closes | Toast `Product lots updated` | Response written to the cache; the list is invalidated |
| 422 on `productLots.N.*` or `customerId` | Stays open, values kept | Error on row N's field or on `Customer` | Refetched (door assignments may have changed) |
| 422 on `removedProductLotIds.N` or `productLots.N.id` | Stays open, values kept | API messages at form level | Refetched; removal blocks update |
| 409 `E_DISCHARGE_LAST_PRODUCT_LOT` | Stays open | Form error `A discharge needs at least one product lot` | Refetched |
| 404 `E_PRODUCT_LOT_NOT_FOUND` | Closes | Toast `This customer's product lots changed` | Refetched |
| 409 `E_DISCHARGE_NOT_PLANNED`, 404 `E_DISCHARGE_NOT_FOUND` | Closes | Toast `This discharge has started and can no longer be corrected` | Refetched |
| Network or other error | Stays open | Toast `Unable to update the product lots`, with the API message | Unchanged |

## Feature tests (`apps/web/src/features/discharges/__tests__/detail/correct-customer-product-lots.test.tsx`)

MSW through `mockDischargeCorrections`, which gains a `PATCH …/customers/:customerId/product-lots`
handler. It applies the body to `state.current`, records `customerLotRequests`, and accepts a
`respondToCustomerLots` override. Every table row above has a test, plus:
- `Edit` absent for an observer and on an active discharge;
- prefill of a three-lot customer;
- swap accepted without a client error, with the body sent in row order;
- a door-assigned row's blocked removal, with its tooltip on focus;
- last-row removal blocked for a single-customer discharge, and allowed with the empty-block text
  otherwise;
- a move with the `Joins…` description and a client clash;
- `Cancel` sends nothing.
