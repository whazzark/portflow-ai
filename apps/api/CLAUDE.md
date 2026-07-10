# API Agent Notes

## Application structure

- Organize each application domain as vertical workflow slices under `app/<domain>/<workflow>`.
- Keep workflow-specific use cases, validators, exceptions, transformers, and queries inside their workflow slice.
- Put code shared by multiple workflows of the same domain under `app/<domain>/shared`, grouped by technical family only when useful.

## Application responsibilities

- Name use case classes `<Verb><Entity>UseCase` and expose one public `handle` method.
- When a use case needs multiple values, define a named `<UseCase>Input` object and call `handle(input)` instead of using positional arguments.
- Pass request-specific and non-deterministic values such as the authenticated actor, timestamps, and generated context explicitly to use cases; do not read them from `HttpContext` inside application code.
- Keep authentication, request validation, authorization, HTTP statuses, and response transformation in controllers.
- Keep business decisions and business-exception selection in use cases. Validators only validate request shape, policies only decide authorization, and transformers only define exposed response data.
- Keep input normalization such as trimming, whitespace collapsing, or case normalization in use cases or domain helpers, not in validators, so the same behavior applies when the use case is invoked outside HTTP.
- For Vine validators, prefer `.create()` over `.compile()` when defining validators.
- When a requested entity does not exist, throw a dedicated `<Entity>NotFoundException` from the use case instead of returning `null` or `undefined` for the controller to handle.

## Repository boundaries

- Depend on abstract repositories from use cases and bind their Lucid implementations through the container.
- Name repository operations after domain intent instead of exposing a generic CRUD interface.
- Use dedicated input types for repository mutations with multiple values.
- Name use case request types `<UseCase>Input`, repository mutation types `<Operation>Command`, and conditional repository outcomes `<Operation>Result`.
- Keep `Input` and `Command` as distinct contracts even when their fields are currently equivalent, and map between them explicitly so the use case and repository interfaces can evolve independently.
- Let use cases coordinate transactions spanning multiple repositories or collaborators.
- Let a repository encapsulate the transaction, lock, and conditional write required to make one repository operation atomic under concurrency.
- Return an explicit typed outcome from a conditional mutation when failure can have more than one business meaning; do not use `null` to represent several distinct outcomes.
- Let the use case translate repository outcomes into dedicated business exceptions. Do not make repositories choose HTTP-aware or workflow-specific exceptions.
- Lucid models may serve as application entities in this codebase; do not introduce a parallel persistence-independent entity layer without a concrete need.
- For every new table that participates in application workflows, add an abstract repository and a Lucid repository implementation.
- See `apps/api/docs/adr/0013-use-case-and-repository-boundaries.md` for the architectural rationale.

## HTTP layer

- In controllers, use the transformer's static `transform(resource)` method instead of instantiating the transformer and calling `toObject()` directly.
- In controllers, assign the resource or collection to a local variable before passing it to `Transformer.transform(...)`; avoid inlining awaited use-case calls inside transformer arguments.
- Avoid `as never` for successful HTTP responses when a controller method returns a DTO for Tuyau inference.
- For non-200 success statuses, set the status on `ctx.response`, then return the typed DTO body.
- Example: use `ctx.response.status(201)` followed by `return dischargeDetailDto(discharge)` instead of `return ctx.response.created(dischargeDetailDto(discharge)) as never`.
- For `204 No Content`, prefer a `Promise<void>` action, call `ctx.response.status(204)`, then `return`.
- In transformers, prefer `this.pick(this.resource, [...])` over manually mapping resource properties.

## Authorization

- When a resource is exposed through an endpoint, add or update the corresponding policy when access depends on authorization rules.

## Schema and models

- When a new database table is needed, create a dedicated migration file for that table.
- For every new table, add the corresponding Lucid model.
- Store all API Lucid models in `app/models`; do not place models inside workflow slices.
- For every new Lucid model, add its factory when realistic test data will need to be created.
- Store all API factories in `database/factories`; do not place factories inside workflow slices.
- For every model property whose type is a finite union of literal values, declare an uppercase `as const` array in the associated model file and derive the property type from that array. Reuse the derived type instead of duplicating the union in application contracts. This rule does not apply to nullability unions such as `string | null` or `DateTime | null`.

## Tests

- Organize unit tests by domain slice only, for example `tests/unit/auth` or `tests/unit/users`; do not add a separate directory for each feature or use case.
- Cover use case business behavior in unit tests and the corresponding API endpoint contract in integration tests.
- Treat the `integration` suite as HTTP-level functional coverage: it boots the HTTP server and runs requests through the real Lucid repositories against the in-memory SQLite test database. Do not use integration tests to re-prove business behavior already covered by unit tests; keep them focused on the request/response contract.
- Order unit tests as: happy path, valid business variations, invalid input, forbidden business states, conflicts, then regressions or race conditions.
- When an integration file covers several resource actions, order the tests by action, for example `create -> list -> show -> update -> archive -> reactivate`.
- For one integration action, prefer the local order: unauthenticated rejection, unauthorized rejection, success, then endpoint-specific validation or business conflict.
- Keep `401` and `403` tests near the action they protect instead of moving them systematically to the end of the file.
- Keep `422` tests near the action when the validation rules are an important part of the endpoint contract.
- For workflow-oriented integration files, repeated guard-rail cases may be grouped later in the file when that improves readability.
- In unit and integration tests, use model factories whenever they are the most relevant way to prepare realistic test data.
- When implementing with TDD, proceed one observable behavior at a time: write a failing test, add the minimal implementation, then refactor while the tests are green.
- Keep integration tests focused on the API contract: happy path, authentication, authorization policies, request validation, response shape, and transformer exposure.
- Do not use integration tests to re-prove the full business behavior already covered by unit tests. In integration tests, assert only the minimum business state needed to prove the endpoint wiring and public contract, and leave detailed state-transition coverage, edge cases, rollback cases, and concurrency cases to unit tests.
- Standard business exceptions already carry their public HTTP contract through their own status, code, and message. Do not add an integration test only to verify that standard contract.
- Add an integration test for an error case only when the endpoint applies non-standard propagation, translation, or response shaping beyond the exception's built-in public contract.
- Before marking a backend feature as done, run a final delivery check:
  - does the route or entry point require authentication?
  - if yes, is there a test that rejects unauthenticated access?
  - if yes, is there a test that rejects an authenticated user without the required capability or role?
  - is there at least one test for the main business path?
  - are any endpoint-specific rejection behaviors covered when they differ from the standard exception contract?

## Coding style

- Prefer airy function bodies with clear visual separation between setup, decisions, and output.
- Write all enum members in uppercase.
- Add a blank line before a `return` statement when the function or method has setup, decisions, or side effects before the return.
- Do not add a blank line before `return` when the function body contains only that single return statement.
- Keep a consistent ordering by intent:
  - routes: group by resource, then order by URL shape: resource URL, resource URL with `:id`, then resource URL with `:id` and action; for the same URL, order by HTTP method
  - controllers: `read -> create -> update -> state transitions -> delete`
  - repositories: `create -> list/read -> update -> state transitions -> delete`
