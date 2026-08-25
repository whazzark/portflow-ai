# Data Model: Reactivate a Transport Company

This slice adds no entity, no column, no index, and no migration. Every field it writes already exists on `transport_companies`, is already seeded, and is already read by the delivered consultation and details views. The full entity is defined in [the consultation data model](../list-transport-companies/data-model.md); only the parts this feature constrains are restated here.

## Transport Company — what a reactivation writes

| Field | Written by this feature | Rules |
|---|---|---|
| `id` | No | Stable identity; preserved (FR-012) |
| `name` | No | Preserved exactly; reactivation is not a rename (FR-012) |
| `status` | **Yes** | `ARCHIVED` → `AVAILABLE`. The write matches only rows still `ARCHIVED` |
| `reactivatedAt` | **Yes** | Set to the server time of the successful transition; identical for every company reactivated by one bulk request (FR-027) |
| `reactivatedByUserId` | **Yes** | Set to the authenticated administrator's id; identical across one bulk request |
| `reactivationComment` | **Yes** | Trimmed submitted comment, or `null` when absent, empty, or whitespace-only (FR-008); identical across one bulk request. Replaces any earlier value, including replacing a previous comment with `null` (FR-011) |
| `archivedAt` / `archivedByUserId` / `archiveComment` | No | Left exactly as they are (FR-012). The most recent archival stays readable as history; the details view simply stops showing it once the status is `AVAILABLE` and shows the reactivation context instead |
| `createdAt` | No | Server-managed; never rewritten |
| `updatedAt` | Yes, implicitly | Refreshed by the write, to the same instant as `reactivatedAt` |

A refused reactivation writes none of these, and a company blocked within a bulk request is written no more than a company refused alone (FR-016, FR-026).

### A company is never partially reactivated

The four written fields move together or not at all (FR-028). In the bulk path they are set by a single `UPDATE` over the eligible ids inside one transaction, so there is no interval in which a company is `AVAILABLE` without its reactivation actor, time, or comment.

### Lifecycle context is replaced, not accumulated

`transport_companies` carries exactly one archive triple and one reactivation triple. Reactivating a company that was already reactivated once before overwrites `reactivatedAt` / `reactivatedByUserId` / `reactivationComment` with the new transition and leaves the archive triple in place. This is the exact mirror of what #220 does in the other direction, it is the delivered model for every site reference, and it is what spec edge case 12 asserts: one most-recent context per direction, never a growing history. Durable history lives in discharges and reports, not in the reference row.

A consequence worth stating because a reviewer will look for it: `archivedByUserId` may be `null` on a legacy row — the seeded *Noroît Logistique* is exactly that case. A reactivation neither repairs nor rejects such a row; it writes its own triple and leaves the archive triple as found.

## Truck — not read, not written

| Field | Read | Written |
|---|---|---|
| every field | **No** | **Never** |

This is the deliberate asymmetry with archival, which reads `trucks.status` to evaluate its blocking rule. Reactivation has no blocking rule, so it issues no query against `trucks` at all (FR-006, [research.md](./research.md) Decision 3). No truck row is created, updated, archived, or reactivated, so:

- every company↔truck association survives a reactivation unchanged (FR-015);
- a truck archived while its company was archived stays archived (spec edge case 13);
- a reactivated company may legitimately provide no available truck.

## The eligibility rule

```text
reactivatable(company) ⇔ company.status = 'ARCHIVED'
```

That is the whole rule.

- Every archived company is reactivatable, whatever trucks it provides and however long it has been archived (FR-006).
- No name-uniqueness condition applies: `transport_companies_name_unique` spans both lifecycle states, so an archived company's name cannot have been taken while it was away ([research.md](./research.md) Decision 4).
- Evaluated at submission time against persisted state, never against state captured when the dialog opened or against the collection the administrator was looking at (FR-005, FR-033).
- Identical for one company and for every company of a selection (FR-023).

## Write commands and results

### Single reactivation

```text
ReactivateTransportCompanyCommand
  id                    : UUID
  reactivatedAt         : DateTime
  reactivatedByUserId   : UUID
  reactivationComment   : string | null    # already trimmed by the caller; null when blank

ReactivateTransportCompanyResult
  | REACTIVATED       { company }   # row matched, was ARCHIVED, and was written
  | NOT_FOUND                       # no row with this id
  | ALREADY_AVAILABLE               # row exists but its status is already AVAILABLE
```

`ReactivateTransportCompanyResult` is a separate type from `ArchiveTransportCompanyResult` and from `TransportCompanyWriteResult`, for the reason #220 already recorded: those types use `ARCHIVED` to mean two different things, and adding a third meaning to either would make `kind` ambiguous at call sites.

The `REACTIVATED` result preloads both `archivedBy` and `reactivatedBy`, so the response carries the new actor's summary — which the details panel renders immediately — and the preserved archival actor, without a follow-up read. This matches `archiveAvailable` and `updateAvailable`, which already preload both relations.

### Bulk reactivation

