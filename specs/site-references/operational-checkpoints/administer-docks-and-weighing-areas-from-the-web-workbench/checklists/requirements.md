# Requirements Checklist: Administer Docks and Weighing Areas From the Web Workbench

**Feature ID**: `GH-41`
**Spec**: `../spec.md`

## Source acceptance criteria

- [x] Resolve all `[NEEDS CLARIFICATION]` markers before plan approval.
- [x] Define the actor, scope, intended behavior, and observable acceptance criteria for "Administer Docks and Weighing Areas From the Web Workbench" before planning.

## Verification

- [ ] Each item maps to a test or reviewable behavior.
- [ ] API and web seams are covered where applicable.
- [ ] No requirement is implemented outside the approved spec.

## Requirement Completeness

- [ ] CHK001 - Are consultation, search, creation, editing, individual lifecycle, and grouped lifecycle requirements explicitly defined for both Docks and Weighing Areas? [Completeness, Spec §FR-001]
- [ ] CHK002 - Are the map, list, detail, filter, and status representations specified as one coherent workbench experience rather than as implicit UI behavior? [Completeness, Spec §FR-001a, Plan §Frontend boundaries]
- [ ] CHK003 - Are the permissions for consultation and every mutation stated for active users, observers, Organization Admins, and Operations Admins? [Completeness, Spec §FR-002]
- [ ] CHK004 - Are the required identity, GPS, lifecycle, audit, and optimistic-concurrency fields defined for both resource types? [Completeness, Spec §FR-003, Spec §FR-006, Spec §FR-007]
- [ ] CHK005 - Are dependencies, deferred discharge integration, and explicitly excluded capabilities documented well enough to prevent scope expansion? [Completeness, Spec §Dependencies, Spec §Out of Scope, Plan §Deferred integration]

## Requirement Clarity

- [ ] CHK006 - Is the meaning of “available” and “archived” clear for consultation, filtering, and future operational use? [Clarity, Spec §FR-001a, Spec §Assumptions and Clarifications]
- [ ] CHK007 - Are name normalization, case-insensitive substring matching, independent per-type search, and status-filter preservation unambiguous? [Clarity, Spec §FR-003a, Spec §FR-003b]
- [ ] CHK008 - Are valid latitude and longitude formats, inclusive bounds, blank handling, and legal zero values specified without conflicting interpretations? [Clarity, Spec §FR-003, Plan §Constraints]
- [ ] CHK009 - Is the expected-version contract clear for individual and grouped mutations, including what constitutes stale intent? [Clarity, Spec §FR-007, Plan §Concurrency]
- [ ] CHK010 - Are optional lifecycle comments precisely defined for whitespace trimming, blank-only values, null representation, and maximum length? [Clarity, Spec §FR-006, Spec §Assumptions and Clarifications]
- [ ] CHK011 - Are “distinct icon,” “accessible list,” “recoverable map-unavailable state,” and “explicit reload” defined with observable, technology-independent outcomes? [Clarity, Spec §FR-001a, Spec §FR-007, Plan §Frontend boundaries]

## Requirement Consistency

- [ ] CHK012 - Do the consultation permissions in the user story, FR-002, plan authorization boundary, and UI permission guidance agree? [Consistency, Spec §User Stories & Testing, Spec §FR-002, Plan §Authorization]
- [ ] CHK013 - Do archive-blocking rules consistently distinguish planned or active discharge usage from reactivation and other lifecycle outcomes? [Consistency, Spec §FR-004, Plan §Bulk invariant]
- [ ] CHK014 - Do the individual stale-error contract and grouped stale-item contract clearly differ without creating contradictory retry expectations? [Consistency, Spec §FR-007, Plan §API and application boundaries]
- [ ] CHK015 - Are same-type uniqueness and cross-type same-name allowance expressed consistently in requirements, assumptions, and acceptance traceability? [Consistency, Spec §FR-003a, Plan §Constraints]
- [ ] CHK016 - Are the stated source-of-truth and API/UI ownership boundaries consistent with the constitution and the plan’s named slices? [Consistency, Constitution §V, Spec §FR-002, Plan §API and application boundaries]

## Acceptance Criteria Quality

- [ ] CHK017 - Can each acceptance scenario be objectively judged from a defined API, feature, integration, or browser seam? [Measurability, Spec §User Stories & Testing, Plan §Test strategy]
- [ ] CHK018 - Are successful and rejected mutations measurable through resource state, version, audit metadata, and unchanged-record expectations? [Acceptance Criteria, Spec §FR-003, Spec §FR-004, Spec §FR-006, Spec §FR-007]
- [ ] CHK019 - Are grouped results measurable per submitted resource, including changed versus unchanged outcomes and stable ordering? [Acceptance Criteria, Spec §FR-005a, Plan §Bulk invariant]
- [ ] CHK020 - Are the success criteria sufficiently specific to demonstrate authorization invariants and all acceptance criteria rather than merely claiming feature completion? [Measurability, Spec §SC-001, Spec §SC-002]

