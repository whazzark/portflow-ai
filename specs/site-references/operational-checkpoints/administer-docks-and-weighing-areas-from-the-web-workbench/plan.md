# Implementation Plan: Administer Docks and Weighing Areas From the Web Workbench

**Feature ID**: `GH-41` | **Date**: `2026-07-29` | **Spec**: `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/spec.md`

## Summary

Complete one authenticated `/checkpoints` workbench that lets every active user consult and independently search available or archived Docks and Weighing Areas, while Organization Admins and Operations Admins can create, edit, individually or collectively archive, and individually or collectively reactivate them.

The implementation extends the two existing named API vertical slices and adds one checkpoints web feature. A reversible migration adds an integer `version` to both resource tables. Update and lifecycle repositories use conditional, version-incrementing writes; grouped lifecycle operations lock and classify the submitted `{ id, expectedVersion }` items, commit every eligible transition, and return each blocked item without overwriting stale state. No generic Checkpoint entity or endpoint is introduced.

## Technical Context

- **Apps**: `apps/api` and `apps/web` in the PNPM/Turbo monorepo.
- **Runtime**: TypeScript and Node.js 22; AdonisJS/Lucid and PostgreSQL; TanStack Start/Router/Query/Table/Form, React, Tuyau, Zod, shadcn, Tailwind, and a vendored MapCN map component backed by `maplibre-gl`.
- **Testing**: Japa use-case and HTTP integration tests against the real Lucid repositories on in-memory SQLite; Vitest router-level feature tests with MSW; Playwright only where an authenticated real-stack journey is configured.
- **Existing API baseline**: `apps/api/app/docks/` and `apps/api/app/weighing_areas/` already provide create, list, available-list, single-resource GET, update, individual archive/reactivate, named policies/validators/transformers/repositories, migrations, factories, routes, and tests. GH-41 keeps those GET endpoints but the workbench opens details from list results rather than adding another read path.
- **Existing web baseline**: the customer workbench establishes URL-backed filter/detail state, TanStack Query/Tuyau mutations, shared forms, semantic accessible representations, selection toolbars, lifecycle dialogs, MSW feature tests, and authorization-aware affordances. There is no checkpoints route or feature yet.
- **Persistence**: existing `docks` and `weighing_areas` tables are retained. One reversible migration adds a non-null positive integer `version` with default `1`; functional name indexes, GPS checks, lifecycle metadata, and stable UUIDs remain.
- **Authorization**: authentication middleware remains responsible for active-session access. Dock and Weighing Area list/view policies expand to every active user; create/update/archive/reactivate remain restricted to `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`. The API is authoritative.
- **Concurrency**: every mutation of an existing resource submits its observed version. Conditional writes match ID, expected version, and required status and atomically increment the version. A stale mutation returns a typed outcome and changes nothing.
- **Bulk invariant**: each grouped command evaluates an ordered, distinct list of `{ id, expectedVersion }` items. Eligible items change; missing, stale, wrong-state, or in-use items remain unchanged and are returned with stable reasons. A blocked item never rolls back an eligible item.
- **Constraints**: case-insensitive name uniqueness is per resource table; latitude is `[-90, 90]`; longitude is `[-180, 180]`; lifecycle comments are optional, trimmed, null when blank, and limited to 1,000 characters.
- **Deferred integration**: the current schema cannot persist discharges or their operational-checkpoint references. GH-41 preserves `SiteReferenceUsageChecker`; GH-53 must replace the no-discharge production binding before it makes planned or active references durable.
- **Map integration**: install MapCN through its shadcn registry so the generated component is owned under `apps/web/src/components/ui/map.tsx`; retain `maplibre-gl` as the runtime dependency and use MapCN's default light/dark CARTO basemap styles with required attribution. The MapCN canvas mounts only on the client, while the route and synchronized list remain SSR-safe.
- **Out of scope**: operational selection during discharge preparation, map editing or geocoding, custom tile hosting, server pagination/full-text search, permanent deletion, a generic Checkpoint entity/API, unrelated site references, and implementing the GH-53 discharge model.

## Constitution Check

