# Test repositories against an in-memory SQLite database instead of fakes

ADR 0013 introduced fake repository implementations so use cases could be tested without a database and so the `integration` suite could stay scoped to the HTTP contract without depending on infrastructure. That trade-off assumed a database was infrastructure to avoid in tests.

The test suite now runs migrations against an in-memory SQLite connection (`better-sqlite3`, `filename: ':memory:'`) instead of a provisioned Postgres instance. This removes the original reason for fakes: a real repository backed by SQLite is as fast and as free of external infrastructure as a fake, while also exercising the actual query and constraint behavior (unique, foreign key) that a fake would otherwise have to reimplement by hand and keep in sync.

Unit tests exercising use cases and the `integration` suite both run through the real Lucid repository implementations against the in-memory database. Fake repository implementations are no longer written; abstract repositories still exist to let use cases depend on domain-oriented persistence operations rather than a concrete Lucid class, per ADR 0013.

## Consequences

Repository conditional outcomes (`CHANGED`, `NOT_FOUND`, and similar) are proven against the real Lucid implementation, so there is only one implementation to keep correct instead of two kept in sync by hand. Tests that need a specific repository state prepare it through model factories against the real database rather than by registering objects into a fake. Primary keys generated at the database layer must be portable across Postgres and SQLite (see the `User` model's `selfAssignPrimaryKey` and `@beforeCreate` UUID generation), since migrations now run against both engines.
