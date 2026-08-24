# Data Model: Archive a Transport Company

**Last Updated**: 2026-08-24 — bulk archival added.

This slice adds no entity, no column, no index, and no migration. Every field it writes already exists on `transport_companies` and is already seeded and read by the delivered consultation slice. The full entity is defined in [the consultation data model](../list-transport-companies/data-model.md); only the parts this feature constrains are restated here.

## Transport Company — what an archival writes

| Field | Written by this feature | Rules |
|---|---|---|
| `id` | No | Stable identity; preserved (FR-013) |
| `name` | No | Preserved exactly; archival is not a rename (FR-013) |
| `status` | **Yes** | `AVAILABLE` → `ARCHIVED`. The write matches only rows still `AVAILABLE` |
| `archivedAt` | **Yes** | Set to the server time of the successful transition; identical for every company archived by one bulk request (FR-029) |
| `archivedByUserId` | **Yes** | Set to the authenticated administrator's id; identical across one bulk request |
| `archiveComment` | **Yes** | Trimmed submitted comment, or `null` when absent, empty, or whitespace-only (FR-010); identical across one bulk request |
| `reactivatedAt` / `reactivatedByUserId` / `reactivationComment` | No | Left exactly as they are. A company archived after a previous reactivation keeps that reactivation context; the details view simply stops showing it once the status is `ARCHIVED` |
| `createdAt` | No | Server-managed; never rewritten |
| `updatedAt` | Yes, implicitly | Refreshed by the write, to the same instant as `archivedAt` |

A refused archival writes none of these, and a company blocked within a bulk request is written no more than a company refused alone (FR-018, FR-028).

### A company is never partially archived

The five written fields move together or not at all (FR-030). In the bulk path they are set by a single `UPDATE` over the eligible ids inside one transaction, so there is no interval in which a company is `ARCHIVED` without its actor, time, or comment.

### Lifecycle context is replaced, not accumulated

`transport_companies` carries exactly one archive triple and one reactivation triple. Archiving a company that was previously archived and then reactivated overwrites `archivedAt` / `archivedByUserId` / `archiveComment` with the new transition and leaves the stale reactivation triple in place. This is the delivered model for every site reference, and it is what spec edge case 13 asserts: one most-recent context per direction, never a growing history. Durable history lives in discharges and reports, not in the reference row.

## Truck — read only

| Field | Read | Written |
|---|---|---|
| `transportCompanyId` | Yes — to find each company's trucks | **Never** |
| `status` | Yes — only `AVAILABLE` blocks | **Never** |
| every other field | No | **Never** |

No truck row is created, updated, archived, or deleted by this feature, so every company↔truck association survives an archival unchanged (FR-016).

## The blocking rule

```text
archivable(company) ⇔
      company.status = 'AVAILABLE'
  ∧   ¬∃ truck : truck.transport_company_id = company.id ∧ truck.status = 'AVAILABLE'
```

- A company with **no trucks at all** is archivable (FR-005).
- A company whose trucks are **all archived** is archivable (FR-004).
- A company with **at least one available truck** is refused (FR-003), including when that truck is reserved by a planned or active discharge — such a truck is necessarily `AVAILABLE`, so this rule already covers it. No discharge-usage check is performed for transport companies; see [research.md](./research.md) Decision 2.
- Evaluated at submission time against persisted state, never against state captured when the dialog opened or against the collection the administrator was looking at (FR-006, FR-035).
- Identical for one company and for every company of a selection (FR-025).

## Write commands and results

### Single archival

```text
ArchiveTransportCompanyCommand
  id                : UUID
  archivedAt        : DateTime
  archivedByUserId  : UUID
  archiveComment    : string | null    # already trimmed by the caller; null when blank

ArchiveTransportCompanyResult
  | ARCHIVED          { company }   # row matched, was AVAILABLE, and was written
  | NOT_FOUND                       # no row with this id
  | ALREADY_ARCHIVED                # row exists but its status is already ARCHIVED
```

`ArchiveTransportCompanyResult` is deliberately a separate type from the existing `TransportCompanyWriteResult`, whose `ARCHIVED` member means the opposite thing — "refused because the row is archived". Reusing one type for both meanings would make `kind === 'ARCHIVED'` ambiguous at every call site.

