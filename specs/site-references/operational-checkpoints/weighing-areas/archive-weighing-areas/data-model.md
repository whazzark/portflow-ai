# Data Model: Archive Weighing Areas

**Feature**: `GH-205` | **Date**: 2026-08-24 | **Plan**: [plan.md](./plan.md)

## Schema impact

**No migration is required.** `weighing_areas` already carries every column this feature writes,
created with the table in `1784600000000_create_weighing_areas_table.ts`.

| Column | Type | Role in this feature |
|---|---|---|
| `id` | `uuid` PK | Identifies a submitted weighing area |
| `name` | `string` NOT NULL | Blocker label; preserved by archival (FR-011) |
| `latitude` / `longitude` | `double` NOT NULL | Preserved by archival (FR-011) |
| `status` | `enum('AVAILABLE','ARCHIVED')` NOT NULL | The transition this feature performs |
| `archived_at` | `timestamp` NULL | Written on success (FR-008); shared across a bulk (FR-030) |
| `archived_by_user_id` | `uuid` NULL → `users.id` | Written on success (FR-008); shared across a bulk |
| `archive_comment` | `text` NULL | Written on success; `null` when absent/blank (FR-009) |
| `reactivated_at` / `reactivated_by_user_id` / `reactivation_comment` | NULL | **Untouched** — prior reactivation context is preserved (FR-011) |
| `created_at` | `timestamp` NOT NULL | Preserved (FR-011) |
| `updated_at` | `timestamp` NOT NULL | Set to the archive time |

Relevant existing constraints: `weighing_areas_name_unique` on `LOWER(name)` — status-independent,
which is why archiving does **not** free a name (FR-016) — and `weighing_areas_status_index`, which
serves the `status = 'AVAILABLE'` predicate in the bulk update.

## Entities

### Weighing Area

The weighbridge being retired. Archival mutates only `status`, the three `archive_*` columns, and
`updated_at`. Identity, name, coordinates, creation time, and reactivation context are invariant
across the transition.

**State transition** — the only one this feature performs:

```text
AVAILABLE ──archive(actor, at, comment?)──▶ ARCHIVED
```

Guarded by, in the order the checks are applied:

1. record exists → else `NOT_FOUND`
2. `status = 'AVAILABLE'` → else `ALREADY_ARCHIVED`
3. not currently used → else `IN_USE`

`ARCHIVED → AVAILABLE` exists in the codebase but belongs to #206 and is out of scope here.

### Weighing Area Usage

Not a stored entity — a derived set. A weighing area is currently in use when it holds a **current
shift membership** belonging to a **Planned or Active** discharge, resolved by
`SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'WEIGHING_AREA', … })`
(`#240` FR-005). Closed discharges and ended memberships do not qualify (FR-006). The checker is
already set-based and already accepts a transaction client, so the bulk path reads usage under the
same locks it writes beneath.

### Weighing Area Lifecycle Blocker

The per-record reason returned by a bulk submission. New module
`weighing_area_lifecycle_blockers.ts`, transposed from the delivered
`dock_lifecycle_blockers.ts` (`#200`):

```ts
export type WeighingAreaLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkWeighingAreaLifecycleBlocker = {
  id: string
  name?: string          // omitted for NOT_FOUND — no record resolved to name
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

export function findBulkBlockers(
  ids: string[],
  byId: Map<string, WeighingAreaLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  usedIds: Set<string> = new Set(),
): BulkWeighingAreaLifecycleBlocker[]
```

Exactly one reason per blocked weighing area (FR-029), assigned in the guard order above.

Two deliberate choices, both from `#200`:

- **`expectedStatus` is a parameter**, so the same function serves reactivation and #206 does not
  write a second one. `ALREADY_AVAILABLE` exists in the union for that reason and is **never
  produced by this slice**, which only ever passes `'AVAILABLE'`.
- The generic `indexById` / `orderByIds` helpers in `shared/lifecycle/bulk_lifecycle_records.ts` are
  reused rather than redeclared locally. The dock module predates those helpers and declares its own
  `indexDocksById`/`orderDocks`; the weighing-area module should not copy that duplication forward.

### Bulk Archival Outcome

```ts
export type BulkWeighingAreaLifecycleResult = {
  updatedWeighingAreas: WeighingArea[]           // ordered by submitted id order
  blockedWeighingAreas: BulkWeighingAreaLifecycleBlocker[]
}
```

Every entry in `updatedWeighingAreas` shares one `archived_at`, `archived_by_user_id`, and
`archive_comment` (FR-030), because a single `UPDATE` writes them.

### Weighing Area Selection (client state)

Ephemeral, never persisted (research D5): a `Set<string>` of weighing-area ids in the Checkpoints
page. Holds only weighing areas the administrator may archive; pruned by lifecycle-status and
resource-kind scope, **not** by search (FR-036).

### Authorized Administrator

`ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN` with active access — already encoded in
`WeighingAreaPolicy.archive`, which needs no change and gates both endpoints (FR-026).

## Validation rules

| Rule | Source | Where enforced |
|---|---|---|
| Comment trimmed; blank → `null` | FR-009 | `lifecycleComment()` |
| Comment ≤ 1,000 chars | FR-010 | `lifecycleComment()` |
| At least one id | FR-033 | `lifecycleIds()` → `minLength(1)` |
| Ids well-formed | FR-033 | `lifecycleIds()` → `.uuid()` |
| No duplicate ids | FR-033 | `lifecycleIds()` → `distinctUuids()` |
| Eligibility at submission time | FR-007, FR-027 | Repository, under `forUpdate()` |
| All-or-nothing for the eligible set | FR-031 | Transaction + affected-rows guard |

The three FR-033 rejections all occur during validation, i.e. **before** the use case runs — which is
what makes "rejected before any weighing area changes" true, and what distinguishes them from
`NOT_FOUND`, which is a per-record outcome for a well-formed id that resolved to nothing.
