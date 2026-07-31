# Quickstart: Validate Transport Company Consultation

## Prerequisites

- Node.js compatible with the repository toolchain
- PNPM 10.28.1
- Repository dependencies installed with `pnpm install`
- API and web environment files configured from their checked-in examples
- PostgreSQL available for the manual browser flow; automated API tests use in-memory SQLite

## 1. Prepare the development dataset

```bash
pnpm --filter @portflow/api db:fresh
```

Confirm the transport-company seeder creates representative available, archived, and previously reactivated records. The authoritative fields and lifecycle interpretation are defined in [data-model.md](./data-model.md); response shapes are defined in [contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/transport_companies/consultation/available.spec.ts \
  --files=tests/unit/transport_companies/consultation/list.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/transport_companies/consultation/available.spec.ts \
  --files=tests/integration/transport_companies/consultation/list.spec.ts
```

Expected outcomes:

- Unauthenticated and non-active users receive no company data.
- Every active role can list both lifecycle states.
- The complete collection is name-ordered and includes lifecycle actor summaries when present.
- The available-only endpoint excludes every archived company.
- Empty collections return successful empty arrays.
- A new request after a persisted lifecycle change returns the authoritative current state.

## 3. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run src/features/transport-companies
```

Expected outcomes:

- Available is selected by default and both lifecycle counts remain visible.
- Search is name-only, case-insensitive, trimmed, and scoped to the selected lifecycle.
- Whitespace-only search behaves as no search.
- Each lifecycle uses automatic ascending name order with UUID tie-breaking.
- Details expose full stable identity, name, status, and relevant archive or latest-reactivation context.
- Empty, no-match, loading, and retryable failure states are distinct.
- Retrying a failed request replaces stale data and recovers once the endpoint succeeds.
- The interface contains no create, edit, archive, reactivate, bulk, import, or synchronization actions.

## 4. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. Because no Playwright suite is currently configured, also complete the affected browser flow below.

## 5. Exercise the affected browser flow

Start both workspaces:

```bash
pnpm dev
```

Then validate in a desktop viewport and a narrow mobile viewport:

1. Sign in as an active observer and open **Site references → Transport resources**.
2. Confirm the aggregate overview appears by default with no company selected, available companies appear first, and both lifecycle tabs show unfiltered counts.
3. Search using mixed case and surrounding whitespace; confirm only matching names in the selected tab remain and the matching portion of each company name is highlighted.
4. Confirm each tab remains automatically ordered by company name, with same-name companies kept in stable UUID order and no list header or manual ordering control.
5. Select an available company and confirm its details replace the aggregate overview without leaving the page; verify UUID, current name, status, and latest reactivation context when present, then click the selected company again to return to the aggregate overview.
6. Open an archived company and confirm archive time, actor, and comment, including graceful unavailable values.
7. Confirm an archived company never appears in a control backed by `GET /api/v1/transport-companies/available`.
8. Confirm a zero-record tab is still selectable and differs from a non-empty tab with a no-match search.
9. Simulate or intercept a retrieval failure, use **Try again**, and confirm the recovered response replaces the stale collection.
10. Confirm no mutation control appears for the observer or an administrator in this slice.

Repeat the access check with an unauthenticated session and a non-active user; both must be denied before company data is exposed.