```text
ReactivateTransportCompaniesCommand
  ids                   : UUID[]           # at least one, no duplicates (enforced by validation)
  reactivatedAt         : DateTime
  reactivatedByUserId   : UUID
  reactivationComment   : string | null

BulkTransportCompanyLifecycleResult                          # reused unchanged from #220
  updatedCompanies : TransportCompany[]                      # reactivated by this request, in requested order
  blockedCompanies : BulkTransportCompanyLifecycleBlocker[]  # left unchanged, in requested order

BulkTransportCompanyLifecycleBlocker                         # reason union widened by this slice
  id      : UUID
  name    : string | undefined    # absent when the company does not exist
  reason  : 'NOT_FOUND' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE' | 'HAS_AVAILABLE_TRUCKS'
```

The reactivation endpoint produces only `NOT_FOUND` and `ALREADY_AVAILABLE`; the archival endpoint produces only the other two. The union is shared rather than split per direction — see [research.md](./research.md) Decision 2 for the trade-off.

Invariants the bulk result must satisfy, and which the tests assert:

- `updatedCompanies` and `blockedCompanies` partition the requested ids: every requested id appears in exactly one of them, exactly once, and nothing else appears.
- Both collections follow the order of the requested ids, so the administrator reads the outcome in the order they made the selection.
- Every entry of `updatedCompanies` carries the same `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment`.
- `blockedCompanies` carries exactly one reason per company — the first that applies in the order of [research.md](./research.md) Decision 6.

### The shared partition rule

```text
findBulkBlockers(
  ids                           : UUID[],
  companiesById                 : Map<UUID, TransportCompanyLifecycleRecord>,
  expectedStatus                : 'AVAILABLE' | 'ARCHIVED',
  companyIdsWithAvailableTrucks : Set<UUID> = ∅,
) : BulkTransportCompanyLifecycleBlocker[]

  id absent from companiesById            → NOT_FOUND
  status ≠ expectedStatus                 → ALREADY_ARCHIVED  (expected AVAILABLE)
                                          → ALREADY_AVAILABLE (expected ARCHIVED)
  expectedStatus = AVAILABLE ∧ id ∈ trucks→ HAS_AVAILABLE_TRUCKS
  otherwise                               → eligible
```

Reactivation calls it with `expectedStatus: 'ARCHIVED'` and lets the truck set default to empty, so its third branch is unreachable by construction rather than by convention.

## Concurrency

| Path | Mechanism | Guarantee |
|---|---|---|
| Single | `UPDATE … WHERE id = ? AND status = 'ARCHIVED'`, no transaction | Two concurrent reactivations of one company: exactly one `REACTIVATED`, one `ALREADY_AVAILABLE`, one stored reactivation context |
| Bulk | One transaction; requested rows locked `forUpdate`; one `UPDATE … WHERE id IN (eligible) AND status = 'ARCHIVED'`; affected-row count asserted equal to the eligible count | No company half-written; a company reactivated concurrently is reported blocked rather than double-written; an unexpected count aborts the transaction instead of reporting a success that did not happen |

The single path takes no lock deliberately: unlike archival it reads no second table, so there is nothing to serialize. See [research.md](./research.md) Decision 5.

There is no equivalent of the archival slice's residual create-truck race, because this path never reads `trucks`.

## State transitions

```text
                 archive (#220 — one company or a selection, blocked by available trucks)
   AVAILABLE ──────────────────────────────────────────────────────────────────────────▶ ARCHIVED
       ▲                                                                                      │
       └──────────────────────────────────────────────────────────────────────────────────────┘
                 reactivate (this slice, #221 — one company or a selection, never blocked)
```

- `ARCHIVED → AVAILABLE` is the only transition this slice performs, and it is unconditional for an archived company.
- `AVAILABLE → AVAILABLE` is refused as `ALREADY_AVAILABLE` (FR-003) and reported as a per-company blocker in bulk (FR-025); it is not treated as a successful no-op, because silently succeeding would overwrite the real reactivation's actor, time, and comment.
- The loop is now closed in both directions, and it may be traversed any number of times; the row keeps only the most recent context per direction.
- No transition deletes a row, and no transition touches a truck.

## Consequences for other reads

| Read | Effect of a reactivation |
|---|---|
| `GET /transport-companies` | The company still appears, now with `status: "AVAILABLE"` and its reactivation context (FR-014) |
| `GET /transport-companies/available` | The company starts appearing again (FR-013, FR-014) |
| Truck creation's provider check | `CreateTruckUseCase` accepts a provider whose status is `AVAILABLE`, so the company can receive new trucks again (FR-013) with no change to that slice |
| `PATCH /transport-companies/:id` | Stops refusing with `409 E_TRANSPORT_COMPANY_ARCHIVED`; the company is renameable again, with no change to the update slice |
| Existing trucks of the company | Unchanged, still associated, still readable, still in whatever lifecycle state they were (FR-015) |
| Historical discharges and report snapshots | Unchanged; they retain values captured when they were produced |
