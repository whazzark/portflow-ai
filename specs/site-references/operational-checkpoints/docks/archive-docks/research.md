# Phase 0 Research: Archive Docks

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No `[NEEDS CLARIFICATION]` markers remain in the Technical Context; this document records the
design decisions made while resolving how the spec's requirements map onto the existing codebase.

## D1 — The individual archive backend is reused verbatim, not touched

**Decision**: Ship this slice's individual-archive path by wiring the frontend to the existing
`POST /api/v1/docks/:id/archive` endpoint. No change to `archive_dock_use_case.ts`,
`dock_validator.ts`'s `archiveDockValidator`, `dock_policy.ts`'s `archive`, or
`LucidDockRepository.archiveAvailable`.

**Rationale**: Issue #178 ("Add dock reference administration") already delivered this endpoint
with the same rules this spec restates: eligibility via `SiteReferenceUsageChecker`
(`referenceType: 'DOCK'`), `DockAlreadyArchivedException`, `DockInUseException`,
`DockNotFoundException`, optional trimmed comment, and lifecycle metadata (`archivedAt`,
`archivedByUserId`, `archiveComment`). `apps/api/tests/unit/docks/dock_use_cases.spec.ts` already
covers the eligible, in-use, and already-archived cases at the use-case level. Re-implementing or
even editing this file for a spec that asks for the same behavior would be pure risk with no
behavioral gain.

**Gap found**: `apps/web/src/features/docks/mutations/use-dock-mutations.ts` has no `archive`
mutation, and no UI component calls the endpoint — confirmed by grepping the entire `apps/web`
tree for `docks.archive` and finding only the checkpoints-page's unrelated `create` usage. There is
also no HTTP-level (Japa integration, not unit) test of the individual archive endpoint — a real
gap, since only the use case is exercised in isolation today.

**Alternatives considered**: Rewriting the endpoint to also accept the future bulk shape (e.g.
`ids: [id]`) — rejected, because it would touch already-correct, already-tested production code for
no behavioral change, and would diverge from the Customer precedent, which also keeps its
`/:id/archive` and `/archive` (many) endpoints separate.

## D2 — Extract the bulk-lifecycle validator pieces into the shared site-reference module

**Decision**: Move the `distinctUuids` rule and the `lifecycleIds`/`lifecycleComment` factory
functions out of `apps/api/app/customers/shared/customer_validator.ts` and into
`apps/api/app/site_references/shared/site_reference_validator.ts`, alongside the existing
`nonBlank` rule. `customer_validator.ts` is updated to import and use them instead of its local
copies (no behavior change — same rule names, same messages, same validators produced).
`dock_validator.ts` imports the same factories to build `archiveDocksValidator`.

**Rationale**: `nonBlank` already lives in the shared site-reference module because it is a rule
every site reference's name validation needs. The bulk-lifecycle shape (`ids`: non-empty,
UUID-format, case-insensitively distinct array; `comment`: optional, trimmed, ≤1000 chars) is
exactly as reusable — Dock needs the identical rule today, and Weighing Area / Warehouse Door /
Truck will need it the moment any of them gets a bulk lifecycle action. Leaving it in
`customer_validator.ts` and having `dock_validator.ts` redeclare an equivalent `distinctUuids` rule
would be the second copy of the same 12 lines, which is exactly what the shared module exists to
prevent (constitution VI).

**Alternatives considered**: Duplicate the rule directly in `dock_validator.ts` (fastest, but
creates the duplication the shared module is for, and the fork would drift silently the next time
one of them changes); introduce a `#site_references/shared/bulk_lifecycle_validator.ts` as a new
file (unnecessary extra indirection for ~15 lines that fit naturally next to `nonBlank`).

## D3 — The bulk backend copies the Customer bulk-archive shape file-for-file

**Decision**: `dock_lifecycle_blockers.ts`, `archive_docks_use_case.ts`,
`LucidDockRepository.archiveAvailableMany`, and `DocksController.archiveMany` each mirror their
Customer counterpart's structure and behavior, substituting Dock's fields (`name` in place of
`code`/`companyName`) and its existing `DOCK` usage-checker reference type.

