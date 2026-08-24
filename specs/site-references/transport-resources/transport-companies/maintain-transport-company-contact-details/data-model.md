# Data Model: Maintain Transport Company Contact Details

This slice adds no entity. It adds two columns and one check constraint to the existing `transport_companies` table, and widens the two delivered write commands. The full entity is defined in [the consultation data model](../list-transport-companies/data-model.md); only the parts this feature changes or constrains are restated here.

## New columns

| Column | Type | Nullable | Rules |
|---|---|---|---|
| `contact_phone` | `varchar(32)` | Yes | Trimmed before validation and storage; accepted character set and digit count per the validation table below; no uniqueness rule |
| `contact_email` | `varchar(255)` | Yes | Trimmed before validation and storage; must be a syntactically valid email address; no uniqueness rule |

Both are added by migration `1785200000000_add_transport_companies_contact_details.ts`.

Nullability is deliberate and is the direct consequence of FR-018: companies that existed before this slice keep `NULL` in both columns, stay valid, stay consultable, and are never backfilled with placeholder values. "Required" is enforced on every accepted write, not at rest — see [Write commands](#write-commands-and-result) below.

No index is created. FR-014 makes contact values explicitly non-unique, and nothing searches, sorts, or joins on them.

## New constraint

```sql
ALTER TABLE transport_companies
  ADD CONSTRAINT transport_companies_contact_details_check
  CHECK ((contact_phone IS NULL) = (contact_email IS NULL));
```

- Declared with `table.check(...)` inside the migration's `alterTable`, the same form as the existing `transport_companies_archived_at_check`.
- Expresses FR-004's "always recorded together" as an invariant the database holds, so no migration, seeder, factory, or future slice can produce a half-reachable company.
- Permits exactly two states: `(NULL, NULL)` for a company registered before this slice, and `(value, value)` for every company created or updated after it.
- Existing rows all satisfy it, because both columns are added as `NULL` for every row. The migration therefore needs no data step.

## Transport Company — mutability after this slice

| Field | Mutable by this feature | Rules |
|---|---|---|
| `id` | No | Stable identity; preserved across every write (FR-015) |
| `name` | Unchanged by this slice | Keeps the rules from #218/#219: trimmed, 1–255 characters, case-insensitively unique |
| `contactPhone` | **Yes** | Required on every accepted create and update; trimmed; never cleared without replacement |
| `contactEmail` | **Yes** | Required on every accepted create and update; trimmed; never cleared without replacement |
| `status` | No | A contact change is not a lifecycle transition; the write is refused unless the row is already `AVAILABLE` |
| `archivedAt` / `archivedByUserId` / `archiveComment` | No | Preserved exactly; a contact change records no archive context (FR-015) |
| `reactivatedAt` / `reactivatedByUserId` / `reactivationComment` | No | Preserved exactly; a contact change records no reactivation context (FR-015) |
| `createdAt` | No | Server-managed; never rewritten |
| `updatedAt` | Yes, implicitly | Refreshed by the write, including when the submitted values equal the stored ones |

Trucks reference their company by `transport_company_id`. No truck row is read or written by this feature, so every association survives a contact change unchanged (FR-016).

## Write commands and result

Both delivered commands gain the two fields. The result type is unchanged.

```text
CreateTransportCompanyCommand
  name          : string        # already trimmed and validated by the caller
  contactPhone  : string        # already trimmed and validated by the caller
  contactEmail  : string        # already trimmed and validated by the caller

UpdateTransportCompanyCommand
  id            : UUID
  name          : string
  contactPhone  : string
  contactEmail  : string

TransportCompanyWriteResult                       # unchanged
  | CREATED         { company }
  | UPDATED         { company }   # row matched, was AVAILABLE, and was written
  | NOT_FOUND                     # no row with this id
  | ARCHIVED                      # row exists but its status is ARCHIVED
  | DUPLICATE_NAME                # unique name index rejected the write
```

`updateAvailable` keeps issuing a single `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'`, now setting three columns instead of one. The lifecycle guard therefore stays atomic with the write, so a company archived between form load and submission is refused rather than silently updated (spec edge case 1). Only when zero rows are affected does it re-read the row to distinguish `NOT_FOUND` from `ARCHIVED`.

No new result variant is introduced: contact values carry no uniqueness rule, so no persistence-originating refusal is possible for them. `DUPLICATE_NAME` continues to come only from `transport_companies_name_unique`.

## Validation rules

| Rule | Enforced at | Outcome when violated |
|---|---|---|
| `name` is present, non-blank, 1–255 characters after trimming | HTTP validator, re-asserted in the domain | `422 E_VALIDATION_ERROR`, or `422 E_SITE_REFERENCE_NAME_INVALID` if reached directly |
| `name` is unique, case-insensitively | Database unique index | `409 E_TRANSPORT_COMPANY_NAME_CONFLICT` |
| `contactPhone` is present and non-blank after trimming | HTTP validator (`nonBlank`) | `422 E_VALIDATION_ERROR` |
| `contactPhone` matches the accepted format | HTTP validator (`phoneNumber`), re-asserted in the domain | `422 E_VALIDATION_ERROR`, or `422 E_TRANSPORT_COMPANY_CONTACT_PHONE_INVALID` if reached directly |
| `contactPhone` is at most 32 characters after trimming | HTTP validator, re-asserted in the domain | `422 E_VALIDATION_ERROR` |
| `contactEmail` is present and non-blank after trimming | HTTP validator (`nonBlank`) | `422 E_VALIDATION_ERROR` |
| `contactEmail` is a syntactically valid email address | HTTP validator (`.email()`), re-asserted in the domain | `422 E_VALIDATION_ERROR`, or `422 E_TRANSPORT_COMPANY_CONTACT_EMAIL_INVALID` if reached directly |
| `contactEmail` is at most 255 characters after trimming | HTTP validator, re-asserted in the domain | `422 E_VALIDATION_ERROR` |
| Company exists | Repository write result | `404 E_TRANSPORT_COMPANY_NOT_FOUND` |
| Company is `AVAILABLE` | Repository write result | `409 E_TRANSPORT_COMPANY_ARCHIVED` |
| Caller is an active authenticated user | Authentication middleware | `401 E_UNAUTHORIZED_ACCESS` |
| Caller holds an administration role | `TransportCompanyPolicy.create` / `.update` | `403 E_AUTHORIZATION_FAILURE` |

### Accepted phone format

After trimming, a phone number is accepted when all of the following hold:

- it contains only digits and the characters `+`, `-`, `.`, `(`, `)`, and space;
- a `+`, if present, is the first character and appears at most once;
- it contains at least 6 and at most 20 digits.

`+33 2 40 12 34 56`, `02.40.12.34.56`, and `(02) 40-12-34-56` are all accepted and stored exactly as submitted after trimming. `+`, `()`, `12345`, and `+33 (0)2 40 12 34 56 ext 12` are refused. No normalization to a canonical international form is performed — operations dials what was recorded.

Trimming is applied both by `vine.string().trim()` at the boundary and by `assertValidContactPhone` / `assertValidContactEmail` in the domain, so stored values are normalized no matter which entry point is used (FR-008).

## Authorization

Unchanged. `TransportCompanyPolicy.create` and `.update` already require `ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`, which is exactly the right this slice needs (FR-005). `list` and `listAvailable` remain open to every active user, which is what makes the contact readable by non-administrators (FR-019). No new ability is added.

## State transitions

None. Recording or changing a contact leaves the company in `AVAILABLE`:

```text
                 archive (#220)
AVAILABLE  ---------------------------->  ARCHIVED
    ^  |                                     |
    |  +-- set contact (#254, this slice)    |
    |      status unchanged                  |
    +------------- reactivate (#221) --------+
```

Changing an `ARCHIVED` company's contact is not a transition either — it is refused (FR-006). Doing so requires reactivation first (#221).

## Historical records

`discharge_truck_assignments` captures `transport_company_name_snapshot` at assignment time and is never rewritten. This slice adds no contact snapshot: historical assignments and immutable report snapshots (ADR 0004) neither gain nor lose contact information, retroactively or otherwise (FR-017). No snapshot table is read or written by this feature.

## Dataset impact

- `TRANSPORT_COMPANY_FIXTURES` gains a phone number and an email address for five of the six companies. "Noroît Logistique" — already the fixture representing a historical provider retained without complete data — deliberately keeps both as `NULL`, so the un-migrated state of FR-018 exists in the seeded dataset and is visible in the browser flow.
- `TransportCompanyFactory` gains faker-driven `contactPhone` / `contactEmail` defaults so every existing factory caller keeps producing valid rows, plus a `withoutContact` state setting both to `NULL` for tests that need the legacy shape.
- The seeder needs no change: it merges fixture attributes as-is, and its case-insensitive name assertion is unaffected.
