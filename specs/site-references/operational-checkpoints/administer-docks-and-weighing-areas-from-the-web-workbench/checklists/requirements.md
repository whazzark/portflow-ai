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

## Incremental requirements review

- [ ] CHK059 - Are the two resource types’ shared fields, lifecycle states, audit fields, and identity-preservation rules defined consistently enough to prevent accidental creation of a generic Checkpoint requirement? [Completeness, Consistency, Spec §FR-001, Spec §Out of Scope, Contracts §API Resource DTOs]
- [ ] CHK060 - Is the relationship between “all docks/weighing areas including archived” consultation and “available-only” operational selection explicit despite discharge preparation being out of scope? [Ambiguity, Spec §FR-001a, Spec §Assumptions and Clarifications, Plan §Out of scope]
- [ ] CHK061 - Are active-session semantics and the distinction between unauthenticated, inactive, observer, Organization Admin, and Operations Admin actors traceable across the user story, API contract, and UI affordance requirements? [Traceability, Spec §FR-002, Contracts §API Error behavior, Contracts §UI Workbench structure]
- [ ] CHK062 - Are normalization rules for names, coordinates, lifecycle comments, UUIDs, and versions stated once as authoritative requirements and applied consistently to create, edit, individual lifecycle, and grouped lifecycle inputs? [Consistency, Contracts §API Grouped results, Plan §Constraints]
- [ ] CHK063 - Are grouped-action transaction and outcome requirements clear about the boundary between request-level atomic rejection and resource-level partial success, including whether audit metadata is recorded only for transitioned resources? [Clarity, Acceptance Criteria, Spec §FR-005a, Plan §Bulk invariant]
- [ ] CHK064 - Are archive blockers defined against planned and active discharge references while the temporary no-discharge usage checker and GH-53 replacement condition remain explicit and reviewable? [Dependency, Spec §FR-004, Spec §Dependencies, Plan §Deferred integration]
- [ ] CHK065 - Are stale-version requirements precise for edits and lifecycle actions, including unchanged resource metadata, explicit reload, no automatic retry, and behavior when the selected resource is no longer visible? [Recovery, Contracts §API Error behavior, Contracts §UI Mutation feedback and refresh, Spec §FR-007]
- [ ] CHK066 - Are wrong-state, not-found, stale, and in-use outcomes distinguished consistently between individual HTTP errors and grouped blocker reasons, without leaving precedence or user-facing wording implicit? [Conflict, Contracts §API Grouped results, Contracts §API Error behavior]
- [ ] CHK067 - Are map dependency, tile/style failure, SSR/hydration, and accessible list fallback requirements bounded by observable service-availability and user-access criteria rather than implementation-specific MapLibre behavior? [Non-Functional, Clarity, Contracts §UI Responsive and accessibility behavior, Plan §Map integration]
- [ ] CHK068 - Do acceptance scenarios cover successful and rejected behavior for both Dock and Weighing Area paths, including same-name cross-type allowance and same-type case-insensitive conflicts? [Coverage, Spec §FR-003a, Spec §User Stories & Testing, Contracts §API Error behavior]
- [ ] CHK069 - Is every API and UI contract requirement connected to a functional requirement, acceptance scenario, or success criterion, with any intentional design-only detail identified as an assumption rather than an untestable obligation? [Traceability, Spec §Traceability, Spec §SC-001, Contracts §API, Contracts §UI]
- [ ] CHK070 - Are migration compatibility, existing-row version initialization, rollback, and old-client behavior documented as release requirements with an explicit owner and verification seam? [Completeness, Recovery, Plan §Persistence, Plan §Rollout, Plan §Rollback]

## Contract and Operational Precision

