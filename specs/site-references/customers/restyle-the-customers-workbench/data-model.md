# Data Model: Restyle the Customers workbench

This feature changes no persisted data and no API contract. It reads the existing
`customers.index` response (`CustomerDto`) and the existing bulk lifecycle responses, and derives
view models from them in the web app.

## Source data (unchanged)

### CustomerDto (`Route.Response<'customers.index'>['data'][number]`)

| Field | Used for |
|-------|----------|
| `id` | Row identity, selection, `customerId` URL parameter |
| `code` | Monospaced code link, row menu and checkbox names, bulk list, skipped names, conflict lookup |
| `companyName` | Table, sheet titles, dialog titles, toasts, conflict messages |
| `status` (`AVAILABLE` \| `ARCHIVED`) | Tab membership, status dot, offered actions |
| `createdAt`, `updatedAt` | Detail summary (date and time) |
| `archivedAt`, `archivedBy`, `archiveComment` | Archived table columns, History entry |
| `reactivatedAt`, `reactivatedBy`, `reactivationComment` | Available table columns, History entry |

`archivedBy` / `reactivatedBy` carry `{ firstName, lastName }` (the shape `UserAvatar` and
`formatFullName` already consume).

### BulkCustomerLifecycleResult (`customers.archive_many` / `customers.reactivate_many`)

`{ updatedCustomers: CustomerDto[], blockedCustomers: { id, code?, companyName?, reason }[] }`,
normalized by `toBulkCustomerLifecycleOutcome` into `BulkLifecycleOutcome` (unchanged).

Blocker reasons: `IN_USE`, `NOT_FOUND`, `ALREADY_ARCHIVED`, `ALREADY_AVAILABLE`.

### API error codes consumed by the forms

| Code | Mapped to |
|------|-----------|
| `E_CUSTOMER_CODE_CONFLICT` | `code` field error "Already used by {company name}." |
| `E_CUSTOMER_COMPANY_NAME_CONFLICT` | `companyName` field error "Already used by {code}." |
| `E_VALIDATION_ERROR` | Field errors via `applyValidationError` (unchanged) |
| anything else | Refusal toast (unchanged) |

## Derived view models (web only)

### LifecycleBlock (existing, `components/lifecycle/resource-lifecycle-summary.tsx`)

`{ action, at, actor?, comment }` built by `customerLifecycleBlocks(customer)`;
`orderLifecycleBlocks` drops blocks without `at` and sorts newest first. Feeds both the History
timeline and nothing else new.

### Lifecycle cell (table)

Per row and tab: the transition for the tab (`reactivate` on Available, `archive` on Archived) →
`{ comment | "—", actor chip + formatShortDate(at) | "—" }`.

### No-match summary

`{ term, activeTab, otherTabMatchCount }` where `otherTabMatchCount` counts customers of the other
status satisfying `customerMatchesSearch(customer, term)`.

### Bulk selection list

For the selected ids that are listed: `{ id, primary: code, secondary: companyName }`, in list
order, passed to the bulk dialog's optional `selection` prop.

### Conflict owner lookup

`findCustomerByCode(customers, typed)`: normalized comparison (trim, uppercase) excluding the
customer being edited; `findCustomerByCompanyName` likewise (trim, case-insensitive). Used only to
phrase the API's conflict as a field message.

## State and transitions

Customer lifecycle (unchanged, API-owned): `AVAILABLE --archive--> ARCHIVED --reactivate-->
AVAILABLE`. Editing is offered only in `AVAILABLE`.

Sheet mode (URL, unchanged): `none → view → edit → view`, `none → create → view (created
customer)`, any → `none` on close; `create`/`edit` never open for non-administrators.
