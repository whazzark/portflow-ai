# Data Model: Create a Transport Company

This slice adds no entity, no column, no index, and no migration. It adds one repository command and one write-result variant, and it exercises a constraint that already exists. The full entity is defined in [the consultation data model](../list-transport-companies/data-model.md); only the parts this feature constrains are restated here.

## Transport Company — values at creation

| Field | Set by this feature | Rules |
|---|---|---|
| `id` | Yes, generated | Assigned by the model's `@beforeCreate` hook via `randomUUID()`; unique and never reused (FR-008) |
| `name` | **Yes, from the request** | Trimmed before validation, comparison, and storage; 1–255 characters after trimming; case-insensitively unique across all rows |
| `status` | Yes, fixed | Always `AVAILABLE`; the contract cannot express any other value (FR-009) |
| `archivedAt` / `archivedByUserId` / `archiveComment` | No — null | A new company has no archive context (FR-009) |
| `reactivatedAt` / `reactivatedByUserId` / `reactivationComment` | No — null | A new company has no reactivation context (FR-009) |
| `createdAt` | Yes, server-managed | The creation time required by FR-010 |
| `updatedAt` | Yes, server-managed | Equal to `createdAt` on the created row |

No creation actor is stored. See [research.md](./research.md) decision 3 for why, and what would change that.

Trucks reference their company by `transport_company_id`. No truck row is read or written by this feature, so a newly created company simply owns none (FR-013).

## Inherited persistence constraint

```sql
CREATE UNIQUE INDEX transport_companies_name_unique
  ON transport_companies (LOWER(name));
```

- **Already delivered** by #219's migration `1785100000000_add_transport_companies_name_unique_index.ts`. This slice adds no migration.
- The index constrains inserts as well as updates, so it is the mechanism that makes FR-007 and FR-019 true. Two concurrent inserts of the same name produce exactly one row and one unique violation.
- It applies to **all** rows regardless of lifecycle state, so an archived company still reserves its name and a creation reusing it is refused (spec acceptance scenario 2.4).
- Comparison is case-insensitive. Combined with trimming at the write boundary, submitting `"  atlantique transport routier "` collides with a stored `"Atlantique Transport Routier"`.
- The table's `transport_companies_archived_at_check` constraint (`status <> 'ARCHIVED' OR archived_at IS NOT NULL`) is trivially satisfied by a row created `AVAILABLE` with a null `archivedAt`.

## Write command and result

The repository boundary gains one command and one result variant on the existing union.

```text
CreateTransportCompanyCommand
  name  : string        # already trimmed and validated by the caller

TransportCompanyWriteResult
  | CREATED         { company }   # new row inserted            <- added by this slice
  | UPDATED         { company }
  | NOT_FOUND
  | ARCHIVED
  | DUPLICATE_NAME                # unique index rejected the insert
```

`create` issues a single `INSERT` through `TransportCompany.create({ ...command, status: 'AVAILABLE' })`. A unique violation is caught and translated to `DUPLICATE_NAME`; any other database error propagates. `NOT_FOUND` and `ARCHIVED` are unreachable on the creation path — the use case throws on any unexpected kind rather than returning a misleading success, matching `CreateCustomerUseCase`.

The created model is returned without preloading `archivedBy` or `reactivatedBy`: both foreign keys are null by construction, and the transformer already emits `null` for an absent relation. See [research.md](./research.md) decision 6.

## Validation rules

| Rule | Enforced at | Outcome when violated |
|---|---|---|
| `name` is present | HTTP validator | `422 E_VALIDATION_ERROR` |
| `name` is not blank after trimming | HTTP validator (`nonBlank`), re-asserted in the domain | `422 E_VALIDATION_ERROR`, or `422 E_SITE_REFERENCE_NAME_INVALID` if reached directly |
| `name` is 1–255 characters after trimming | HTTP validator (`minLength`/`maxLength`), re-asserted by `assertValidSiteReferenceName` | `422 E_VALIDATION_ERROR`, or `422 E_SITE_REFERENCE_NAME_INVALID` |
| `name` is not already used, ignoring case and surrounding whitespace | `transport_companies_name_unique` index, translated at the repository | `409 E_TRANSPORT_COMPANY_NAME_CONFLICT` |
| Caller holds an administration role | `TransportCompanyPolicy.create` | `403 E_AUTHORIZATION_FAILURE` |
| Caller is authenticated with active access | Authentication middleware | `401 E_UNAUTHORIZED_ACCESS` |

Trimming happens twice on purpose: the Vine validator makes the HTTP boundary honest, and `assertValidSiteReferenceName` in the use case keeps FR-006 true for any caller that reaches the domain directly, including tests.

## Collection effects

- The created company joins the complete collection (`GET /api/v1/transport-companies`) and the available-only collection (`GET /api/v1/transport-companies/available`) on their next request.
- Ordering is `name ASC, id ASC`, so the new company appears in its alphabetical position with no re-indexing. The `id` tie-breaker only matters for names differing by case, which the index permits to differ in display casing but not to duplicate.
- The archived collection is unaffected; no path in this slice can produce an archived row.
