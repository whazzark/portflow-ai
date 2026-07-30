# Delivery plan: [FEATURE]

**Spec**: `specs/[FEATURE]/spec.md`
**Profile**: `standard`

## Approach

[Smallest coherent technical approach and existing behavior to reuse.]

## Affected boundaries

- **Domain/application**: [use cases, policies, repositories, invariants]
- **API**: [routes, validation, authorization, DTOs, errors]
- **Data/migrations**: [schema, compatibility, rollback, or none]
- **Web**: [feature slice, adapters, route, states, accessibility]

## Risks and rollback

- [Security, concurrency, migration, compatibility, external dependency, or rollout risk]
- [Rollback or safe recovery path]

## Acceptance-to-test mapping

| Scenario / rule | Observable test | Area |
|---|---|---|
| Scenario 1 / BR-001 | [focused command or journey] | [path/layer] |

## Implementation Slices

- [ ] `slice-01` — [First independently testable outcome]
- [ ] `slice-02` — [Second independently testable outcome]
- [ ] `slice-03` — [Third independently testable outcome]
- [ ] `slice-04` — [Fourth independently testable outcome]
- [ ] `slice-05` — [Final integration or browser outcome]

Keep between 5 and 15 outcome-oriented slices for a standard delivery. Each slice is executed with RED → GREEN → REFACTOR; do not create separate bookkeeping tasks for those internal steps.
