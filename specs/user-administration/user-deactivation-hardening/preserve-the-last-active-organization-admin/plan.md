# Implementation Plan: Preserve the Last Active Organization Admin

**Branch**: `whazzark/preserve-the-last-active-organization-admin` | **Date**: 2026-09-11 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from
`specs/user-administration/user-deactivation-hardening/preserve-the-last-active-organization-admin/spec.md`

## Summary

This slice closes the one path by which deactivation can still leave the organization without an
active organization admin: two administrators deactivating each other at the same moment. It adds
no endpoint, no field, no migration, and no web code.

The whole change sits inside `LucidUserRepository.deactivateActive`. Before its existing guarded
`UPDATE`, the write now locks the actor's and the target's rows **in id order** with `FOR NO KEY UPDATE`,
and re-reads the actor. If the actor is no longer `ACTIVE` with the `ORGANIZATION_ADMIN` role, it
returns a new `ACTOR_NOT_ENTITLED` outcome and writes nothing. `DeactivateUserUseCase` turns that
outcome into the same `403 E_AUTHORIZATION_FAILURE` the policy already returns. The workbench
already shows that refusal on this action.

The design rests on two points. First, *the actor still being entitled at the write* is enough to
guarantee that an organization admin remains, because `SELF` is already refused, so no head count is
needed (D1). Second, locking both rows in a single global order is what turns the mutual race into
a queue instead of write skew or a deadlock. The codebase already applies the same pattern in
`lockWarehouses` (D2).