- `findBulkBlockers` takes the same `(ids, docksById, expectedStatus, usedIds?)` shape so it stays
  reusable by dock reactivation (#201) exactly as the Customer version already serves both archive
  and reactivate.
- `archiveAvailableMany` runs inside one `Dock.transaction`, locks the candidate rows with
  `.forUpdate()`, computes blockers from the locked snapshot plus one bulk usage-checker call
  (`referenceIds: command.ids`), then updates only the eligible ids with a single
  `WHERE id IN (…) AND status = 'AVAILABLE'` — the same statement shape that gives the Customer
  version its concurrency guarantee (a row locked by one transaction is invisible to a second
  transaction's `forUpdate()` until the first commits, so the second transaction's own blocker
  computation sees the now-archived status and reports `ALREADY_ARCHIVED` instead of double
  archiving it).
- The controller method reuses the existing `DockPolicy.archive` check — no new policy method,
  matching how `archiveMany` on the Customer controller reuses `CustomerPolicy.archive` rather than
  defining an `archiveMany` policy action.

**Rationale**: This is the same business rule (archive an eligible dock, individually or in bulk)
applied through a proven, already-reviewed, already-tested shape. Inventing a different bulk
pattern for Dock would add a second bulk-lifecycle idiom to the codebase for no reason, making the
eventual #201 (bulk reactivate) and any future bulk action on another site reference harder to
place.

**Alternatives considered**: A queue-based or per-id-independent-transaction bulk archive —
rejected; it would weaken the partial-success guarantee (FR-010) and diverge from the proven
locking strategy without a demonstrated need at the stated scale (SC-009: 100 ids within 5s).

## D4 — Multi-select lives as a map mode, not a second (table) dock surface

**Decision**: Add a `selecting=docks` search param to the existing `/checkpoints` route. While
active: dock markers gain a checkable state (new `checked` prop on `CheckpointMarker`, additive to
the marker's existing `selected`-driven styling); clicking a dock marker toggles it in a
`Set<string>` instead of opening the details sheet; weighing-area markers and the existing
`checkpoint=<kind>:<id>` single-selection contract are untouched; a new `BulkArchiveDocksActions`
bar (the archive-only counterpart of `bulk-lifecycle-actions.tsx`) appears once the set is
non-empty.

**Rationale**: #197–#199 established the checkpoints map as the one canonical place docks are
consulted, created, and edited — #199's own plan explicitly rejected building a second
map-editing mechanism to avoid two disagreeing sources of "where is this dock." A table-based bulk
surface (the Customer pattern, transplanted wholesale) would reopen exactly that problem: an
administrator would need to remember whether to bulk-archive from the map or from a list, and the
list would need its own search/status filtering that `checkpoint-search.ts` already provides on the
map. A map-native selection mode keeps one surface and reuses the existing search/status/kind
filters unchanged.

**Alternatives considered**:
- *A dedicated `/docks` table page, mirroring `/customers`* — rejected for the reason above; also a
  meaningfully larger surface (new route, new table component, new pagination/sorting) for a
  capability the issue scopes to archiving, not general dock browsing.
- *Reuse the existing single `checkpoint` param as a list by changing its type* — rejected; it is
  consumed by view and edit mode as a single resource today (`selectedCheckpoint`,
  `selectedDock`), and overloading it to sometimes mean "one" and sometimes "many" would ripple into
  every consumer of `checkpoint-selection.ts` for no benefit over a second, purpose-built param.
- *Teach `resource-map-placement.tsx` / `resource-map-workspace.tsx` about multi-select* —
  rejected; those primitives are resource-agnostic and shared with future Weighing Area /
  Warehouse consumers (#199's constraint). Multi-select-for-archiving is a Dock-specific,
  view-mode concern, not a placement concern, so it belongs in `CheckpointMap`/`CheckpointMarker`
  (already Dock/Weighing-Area-specific) rather than in the shared placement layer.

## D5 — Concurrency: row locking + partial success, no optimistic-locking prompt

**Decision**: Same as #199's D6 for updates and the Customer bulk archive's existing behavior: the
database transaction and `SELECT … FOR UPDATE` are the only concurrency control. There is no
version field, no `If-Match`, and no "someone else changed this" prompt surfaced to the
administrator. Two overlapping requests for the same dock resolve to exactly one archive and one
`ALREADY_ARCHIVED` blocker; a request for a dock a discharge started using after the selection was
built resolves to one `IN_USE` blocker computed at submission time, not at selection time.

**Rationale**: This is FR-016's requirement (exactly one success per dock under concurrent
attempts) satisfied by the same mechanism already shipped, load-tested in spirit, and reviewed for
Customer. Introducing a different concurrency story for Dock would be an unjustified divergence.

**Alternatives considered**: Optimistic locking with a version/If-Match header — rejected as
unnecessary scope; archiving is a one-way, single-field transition where "the other administrator's
change wins, and I find out by seeing my request blocked" is an acceptable, already-established
outcome (see spec Assumptions).

## D6 — `DockLifecycleActions` and `BulkArchiveDocksActions` are archive-only, not bidirectional

**Decision**: Unlike `customers/ui/lifecycle-actions.tsx` and `bulk-lifecycle-actions.tsx`, which
branch on `isArchived` to offer both Archive and Reactivate, the Dock equivalents offer **only**
Archive. `dock-details.tsx` renders `DockLifecycleActions` solely when `dock.status === 'AVAILABLE'`
and renders nothing lifecycle-related for an archived dock. The "Select docks" mode and
`BulkArchiveDocksActions` are only ever offered for the `available` status filter.

**Rationale**: Spec FR-020 and the roadmap both scope reactivation to #201 as an independently
deliverable sibling issue. `ArchiveDockUseCase`/`ReactivateDockUseCase` already exist as separate
use cases on the backend (unlike Customer, where both were delivered together); the frontend should
mirror that boundary rather than pre-building reactivate UI this issue doesn't own and #201 would
then have to unpick or extend. When #201 ships, it can either extend `DockLifecycleActions` to
branch like the Customer version or add its own reactivate-only sibling — that choice is left to
#201's own plan.

**Alternatives considered**: Build the bidirectional component now, "since #201 is coming soon
anyway" — rejected; it would deliver unrequested, unreviewed reactivate UI ahead of its own spec and
tests, violating constitution II (one independently deliverable feature per spec).
