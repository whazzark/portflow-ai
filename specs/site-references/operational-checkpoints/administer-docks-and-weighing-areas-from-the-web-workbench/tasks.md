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

- [ ] T004 [P] [US1] [RED] Add migration/repository failing tests for version `1` backfill, positive versions, conditional zero-row stale writes, one-step increments, and reversible rollback in `apps/api/tests/unit/docks/dock_concurrency.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
- [ ] T005 [P] [US1] [RED] Add shared failing tests for distinct ordered `{ id, expectedVersion }` validation and stable lifecycle blocker reasons in `apps/api/tests/unit/site_references/versioned_lifecycle_validation.spec.ts`
- [ ] T006 [GREEN] [DOC] Establish the shared versioned lifecycle command/result vocabulary and repository boundary in `apps/api/app/site_references/shared/versioned_lifecycle.ts`
- [ ] T007 [GREEN] [REFACTOR] Add the reversible version migration, schema fields, model fields/relations, and factory defaults in `apps/api/database/migrations/*_add_operational_checkpoint_versions.ts`, `apps/api/database/schema.ts`, `apps/api/app/models/dock.ts`, `apps/api/app/models/weighing_area.ts`, `apps/api/database/factories/dock_factory.ts`, and `apps/api/database/factories/weighing_area_factory.ts`
- [ ] T008 [P] [GREEN] [REFACTOR] Add version-aware shared validators and lifecycle result types without changing the separate Dock and Weighing Area domain names in `apps/api/app/site_references/shared/`

## Phase 3: User Story 1 - Administer Docks and Weighing Areas From the Web Workbench (Priority: P1)

**Goal**: Let active users consult both named operational-checkpoint resources in one accessible workbench, while Organization Admins and Operations Admins can safely administer each resource with validation, lifecycle, grouped actions, and optimistic concurrency.

**Independent test**: Run the focused API suites in `apps/api/tests/unit/docks/`, `apps/api/tests/unit/weighing_areas/`, `apps/api/tests/integration/docks.spec.ts`, and `apps/api/tests/integration/weighing_areas.spec.ts`, then run `pnpm --filter @portflow/web exec vitest run src/features/checkpoints/__tests__ --pool=threads --maxWorkers=1`; validate the authenticated `/checkpoints` journey when a Playwright seam is configured.

### API persistence, Dock, and Weighing Area slices

- [ ] T009 [P] [US1] [RED] Add Dock use-case failing tests for version-aware update/archive/reactivate, actor and comment metadata, same-type name uniqueness, GPS validation, archived edit refusal, usage blocking, and stale no-op behavior in `apps/api/tests/unit/docks/dock_use_cases.spec.ts` and `apps/api/tests/unit/docks/dock_concurrency.spec.ts`
- [ ] T010 [P] [US1] [RED] Add Weighing Area use-case failing tests for version-aware update/archive/reactivate, actor and comment metadata, same-type name uniqueness, GPS validation, archived edit refusal, usage blocking, and stale no-op behavior in `apps/api/tests/unit/weighing_areas/weighing_area_use_cases.spec.ts` and `apps/api/tests/unit/weighing_areas/weighing_area_concurrency.spec.ts`
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
- [ ] T025 [GREEN] [US1] [REFACTOR] Install/own the MapCN component with theme-aware CARTO styles, attribution, distinct Dock/Weighing Area markers, client-only mounting, and recoverable map-unavailable fallback in `apps/web/src/components/ui/map.tsx`, `apps/web/package.json`, `pnpm-lock.yaml`, and `apps/web/src/features/checkpoints/ui/`
- [ ] T026 [GREEN] [US1] [REFACTOR] Link the existing Checkpoints sidebar item to `/checkpoints` while preserving the established layout tokens and active navigation behavior in `apps/web/src/components/layout/app-sidebar.tsx`

### Individual administration flows

- [ ] T027 [P] [US1] [RED] Add failing web tests for observer read-only affordances and admin-only create/edit controls in `apps/web/src/features/checkpoints/__tests__/checkpoints-permissions.test.tsx`
- [ ] T028 [P] [US1] [RED] Add failing web tests for shared resource-aware create/edit GPS forms, boundary values, server validation, version capture, and recoverable network errors in `apps/web/src/features/checkpoints/__tests__/checkpoints-forms.test.tsx`
- [ ] T029 [P] [US1] [RED] Add failing web tests for list-backed detail sheets, individual archive/reactivate confirmation, comments, success refresh, and affected-resource-only cache invalidation in `apps/web/src/features/checkpoints/__tests__/checkpoints-individual-mutations.test.tsx`
- [ ] T030 [GREEN] [US1] [REFACTOR] Implement shared Dock/Weighing Area create/edit forms using `useAppForm`, registered fields, validation mapping, explicit coordinate strings, and resource-specific mutation adapters in `apps/web/src/features/checkpoints/ui/`, `apps/web/src/features/checkpoints/mutations/`, and `apps/web/src/features/checkpoints/helpers/`
- [ ] T031 [GREEN] [US1] [REFACTOR] Implement list-backed detail sheets and individual lifecycle dialogs with permission-aware actions, trimmed comments, pending protection, and query invalidation in `apps/web/src/features/checkpoints/ui/` and `apps/web/src/features/checkpoints/mutations/`

### Grouped lifecycle, stale state, and accessibility

- [ ] T032 [P] [US1] [RED] Add failing tests for visible-scope selection clearing, keyboard-reachable grouped toolbar, confirmation, mixed changed/blocked result announcements, stable blocker wording, and changed/blocked selection retention in `apps/web/src/features/checkpoints/__tests__/checkpoints-bulk-mutations.test.tsx`
- [ ] T033 [P] [US1] [RED] Add failing tests for individual stale `409` reload prompts, explicit refetch-only retry, unsafe-state closure, and no automatic version substitution in `apps/web/src/features/checkpoints/__tests__/checkpoints-stale-state.test.tsx`
- [ ] T034 [P] [US1] [RED] Add failing responsive/accessibility tests for labelled controls, non-color-only status/type cues, focus flow, map/list fallback, and no document-level horizontal overflow at 375/768/1024/1440 px in `apps/web/src/features/checkpoints/__tests__/checkpoints-accessibility.test.tsx`
- [ ] T035 [GREEN] [US1] [REFACTOR] Implement grouped archive/reactivate mutations, visible-scope selection model, confirmation dialogs, partial-result adapter, inline live outcome, and resource-specific cache invalidation in `apps/web/src/features/checkpoints/mutations/`, `apps/web/src/features/checkpoints/helpers/`, and `apps/web/src/features/checkpoints/ui/`
- [ ] T036 [GREEN] [US1] [REFACTOR] Implement stale-error handling that invalidates the affected named queries, closes unsafe mutation state, preserves recoverable input where safe, and exposes an explicit reload-latest-data action in `apps/web/src/features/checkpoints/mutations/` and `apps/web/src/features/checkpoints/ui/`
- [ ] T037 [GREEN] [US1] [REFACTOR] Complete responsive layout, keyboard navigation, screen-reader announcements, visible focus, dialog lifecycle, map failure fallback, and text-plus-icon lifecycle/type indicators in `apps/web/src/features/checkpoints/ui/`

## Final verification

- [ ] T038 [P] [US1] [VERIFY] Run the focused API migration, unit, and HTTP suites from `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T039 [P] [US1] [VERIFY] Run the focused web Vitest feature suite and inspect the authenticated `/checkpoints` journey at configured browser seam, recording when no Playwright journey is available in `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/quickstart.md`
- [ ] T040 [VERIFY] Run `pnpm check` from the repository root
- [ ] T041 [VERIFY] Run `pnpm typecheck` from the repository root
- [ ] T042 [VERIFY] Run `pnpm test` from the repository root
- [ ] T043 [VERIFY] Run `$speckit-analyze` against `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/`
- [ ] T044 [VERIFY] Run `$speckit-converge` against `specs/site-references/operational-checkpoints/administer-docks-and-weighing-areas-from-the-web-workbench/`

## Dependencies and execution order

- T001-T003 establish repository context and are independent.
- T004-T008 form the blocking persistence/concurrency foundation; T009-T015 depend on T007-T008.
- T016-T020 depend on the corresponding Dock/Weighing Area use cases and validators; Dock and Weighing Area API work can proceed in parallel after the foundation.
- T021-T026 form the consultation shell and can proceed in parallel with API implementation after the API contract is stable; T023-T025 depend on generated/named query contracts.
- T027-T031 depend on the consultation shell and named API mutations.
- T032-T037 depend on the individual mutation adapters and list/detail state.
- T038-T044 depend on all implementation tasks; T043 and T044 are the final Spec Kit gates.

Safe parallel groups: T004-T005; T009-T010; T011; T016-T017; T021-T022; T027-T029; T032-T034; T038-T039.

## Implementation strategy

Deliver the MVP as the single P1 story in vertical slices: first make versioned persistence safe, then ship named Dock and Weighing Area API contracts, then the read-only consultation shell, then individual admin flows, and finally grouped lifecycle/stale-state UX. Keep every RED test immediately before the smallest GREEN implementation. The workbench remains usable for active observers before administration controls are added, and API authorization remains authoritative throughout.

## Format validation

All executable tasks use the required `- [ ] T###` checklist prefix, include a phase-appropriate label, and name an exact file or command path. User-story tasks are labelled `[US1]`; setup, foundation, and verification tasks are not assigned a fabricated additional story.
