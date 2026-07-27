# API Agent Instructions

## Architecture

- Organize domains as vertical workflow slices under `app/<domain>/<workflow>`.
- Keep workflow use cases, validators, exceptions, transformers, and queries inside their slice; shared domain helpers belong under `app/<domain>/shared`.
- Use cases own business decisions, business exceptions, transaction coordination, and explicit `<UseCase>Input` objects.
- Controllers own authentication, request validation, HTTP status, and response transformation.
- Policies own authorization. Repositories expose domain-oriented operations and own locks, transactions, and conditional writes.
- Use explicit typed outcomes for conditional mutations; never make repositories select HTTP-aware exceptions.
- Lucid models remain the application entities. New workflow tables require a migration, model, repository abstraction/implementation, and realistic factory when useful.

## HTTP and contracts

- Use static `Transformer.transform(resource)` and assign awaited resources to locals before transforming.
- Avoid `as never` for successful typed responses. Set non-200 status on `ctx.response`, then return the DTO body.
- Keep Tuyau response contracts stable and use named domain exceptions for public failures.
- Normalize input in use cases or domain helpers, not validators.

## Tests

- Unit tests cover domain behavior and state transitions; integration tests cover HTTP authentication, authorization, validation, response shape, and endpoint wiring.
- Organize tests by domain slice, not one directory per use case.
- Use factories for persisted scenarios. Follow RED → GREEN → REFACTOR.
- For each protected endpoint cover unauthenticated, unauthorized, main success, and endpoint-specific failures where applicable.

## Style

- Use uppercase enum members and airy function bodies.
- Add a blank line before a `return` after setup, decisions, or side effects, but not before a sole return.
