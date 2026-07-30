# Implementation Plan: Administer Docks and Weighing Areas From the Web Workbench

**Feature ID**: `GH-41` | **Date**: `2026-07-30` | **Spec**: `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/spec.md`

## Summary

Add an administrator-only `/checkpoints` workbench to `apps/web`, reusing the Dock and Weighing Area APIs delivered by GH-39 and GH-40. One shared screen shell owns navigation, URL state, tables, detail/form presentation, confirmation, and feedback; explicit per-resource adapters select the separate Tuyau routes, field labels, and DTOs without creating a generic backend entity.

The API remains the source of truth for role authorization, validation, uniqueness, lifecycle transitions, and planned/active-discharge usage. Start each implementation slice with a failing observable test, add only the minimum behavior to make it pass, then refactor while green. No migration or new service endpoint is expected unless the baseline audit proves an existing contract cannot satisfy the approved specification.

## Technical Approach

### Existing baseline

- `apps/api/app/docks/` and `apps/api/app/weighing_areas/` already expose named create, list, available-list, detail, update, archive, and reactivate use cases and HTTP routes.
- Both resources already persist stable IDs, normalized unique names, GPS coordinates, lifecycle status, archive/reactivation metadata, and optional comments.
- Both policies already reserve full list and mutation access for `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN`; available-list and detail endpoints remain available to other active users for operational consumers.
- `apps/web/src/features/customers/` provides the closest project-native pattern for URL-backed administration tables, detail sheets, forms, lifecycle confirmations, cache invalidation, accessible feedback, and MSW-backed feature tests.
- `apps/web/src/components/layout/app-sidebar.tsx` already declares a Checkpoints navigation item without a route.

### Web workbench

- Add a thin authenticated route at `apps/web/src/routes/_authenticated/checkpoints.tsx` that validates and normalizes `resource`, `status`, `q`, `sort`, `detail`, and `mode` search parameters before composing a feature-owned screen.
- Add `apps/web/src/features/checkpoints/` as one vertical slice. A discriminated Dock/Weighing Area configuration selects typed Tuyau operations and adapts transport DTOs to a shared presentation shape; it does not erase the distinct transport or business types.
- Default to `resource=docks`, `status=available`, empty search, and ascending name sort. Keep create, view, and edit state in the URL only when valid for the selected resource and lifecycle view.
- Reuse the established table, tabs, sheet, form, confirmation-dialog, alert, empty-state, skeleton, status, and toast primitives. On narrow screens, preserve labeled actions and present records without horizontal page overflow.
- Query the administrator list for the selected type, split available and archived views client-side from the authoritative status, and perform case-insensitive name filtering and deterministic name sorting in the UI. Query detail independently so direct links and stale list entries resolve authoritatively.
- Keep form models explicit for `name`, `latitude`, and `longitude`. Convert form text to the typed transport payload at the feature adapter and map stable API validation or business errors back to fields or actionable screen feedback.
- Use individual create, update, archive, and reactivate mutations. On settlement, invalidate the affected resource's administration and available-list queries, refresh open detail data, close modes made invalid by the resulting status, and restore focus to the initiating control.

### API boundary

- Preserve the separate `/api/v1/docks` and `/api/v1/weighing-areas` route families and their Tuyau names; do not add `/api/v1/checkpoints`.
- Confirm with focused tests that both administrator roles can list and mutate, other roles cannot use administration endpoints, archived records are read-only, coordinate/name validation is field-addressable, duplicate names have stable conflicts, and lifecycle failures remain distinct.
- Preserve `SiteReferenceUsageChecker` as the archive-rule boundary. The workbench must render `IN_USE` outcomes, while GH-53 and GH-54 remain responsible for replacing/extending `NoDischargeSiteReferenceUsageChecker` when the corresponding planned/active relationships become persistent.
- Keep use-case decisions outside controllers, persistence mechanics in repositories, HTTP adaptation in controllers/transformers, and transport-to-view translation in the web feature.

## Affected Boundaries

| Boundary | Planned effect |
|---|---|
| Authenticated routing and navigation | Make the existing Checkpoints navigation item link to `/checkpoints`; enforce an administrator route experience and normalized URL state. |
| Web feature slice | Add shared workbench composition plus explicit Dock and Weighing Area query, mutation, form, and view adapters. |
| API contracts | Reuse named routes and DTOs; change only if focused contract tests expose a spec-required gap. |
| Authorization | Retain API-authoritative policies and add route/UI affordance tests for both administrator roles and non-administrators. |
| Persistence | Reuse existing tables, constraints, lifecycle fields, and usage-checker boundary; no migration expected. |
| Tests | Add route/provider feature tests with MSW, focused API regression coverage where missing, and the affected authenticated browser journey. |

## Constitution Check

