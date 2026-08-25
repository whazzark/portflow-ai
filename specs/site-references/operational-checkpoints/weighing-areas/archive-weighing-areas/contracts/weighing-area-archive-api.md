# Contract: Weighing Area Archive API

**Feature**: `GH-205` | **Date**: 2026-08-24

Two endpoints under the existing `/weighing-areas` group in `apps/api/start/routes.ts`. Both are
session-authenticated and gated by `WeighingAreaPolicy.archive`
(`ORGANIZATION_ADMIN` or `OPERATIONS_ADMIN`, active access).

Route order matters: the literal `/archive` must be registered **before** `/:id/archive`, matching
the delivered truck group, so that `POST /weighing-areas/archive` is not captured with
`id = "archive"`.

```ts
router.post('/archive', [controllers.WeighingAreas, 'archiveMany']).as('archive_many')  // NEW
router.post('/:id/archive', [controllers.WeighingAreas, 'archive']).as('archive')       // exists
```

---

## 1. Archive one weighing area (exists — validator changes only)

`POST /weighing-areas/:id/archive`

**Request**

```json
{ "comment": "Weighbridge decommissioned after the 2026 survey" }
```

`comment` is optional and nullable. It is now trimmed and capped at 1,000 characters by
`lifecycleComment()`; a whitespace-only comment is stored as `null` (FR-009/FR-010).

**Success** — `200`, the serialized weighing area via `WeighingAreaTransformer`:

```json
{
  "id": "6b1d0f92-…", "name": "Alpha Scale",
  "latitude": 43.28, "longitude": 5.36,
  "status": "ARCHIVED",
  "archivedAt": "2026-08-24T18:40:00.000Z",
  "archivedByUserId": "a71c…", "archiveComment": "Weighbridge decommissioned…",
  "reactivatedAt": null, "reactivatedByUserId": null, "reactivationComment": null,
  "createdAt": "2026-07-02T09:12:00.000Z", "updatedAt": "2026-08-24T18:40:00.000Z"
}
```

**Outcomes**

| Condition | Status | Code |
|---|---|---|
| Unauthenticated | `401` | session guard |
| Active non-administrator | `403` | policy denial (FR-002) |
| `:id` matches no weighing area | `404` | `E_WEIGHING_AREA_NOT_FOUND` (FR-003) |
| Already archived, including a concurrent race | `409` | `E_WEIGHING_AREA_ALREADY_ARCHIVED` — existing archive context untouched (FR-004) |
| Current shift membership in a planned or active discharge | `409` | `E_WEIGHING_AREA_IN_USE` (FR-005) |
| Comment over 1,000 characters | `422` | validation — no lifecycle change (FR-010) |

All five exception classes already exist in `weighing_area_exceptions.ts`; none is added.

---

## 2. Archive several weighing areas (new)

`POST /weighing-areas/archive`

**Request**

```json
{
  "ids": ["6b1d0f92-…", "9f2a41c7-…", "1c77b0de-…"],
  "comment": "End-of-campaign cleanup"
}
```

`ids` uses `lifecycleIds()`: a non-empty array of distinct, well-formed UUIDs, lower-cased.
`comment` uses `lifecycleComment()` and applies to **every** weighing area archived by the request
(FR-030).

**Success** — `200`. Partial success is a success: the request returns `200` even when every
submitted weighing area was blocked (FR-028).

```json
{
  "updatedWeighingAreas": [
    { "id": "6b1d0f92-…", "name": "Alpha Scale", "status": "ARCHIVED",
      "archivedAt": "2026-08-24T18:40:00.000Z", "archivedByUserId": "a71c…",
      "archiveComment": "End-of-campaign cleanup", "…": "…" }
  ],
  "blockedWeighingAreas": [
    { "id": "9f2a41c7-…", "name": "Beta Scale", "reason": "IN_USE" },
    { "id": "1c77b0de-…", "reason": "NOT_FOUND" }
  ]
}
```

- `updatedWeighingAreas` is ordered by submitted id order and fully serialized through
  `WeighingAreaTransformer`.
- `blockedWeighingAreas[].reason` is exactly one of `NOT_FOUND`, `IN_USE`, `ALREADY_ARCHIVED`.
- `blockedWeighingAreas[].name` is **omitted for `NOT_FOUND`**, because no record resolved to name.
- Every submitted id appears in exactly one of the two arrays.

**Whole-request rejections** — evaluated during validation, before any weighing area changes
(FR-033):

| Condition | Status |
|---|---|
| Unauthenticated | `401` |
| Active non-administrator | `403` (FR-026) |
| `ids` empty | `422` — `minLength(1)` |
| `ids` contains a malformed identifier | `422` — `.uuid()` |
| `ids` names the same weighing area twice | `422` — `distinctUuids()` |
| Comment over 1,000 characters | `422` |

A malformed id fails the **whole** request; a well-formed id that resolves to nothing is reported
per record as `NOT_FOUND`. That distinction is deliberate and is the contract's sharpest edge.

**Guard order** — for each submitted id: missing → `NOT_FOUND`; not `AVAILABLE` →
`ALREADY_ARCHIVED`; in the used set → `IN_USE`. Exactly one reason each.

---

## Transactional guarantees

The bulk handler runs in one transaction:

1. `whereIn('id', ids).forUpdate()` locks the requested rows.
2. Usage is resolved set-based with the transaction client.
3. Blockers are derived; `eligibleIds` is the complement.
4. One `UPDATE … whereIn(eligibleIds).where('status','AVAILABLE')` writes status and all three
   archive columns with identical values.
5. If `affectedRows !== eligibleIds.length`, the handler throws and the transaction rolls back —
   nothing is archived (FR-031).

Consequences the tests must pin (FR-020): two overlapping submissions archive each weighing area
exactly once, the loser reporting it as `ALREADY_ARCHIVED` without overwriting the winner's archive
context; and a transient failure part-way through leaves nothing archived, so the same selection can
be retried.

## Client typing

Both endpoints reach the web app through the generated Tuyau registry, so
`apps/api/.adonisjs/client/registry` regenerates on `dev`/`build`. `apps/web` consumes them as
`tuyauQuery.weighingAreas.archive` and `tuyauQuery.weighingAreas.archiveMany`; no handwritten client
types.
