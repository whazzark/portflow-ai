---
description: "Portflow task list grouped by independently deliverable user story"
---

# Tasks: [FEATURE NAME]

**Input**: `spec.md` and `plan.md` in `specs/[FEATURE]/`
**Prerequisites**: Approved spec and plan

## Task format

`- [ ] T001 [P?] [US1] [RED|GREEN|REFACTOR|DOC] Concrete action in an exact path`

- `[P]` means safe to run in parallel with other tasks in the same phase.
- Every task names its user story, exact path, and dependency when relevant.
- Tests come before the implementation they prove.

## Phase 1: Setup

- [ ] T001 [P] [SETUP] [RED|GREEN|REFACTOR|DOC] [Concrete repository setup]

## Phase 2: Foundational

- [ ] T002 [FOUNDATION] [RED|GREEN|REFACTOR|DOC] [Blocking prerequisite]

## Phase 3: User Story 1 - [Title] (Priority: P1)

**Goal**: [Smallest independently demonstrable outcome]
**Independent test**: [Command or observable journey]

- [ ] T003 [P] [US1] [RED] Add the failing behavior test in `[path]`
- [ ] T004 [US1] [GREEN] Implement the minimum behavior in `[path]`
- [ ] T005 [US1] [REFACTOR] Simplify and align boundaries in `[path]`
- [ ] T006 [US1] [DOC] Update domain/ADR documentation when required

## Phase 4: User Story 2 - [Title] (Priority: P2)

- [ ] T007 [P] [US2] [RED] [Failing test]
- [ ] T008 [US2] [GREEN] [Minimum implementation]

## Final verification

- [ ] TXXX [VERIFY] Run `pnpm check`
- [ ] TXXX [VERIFY] Run `pnpm typecheck`
- [ ] TXXX [VERIFY] Run `pnpm test`
- [ ] TXXX [VERIFY] Run relevant browser/e2e flow when applicable
- [ ] TXXX [VERIFY] Run `$speckit-analyze` and `$speckit-converge`

## Dependencies and execution order

[Explicit phase and user-story dependencies. Identify safe parallel groups and file-conflict boundaries.]
