# Contract: Weighing Area Reactivation API

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Date**: 2026-08-25

Two endpoints. One exists and is corrected; one is new. Both sit inside the authenticated route
group and both authorize through `WeighingAreaPolicy.reactivate`
(`ORGANIZATION_ADMIN || OPERATIONS_ADMIN`).

---

## 1. `POST /api/v1/weighing-areas/:id/reactivate` — existing, route name `weighing_areas.reactivate`

Reactivates one archived weighing area. Throws on any blocker rather than reporting it.

**Request body** (`reactivateWeighingAreaValidator` — **modified**: `lifecycleComment()`)

```jsonc
{ "comment": "Back in service after calibration" }   // optional, nullable, trimmed, ≤ 1000 chars
```

**Responses**

| Status | Condition | Body |
| --- | --- | --- |
| 200 | Reactivated | `{ "data": WeighingAreaDto }` with `status: "AVAILABLE"`, `reactivatedAt`, `reactivatedByUserId`, `reactivationComment`, and the archive fields untouched |
| 401 | Unauthenticated | Standard auth error |
| 403 | Authenticated but not an administrator, or access not active | Standard authorization error |
| 404 | `E_WEIGHING_AREA_NOT_FOUND` | No weighing area with that id |
| 409 | `E_WEIGHING_AREA_ALREADY_AVAILABLE` | Already available; lifecycle context unchanged |
| 422 | Validation failure | Comment over 1,000 characters — **new behavior**, see research D2 |

---

## 2. `POST /api/v1/weighing-areas/reactivate` — new, route name `weighing_areas.reactivate_many`

Reactivates every eligible weighing area in a selection and reports the rest individually.

**Route registration must precede `/:id/reactivate`**, exactly as `/archive` precedes
`/:id/archive`, or the literal segment is captured as an id.

**Request body** (`reactivateWeighingAreasValidator` — new)

```jsonc
{
  "ids": ["3f1c…", "7ab2…"],   // lifecycleIds(): uuid, non-empty, duplicate-free
  "comment": "Weighing lane reopened"   // optional, nullable, trimmed, ≤ 1000 chars
}
```

**Responses**

| Status | Condition | Body |
| --- | --- | --- |
| 200 | Selection was valid (including the all-blocked case) | `{ "data": { "updatedWeighingAreas": WeighingAreaDto[], "blockedWeighingAreas": Blocker[] } }` |
| 401 / 403 | As above; **whole** submission denied, nothing changed | Standard errors |
| 422 | `ids` empty, containing duplicates, or containing a malformed identifier | Validation failure, **zero** weighing areas evaluated or changed |

```ts
type Blocker =
  | { id: string; reason: 'NOT_FOUND' }                    // no name — none was resolved
  | { id: string; name: string; reason: 'ALREADY_AVAILABLE' }
```

**Semantics**

- One transaction, `SELECT … FOR UPDATE` on the submitted rows, blockers computed against the
  locked state (FR-022), a single guarded `UPDATE` over the eligible ids, and an
  `affectedRows !== eligibleIds.length` assertion that rolls back rather than writing partially
  (FR-026, FR-027).
- All updated rows share one `reactivatedAt` / `reactivatedByUserId` / `reactivationComment`
  (FR-025); blocked rows are written to in no way (FR-023).
- An all-blocked submission is a **200 with an empty `updatedWeighingAreas`**, not a 4xx — it is a
  valid request whose entries all turned out ineligible (US2 scenario 5).
- `IN_USE` is unreachable: `findBulkBlockers` performs the usage lookup only when
  `expectedStatus === 'AVAILABLE'`.

---

## Requirement coverage and test posture

Three postures, per research D1. **RED** is genuinely test-first new behavior; **CHAR** is
characterization of existing correct behavior that is currently untested; **COVERED** needs no new
test.