- **I. Versioned intent**: all behavior is traced to GH-41 and its clarified `spec.md`; design details remain in this feature directory.
- **II. Coherent delivery**: the scope is one operational-checkpoints workbench over two intentionally paired references. It reuses GH-39/GH-40 behavior and does not absorb discharge preparation.
- **III. Human gates**: no unresolved product choice is hidden in the plan; the reviewed spec remains authoritative and implementation requires plan approval.
- **IV. Test-first behavior**: each update, lifecycle, authorization, grouped-result, search, and stale-state behavior starts at an observable API or router-level RED seam.
- **V. Explicit boundaries**: use cases interpret business outcomes, repositories own conditional writes/transactions/locks, policies authorize, controllers adapt HTTP, and the web slice translates named Tuyau contracts into view state.
- **VI. Durable knowledge**: Checkpoint, Dock, Weighing Area, GPS location, available/archived state, and reactivation follow `CONTEXT.md`; no new durable architectural decision is required.
- **VII. Verification**: focused suites, migration checks, `pnpm check`, `pnpm typecheck`, `pnpm test`, relevant browser validation, Spec Kit analysis, and convergence remain required.
- **VIII. Secure and reversible**: protected HTTP tests prove authorization, stale writes are conditional, grouped writes are transactional, and the additive version migration has a rollback.

No constitution exception or unresolved clarification remains.

## Existing Baseline and Planned Delta

| Area | Existing implementation | Planned GH-41 work |
|---|---|---|
| Persistence | Separate tables already hold UUID, name, GPS coordinates, status, lifecycle actor/time/comment metadata, timestamps, name indexes, and coordinate checks. | Add positive `version` defaulting existing rows to `1`; update generated schema/models/factories and increment it on every successful existing-resource mutation. |
| API reads | Named list, available-list, and single-resource GET routes exist. Full list policy currently requires an admin; transformers expose actor IDs only. | Allow every active user to list/view; preload and return lifecycle actor summaries and version in both named DTOs. Keep the existing GET routes, but use list payloads for workbench details. |
| API writes | Create/update and individual lifecycle routes validate, normalize, enforce uniqueness/status, and call the shared usage boundary. Writes do not carry an observed version. | Require `expectedVersion` for update/archive/reactivate; return resource-specific stale `409` errors that require refetch; make resource-state changes conditional and atomic in the repository while preserving the usage-checker boundary. |
| Grouped lifecycle | No grouped Dock or Weighing Area endpoints or use cases exist. | Add static `/archive` and `/reactivate` commands for each resource, ordered `{ id, expectedVersion }` items, transactional partial success, stable blockers, controller DTOs, and Tuyau route names. |
| Web | Sidebar has a disabled Checkpoints item; no route, queries, mutations, forms, map, or tests exist. | Link `/checkpoints`; add one isolated feature slice composing distinct Dock/Weighing Area clients, URL-backed map filters, map/list representations, forms/sheets, permissions, individual/grouped lifecycle, stale reload, partial-result feedback, and tests. |
| Usage blocking | `SiteReferenceUsageChecker` supports `DOCK` and `WEIGHING_AREA`; production uses the temporary no-discharge implementation. | Preserve the boundary and test both used/unused outcomes. GH-53 retains responsibility for the persistence-backed adapter before durable discharge references ship. |

## Design

### Domain and data model

Keep Dock and Weighing Area as separate Lucid application entities with stable UUID identity, required normalized name, exact GPS point, `AVAILABLE`/`ARCHIVED` status, lifecycle metadata, timestamps, and same-type case-insensitive uniqueness. A Dock and Weighing Area may share a name.

Add `version` to both tables using one reversible, SQLite/PostgreSQL-compatible migration. Existing rows become version `1`; creation explicitly or by default starts at `1`. Every successful update, archive, or reactivation changes business state and increments the version exactly once. Rejected validation, authorization, duplicate, usage, wrong-state, not-found, or stale attempts do not update timestamps or versions.

Repositories receive `Command` types containing `expectedVersion` for individual existing-resource mutations. Conditional writes filter by `id`, `version`, and the required status, set the requested values and timestamp, and use a database expression to increment `version`. When no row changes, the repository reads the current row to distinguish `NOT_FOUND`, `STALE_VERSION`, and wrong-state results; use cases map those typed results to named exceptions.

Grouped archive/reactivation use cases obtain archive-usage facts through `SiteReferenceUsageChecker`, then pass the ordered command and those facts to the named resource repository. Repository methods open a transaction, lock all found requested rows in deterministic ID order, classify ordered items, and update only eligible rows. Classification precedence is `NOT_FOUND`, `STALE_VERSION`, wrong lifecycle state, then `IN_USE` for archive. Each eligible update remains conditional on the locked version/status and increments its version. Changed and blocked result arrays preserve request order within each category. Empty, duplicate-ID, malformed-ID, or invalid-version input is a request-level `422`.