The `ARCHIVED` result preloads `archivedBy` so the response carries the actor's summary and the details panel can render "Archived by" without a follow-up read. This matches `updateAvailable`, which already preloads both lifecycle relations.

### Bulk archival

```text
ArchiveTransportCompaniesCommand
  ids               : UUID[]           # at least one, no duplicates (enforced by validation)
  archivedAt        : DateTime
  archivedByUserId  : UUID
  archiveComment    : string | null

BulkTransportCompanyLifecycleResult
  updatedCompanies : TransportCompany[]                     # archived by this request, in requested order
  blockedCompanies : BulkTransportCompanyLifecycleBlocker[] # left unchanged, in requested order

BulkTransportCompanyLifecycleBlocker
  id      : UUID
  name    : string | undefined    # absent when the company does not exist
  reason  : 'NOT_FOUND' | 'ALREADY_ARCHIVED' | 'HAS_AVAILABLE_TRUCKS'
```

Invariants the bulk result must satisfy, and which the tests assert:

- `updatedCompanies` and `blockedCompanies` partition the requested ids: every requested id appears in exactly one of them, and nothing else appears.
- Both collections follow the order of the requested ids, so the administrator reads the outcome in the order they made the selection.
- Every entry of `updatedCompanies` carries the same `archivedAt`, `archivedByUserId`, and `archiveComment`.
- `blockedCompanies` carries at most one reason per company — the first that applies in the order of [research.md](./research.md) Decision 3.

### Truck read

```text
findCompanyIdsWithAvailableTrucks({
  transportCompanyIds : UUID[]
  client?             : QueryClientContract   # so the bulk path can read inside its transaction
}) : Set<UUID>
```

Returns exactly the subset of the requested ids that still provide at least one `AVAILABLE` truck. An empty request returns an empty set without touching business state. Unknown ids are simply absent from the result — they are classified as `NOT_FOUND` by the company lookup, not by this read.

## Concurrency

| Path | Mechanism | Guarantee |
|---|---|---|
| Single | `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'` | Two concurrent archivals of one company: exactly one `ARCHIVED`, one `ALREADY_ARCHIVED`, one stored context |
| Bulk | One transaction; requested rows locked `forUpdate`; one `UPDATE ... WHERE id IN (eligible) AND status = 'AVAILABLE'`; affected-row count asserted equal to the eligible count | No company half-written; a company archived concurrently is reported blocked rather than double-written; an unexpected count aborts the transaction instead of reporting a success that did not happen |

The residual window between reading truck availability and writing the company is documented and accepted in [research.md](./research.md) Decision 7.

## State transitions

```text
                 archive (this slice, #220 — one company or a selection)
   AVAILABLE ──────────────────────────────────────────────────────────▶ ARCHIVED
       ▲                                                                     │
       └─────────────────────────────────────────────────────────────────────┘
                 reactivate (#221, not here — single and bulk alike)
```

- `AVAILABLE → ARCHIVED` is the only transition this slice performs, and only when the blocking rule allows it.
- `ARCHIVED → ARCHIVED` is refused as `ALREADY_ARCHIVED` (FR-007) and reported as a per-company blocker in bulk (FR-027); it is not treated as a successful no-op, because silently succeeding would overwrite the original archival context with a new actor and time.
- `ARCHIVED → AVAILABLE` does not exist yet. Until #221 ships, an archival is not reversible through the product.
- No transition deletes a row (FR-017).

## Consequences for other reads

| Read | Effect of an archival |
|---|---|
| `GET /transport-companies` | The company still appears, now with `status: "ARCHIVED"` and its archive context (FR-014) |
| `GET /transport-companies/available` | The company stops appearing (FR-015) |
| Truck creation's provider check | `CreateTruckUseCase` already refuses a provider whose status is not `AVAILABLE`, so an archived company can no longer receive new trucks (FR-015) with no change to that slice |
| Existing trucks of the company | Unchanged, still associated, still readable, still listing their company (FR-016) |
| Historical discharges and report snapshots | Unchanged; they retain values captured when they were produced |