- [ ] CHK071 - Are the shared success and error envelopes, authentication scope, and version semantics stated consistently for every named Dock and Weighing Area endpoint? [Completeness, Contracts §API, Spec §FR-002, Spec §FR-007]
- [ ] CHK072 - Is the distinction between optional PATCH fields and the requirement for at least one editable field explicit for both resource types, including the behavior of an otherwise valid no-op update? [Clarity, Contracts §API Dock endpoints, Contracts §API Weighing Area endpoints]
- [ ] CHK073 - Are response-field nullability and actor-summary privacy requirements defined for lifecycle metadata, especially before the first archive/reactivation and when the actor is unavailable? [Completeness, Contracts §API Resource DTOs, Spec §FR-006]
- [ ] CHK074 - Are grouped result ordering requirements unambiguous about updated resources, blocked resources, and the relationship between the two arrays when the input interleaves outcomes? [Clarity, Contracts §API Grouped results, Spec §FR-005a]
- [ ] CHK075 - Is the grouped blocker vocabulary complete and consistently mapped to the individual mutation failure concepts, including the precedence of `NOT_FOUND`, `STALE_VERSION`, wrong-state, and `IN_USE`? [Consistency, Contracts §API Grouped results, Contracts §API Error behavior]
- [ ] CHK076 - Are request-level validation guarantees explicit enough to establish that malformed grouped input causes no resource transition, audit change, timestamp change, or version change? [Acceptance Criteria, Contracts §API Grouped results, Plan §Domain and data model]
- [ ] CHK077 - Are route registration and path-specificity requirements documented well enough to prevent grouped `/archive` and `/reactivate` actions from being interpreted as resource identifiers? [Dependency, Contracts §API, Plan §API and application boundaries]
- [ ] CHK078 - Does the UI contract define how invalid, unauthorized, or stale URL detail state is normalized while preserving safe searchable and filterable workbench state? [Recovery, Contracts §UI Route and state]
- [ ] CHK079 - Are mutation feedback requirements explicit about preserving user-entered comments after recoverable network or request-level failures while clearing unsafe stale edit/action state? [Consistency, Contracts §UI Administration flows, Contracts §UI Mutation feedback and refresh]
- [ ] CHK080 - Are cache invalidation and refresh requirements scoped consistently to the affected named resource while still ensuring grouped outcomes cannot leave stale available/archived counts or filters? [Clarity, Contracts §UI Mutation feedback and refresh, Plan §Frontend boundaries]
- [ ] CHK081 - Are the no-horizontal-overflow and operability criteria at 375, 768, 1024, and 1440 pixels defined for every stated workbench surface without making a specific layout implementation a hidden requirement? [Measurability, Contracts §UI Responsive and accessibility behavior, Plan §Risks and Rollout]
- [ ] CHK082 - Are external map attribution, unavailable-map fallback, and accessible list requirements explicit enough to preserve location meaning and resource-type distinction when tiles or WebGL are unavailable? [Non-Functional, Contracts §UI Workbench structure, Contracts §UI Responsive and accessibility behavior]
- [ ] CHK083 - Are deployment and rollback ownership boundaries explicit for the coupled versioned API/web contract, including the condition that migration reversal waits until no client sends versioned mutations? [Dependency, Plan §Risks and Rollout, Constitution §VIII]
- [ ] CHK084 - Does each API/UI contract detail that is not directly traceable to FR-001 through FR-007, an acceptance scenario, or SC-001/SC-002 have an explicit rationale or assumption rather than silently expanding the feature contract? [Traceability, Spec §Traceability, Plan §Acceptance Traceability]

## Final Requirements Quality Pass

- [ ] CHK085 - Are the primary consultation and administration journeys described separately enough that an active observer can use the workbench without receiving implicit mutation requirements? [Completeness, Spec §User Stories & Testing, Contracts §UI Workbench structure]
- [ ] CHK086 - Is the phrase “both Dock and Weighing Area” consistently scoped to parallel named resources, with no requirement implying a shared generic identity, endpoint, or lifecycle history? [Consistency, Spec §FR-001, Spec §Out of Scope, Data Model §Relationships and scope]
- [ ] CHK087 - Are the permitted edit fields and immutable identity/lifecycle fields explicitly distinguished for available and archived resources? [Clarity, Data Model §State transitions, Contracts §UI Administration flows]
- [ ] CHK088 - Are name-length, coordinate-finiteness, coordinate-boundary, and comment-length rules stated with enough precision to distinguish valid boundary values from malformed input? [Measurability, Data Model §Validation and authorization, Contracts §API Error behavior]
- [ ] CHK089 - Are duplicate-name requirements clear about normalization, resource-type scope, and whether an unchanged name during edit is allowed? [Ambiguity, Spec §FR-003a, Contracts §API Error behavior]
- [ ] CHK090 - Are audit-history requirements explicit about preserving prior opposite lifecycle metadata when a resource is reactivated or archived again? [Completeness, Data Model §State transitions, Spec §FR-006]
- [ ] CHK091 - Are version changes and timestamp changes specified consistently for successful create, update, archive, reactivation, rejected validation, rejected conflict, and blocked grouped outcomes? [Consistency, Data Model §Optimistic concurrency, Spec §FR-007]
- [ ] CHK092 - Does the specification define the expected visibility and selection consequences when a successful lifecycle transition moves a resource out of the current status/search scope? [Coverage, Contracts §UI Mutation feedback and refresh]
- [ ] CHK093 - Are grouped-action comments and per-resource audit records clearly defined when one request partially succeeds, including whether the same normalized comment applies to every transitioned resource? [Clarity, Spec §FR-005a, Spec §FR-006, Contracts §API Grouped results]
- [ ] CHK094 - Are grouped lifecycle results sufficiently discriminated for reviewers to determine whether a blocked item was absent, stale, in use, or already in the requested state? [Acceptance Criteria, Contracts §API Grouped results]
- [ ] CHK095 - Are request-order guarantees defined independently for mixed outcomes so that reviewers can identify the original item associated with every updated or blocked result? [Measurability, Plan §Bulk invariant, Contracts §API Grouped results]
- [ ] CHK096 - Are the requirements for a stale mutation explicit about which client state is unsafe to retain and which recoverable user input may remain available? [Recovery, Spec §FR-007, Contracts §UI Mutation feedback and refresh]
- [ ] CHK097 - Are authentication and authorization requirements stated for direct service access as well as workbench affordances, including inactive sessions and stale observer pages? [Security, Spec §FR-002, Contracts §API Error behavior]
- [ ] CHK098 - Are map, list, marker, sheet, dialog, and toolbar requirements mutually consistent when only one resource type is visible or when both types have simultaneous selections? [Consistency, Contracts §UI Workbench structure, Contracts §UI Administration flows]
- [ ] CHK099 - Are search and status-filter requirements precise about trimming, case folding, empty search, independent query state, and the scope of counts/results? [Clarity, Contracts §UI Route and state, Spec §FR-003b]
- [ ] CHK100 - Are accessibility requirements complete for conveying resource type, lifecycle state, location, selection, partial success, and blockers without relying on color, map position, or transient notifications alone? [Coverage, Contracts §UI Responsive and accessibility behavior, Spec §FR-001a]
- [ ] CHK101 - Are recoverable failures distinguished from unsafe retries for map availability, list retrieval, create/edit submission, lifecycle confirmation, and stale-version responses? [Recovery, Contracts §UI Mutation feedback and refresh, Plan §Risks and Rollout]
- [ ] CHK102 - Are external basemap attribution, remote-style failure, WebGL unavailability, and SSR/hydration constraints stated as user-visible requirements rather than only technology notes? [Non-Functional, Plan §Map integration, Contracts §UI Responsive and accessibility behavior]
- [ ] CHK103 - Are migration rollout, version-aware client adoption, and rollback preconditions assigned to an explicit release decision or owner? [Dependency, Plan §Rollout, Plan §Rollback, Constitution §VIII]
- [ ] CHK104 - Can every unresolved or intentionally deferred behavior be located in the spec’s clarifications, assumptions, out-of-scope section, or a named dependency without requiring inference from task wording? [Traceability, Spec §Clarifications, Spec §Dependencies, Spec §Out of Scope]

