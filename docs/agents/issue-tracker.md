# Issue tracker: GitHub Issues

GitHub Issues are the intake and coordination surface for Portflow. They carry the problem statement needed to start discovery, priority, milestone, parent/sub-issue relationships, and discussion history. The detailed functional contract lives in the linked Spec Kit artifact under `specs/`.

## Canonical ownership

- `specs/<roadmap-or-feature>/` owns detailed behavior, acceptance scenarios, assumptions, dependencies, and implementation artifacts.
- `CONTEXT.md` owns ubiquitous domain language.
- ADRs own durable architectural decisions.
- GitHub Project owns delivery status, priority, milestone, and sprint.
- Issues retain their stable number as the traceability anchor and link to the canonical spec or roadmap.

An issue body is a short tracking stub after migration. It must not become a second editable copy of the spec.

## Spec hierarchy

- An epic becomes `specs/<domain>/<epic-slug>/roadmap.md` and lists independently deliverable sub-specs.
- A child delivery issue becomes `specs/<domain>/<epic-slug>/<feature-slug>/spec.md`; standalone work uses `specs/standalone/<feature-slug>/spec.md`.
- Closed historical child issues are represented by `spec.md` artifacts marked `Done (historical)` and linked from their roadmap.
- A feature directory must contain the GitHub issue number in its metadata even when the path is organized by domain rather than issue number.

## Creating and updating work

The [Spec Kit operator guide](./spec-kit.md) is the canonical command reference.

1. Create or select the GitHub intake issue.
2. Assign priority and milestone in the Project.
3. Create or update the linked spec with `$speckit-specify` and `$speckit-clarify`.
4. Open a Draft PR once the spec is reviewable.
5. Move the Project item through Spec Review, Plan Review, Ready, In Progress, Review, and Done as gates pass.
6. Keep issue comments for product discussion; update the spec when a decision changes behavior.

When publishing a new issue from a generated task list, keep the issue short and link it to the relevant spec. Do not copy `tasks.md` into the issue body.

Administrative migration, validation, and cutover commands are documented centrally in the [Spec Kit operator guide](./spec-kit.md).