## Scenario Coverage

- [ ] CHK021 - Are primary, alternate, authorization-failure, validation-failure, duplicate-name, wrong-state, in-use, stale-version, and not-found scenarios represented across both resources? [Coverage, Spec §User Stories & Testing, Spec §Edge Cases, Plan §Test strategy]
- [ ] CHK022 - Are mixed eligible-and-blocked grouped actions defined as partial-success scenarios, including request ordering and per-resource reporting? [Coverage, Spec §FR-005a, Spec §Assumptions and Clarifications]
- [ ] CHK023 - Are empty, loading, network-error, validation-error, stale-detail, and map-unavailable workbench states explicitly covered as recoverable scenarios? [Coverage, Spec §Edge Cases, Plan §Frontend boundaries]
- [ ] CHK024 - Are observer/read-only and stale-workbench scenarios covered independently from authoritative service authorization? [Coverage, Spec §User Stories & Testing, Spec §FR-002]

## Edge Case Coverage

- [ ] CHK025 - Are malformed request-level grouped inputs, duplicate IDs, invalid versions, empty selections, and mixed resource types explicitly distinguished from per-resource blockers? [Edge Case, Spec §Assumptions and Clarifications, Plan §Domain and data model]
- [ ] CHK026 - Are concurrent edits, concurrent lifecycle changes, and the no-overwrite/no-version-change guarantees for rejected mutations specified? [Recovery, Spec §FR-007, Spec §Edge Cases]
- [ ] CHK027 - Are archive and reactivation identity/history guarantees defined for repeated, wrong-state, and partially blocked actions? [Edge Case, Spec §FR-004, Spec §FR-005a]
- [ ] CHK028 - Are boundary coordinates, case variants, blank names/comments, and maximum-length comments included in the written requirements? [Edge Case, Spec §FR-003, Spec §FR-003a, Spec §FR-006]

## Non-Functional Requirements

- [ ] CHK029 - Are accessibility requirements defined for non-map inspection, keyboard selection, screen-reader announcements, icon semantics, and non-color status communication? [Accessibility, Spec §FR-001a, Plan §Frontend boundaries]
- [ ] CHK030 - Are responsive containment and usable narrow-screen behavior stated as requirements with an objective review criterion? [Non-Functional, Plan §Test strategy, Plan §Risks and Rollout]
- [ ] CHK031 - Are SSR/hydration, WebGL/style/tile failure, attribution, and external map dependency expectations explicit without making the map the sole access path? [Resilience, Plan §Map integration, Plan §Risks and Rollout]
- [ ] CHK032 - Are security requirements explicit that API authorization is authoritative and that stale UI affordances cannot bypass it? [Security, Spec §User Stories & Testing, Constitution §VIII]

## Dependencies & Assumptions

- [ ] CHK033 - Is the temporary no-discharge usage checker and the GH-53 handoff described as an assumption with a clear condition for replacing it? [Dependency, Spec §Dependencies, Plan §Deferred integration]
- [ ] CHK034 - Are deployment coordination and rollback ordering for versioned mutation contracts and the additive migration documented as release requirements? [Dependency, Plan §Rollout, Plan §Rollback]
- [ ] CHK035 - Are the assumptions about existing Dock/Weighing Area behavior, named routes, and reusable workbench conventions validated or explicitly marked as baseline dependencies? [Assumption, Plan §Existing Baseline and Planned Delta]

## Ambiguities & Conflicts

- [ ] CHK036 - Is “every active application user” explicitly bounded by authentication/session validity and separated from inactive or unauthenticated users? [Ambiguity, Spec §FR-002]
- [ ] CHK037 - Is the precedence among missing, stale, wrong-state, and in-use grouped outcomes consistently defined and understandable to reviewers? [Ambiguity, Plan §Domain and data model, Plan §Risks and Rollout]
- [ ] CHK038 - Is the phrase “each action still records its actor and timestamp” unambiguous for grouped actions and for each successfully transitioned resource? [Ambiguity, Spec §FR-006, Spec §FR-005a]
- [ ] CHK039 - Is the distinction between “available-list” consultation and the workbench’s available/archived status filtering explicit enough to avoid inconsistent visibility requirements? [Ambiguity, Spec §FR-001a, Plan §Existing Baseline and Planned Delta]
