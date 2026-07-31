# Data Model: List Transport Companies

## Transport Company

A site reference for a company that operationally provides trucks. In the current single-site architecture, every row belongs implicitly to the one operating organization and site represented by the deployment.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | Stable primary identity; application-assigned before insert for PostgreSQL/SQLite portability |
| `name` | String, max 255 | Yes | Display casing is preserved; write-time normalization and duplicate-name policy belong to the create/update feature contracts |
| `status` | `AVAILABLE` \| `ARCHIVED` | Yes | Defaults to `AVAILABLE`; authoritative current lifecycle state |
| `archivedAt` | Timestamp | Conditional | Required when `status` is `ARCHIVED`; otherwise retains the most recent archive time when one exists |
| `archivedByUserId` | UUID | No | Nullable foreign key to `users.id`; becomes null if the actor is removed |
| `archiveComment` | Text, max 1000 at write boundary | No | Optional most recent archive reason/context |
| `reactivatedAt` | Timestamp | No | Time of the most recent reactivation when reactivation context exists |
| `reactivatedByUserId` | UUID | No | Nullable foreign key to `users.id`; becomes null if the actor is removed |
| `reactivationComment` | Text, max 1000 at write boundary | No | Optional most recent reactivation context |
| `createdAt` | Timestamp | Yes | Server-managed creation time |
| `updatedAt` | Timestamp | Yes | Server-managed last-change time |

### Persistence constraints and indexes

- Primary key on `id`.
- Index on `status` for the available-only collection and lifecycle filtering.
- `archivedByUserId` and `reactivatedByUserId` reference `users.id` with `ON DELETE SET NULL`.
- Check constraint requires `archivedAt` whenever `status` is `ARCHIVED`; actor and comment remain optional.
- No `site_id` or `organization_id`: ADR `docs/adr/0003-single-site-without-tenant-isolation.md` defines the current dataset scope implicitly.
- No uniqueness constraint on `name` is introduced by this consultation slice. Results order by name and then UUID so same-name records remain deterministic and distinguishable by stable identity.

### Lifecycle interpretation

- `status` alone decides whether the company is available for new operational use.
- An `ARCHIVED` company remains readable in the complete consultation collection and is excluded from the available-only collection.
- An `AVAILABLE` company may have no reactivation context if it has never been archived, or may expose the latest reactivation timestamp, actor, and comment.
- An `ARCHIVED` company always exposes its current archive timestamp and exposes its actor and comment when present.
- Actor identity and comments are optional. Their absence never hides the company or causes a fabricated value.
- Archive and reactivation transitions are documented for model coherence but are not implemented by issue #217; issues #220 and #221 own those behaviors.

### State transitions

```text
                 archive (#220)
AVAILABLE  ---------------------------->  ARCHIVED
    ^                                        |
    |                                        |
    +------------- reactivate (#221) --------+
```

This slice only reads the current state. Refreshing or retrying replaces the client snapshot with the latest persisted state.

## Transport Company Lifecycle Actor Summary

The API resolves an optional actor relationship for display without exposing the full user record.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes when actor exists | Stable user identity |
| `firstName` | String | Yes when actor exists | Current user first name |
| `lastName` | String | Yes when actor exists | Current user last name |

The archive and reactivation summaries are independently nullable. A deleted or otherwise unavailable actor produces `null` while retained lifecycle time/comment fields remain readable.

## Operating Site

The operating site is a domain scope rather than a table in the current MVP. One deployment dataset represents one operating organization and exactly one site; transport-company repository methods therefore accept no tenant or site identifier. Introducing multi-site isolation requires a separate architectural change across users and all site references.