Dock and Weighing Area models gain `archivedBy` and `reactivatedBy` relations following the customer precedent. Named list and mutation queries preload those relations so transformers can emit safe user summaries without client joins; the detail sheet uses the selected list item and does not fetch a single resource.

### API and application boundaries

- Keep separate `DockPolicy` and `WeighingAreaPolicy`; change list authorization to active-user consultation and keep all mutations admin-only.
- Extend Vine validators with positive integer concurrency fields, distinct versioned item arrays, and the established trimmed 1,000-character lifecycle-comment rule.
- Keep input normalization and domain result mapping in the named use cases. Add grouped archive/reactivate use cases per resource; do not route through customer code or a generic controller.
- Extend repository abstractions and Lucid implementations with version-aware command/result unions and grouped partial-result DTOs. Shared, resource-neutral helpers may live under `app/site_references/shared/` only for true mechanics such as distinct versioned-item validation or lifecycle blocker types; resource labels and result names stay in their slices.
- Add `archiveMany` and `reactivateMany` controller actions for each resource. Controllers capture the authenticated actor and server time, transform updated named resources, and leave display wording to the web adapter.
- Register `/archive` and `/reactivate` before the existing `/:id` routes, retaining `/api/v1/docks`, `/api/v1/weighing-areas`, their existing single-resource GET routes, and the existing Tuyau namespaces. The workbench does not depend on those GET routes because its detail sheet uses list payloads.
- Individual stale writes return `409` with `E_DOCK_STALE_VERSION` or `E_WEIGHING_AREA_STALE_VERSION` and no replacement version token. Grouped stale items are ordinary blockers in a `200` partial-result contract. Both paths require a refetch before retry.
- Preserve shared `401`, `403`, `404`, `409`, and `422` envelopes. A grouped mixed result is never encoded as a request-level conflict.
- Continue binding `SiteReferenceUsageChecker` through the provider. Its temporary no-discharge implementation is valid only until GH-53 introduces durable planned/active references.

### Frontend boundaries

- Add thin `apps/web/src/routes/_authenticated/checkpoints.tsx` route composition with a Zod search schema and list preloading. The feature owns screen behavior under `apps/web/src/features/checkpoints/`.
- Store visible resource types plus independent Dock and Weighing Area name-search, lifecycle-status, and sorting state in the URL. Store named detail type, resource ID, and create/view/edit mode in the URL. Changing one resource's search preserves that resource's lifecycle status and does not alter the other resource's state. Ephemeral selection, dialogs, comments, and result summaries remain feature-local. The route loader preloads both named lists into the same TanStack Query cache used by the page.
- Use distinct Tuyau query/mutation options and query keys for Docks and Weighing Areas. A small feature-local adapter may normalize both DTOs into a discriminated workbench view model, but it must retain `kind`, named request builders, and resource-specific error handling.
- Reuse `useAppForm`, registered fields, `applyValidationError`, `FormError`, `SubmitButton`, shadcn primitives, and existing theme tokens. Keep latitude/longitude as explicit form strings until validated and adapted to numbers so a blank value never coerces to zero; use decimal input hints and accept legal zero/boundary values. A resource-aware edit submits the version captured when it opens.
- Add MapCN's `@mapcn/map` registry component to the owned shadcn UI layer, which installs `maplibre-gl`; do not introduce a second React map wrapper. Render it in a hydration-safe client boundary using MapCN's default theme-aware CARTO styles, preserve visible attribution, and show a recoverable map-unavailable state when styles or tiles cannot load.
- Render MapCN markers from the latitude/longitude fields with distinct Lucide marker contents for Docks and Weighing Areas. The visible-type filter composes the two independently filtered result sets; each type's URL-backed status, search, and sort state affects only that type. Color only reinforces icon, label, and textual lifecycle state.
- Provide an accessible list representation synchronized with visible map markers so keyboard and screen-reader users can inspect and select resources without relying on map interaction.
- Only admins see create, edit, row selection, lifecycle, and grouped action controls. This is ergonomic UI policy; API authorization remains authoritative and API failures remain visible.
- Scope selection to the visible resource type/status/filter and clear it on any scope change. Grouped requests submit each selected row's current version as `expectedVersion` and show an inline announced outcome that lists every changed and unchanged resource rather than relying on a summary toast. Clear changed IDs; retain only still-visible blocked IDs, and disable stale retry until an explicit refetch supplies current versions.
- On individual stale errors, invalidate the affected named queries, leave the authoritative state untouched, close unsafe mutation state, and offer an explicit reload/latest-data action. Never silently substitute the server's current version and retry.
- Invalidate list and available caches only for the mutated named resource. Keep loading/error/empty/stale-detail states recoverable and preserve entered input on network or validation failures where safe.
- Update the sidebar Checkpoints item to `/checkpoints`; do not create separate top-level Dock and Weighing Area pages.

