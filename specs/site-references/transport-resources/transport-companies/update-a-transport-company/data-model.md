# Data Model: Update a Transport Company

This slice adds no entity and no column. It adds one constraint to the existing `transport_companies` table and defines which fields a rename may touch. The full entity is defined in [the consultation data model](../list-transport-companies/data-model.md); only the parts this feature constrains are restated here.

## Transport Company — mutability

| Field | Mutable by this feature | Rules |
|---|---|---|
| `id` | No | Stable identity; preserved across every update (FR-011) |
| `name` | **Yes** | Trimmed before validation, comparison, and storage; 1–255 characters after trimming; case-insensitively unique across all rows |
| `status` | No | A rename is not a lifecycle transition; the write is refused unless the row is already `AVAILABLE` |
| `archivedAt` / `archivedByUserId` / `archiveComment` | No | Preserved exactly; a rename records no archive context |
| `reactivatedAt` / `reactivatedByUserId` / `reactivationComment` | No | Preserved exactly; a rename records no reactivation context |
| `createdAt` | No | Server-managed; never rewritten |
| `updatedAt` | Yes, implicitly | Refreshed by the write, including when the submitted name equals the stored name |

Trucks reference their company by `transport_company_id`. No truck row is read or written by this feature, so every association survives a rename unchanged (FR-014).

## New persistence constraint

```sql
CREATE UNIQUE INDEX transport_companies_name_unique
  ON transport_companies (LOWER(name));
```

- Added by migration `1785100000000_add_transport_companies_name_unique_index.ts` using `this.defer` with `db.rawQuery`, the established portable form for expression indexes in this repository.
- Applies to **all** rows regardless of lifecycle state, matching `customers_company_name_unique` and `docks_name_unique`. An archived company therefore still reserves its name.
- Comparison is case-insensitive. Combined with trimming at the write boundary, `"  atlantique transport routier "` collides with a stored `"Atlantique Transport Routier"`.
- A row never collides with itself, so resubmitting a company's current name succeeds (FR-008).
- Existing seeded fixtures are already case-insensitively distinct — `03_transport_company_seeder.ts` asserts this before writing — so the migration applies to existing data without a cleanup step.
- The index also constrains inserts. Creation (#218) will inherit the guarantee; no creation behavior is added by this slice.

The previously documented state is superseded on exactly one point: the consultation data model recorded that "no uniqueness constraint on `name` is introduced by this consultation slice" and deferred the rule to the first write slice. This is that slice.

Ordering is unaffected. `name ASC, id ASC` remains deterministic; the tie-breaker now only matters for names differing by case, which the index still permits to differ in display casing but not to duplicate.

## Write command and result

The repository boundary gains one command and one result type, mirroring the delivered customer write boundary.

```text
UpdateTransportCompanyCommand
  id    : UUID
  name  : string        # already trimmed and validated by the caller

TransportCompanyWriteResult
  | UPDATED         { company }   # row matched, was AVAILABLE, and was written
  | NOT_FOUND                     # no row with this id
  | ARCHIVED                      # row exists but its status is ARCHIVED
  | DUPLICATE_NAME                # unique index rejected the write
```

`updateAvailable` issues `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'` so the lifecycle guard is atomic with the write. Only when zero rows are affected does it re-read the row to distinguish `NOT_FOUND` from `ARCHIVED`. A unique violation is caught and translated to `DUPLICATE_NAME`; any other database error propagates.

## Validation rules

| Rule | Enforced at | Outcome when violated |
|---|---|---|
| `name` is present | HTTP validator | `422 E_VALIDATION_ERROR` |
| `name` is not blank after trimming | HTTP validator (`nonBlank`), re-asserted in the domain | `422 E_VALIDATION_ERROR`, or `422 E_SITE_REFERENCE_NAME_INVALID` if reached directly |
| `name` is 1–255 characters after trimming | HTTP validator, re-asserted in the domain | `422 E_VALIDATION_ERROR` |
| `name` is unique, case-insensitively | Database unique index | `409 E_TRANSPORT_COMPANY_NAME_CONFLICT` |
| Company exists | Repository write result | `404 E_TRANSPORT_COMPANY_NOT_FOUND` |
| Company is `AVAILABLE` | Repository write result | `409 E_TRANSPORT_COMPANY_ARCHIVED` |
| Caller is an active authenticated user | Authentication middleware | `401 E_UNAUTHORIZED_ACCESS` |
| Caller holds an administration role | `TransportCompanyPolicy.update` | `403 E_AUTHORIZATION_FAILURE` |

Trimming is applied by both `vine.string().trim()` at the boundary and `assertValidSiteReferenceName` in the domain, so the stored value is normalized no matter which entry point is used.

## Authorization

`TransportCompanyPolicy` gains:

```text
update(user) => user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
```

This matches `CustomerPolicy.update`. The existing `list` and `listAvailable` abilities remain open to every active user, so consultation is unchanged and a non-administrator keeps read access while losing the write.

## State transitions

None. A rename leaves the company in `AVAILABLE`:

```text
                 archive (#220)
AVAILABLE  ---------------------------->  ARCHIVED
    ^  |                                     |
    |  +-- update name (#219, this slice)    |
    |      status unchanged                  |
    +------------- reactivate (#221) --------+
```

Renaming an `ARCHIVED` company is not a transition either — it is refused. Changing an archived company's name requires reactivation first (#221).

## Historical records

Immutable report snapshots (ADR 0004) capture the company name at generation time and are never rewritten. A rename therefore changes the current reference and every live consultation view, while previously produced snapshots and closed records keep the name they captured (FR-015). No snapshot table is read or written by this feature.