The decisions are in [research.md](./research.md), the extended write and its decision table in
[data-model.md](./data-model.md), the contract delta in
[contracts/deactivate-user.md](./contracts/deactivate-user.md), and the proofs in
[quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22, ESM, in the PNPM/Turbo monorepo.

**Primary Dependencies**: AdonisJS 7.3 (Lucid 22 and Bouncer 4). No new dependency.

**Storage**: PostgreSQL in every deployed environment, where the `FOR NO KEY UPDATE` lock provides the
guarantee. In-memory SQLite in the test suite (ADR-0014), where the lock is a no-op and writers
are serialized anyway. **No migration**: the slice reads `users.access_status` and `users.role`,
which already exist.

**Testing**: Japa `unit` for the repository write and the use case mapping, against the real
database per ADR-0014. Japa `integration` for the HTTP envelope and the in-flight window, reproduced
by a test-only subclass of the real repository (D7). Vitest + MSW for one pinning test of the
workbench refusal (D6). Real concurrency is verified manually on PostgreSQL through the quickstart
loop, because the single-connection test database cannot run two transactions at once.

**Target Platform**: The AdonisJS API server. The TanStack Start web application is unchanged.

**Project Type**: Web application (`apps/api` and `apps/web`). Only `apps/api` changes.

**Performance Goals**: No regression on SC-005's 2-second workbench visibility. The lock adds one
indexed primary-key read of at most two rows to a transaction that already exists. Waiting only
happens between requests that share a user row.

**Constraints**: The mutual race must never produce a `500` (hence the ordered locks), a refusal
must write nothing on either row, and the `403` body must stay identical to the policy's.

**Scale/Scope**: One organization and ≤ 200 users. One repository method, one result variant, one
exception, and one use case branch change, plus one sentence in `CONTEXT.md`.

## Constitution Check

*GATE: passed before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Selected feature intent is versioned | PASS. Issue #21 is selected, and its spec went from placeholder to draft on this branch and was accepted for planning. |
| II. One independently deliverable feature per spec | PASS. One outcome: deactivation can never lock the organization out. The role change side stays with GH-29 (spec Out of Scope), and the contract records the obligation it inherits. |
| III. Vanilla Spec Kit gates | PASS. The spec was reviewed before this plan, and this plan awaits review before `speckit-tasks`. One copy question is raised for that review (D6) and needs no spec change. |
| IV. Test-first observable behavior | PASS. RED → GREEN on each commit order at the repository, then on the HTTP in-flight window, then the pinning web test. Every acceptance scenario maps to a seam (D7, quickstart table). |
| V. Deep boundaries and explicit contracts | PASS. The repository owns the lock and reports what it observed (`ACTOR_NOT_ENTITLED`, carrying nothing). The use case selects the exception. The policy keeps its early, non-disclosing check. No layer is crossed (D1, D3, D4). |
| VI. Durable knowledge has a home | PASS. The invariant goes into `CONTEXT.md` once (D8). No ADR, because the locking rule follows the documented `lockWarehouses` precedent. |
| VII. Verification is part of delivery | PASS. `pnpm check`, `pnpm typecheck`, `pnpm test`, the PostgreSQL race loop in the quickstart, then a fresh read-only review of the diff. |
| VIII. One workflow owner | PASS. No state machine and no new status. |

There is no violation, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/user-administration/user-deactivation-hardening/preserve-the-last-active-organization-admin/
├── spec.md
├── plan.md                    # This file
├── research.md                # Phase 0: D1–D8
├── data-model.md              # Phase 1: invariant, extended write, decision table, lock table
├── quickstart.md              # Phase 1: automated seams + PostgreSQL race loop
├── contracts/
│   └── deactivate-user.md     # Amendment to GH-20's contract: new 403 cause, precedence, guarantees
├── checklists/requirements.md
└── tasks.md                   # Phase 2: produced by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
apps/api/
├── app/users/
│   ├── deactivate/deactivate_user_use_case.ts              # + ACTOR_NOT_ENTITLED → exception
│   └── shared/
│       ├── user_exceptions.ts                              # + DeactivationNoLongerAuthorizedException
│       └── repositories/
│           ├── user_repository.ts                          # + ACTOR_NOT_ENTITLED in DeactivateUserResult
│           └── lucid_user_repository.ts                    # + ordered lock + actor check in deactivateActive
└── tests/
    ├── unit/users/deactivation/guarded_write.spec.ts       # + commit orders, precedence, renewal requirement
    ├── unit/users/deactivation/deactivate.spec.ts          # + mapping to the 403 exception
    └── integration/users/deactivation/deactivate.spec.ts   # + in-flight window, envelope parity

apps/web/src/features/users/__tests__/deactivate/refusals.test.tsx   # + 403 E_AUTHORIZATION_FAILURE case

CONTEXT.md                                                  # Organization Admin: + the invariant
```

**Structure Decision**: The existing vertical slice, `app/users/deactivate` with its shared
repository and exceptions, is extended in place. No new file is added in `app/`. The lock is a
private helper of `LucidUserRepository`, shaped like `LucidWarehouseRepository.lockWarehouses`, so
GH-29 can reuse it in `changeRole` when it takes on the obligation the contract records.

## Phase 0 — Outline & Research

Complete. See [research.md](./research.md):

- **D1**: the actor re-check instead of a head count.
- **D2**: ordered `FOR NO KEY UPDATE` on the actor and target rows, and why neither `SERIALIZABLE`, an
  advisory lock, nor an `EXISTS` guard fits.
- **D3**: lost entitlement takes precedence over target reasons.
- **D4**: the `403` envelope parity.
- **D5**: only status and role count.
- **D6**: no web change, and one copy question for review.
- **D7**: three proof layers for a race on a single-connection test database.
- **D8**: the invariant in `CONTEXT.md`.

## Phase 1 — Design & Contracts

Complete. [data-model.md](./data-model.md) fixes the invariant, who counts, the extended write
step by step, the result union, the decision table, and which concurrent writers wait on the new
locks. [contracts/deactivate-user.md](./contracts/deactivate-user.md) amends GH-20's contract:
the second authorization layer, the new cause of `403`, the precedence order, the amended
guarantees, and the serialization obligation on GH-29. [quickstart.md](./quickstart.md) lists
the automated expectations and the PostgreSQL loop that proves SC-001 and SC-002.

**Post-design Constitution re-check**: PASS, unchanged. The design adds one result variant, one
exception, and one lock step inside a transaction that already exists. It adds no layer, no
dependency, no migration, and no web code.

## Complexity Tracking

There is no Constitution Check violation and nothing to justify.