## Reviewer Readiness Pass

- [ ] CHK105 - Are the named API and UI contract documents explicitly included in the feature’s traceability surface so reviewers can locate the exact request, response, route-state, and accessibility requirements referenced by the plan? [Completeness, Contracts §API, Contracts §UI, Spec §Traceability]
- [ ] CHK106 - Does the specification distinguish the user-visible requirements for consulting archived resources from the separate future rule that archived resources cannot be selected for operational use? [Clarity, Spec §FR-001, Spec §Assumptions and Clarifications, Plan §Out of scope]
- [ ] CHK107 - Are grouped archive and reactivation comments, actor attribution, timestamps, and version changes defined per transitioned resource when one request contains both eligible and blocked items? [Completeness, Spec §FR-005a, Spec §FR-006, Plan §Bulk invariant]
- [ ] CHK108 - Are the requirements explicit about whether a successful edit of an available resource can change its search/filter visibility and how the workbench communicates that consequence? [Coverage, Spec §FR-003, Spec §FR-003b, Contracts §UI Mutation feedback and refresh]
- [ ] CHK109 - Can reviewers determine the required behavior when a selected list-backed detail item is deleted, archived, reactivated, or otherwise becomes absent from the current filtered result before a mutation is submitted? [Recovery, Spec §FR-007, Contracts §UI Route and state, Contracts §UI Mutation feedback and refresh]
- [ ] CHK110 - Are the API’s actor-summary fields bounded to the minimum privacy-safe data needed by the workbench, including behavior when lifecycle actors are unavailable or no lifecycle action has occurred? [Security, Completeness, Plan §API and application boundaries, Contracts §API Resource DTOs]
- [ ] CHK111 - Are map attribution and external basemap availability obligations assigned to an explicit dependency or operational owner rather than left only as implementation notes? [Dependency, Plan §Map integration, Plan §Risks and Rollout]
- [ ] CHK112 - Does the acceptance traceability identify an observable seam for migration backfill/rollback and for the no-discharge usage-checker handoff, rather than treating those as unverified plan details? [Traceability, Spec §SC-001, Plan §Test strategy, Plan §Deferred integration]
- [ ] CHK113 - Are the requirements for preserving entered form data separated clearly between recoverable validation/network failures and unsafe stale-version failures that require reload? [Consistency, Spec §FR-007, Contracts §UI Administration flows, Contracts §UI Mutation feedback and refresh]
- [ ] CHK114 - Is the absence of explicit dependencies in the spec reconciled with the plan’s MapCN/CARTO and GH-53 dependencies, including the condition under which each dependency blocks release? [Conflict, Spec §Dependencies, Plan §Map integration, Plan §Deferred integration]
