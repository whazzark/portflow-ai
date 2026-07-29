---
description: "Portflow task list grouped by independently deliverable user story"
---

# Tasks: Administer Docks and Weighing Areas From the Web Workbench

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/api.md`, `contracts/ui.md`, and `quickstart.md`
**Prerequisites**: Approved spec and plan

## Phase 1: Setup

- [ ] T001 [P] [SETUP] [DOC] Confirm the active feature directory and existing Dock/Weighing Area vertical-slice paths in `.specify/feature.json`, `apps/api/app/docks/`, `apps/api/app/weighing_areas/`, and `apps/web/src/`
- [ ] T002 [P] [SETUP] [DOC] Record the focused API and web test commands from `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T003 [P] [SETUP] [DOC] Verify the current MapCN/shadcn installation state and `maplibre-gl` dependency in `apps/web/package.json` and `apps/web/src/components/ui/`

## Phase 2: Foundational

- [ ] T004 [P] [FOUNDATION] [RED] Add migration/repository failing tests for version `1` backfill, positive versions, conditional zero-row stale writes, one-step increments, and reversible rollback in `apps/api/tests/unit/docks/dock_concurrency.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T005 [P] [FOUNDATION] [RED] Add shared failing tests for distinct ordered `{ id, expectedVersion }` validation and stable lifecycle blocker reasons in `apps/api/tests/unit/site_references/versioned_lifecycle_validation.spec.ts`
- [ ] T006 [FOUNDATION] [GREEN] Establish the shared versioned lifecycle command/result vocabulary and repository boundary in `apps/api/app/site_references/shared/versioned_lifecycle.ts`
- [ ] T007 [FOUNDATION] [GREEN] Add the reversible version migration, schema fields, model fields/relations, and factory defaults in `apps/api/database/migrations/*_add_operational_checkpoint_versions.ts`, `apps/api/database/schema.ts`, `apps/api/app/models/dock.ts`, `apps/api/app/models/weighing_area.ts`, `apps/api/database/factories/dock_factory.ts`, and `apps/api/database/factories/weighing_area_factory.ts`
- [ ] T008 [P] [FOUNDATION] [REFACTOR] Add version-aware shared validators and lifecycle result types without changing the separate Dock and Weighing Area domain names in `apps/api/app/site_references/shared/`

## Phase 3: User Story 1 - Administer Docks and Weighing Areas From the Web Workbench (Priority: P1)

**Goal**: Let active users consult both named operational-checkpoint resources in one accessible workbench, while Organization Admins and Operations Admins can safely administer each resource with validation, lifecycle, grouped actions, and optimistic concurrency.

**Independent test**: Run the focused API suites in `apps/api/tests/unit/docks/`, `apps/api/tests/unit/weighing_areas/`, `apps/api/tests/integration/docks.spec.ts`, and `apps/api/tests/integration/weighing_areas.spec.ts`, then run `pnpm --filter @portflow/web exec vitest run src/features/checkpoints/__tests__ --pool=threads --maxWorkers=1`; validate the authenticated `/checkpoints` journey when a Playwright seam is configured.

### API persistence, Dock, and Weighing Area slices

- [ ] T009 [P] [US1] [RED] Add Dock use-case failing tests for version-aware update/archive/reactivate, reactivation preserving the stable ID and prior lifecycle history, actor and comment metadata, same-type name uniqueness, GPS validation, archived edit refusal, usage blocking, and stale no-op behavior in `apps/api/tests/unit/docks/dock_use_cases.spec.ts` and `apps/api/tests/unit/docks/dock_concurrency.spec.ts`
- [ ] T010 [P] [US1] [RED] Add Weighing Area use-case failing tests for version-aware update/archive/reactivate, reactivation preserving the stable ID and prior lifecycle history, actor and comment metadata, same-type name uniqueness, GPS validation, archived edit refusal, usage blocking, and stale no-op behavior in `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T011 [P] [US1] [RED] Add grouped lifecycle failing tests for ordered partial success, `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, `ALREADY_ARCHIVED`, `ALREADY_AVAILABLE`, duplicate/invalid input rejection, and unchanged blockers in `apps/api/tests/unit/docks/dock_bulk_lifecycle.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_bulk_lifecycle.spec.ts`
- [ ] T012 [GREEN] [US1] [REFACTOR] Implement conditional version-incrementing Dock repositories, grouped transaction/locking classification, and named result unions in `apps/api/app/docks/shared/` and `apps/api/app/docks/`
- [ ] T013 [GREEN] [US1] [REFACTOR] Implement conditional version-incrementing Weighing Area repositories, grouped transaction/locking classification, and named result unions in `apps/api/app/weighing_areas/shared/` and `apps/api/app/weighing_areas/`
- [ ] T014 [GREEN] [US1] [REFACTOR] Extend Dock and Weighing Area update/archive/reactivate use cases and validators with positive `expectedVersion`, trimmed lifecycle comments, typed stale outcomes, and the existing `SiteReferenceUsageChecker` boundary in `apps/api/app/docks/` and `apps/api/app/weighing_areas/`
- [ ] T015 [GREEN] [US1] [REFACTOR] Add separate grouped archive/reactivate use cases for Docks and Weighing Areas in `apps/api/app/docks/archive/`, `apps/api/app/docks/reactivate/`, `apps/api/app/weighing_areas/archive/`, and `apps/api/app/weighing_areas/reactivate/`
- [ ] T016 [P] [US1] [RED] Add HTTP integration failures for active-user reads, admin-only mutations, DTO lifecycle summaries/version, validation/conflict/wrong-state/in-use/stale errors, grouped route ordering, mixed results, and request-level `422` behavior in `apps/api/tests/integration/docks.spec.ts`
- [ ] T017 [P] [US1] [RED] Add equivalent HTTP integration failures for Weighing Areas in `apps/api/tests/integration/weighing_areas.spec.ts`
- [ ] T018 [GREEN] [US1] [REFACTOR] Update Dock policy, list/show/mutation transformers, controller actions, named validators, and routes for active-user consultation, versioned mutations, grouped endpoints, and safe actor summaries in `apps/api/app/docks/`, `apps/api/app/controllers/docks_controller.ts`, and `apps/api/start/routes.ts`
- [ ] T019 [GREEN] [US1] [REFACTOR] Update Weighing Area policy, list/show/mutation transformers, controller actions, named validators, and routes for active-user consultation, versioned mutations, grouped endpoints, and safe actor summaries in `apps/api/app/weighing_areas/`, `apps/api/app/controllers/weighing_areas_controller.ts`, and `apps/api/start/routes.ts`
- [ ] T020 [GREEN] [US1] [REFACTOR] Verify generated Tuyau route/type output and preserve named Dock and Weighing Area contracts in `apps/api/start/routes.ts`, `apps/web/src/`, and any generated client artifact required by the repository

### Consultation workbench shell

- [ ] T021 [P] [US1] [RED] Add router-level failing tests for `/checkpoints`, independent URL-backed Dock/Weighing Area search and status state, visible-type filters, SSR-safe list preloading, and sidebar navigation in `apps/web/src/features/checkpoints/__tests__/checkpoints-route.test.tsx` and `apps/web/src/features/checkpoints/__tests__/checkpoints-filters.test.tsx`
- [ ] T022 [P] [US1] [RED] Add failing tests for case-insensitive name filtering, distinct query keys/builders, discriminated resource view models, and cache invalidation boundaries in `apps/web/src/features/checkpoints/__tests__/checkpoints-adapters.test.ts`
- [ ] T023 [GREEN] [US1] [REFACTOR] Add named Dock and Weighing Area query adapters, URL Zod search schema, preloading route, and feature types in `apps/web/src/features/checkpoints/queries/`, `apps/web/src/features/checkpoints/helpers/`, `apps/web/src/features/checkpoints/types.ts`, and `apps/web/src/routes/_authenticated/checkpoints.tsx`
- [ ] T024 [GREEN] [US1] [REFACTOR] Build the synchronized accessible resource list, independent filters, loading/error/empty states, and marker-ready view model in `apps/web/src/features/checkpoints/ui/`
- [ ] T025 [P] [US1] [RED] Add focused failing tests for client-only map-canvas mounting, SSR-safe synchronized list rendering, distinct Dock/Weighing Area icon-and-text cues, recoverable map-unavailable fallback, and the accessible map/list representation without requiring WebGL in `apps/web/src/features/checkpoints/__tests__/checkpoints-map.test.tsx`
- [ ] T026 [GREEN] [US1] [REFACTOR] Install/own the MapCN component with theme-aware CARTO styles, attribution, distinct Dock/Weighing Area markers, client-only mounting, and recoverable map-unavailable fallback in `apps/web/src/components/ui/map.tsx`, `apps/web/package.json`, `pnpm-lock.yaml`, and `apps/web/src/features/checkpoints/ui/`
- [ ] T027 [GREEN] [US1] [REFACTOR] Link the existing Checkpoints sidebar item to `/checkpoints` while preserving the established layout tokens and active navigation behavior in `apps/web/src/components/layout/app-sidebar.tsx`

### Individual administration flows

- [ ] T028 [P] [US1] [RED] Add failing web tests for observer read-only affordances and admin-only create/edit controls in `apps/web/src/features/checkpoints/__tests__/checkpoints-permissions.test.tsx`
- [ ] T029 [P] [US1] [RED] Add failing web tests for shared resource-aware create/edit GPS forms, boundary values, server validation, version capture, and recoverable network errors in `apps/web/src/features/checkpoints/__tests__/checkpoints-forms.test.tsx`
- [ ] T030 [P] [US1] [RED] Add failing web tests for list-backed detail sheets, individual archive/reactivate confirmation, comments, success refresh, and affected-resource-only cache invalidation in `apps/web/src/features/checkpoints/__tests__/checkpoints-individual-mutations.test.tsx`
- [ ] T031 [GREEN] [US1] [REFACTOR] Implement shared Dock/Weighing Area create/edit forms using `useAppForm`, registered fields, validation mapping, explicit coordinate strings, and resource-specific mutation adapters in `apps/web/src/features/checkpoints/ui/`, `apps/web/src/features/checkpoints/mutations/`, and `apps/web/src/features/checkpoints/helpers/`
- [ ] T032 [GREEN] [US1] [REFACTOR] Implement list-backed detail sheets and individual lifecycle dialogs with permission-aware actions, trimmed comments, pending protection, and query invalidation in `apps/web/src/features/checkpoints/ui/` and `apps/web/src/features/checkpoints/mutations/`

### Grouped lifecycle, stale state, and accessibility

- [ ] T033 [P] [US1] [RED] Add failing tests for independent Dock and Weighing Area selections in the combined view, simultaneous resource-labelled keyboard-reachable toolbars, resource-specific grouped requests, per-kind scope clearing, confirmation, mixed changed/blocked result announcements, stable blocker wording, and changed/blocked selection retention in `apps/web/src/features/checkpoints/__tests__/checkpoints-bulk-mutations.test.tsx`
- [ ] T034 [P] [US1] [RED] Add failing tests for individual stale `409` reload prompts, explicit refetch-only retry, unsafe-state closure, and no automatic version substitution in `apps/web/src/features/checkpoints/__tests__/checkpoints-stale-state.test.tsx`
- [ ] T035 [P] [US1] [RED] Add failing responsive/accessibility regression tests for labelled controls, non-color-only status/type cues, focus flow, simultaneous per-kind selection toolbars, and no document-level horizontal overflow at 375/768/1024/1440 px in `apps/web/src/features/checkpoints/__tests__/checkpoints-accessibility.test.tsx`
- [ ] T036 [GREEN] [US1] [REFACTOR] Implement grouped archive/reactivate mutations, independent per-kind visible-scope selection models and labelled toolbars, confirmation dialogs, partial-result adapter, inline live outcome, and resource-specific requests/cache invalidation in `apps/web/src/features/checkpoints/mutations/`, `apps/web/src/features/checkpoints/helpers/`, and `apps/web/src/features/checkpoints/ui/`
- [ ] T037 [GREEN] [US1] [REFACTOR] Implement stale-error handling that invalidates the affected named queries, closes unsafe mutation state, preserves recoverable input where safe, and exposes an explicit reload-latest-data action in `apps/web/src/features/checkpoints/mutations/` and `apps/web/src/features/checkpoints/ui/`
- [ ] T038 [GREEN] [US1] [REFACTOR] Complete responsive layout, keyboard navigation, screen-reader announcements, visible focus, dialog lifecycle, and text-plus-icon lifecycle/type indicators in `apps/web/src/features/checkpoints/ui/`

## Final verification

- [ ] T039 [P] [VERIFY] Run the focused API migration, unit, and HTTP suites from `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T040 [P] [VERIFY] Run the focused web Vitest feature suite and inspect the authenticated `/checkpoints` journey at configured browser seam, recording when no Playwright journey is available in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T041 [VERIFY] Run `pnpm check` from the repository root
- [ ] T042 [VERIFY] Run `pnpm typecheck` from the repository root
- [ ] T043 [VERIFY] Run `pnpm test` from the repository root
- [ ] T044 [VERIFY] Run `$speckit-analyze` against `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/`
- [ ] T045 [VERIFY] Run `$speckit-converge` against `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/`

## Dependencies and execution order

- T001-T003 establish repository context and are independent.
- T004-T008 form the blocking persistence/concurrency foundation; T009-T015 depend on T007-T008.
- T016-T020 depend on the corresponding Dock/Weighing Area use cases and validators; Dock and Weighing Area API work can proceed in parallel after the foundation.
- T021-T027 form the consultation shell and can proceed in parallel with API implementation after the API contract is stable; T023-T026 depend on generated/named query contracts, and map implementation T026 must follow its focused RED coverage in T025.
- T028-T032 depend on the consultation shell and named API mutations.
- T033-T038 depend on the individual mutation adapters and list/detail state.
- T039-T045 depend on all implementation tasks; T044 and T045 are the final Spec Kit gates.

Safe parallel groups: T004-T005; T009-T010; T011; T016-T017; T021-T022; T025; T028-T030; T033-T035; T039-T040.

## Implementation strategy

Deliver the MVP as the single P1 story in vertical slices: first make versioned persistence safe, then ship named Dock and Weighing Area API contracts, then the read-only consultation shell, then individual admin flows, and finally grouped lifecycle/stale-state UX. Keep every RED test immediately before the smallest GREEN implementation. The workbench remains usable for active observers before administration controls are added, and API authorization remains authoritative throughout.

## Format validation

All executable tasks use the required `- [ ] T###` checklist prefix, include a phase-appropriate label, and name an exact file or command path. User-story tasks are labelled `[US1]`; setup, foundation, and verification tasks are not assigned a fabricated additional story.
