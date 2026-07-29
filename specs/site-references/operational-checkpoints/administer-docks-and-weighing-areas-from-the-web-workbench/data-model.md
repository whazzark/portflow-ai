# Data Model: Dock and Weighing Area Administration

## Dock

| Field | Type / values | Rules |
|---|---|---|
| `id` | UUID | Stable identity; preserved through updates and lifecycle transitions |
| `name` | string | Required, trimmed, maximum 255 characters, case-insensitively unique among docks |
| `latitude` | finite number | Required; inclusive range `-90` to `90` |
| `longitude` | finite number | Required; inclusive range `-180` to `180` |
| `status` | `AVAILABLE` / `ARCHIVED` | Available is editable/selectable; archived is consultable and read-only |
| `version` | positive integer | Starts at `1`; increments exactly once on every successful update, archive, or reactivation |
| `createdAt`, `updatedAt` | timestamp | Persistence-managed; `updatedAt` changes with each successful mutation |
| `archivedAt`, `archivedByUserId`, `archiveComment` | nullable timestamp/UUID/string | Actor and timestamp set on archive; trimmed optional comment stored as null when blank |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | nullable timestamp/UUID/string | Actor and timestamp set on reactivation; trimmed optional comment stored as null when blank |

## Weighing Area

| Field | Type / values | Rules |
|---|---|---|
| `id` | UUID | Stable identity; preserved through updates and lifecycle transitions |
| `name` | string | Required, trimmed, maximum 255 characters, case-insensitively unique among weighing areas |
| `latitude` | finite number | Required; inclusive range `-90` to `90` |
| `longitude` | finite number | Required; inclusive range `-180` to `180` |
| `status` | `AVAILABLE` / `ARCHIVED` | Available is editable/selectable; archived is consultable and read-only |
| `version` | positive integer | Starts at `1`; increments exactly once on every successful update, archive, or reactivation |
| `createdAt`, `updatedAt` | timestamp | Persistence-managed; `updatedAt` changes with each successful mutation |
| `archivedAt`, `archivedByUserId`, `archiveComment` | nullable timestamp/UUID/string | Actor and timestamp set on archive; trimmed optional comment stored as null when blank |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | nullable timestamp/UUID/string | Actor and timestamp set on reactivation; trimmed optional comment stored as null when blank |

## Relationships and scope

- `archivedByUserId` and `reactivatedByUserId` optionally resolve to user-summary DTOs. The identifier remains even when a relation cannot be resolved; the UI renders a safe unknown-actor fallback.
- A planned or active discharge may reference one Dock, and shifts may reference Weighing Areas. Any such current reference blocks archive through `SiteReferenceUsageChecker`; closed-only history does not.
- Archived records remain visible for administration and historical resolution but are absent from each `/available` endpoint.
- Dock and Weighing Area have separate identity and uniqueness scopes. The same normalized name may exist once in each table.
- Checkpoint is an interface category only. No Checkpoint table, model, repository, or generic API resource is introduced.

## State transitions

```text
create
  └── AVAILABLE (version 1)

AVAILABLE (version N)
  ├── update with expected version N ─────────────────────> AVAILABLE (version N + 1)
  └── archive with expected version N and no usage blocker > ARCHIVED  (version N + 1)

ARCHIVED (version N)
  └── reactivate with expected version N ─────────────────> AVAILABLE (version N + 1)
```

Update is forbidden while archived. Reactivation preserves the same `id` and all prior lifecycle history. Archive and reactivation set the latest action metadata without deleting the prior opposite-action metadata.

## Optimistic concurrency

- Each existing-resource mutation carries the version read by the administrator.
- The repository includes `id`, expected `version`, and required current `status` in the conditional write and increments `version` in the same statement.
- No matching ID produces `NOT_FOUND`.
- A matching row with a different version produces `STALE_VERSION` before lifecycle-state classification. It remains unchanged, and the client must refetch instead of receiving a replacement version token.
- A matching current version in the wrong lifecycle state produces `ARCHIVED`, `ALREADY_ARCHIVED`, or `ALREADY_AVAILABLE` as appropriate.
- Duplicate-name and discharge-usage failures do not increment the version.
- Creation has no prior resource version to compare and returns a new resource at version `1`.

## Grouped lifecycle command

A grouped archive or reactivation contains an ordered, non-empty list of distinct items:

```text
LifecycleItem
  id: UUID
  expectedVersion: positive integer observed by the administrator
```

For each item, the operation returns either an updated resource or one blocker:

| Blocker | Meaning | Resource effect |
|---|---|---|
| `NOT_FOUND` | No current resource has the selected ID | None |
| `STALE_VERSION` | Current version differs from `expectedVersion` | None |
| `IN_USE` | A planned or active discharge currently references the resource during archive | None |
| `ALREADY_ARCHIVED` | Archive was requested for an archived resource at the submitted version | None |
| `ALREADY_AVAILABLE` | Reactivation was requested for an available resource at the submitted version | None |

The use case supplies archive-usage facts from `SiteReferenceUsageChecker`; found rows are then locked and classified in one named repository transaction. Eligible resources transition and increment their versions; blocked resources remain unchanged. Updated and blocked arrays each preserve original request order. Malformed input, including an empty array, duplicate IDs, invalid UUIDs, or non-positive versions, is rejected before any resource changes.

## Validation and authorization

- Authentication middleware admits only active sessions.
- Every active application user may list and view both resource types.
- Only Organization Admins and Operations Admins may create, update, archive, or reactivate.
- Create requires `name`, `latitude`, and `longitude`. Update requires at least one editable field plus `expectedVersion`.
- Lifecycle comments are optional, trimmed, limited to 1,000 characters, and normalized to null when empty after trimming.
- Database coordinate checks and case-insensitive unique indexes remain defense-in-depth behind Vine and use-case validation.
