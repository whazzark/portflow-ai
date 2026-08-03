# Data Model: List Trucks

## Truck

A site reference for a vehicle registered for the current site and provided by exactly one current transport company. In the current single-site architecture, every row belongs implicitly to the one operating organization and site represented by the deployment.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | Stable primary identity; application-assigned before insert for PostgreSQL/SQLite portability |
| `registration` | String, max 255 | Yes | Current plate registration; display casing preserved; case-insensitively unique across all lifecycle states |
| `vehicleModel` | String, max 255 | No | Optional free-text vehicle model |
| `capacityTonnes` | Decimal `(12,3)` | Yes | Positive maximum authorized payload in tonnes; serialized as a JSON number |
| `transportCompanyId` | UUID | Yes | References the truck's one current transport company |
| `status` | `AVAILABLE` \| `ARCHIVED` | Yes | Defaults to `AVAILABLE`; authoritative current truck lifecycle state |
| `archivedAt` | Timestamp | Conditional | Required when status is `ARCHIVED`; may retain the latest archive time after reactivation |
| `archivedByUserId` | UUID | No | Nullable reference to `users.id`; becomes null if the actor is removed |
| `archiveComment` | Text | No | Optional most recent archive reason/context; future write boundary limits it to 1,000 characters |
| `reactivatedAt` | Timestamp | No | Time of the most recent reactivation when that context exists |
| `reactivatedByUserId` | UUID | No | Nullable reference to `users.id`; becomes null if the actor is removed |
| `reactivationComment` | Text | No | Optional most recent reactivation context; future write boundary limits it to 1,000 characters |
| `createdAt` | Timestamp | Yes | Server-managed creation time |
| `updatedAt` | Timestamp | Yes | Server-managed last-change time |

### Persistence constraints and indexes

- Primary key on `id`.
- Unique functional index on `LOWER(registration)` across available and archived rows.
- Check constraint requires `capacityTonnes > 0`.
- Check constraint requires `archivedAt` whenever `status` is `ARCHIVED`.
- Index on `status` for lifecycle reads.
- Index on `transportCompanyId` for provider relations and future company-archive eligibility checks.
- `transportCompanyId` references `transport_companies.id` with deletion restricted; site references are not permanently removed by this slice.
- `archivedByUserId` and `reactivatedByUserId` reference `users.id` with `ON DELETE SET NULL`.
- No `site_id` or `organization_id`: `docs/adr/0003-single-site-without-tenant-isolation.md` defines the current dataset scope implicitly.

The repository orders the complete collection by case-folded registration, then stored registration, then UUID. This preserves display casing while producing deterministic results for PostgreSQL and SQLite.

### Lifecycle and provider invariants

- `status` alone determines whether a truck is available for new operational use.
- An `ARCHIVED` truck remains readable to organization administrators and operations administrators and is withheld from every other role's consultation response.
- An `AVAILABLE` truck must have an `AVAILABLE` transport company. This cross-table invariant is enforced by future create, update, company-archive, and truck-reactivation workflows rather than a database trigger.
- An `ARCHIVED` truck may remain related to either an available or archived transport company; both current statuses are presented independently.
- An `AVAILABLE` truck may have no reactivation context if it has never been archived, or may expose its latest reactivation timestamp, actor, and comment.
- An `ARCHIVED` truck always exposes its current archive timestamp; actor and comment remain optional.
- Provider changes update the current relationship only when later workflow rules allow them. Historical Discharge Truck Assignments retain the registration and company captured at reservation time.
- Issue #222 reads current state only and performs no lifecycle or provider transition.

### State transitions

```text
                 archive (#225)
AVAILABLE  ---------------------------->  ARCHIVED
    ^                                        |
    |                                        |
    +------------- reactivate (#226) --------+

Provider assignment may change through update (#224) only while operational usage rules allow it.
```

Refreshing or retrying consultation replaces the client snapshot with the latest persisted lifecycle state and provider relationship.

## Transport Company Summary

The API resolves the required current provider relation for each truck without exposing the company's full lifecycle history.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | Stable transport-company identity; equals `transportCompanyId` |
| `name` | String | Yes | Authoritative current company name |
| `status` | `AVAILABLE` \| `ARCHIVED` | Yes | Authoritative current company lifecycle state, independent of the truck status |

The summary is always present because `transportCompanyId` is required and deletion is restricted. The full company consultation contract remains owned by the transport-company feature.

## Truck Lifecycle Actor Summary

Archive and reactivation actors use the existing user summary contract.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes when actor exists | Stable user identity |
| `firstName` | String | Yes when actor exists | Current user first name |
| `lastName` | String | Yes when actor exists | Current user last name |

The archive and reactivation summaries are independently nullable. A deleted or unavailable actor produces `null` while retained lifecycle time/comment fields remain readable.

## Operating Site

The operating site is a domain scope rather than a table in the current MVP. One deployment dataset represents one operating organization and exactly one site; truck repository methods therefore accept no tenant or site identifier. Introducing multi-site isolation requires a separate architectural change across users and all site references.