| Requirement | Surface | Posture | Where |
| --- | --- | --- | --- |
| FR-001 policy allows both admin roles | Individual + bulk | COVERED / RED | `weighing_area_policy.spec.ts` asserts `reactivate`; bulk reuses it — assert on the new route |
| FR-002 deny unauthenticated / non-active / non-admin | Individual + bulk | CHAR / RED | `weighing_areas.spec.ts` (individual), new bulk integration spec |
| FR-003 only archived is eligible; no usage blocker | Both | RED | `bulk_reactivate.spec.ts` unit + integration |
| FR-004 `ALREADY_AVAILABLE` | Individual | CHAR | `weighing_areas.spec.ts` — 409 case |
| FR-004 `ALREADY_AVAILABLE` | Bulk | RED | New bulk specs |
| FR-005 `NOT_FOUND` | Individual | CHAR | `weighing_areas.spec.ts` — 404 case |
| FR-005 `NOT_FOUND` | Bulk | RED | New bulk specs |
| FR-006 status + actor + timestamp recorded | Individual | COVERED | `weighing_area_use_cases.spec.ts`, `weighing_areas.spec.ts` happy path |
| FR-006 | Bulk | RED | New bulk specs |
| FR-007 trim; blank → null | Individual | CHAR | Use case already trims; assert whitespace-only → `null` over HTTP |
| FR-007 | Bulk | RED | New bulk specs |
| FR-008 comment ≤ 1000 | Individual | **RED** | Validator change — the one behavior change to shipped code |
| FR-008 | Bulk | RED | New bulk specs |
| FR-009 identity/name/coords/createdAt preserved | Both | CHAR / RED | Assert on the returned DTO |
| FR-010 archive context preserved | Both | CHAR / RED | Assert `archivedAt`/`archiveComment` unchanged after reactivation |
| FR-011 reappears in available collection | Both | RED | Assert `GET /weighing-areas/available` includes it afterwards |
| FR-012 shift/weighing references intact | Both | RED | Integration, using `persisted_weighing_area_usage.ts` |
| FR-015 concurrency → exactly one | Both | RED | Guarded `UPDATE` + re-read; bulk row-lock test |
| FR-019 repeated archive ⇄ reactivate | Both | CHAR | Round-trip already partly covered by `weighing_areas.spec.ts` |
| FR-020 one comment for the whole submission | Bulk | RED | New bulk specs |
| FR-021 same right as individual | Bulk | RED | New bulk integration spec |
| FR-022 state assessed at submission | Bulk | RED | Blockers computed post-lock |
| FR-023 partial success | Bulk | RED | Mixed-selection matrix |
| FR-024 one reason per blocked entry | Bulk | RED | Mixed-selection matrix |
| FR-025 identical metadata across the submission | Bulk | RED | New bulk specs |
| FR-026 all-or-nothing on failure | Bulk | RED | Affected-row assertion → rollback |
| FR-027 no partial per-entry write | Bulk | RED | New bulk specs |
| FR-028 empty / duplicate / malformed rejected | Bulk | RED | Validator-level, asserting zero rows changed |
| FR-029 aggregate outcome | Bulk (UI) | RED | Toolbar toast — web tests |
| FR-035 nothing else changes | Both | RED | Assert name/coords untouched; no delete path exists |

FR-013, FR-014, FR-016 to FR-018, and FR-030 to FR-034 are user-experience requirements; their
contract is [weighing-area-reactivate-ui-state.md](./weighing-area-reactivate-ui-state.md).

---

## Typed client

Adding the route changes the committed Tuyau registry. `pnpm --filter api build` (or any ace
command running the `generateRegistry` hook in `adonisrc.ts`) regenerates
`apps/api/.adonisjs/client/registry/{index.ts,schema.d.ts,tree.d.ts}` and
`apps/api/.adonisjs/server/routes.d.ts` so that `tuyauQuery.weighingAreas.reactivateMany` exists.
Those files are committed; regenerating them is part of the implementation, not a build artifact to
be left out of the diff.
