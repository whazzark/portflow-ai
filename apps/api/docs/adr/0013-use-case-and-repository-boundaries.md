# Separate business decisions from persistence guarantees

Use cases own workflow decisions, select business exceptions, and coordinate transactions that span multiple repositories or collaborators. Repositories expose domain-oriented persistence operations and own the transaction, locking, and conditional write needed to make one such operation atomic under concurrency. Conditional mutations return explicit typed outcomes when their failure has multiple meanings, allowing the use case to interpret the result without coupling persistence code to HTTP-aware or workflow-specific exceptions.

This refines ADR 0012: its rule that use cases own transaction boundaries applies to workflow-level transactions, while repositories may open an internal transaction to guarantee the atomicity of a single operation. Repositories should not raise business exceptions for conditional workflow outcomes; they may still raise infrastructure failures, while lookup methods may follow an explicitly documented not-found contract.

Lucid models may serve directly as application entities. A separate persistence-independent entity layer would add mapping and maintenance cost without a demonstrated domain need, and can be introduced later if persistence coupling becomes an actual constraint.

Use case request contracts use the `Input` suffix, while repository mutation contracts use `Command` and conditional repository outcomes use `Result`. Inputs and commands remain separate types even when they currently contain equivalent fields: this deliberate duplication keeps the application and repository interfaces independently evolvable and makes translation across the seam explicit.

## Consequences

Repository outcomes must distinguish states such as `CHANGED`, `NOT_FOUND`, `NOT_ACTIVE`, and `LAST_ORGANIZATION_ADMIN` instead of collapsing them into `null`. Fake and Lucid implementations must preserve the same outcome semantics. Use cases remain testable against fakes and are the single place where persistence outcomes acquire business meaning.
