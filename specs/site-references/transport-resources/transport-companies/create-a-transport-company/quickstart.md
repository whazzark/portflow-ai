# Quickstart: Validate Creating a Transport Company

## Prerequisites

- Node.js compatible with the repository toolchain
- PNPM 10.28.1
- Repository dependencies installed with `pnpm install`
- API and web environment files configured from their checked-in examples
- PostgreSQL available for the manual browser flow; automated API tests use in-memory SQLite

## 1. Prepare the dataset

```bash
pnpm --filter @portflow/api db:fresh
```

This slice adds **no migration**. The command is still worth running because it re-seeds the fixtures and re-applies the `transport_companies_name_unique` index delivered by #219 — the constraint this feature depends on. If it fails, the index is not in place and none of the duplicate expectations below can hold.

Authoritative field rules and the write boundary are defined in [data-model.md](./data-model.md); request and response shapes are defined in [contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/transport_companies/administration/create.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/transport_companies/administration/create.spec.ts
```

Expected outcomes:

- An unauthenticated request is refused with `401` and creates nothing.
- An active observer is refused with `403` and creates nothing.
- Both administration roles create a company and receive `201` with the complete record.
- The created record has a fresh unique `id`, `status` `AVAILABLE`, null archive and reactivation fields, and `updatedAt` equal to `createdAt`.
- A name with surrounding whitespace is stored trimmed; submitted casing is preserved.
- A missing `name`, a blank name, a whitespace-only name, and a 256-character name are each refused with `422`, and the record count is unchanged.
- A 255-character name is accepted.
- A name already used by an **available** company is refused with `409 E_TRANSPORT_COMPANY_NAME_CONFLICT`.
- A name already used by an **archived** company is refused with the same `409`.
- A name differing from an existing one only by letter case or surrounding whitespace is refused with the same `409`.
- Two creations of the same name attempted back to back produce exactly one company and one `409`.
- The created company owns no truck, and no existing company is modified by any of the above.
- The existing consultation and update specs still pass.

## 3. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run src/features/transport-companies
```

Expected outcomes:

- **Create transport company** appears in the directory only for an administrator.
- An observer sees no creation affordance, and `?companyDetailsMode=create` opens no form for them.
- The available-lifecycle empty state offers the creation action to an administrator and shows only its guidance to an observer.
- The create form opens in the sheet with an empty name field, without leaving the directory.
- A successful save shows a confirmation, closes into the new company's details in `view` mode, and the new company is present in the available list in its alphabetical position.
- A `422` response attaches a message to the name field; a `409` duplicate surfaces as distinct error feedback.
- After a refusal the administrator can correct the value and resubmit without reopening the create form, and only one company results.
- Cancelling creates nothing and returns the directory to its normal state.
- The existing consultation and update tests still pass: lifecycle tabs, counts, search, ordering, details, edit mode, empty, and retry behavior are unaffected.

## 4. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. Because no Playwright suite is configured, also complete the affected browser flow below.

## 5. Exercise the affected browser flow

```bash
pnpm dev
```

Validate in a desktop viewport and a narrow mobile viewport:

1. Sign in as an operations administrator and open **Site references → Transport resources**.
2. Confirm **Create transport company** is offered in the company directory. Open it and confirm the URL carries `companyDetailsMode=create` with no `companyDetailsId`.
3. Reload the page in create mode and confirm the empty form is restored from the URL.
4. Submit a unique name. Confirm the confirmation appears, the panel shows the new company's details, and the available list contains it in its correct alphabetical position with an **Available** status and no lifecycle context.
5. Confirm the truck panel offers the new company as a provider with no truck attached.
6. Create again and submit a blank name, then a 256-character name. Confirm each is refused on the field and nothing is created.
7. Submit a name copied from an existing available company, then one differing only by letter case, then one belonging to an archived company. Confirm all three are refused as duplicates and that the refusal does not name the colliding company.
8. Correct the value in place and resubmit; confirm it succeeds without reopening the form and that exactly one company was created.
9. Submit a name with leading and trailing spaces and confirm the stored value is trimmed while its casing is preserved.
10. Cancel an in-progress creation and confirm nothing was created and the directory is unchanged.
11. Archive nothing and confirm the **Archived** tab count is unchanged throughout.
12. Sign in as an observer and confirm the directory is readable with no creation affordance anywhere, including in an empty lifecycle state.

Finally, repeat the API access check with an unauthenticated session and a non-active user; both must be refused before any company is created.
