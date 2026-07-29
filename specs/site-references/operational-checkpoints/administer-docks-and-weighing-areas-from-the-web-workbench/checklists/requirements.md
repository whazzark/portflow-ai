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

## API Contract Quality

- [ ] CHK040 - Are the request and response shapes for individual Dock and Weighing Area mutations explicit about `expectedVersion`, normalized values, audit metadata, and stale outcomes? [Completeness, Contracts §API, Spec §FR-003, Spec §FR-006, Spec §FR-007]
- [ ] CHK041 - Are grouped archive/reactivate request constraints, result discriminators, blocker reasons, and request-order guarantees specified consistently for both resource types? [Clarity, Contracts §API, Spec §FR-005, Spec §FR-005a]
- [ ] CHK042 - Are HTTP status and error-envelope requirements defined distinctly for authentication failure, authorization failure, malformed input, name conflict, stale version, wrong lifecycle state, and in-use resources? [Completeness, Contracts §API, Spec §User Stories & Testing, Plan §API and application boundaries]
- [ ] CHK043 - Can the written API requirements distinguish a request rejected before any grouped write from a valid grouped request that partially succeeds? [Measurability, Spec §Assumptions and Clarifications, Plan §Bulk invariant]

## Workbench Interaction Requirements

- [ ] CHK044 - Are URL-backed filter, search, visible-type, selection, and detail-state requirements defined sufficiently to preserve or reset state in each specified transition? [Clarity, Contracts §UI, Plan §Frontend boundaries]
- [ ] CHK045 - Are create/edit requirements explicit about whether each form field’s normalized value, validation message, and server-side conflict are presented in a consistent resource-aware way? [Completeness, Contracts §UI, Spec §FR-003, Spec §FR-003a]
- [ ] CHK046 - Are permission-derived affordances described as a presentation concern while the authoritative mutation authorization remains an API requirement? [Consistency, Contracts §UI, Spec §FR-002, Constitution §V]
- [ ] CHK047 - Are grouped-action confirmation, partial-result feedback, blocked-row retention, and explicit stale reload requirements defined without prescribing an implementation-specific component or framework? [Clarity, Spec §FR-005a, Spec §FR-007, Plan §Frontend boundaries]

## Recovery and Release Readiness

- [ ] CHK048 - Are recovery requirements defined for a failed map dependency, failed query, failed mutation, and stale detail state while retaining an accessible non-map representation? [Recovery, Plan §Map integration, Plan §Risks and Rollout]
- [ ] CHK049 - Are compatibility and rollback requirements explicit for existing rows receiving version `1`, old clients encountering versioned mutations, and reversal of the additive migration? [Recovery, Dependency, Plan §Persistence, Plan §Rollback]
- [ ] CHK050 - Does the traceability model connect each stated success criterion to one or more observable acceptance scenarios and named verification seams? [Traceability, Spec §SC-001, Spec §SC-002, Plan §Test strategy]

## Additional Contract Precision

- [ ] CHK051 - Are the two named resource contracts explicit about which list representations include archived records and which available-only representations are intended for future operational selection? [Clarity, Contracts §API, Spec §FR-001a]
- [ ] CHK052 - Are nullable lifecycle actor summaries, timestamps, comments, and version semantics defined consistently for creation, editing, archiving, reactivation, and unchanged blocked results? [Completeness, Contracts §API Resource DTOs, Spec §FR-006]
- [ ] CHK053 - Is the distinction between individual `404`/`409` mutation outcomes and grouped `200` per-item blocker outcomes documented well enough that reviewers can determine the expected result for every missing, wrong-state, stale, and in-use resource? [Consistency, Contracts §API Error behavior, Contracts §API Grouped results]
- [ ] CHK054 - Are the request-level grouped validation rules complete enough to establish atomic rejection before any resource transition, including empty input, duplicate identifiers, invalid identifiers, and invalid versions? [Acceptance Criteria, Contracts §API Grouped results, Spec §Assumptions and Clarifications]
- [ ] CHK055 - Are route-state transitions specified for changing visible resource type, lifecycle status, search text, selection, and detail mode, including which state is preserved and which state is cleared? [Completeness, Contracts §UI Route and state, Contracts §UI Administration flows]
- [ ] CHK056 - Is the requirement that details are sourced from the named list payload, rather than an additional read, stated with enough rationale and fallback behavior to cover stale, missing, or moved selected items? [Dependency, Contracts §API, Contracts §UI Workbench structure]
- [ ] CHK057 - Are grouped feedback requirements precise about ordering, naming fallback, changed-item deselection, blocked-item retention, stale-item reload gating, and dismissal of items no longer visible? [Clarity, Contracts §UI Mutation feedback and refresh, Spec §FR-005a]
- [ ] CHK058 - Are the four responsive viewport widths and non-map fallback requirements framed as reviewable outcomes for the complete workbench, including filters, list, detail sheet, dialogs, and selection toolbar? [Measurability, Contracts §UI Responsive and accessibility behavior, Plan §Test strategy]