- **I. Versioned intent**: GH-41 behavior is defined in the canonical `spec.md`; the issue remains intake and coordination only.
- **II. Coherent delivery**: one Checkpoints administration flow groups two related references at the UI boundary while preserving their independent domain and API contracts.
- **III. Human gate**: this standard delivery requires Ready-to-build approval tied to the current spec and plan hashes before implementation.
- **IV. Test-first behavior**: every slice begins at an observable API, route, feature, or browser seam and follows RED → GREEN → REFACTOR.
- **V. Deep boundaries**: API use cases retain business decisions; repositories retain persistence; controllers retain HTTP adaptation; the web feature owns transport-to-view translation.
- **VI. Durable knowledge**: no new durable domain term or architecture decision is introduced; the plan references `CONTEXT.md` and existing ADRs.
- **VII. Verification**: focused tests, fresh independent review, repository checks, and the affected browser flow remain delivery gates.
- **VIII. Secure and reversible**: authorization remains enforced and tested at HTTP boundaries, no destructive persistence change is planned, and rollback is code-only.

No constitution exception is required.

## Risks and Rollback

- **Accidental generic checkpoint model**: constrain sharing to UI presentation and discriminated adapters; retain separate API calls, DTOs, cache keys, identities, validation, and tests.
- **Authorization mismatch**: full administration lists are administrator-only while available/detail endpoints have broader operational consumers. The route uses administrator affordances, but protected HTTP tests remain authoritative.
- **Stale URL or cache state**: normalize incompatible search parameters, query detail independently, invalidate both administration and available-selection caches after mutation, and refresh after conflicts.
- **Lifecycle usage gap before discharge persistence**: keep the usage-checker boundary and blocked-outcome tests. GH-53/GH-54 must replace the temporary adapter atomically when their relationships become durable.
- **Coordinate input ambiguity**: use explicit latitude and longitude labels, geographic range hints, and field-level errors; do not add map or geocoding behavior.
- **Responsive and accessible density**: keep actions labeled, manage sheet/dialog focus, announce feedback, preserve contrast, and test narrow layouts without horizontal page scrolling.
- **Rollback**: revert the `/checkpoints` route, navigation link, and `features/checkpoints` slice. Existing Dock and Weighing Area APIs and persisted records remain intact; no data rollback is required.

## Acceptance-to-Test Mapping

| Acceptance / requirement | Observable test |
|---|---|
| US1 scenarios 1–4; FR-001–FR-004 | Router/provider feature tests verify resource and lifecycle switching, search, sort, detail, direct URL restoration/normalization, and loading/error/empty states for both types. |
| US2 scenarios 1–2; FR-005–FR-006 | MSW-backed workbench tests plus focused HTTP tests create and update each resource and prove identity/status preservation and cache refresh. |
| US2 scenarios 3–4; FR-007 | Form and HTTP tests cover blank/overlong/duplicate names, absent/out-of-range coordinates, field mapping, and archived read-only behavior. |
| US3 scenarios 1–2; FR-008, FR-010 | Lifecycle feature and HTTP tests verify confirmation, optional-comment normalization, metadata display, identity preservation, availability changes, and focus return. |
| US3 scenarios 3–4; FR-009, FR-011 | Use-case/HTTP tests inject used and unused references; feature tests cover in-use, already-transitioned, not-found, stale detail, invalidated queries, and no false success. |
| Authorization; FR-012; SC-002 | Policy and protected HTTP tests cover both admin roles, unauthenticated users, and active non-admins; route/UI tests cover inaccessible workbench affordances. |
| Failure cases; FR-013 | Feature tests verify retry, preserved form input, field/general errors, keyboard operation, dialog/sheet focus, announcements, and responsive no-overflow behavior. |
| FR-014; SC-001–SC-006 | Focused API/web suites and the authenticated Checkpoints browser flow exercise both resources before the full verification commands run. |

## Verification

- Run focused API tests for Dock and Weighing Area policies, use cases, and HTTP administration contracts.
- Run focused web route and feature tests for Checkpoints with the real router/providers and MSW transport handlers.
- Run the affected authenticated Checkpoints browser journey at desktop and narrow viewport widths.
- Before review completion, run `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm test:spec-kit`.
- Obtain a fresh read-only Codex review after implementation, resolve every confirmed finding, then rerun affected verification.

## Implementation Slices

- [x] S01: An authorized administrator can reach `/checkpoints` from navigation, while invalid or unauthorized route and URL states resolve safely.
- [x] S02: An administrator can browse, search, sort, inspect, and recover the available and archived Dock views.
- [x] S03: An administrator can browse, search, sort, inspect, and recover the available and archived Weighing Area views.
- [x] S04: An administrator can create and correct an available Dock with accurate field and conflict feedback.
- [x] S05: An administrator can create and correct an available Weighing Area with accurate field and conflict feedback.
- [x] S06: An administrator can archive or reactivate one Dock and recover from blocked or stale lifecycle outcomes without false success.
- [x] S07: An administrator can archive or reactivate one Weighing Area and recover from blocked or stale lifecycle outcomes without false success.
- [ ] S08: The complete Checkpoints flow is keyboard-accessible, focus-safe, responsive, cache-consistent, and verified through the affected browser journey.