### Test strategy

- **Migration/repository**: prove existing rows start at version `1`, successful conditional writes increment once, stale writes affect zero rows, name indexes stay separate, coordinate checks remain, and rollback/re-run succeeds on supported test/runtime databases.
- **API use cases**: drive RED tests for normalization, validation defense, read-only archives, actor/comment metadata, usage blocking, version mismatch, same-type uniqueness, cross-type same-name allowance, and partial grouped outcomes for both resource slices.
- **HTTP integration**: for each protected endpoint cover unauthenticated, observer/admin authorization, validation, named DTO shape, route ordering, successful mutation, duplicate/wrong-state/in-use/stale errors, grouped request validation, mixed outcomes, ordering, and unchanged blockers.
- **Web feature**: render through the real router/providers with MSW. Keep filtering/selection and the accessible synchronized list testable without WebGL, and cover URL-restored independent per-type state, name-only substring search, distinct type icons, status filtering, observer read-only behavior, GPS create/edit forms, marker/list-backed detail sheets, individual lifecycle, filtered selection, mixed grouped results, stale reload behavior, cache invalidation, loading/retry/empty/map-unavailable states, accessible names, keyboard flow, and narrow-screen containment.
- **TDD checkpoints**: implement one observable slice at a time: persistence/concurrency foundation; Dock API; Weighing Area API; consultation shell; Dock administration; Weighing Area administration; grouped/stale UX; responsive/accessibility regressions.
- **Browser**: run a real authenticated checkpoints journey if the Playwright seam becomes configured before delivery; otherwise record the absence and use the API integration plus router-level feature suites as the automated seams.

## Repository Changes

```text
apps/api/database/migrations/*_add_operational_checkpoint_versions.ts
apps/api/database/schema.ts
apps/api/app/models/dock.ts
apps/api/app/models/weighing_area.ts
apps/api/app/docks/
  archive/ create/ list/ reactivate/ shared/ show/ update/
apps/api/app/weighing_areas/
  archive/ create/ list/ reactivate/ shared/ show/ update/
apps/api/app/site_references/shared/
  versioned lifecycle validation/result helpers only where genuinely shared
apps/api/app/controllers/docks_controller.ts
apps/api/app/controllers/weighing_areas_controller.ts
apps/api/start/routes.ts
apps/api/database/factories/dock_factory.ts
apps/api/database/factories/weighing_area_factory.ts
apps/api/tests/unit/docks/
apps/api/tests/unit/weighing_areas/
apps/api/tests/integration/docks.spec.ts
apps/api/tests/integration/weighing_areas.spec.ts

apps/web/src/components/layout/app-sidebar.tsx
apps/web/src/components/ui/map.tsx
apps/web/src/routes/_authenticated/checkpoints.tsx
apps/web/src/features/checkpoints/
  __tests__/
  helpers/
  mutations/
  queries/
  ui/
  types.ts

specs/site-references/operational-checkpoints/
  administer-docks-and-weighing-areas-from-the-web-workbench/
    plan.md
    research.md
    data-model.md
    contracts/api.md
    contracts/ui.md
    quickstart.md
```

The API directories contain existing seams. Implementation must start with failing tests and alter only the contract-divergent portions rather than rewriting already-correct create/list/lifecycle behavior.

## Risks and Rollout

