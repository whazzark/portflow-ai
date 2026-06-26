# Japa Test Conventions

This directory uses Japa with one `test.group(...)` per business capability or use case, and one `test(...)` per observable behavior.

Tests are reset before each group and each test through [bootstrap.ts](/Users/romain.petit/Documents/side-projects/portflow-ai/apps/api/tests/bootstrap.ts), so test order must improve readability only. No test should depend on a previous one.

## Unit tests

Unit tests live under `tests/unit` and should describe one use case or one domain behavior in narrative order:

1. happy path
2. valid business variations
3. invalid input or invalid command
4. forbidden business states
5. collisions, duplicates, or conflicts
6. regressions, rollback, or race conditions

Use the existing naming style:

- `allows ...`
- `creates ...`
- `updates ...`
- `normalizes ...`
- `rejects ...`
- `keeps ...`
- `rolls back ...`

Example:

```ts
test.group('Create customer use case', () => {
  test('normalizes the customer code and company name', async ({ assert }) => {})

  test('rejects duplicate customer code across archived records', async ({ assert }) => {})

  test('rejects duplicate customer company names across available records', async ({ assert }) => {})
})
```

Inside one unit test, keep the body in `Arrange -> Act -> Assert` order.

## Integration tests

Integration tests live under `tests/integration` and should describe the contract in request-flow order:

1. unauthenticated rejection
2. authenticated but unauthorized rejection
3. primary successful workflow
4. successful read or follow-up workflow
5. business conflicts and validation failures
6. archive, reactivation, or lifecycle transitions
7. regression-specific or edge workflows

This keeps the file readable as an access-and-behavior story:

- who cannot do it
- who can do it
- what succeeds next
- what the system refuses afterward

Do not move every `401`, `403`, or `422` to the end of the file by default. In this codebase, `401` and `403` usually belong near the action they protect, so the access contract stays attached to the endpoint behavior. `422` should also stay near the action when the validation rules are part of the important business contract.

Example:

```ts
test.group('Customers administration', () => {
  test('rejects unauthenticated customer creation requests', async ({ client }) => {})

  test('rejects users without the customer administration capability', async ({ client }) => {})

  test('organization admin can create, list, inspect, and update customers', async ({ assert, client }) => {})

  test('available customer selections exclude archived customers', async ({ assert, client }) => {})

  test('rejects archival when a planned discharge uses the customer', async ({ client }) => {})

  test('operations admin can archive an unused customer and remove it from available selections', async ({
    assert,
    client,
  }) => {})

  test('operations admin can reactivate the same archived customer identity', async ({ assert, client }) => {})
})
```

When a file covers several actions on the same resource, prefer grouping the tests in this order inside the single `test.group(...)`:

1. create
2. list
3. show
4. update
5. archive
6. reactivate

For each action, keep the local order:

1. unauthenticated rejection
2. unauthorized rejection
3. success
4. business conflict or validation failure

This means a `manage_*.spec.ts` file should usually read action by action, not as one block of successes followed by one block of `401`, `403`, or `422` tests at the end.

Exception: when a file documents one long workflow rather than several resource actions, it is acceptable to keep the dominant successful scenarios first, then the business conflicts, and then the transversal guard rails such as repeated `401`, `403`, or `422` cases.

## File naming

- Unit tests: `<capability>_use_case.spec.ts`
- Integration tests: `<capability>.spec.ts`

Keep the file name aligned with the dominant business capability described by the group title.
