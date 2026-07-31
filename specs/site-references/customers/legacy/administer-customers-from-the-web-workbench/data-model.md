# Data Model: Customer Administration

## Customer

| Field | Type / values | Rules |
|---|---|---|
| `id` | UUID | Stable identity; preserved through updates and lifecycle transitions |
| `code` | string | Required, trimmed/normalized, max 255, case-insensitively unique |
| `companyName` | string | Required, non-blank, max 255, case-insensitively unique |
| `status` | `AVAILABLE` / `ARCHIVED` | Available is editable/selectable; archived is readable but read-only |
| `createdAt`, `updatedAt` | timestamp | Managed by persistence |
| `archivedAt`, `archivedByUserId`, `archiveComment` | nullable timestamp/UUID/string | Set on archive; actor and comment are traceable |
| `reactivatedAt`, `reactivatedByUserId`, `reactivationComment` | nullable timestamp/UUID/string | Set on reactivation; actor and comment are traceable |

## Relationships

- `archivedByUserId` and `reactivatedByUserId` optionally resolve to user summary DTOs.
- A customer may be referenced by planned or active discharges. Such a reference blocks archival; archived customers are excluded from available selections. Lifecycle actor summaries and comments are consultation metadata returned by the existing customer transformer.

## State transitions

```text
AVAILABLE --archive if unused by planned/active discharge--> ARCHIVED
ARCHIVED --reactivate by authorized administrator--------------> AVAILABLE
```

Create starts in `AVAILABLE`. Update is valid only in `AVAILABLE`. Individual transitions are idempotence-aware and return explicit not-found/already-in-state/blocker outcomes. Bulk transitions evaluate each distinct selected ID independently under the lifecycle write boundary: eligible records transition, while missing, wrong-state, or usage-blocked records remain unchanged and are returned as blockers with reasons. Duplicate IDs are malformed input and are rejected before the lifecycle command. A mixed result is not rolled back because another selected record is blocked; changed and blocked arrays preserve request order within each category.

## Validation and authorization

- Any active user may list customers and available selections.
- Only `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` may create, update, archive, or reactivate.
- Create requires both `code` and `companyName`; update requires at least one of them.
- Lifecycle comments are optional, trimmed, limited to 1,000 characters, and normalized to null when blank.
- Bulk IDs must be UUIDs, non-empty, and distinct. Lifecycle comments are optional text, trimmed before persistence, and blank values are stored as `null`.
