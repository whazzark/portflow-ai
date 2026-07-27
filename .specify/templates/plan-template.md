# Implementation Plan: [FEATURE]

**Feature ID**: `[DOMAIN-SLUG]` | **Date**: `[DATE]` | **Spec**: `specs/[FEATURE]/spec.md`
**Input**: Feature specification from `specs/[FEATURE]/spec.md`

## Summary

[Primary requirement and the smallest coherent technical approach]

## Technical Context

- **Apps**: `apps/api`, `apps/web`, or both
- **Language/runtime**: TypeScript, Node.js, AdonisJS, TanStack Start
- **Storage**: PostgreSQL and/or existing persistence
- **Testing**: unit, integration, feature, and e2e level(s) required
- **Constraints**: authorization, concurrency, migrations, performance, accessibility

## Constitution Check

Record how the plan satisfies each applicable constitution principle. Any violation needs a reason and a simpler alternative that was rejected.

## Design

### Domain and data model

[Entities, invariants, migrations, and durable decisions]

### API and application boundaries

[Use cases, repositories, policies, controllers, DTOs, routes, and error contracts]

### Frontend boundaries

[Feature slices, adapters, route composition, states, and user-visible flows]

### Test strategy

[RED test seams, integration contract, feature behavior, e2e journey, and regression coverage]

## Repository Changes

```text
[Concrete files/directories and why each changes]
```

## Risks and Rollout

- [Migration, compatibility, security, performance, or rollout risk]
- [Rollback or feature flag strategy]

## Acceptance Traceability

| Requirement / scenario | Planned test or verification | Implementation area |
|---|---|---|
| FR-001 / US1 | [test command or case] | [path/layer] |