- **Concurrency classification drift**: define one documented precedence and typed result vocabulary per named slice; integration tests must prove stale intent never becomes an `ALREADY_*` retry or successful overwrite.
- **Bulk version safety**: accept `{ id, expectedVersion }` items rather than IDs, lock found rows in deterministic ID order, preserve request ordering, and fail the operation on an impossible post-lock affected-row mismatch.
- **Usage race and deferred persistence**: current production has no durable usage rows, so the checker facts cannot race with an assignment write. GH-53 must replace the temporary adapter and make usage inspection plus lifecycle mutation one transactionally consistent workflow before it introduces persistent planned/active relationships.
- **SQLite/PostgreSQL divergence**: keep the additive migration and version increment expression portable; use real Lucid repositories in tests and validate the migration against disposable PostgreSQL before delivery.
- **Tuyau contract churn**: add named endpoints and DTO fields, regenerate route types through normal build/typecheck flows, and keep Dock/Weighing Area response names explicit.
- **UI abstraction risk**: share only workbench mechanics inside `features/checkpoints`; retain discriminated resource kinds and named client adapters so errors, cache keys, copy, and future rules cannot cross silently.
- **Map dependency, SSR, and tile availability**: own the MapCN registry output, pin `maplibre-gl` through the lockfile, isolate browser-only canvas initialization from TanStack Start SSR, preserve CARTO attribution, and keep the synchronized list usable when WebGL, styles, or external tiles are unavailable.
- **Map accessibility and density**: use distinct icons and text labels in addition to color, keep the synchronized accessible list as a keyboard/screen-reader seam, verify common breakpoints and keyboard access, and avoid a second mobile-only source of interaction truth.
- **Rollout**: the migration is additive and existing clients may ignore `version` in responses, but all existing-resource mutation requests become contractually versioned. API and web changes must deploy together.
- **Rollback**: revert web/API behavior first, then roll back the version-column migration only after no deployed client depends on versioned mutations. No Dock or Weighing Area row is deleted.

## Acceptance Traceability

| Requirement / scenario | Observable verification | Implementation seam |
|---|---|---|
| FR-001; FR-001a; US1 scenario 1 | Authenticated route tests load both types and statuses, filter visible map markers, expose list-backed detail/empty/error states, and verify sidebar navigation | Named list controllers and `/checkpoints` map feature |
| FR-002; US1 scenarios 1–3 | Policy and protected HTTP tests plus observer workbench tests | Auth middleware, Dock/Weighing Area policies, permission-derived UI |
| FR-003 | Create/update tests cover required/blank/malformed/out-of-range fields, database checks, read-only archives, and no-change failures | Vine validators, use cases, repositories, GPS form |
| FR-003a | Same-type case-variant conflicts and cross-type same-name success tests | Functional unique indexes, duplicate result mapping |
| FR-003b | Router-level tests restore type/status/search state and match name substring case-insensitively across visible markers | Route Zod schema, map filter/search adapter, accessible marker list |
| FR-004 | Individual and grouped archive tests cover `IN_USE`; reactivation preserves ID/history and returns to available selections | Usage checker, lifecycle repositories/use cases, UI dialogs |
| FR-005 | UI/API tests prove individual create/edit and individual plus selection-scoped grouped lifecycle actions | Named controllers/routes, selection toolbar, details sheet |
| FR-005a | Mixed-result tests prove eligible version increments, unchanged blockers, one result per item, and request ordering | Grouped repositories/use cases/DTOs and partial-result UI |
| FR-006 | Lifecycle tests prove server actor/time capture and optional trimmed/null/1,000-character comments | Controllers, validators, models/relations, transformers, UI |
| FR-007; edge case | Competing mutation tests prove `409`/`STALE_VERSION`, zero stale writes, version increments, explicit UI reload, and no automatic retry | Version migration, conditional repositories, exceptions, web adapter |
| SC-001 | Focused API and web suites plus documented manual/browser validation cover every scenario | `quickstart.md` and test directories |
| SC-002 | Constitution re-check, named boundaries, authorization integration tests, and analysis/convergence | Plan boundaries, ADR-aligned slices, final delivery gates |

## Post-Design Constitution Check

All initial checks remain satisfied. Phase 1 introduces one reversible migration, explicit named API/UI contracts, and a replaceable MapCN/MapLibre presentation dependency with external CARTO basemap requests; attribution, SSR isolation, failure fallback, lockfile pinning, and removal are documented. It introduces no new source-of-truth rule, durable domain term, or authorization exception. Optimistic concurrency is enforced at the repository write boundary and surfaced through use-case/controller contracts; the UI remains an adapter. The single checkpoints feature may share presentation mechanics internally because Dock and Weighing Area are intentionally grouped by the domain interface category, while their API entities, policies, repositories, cache keys, and error contracts remain separate.
