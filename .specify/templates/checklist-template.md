# Specification Quality Checklist: [FEATURE NAME]

**Purpose**: Validate intent, completeness, and readiness before planning or implementation.
**Created**: [DATE]
**Feature**: `specs/[FEATURE]/spec.md`

## Intent and boundaries

- [ ] The primary actor, business objective, and user value are explicit.
- [ ] User stories are independently testable and ordered by priority.
- [ ] In-scope and out-of-scope behavior are explicit.
- [ ] Dependencies and parent roadmap entry are linked.

## Requirements

- [ ] Requirements are observable, testable, and unambiguous.
- [ ] Acceptance scenarios cover success, validation, authorization, conflict, and recovery paths where relevant.
- [ ] Edge cases and concurrency behavior are identified.
- [ ] No unresolved `[NEEDS CLARIFICATION]` marker remains before plan approval.
- [ ] Success criteria are measurable and technology-independent.

## Portflow alignment

- [ ] Domain terms match `CONTEXT.md`.
- [ ] Durable architectural decisions link to ADRs.
- [ ] API authorization and role behavior are explicit when applicable.
- [ ] Backend/frontend ownership boundaries are clear.
- [ ] Test levels and observable seams are named.

## Notes

- [ ] Failed items have a concrete resolution recorded in the spec or clarification discussion.
