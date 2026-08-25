# Quickstart: Validate Reactivating a Transport Company

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

This slice adds **no migration** — `status`, `reactivated_at`, `reactivated_by_user_id`, and `reactivation_comment` already exist on `transport_companies`. Reseeding is only to get a known dataset for the browser flow. If `apps/api/database/schema.ts` changes after this command, something else is out of date; do not hand-edit it.

The seeded companies give you every browser case, and they compose into a single mixed bulk selection:

| Company | Seeded state | Expected |
|---|---|---|
| *Loire Vrac Transport* | archived, with actor and comment | reactivates successfully |
| *Noroît Logistique* | archived, `archivedByUserId: null` | reactivates successfully; the missing archival actor is tolerated, not repaired |
| *Estuaire Bennes* | available, carrying a previous archive **and** reactivation context | blocked: already available; also proves a second reactivation replaces rather than accumulates |
| *Grand Ouest Camions*, *Atlantique Transport Routier*, *Armor Fret Services* | available | blocked: already available |

The two archived companies are what make a genuine multi-company bulk selection demonstrable without touching `TRUCK_FIXTURES`; see [research.md](./research.md) Decision 11.

Authoritative field rules and the eligibility rule are defined in [data-model.md](./data-model.md); request and response shapes are defined in [contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification — single reactivation

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/transport_companies/lifecycle/reactivate.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/transport_companies/lifecycle/reactivate.spec.ts
```

Expected outcomes:

- An unauthenticated request is refused with `401` and changes nothing.
- An active observer is refused with `403` and changes nothing; a non-active user is refused by the auth middleware.
- Both administration roles reactivate an archived company and receive the complete record, with `reactivatedBy` populated.
- The response preserves `id`, `name`, and `createdAt`, and sets `status`, `reactivatedAt`, `reactivatedByUserId`, and `updatedAt` to consistent values.
- The archive triple is returned **unchanged**; reactivation does not clear it.
- A company whose `archivedByUserId` is `null` reactivates successfully and returns `archivedBy: null`.
- A company that provides no truck at all reactivates successfully.
- A company that provides only archived trucks reactivates successfully, and **no truck changes lifecycle state**.
- An archived company that provides available trucks reactivates successfully: there is no truck-related refusal on this endpoint. That state cannot be produced by archiving — the archival rule refuses it — so the test builds it directly with the company and truck factories, which is the point: the reactivation path must not care how the row got there.
- An already available company is refused with `409 E_TRANSPORT_COMPANY_ALREADY_AVAILABLE` and its existing `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment` are unchanged.
- An unknown id is refused with `404 E_TRANSPORT_COMPANY_NOT_FOUND`.
- An empty body reactivates with `reactivationComment: null`; a whitespace-only comment also stores `null`; a comment with surrounding whitespace is stored trimmed.
- A company that already carried a reactivation comment and is reactivated again with no comment ends with `reactivationComment: null` — the triple is replaced, not merged.
- A 1,000-character comment is accepted; 1,001 characters is refused with `422` and the company stays `ARCHIVED`.
- Reactivating, archiving, and reactivating the same company again leaves exactly one archive triple and one reactivation triple, both from the most recent transitions.
- **Name reservation**: with a company archived, creating another company with the same name is refused, and the archived company still reactivates successfully afterwards ([research.md](./research.md) Decision 4).

## 3. Run focused API verification — bulk reactivation

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/transport_companies/lifecycle/bulk/reactivate.spec.ts
pnpm --filter @portflow/api test unit \
  --files=tests/unit/transport_companies/lifecycle/bulk/blockers.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/transport_companies/lifecycle/bulk/reactivate.spec.ts
```

Expected outcomes:

- An unauthenticated request is refused with `401`; an active observer with `403`. Neither changes anything.
- A selection of archived companies reactivates all of them, and `updatedCompanies` carries one identical `reactivatedAt`, `reactivatedByUserId`, and `reactivationComment` across every entry.
- A mixed selection reactivates exactly the archived companies and reports the others in `blockedCompanies` with `ALREADY_AVAILABLE` or `NOT_FOUND` as appropriate.
- No blocker on this endpoint is ever `ALREADY_ARCHIVED` or `HAS_AVAILABLE_TRUCKS`, and a company providing available trucks in the selection is reactivated rather than blocked.
- `updatedCompanies` and `blockedCompanies` partition the requested ids exactly — every requested id appears once, in one collection, and no other id appears.
- Both collections preserve the requested order.
- A `NOT_FOUND` blocker omits `name`; the response never discloses data for an unknown id.
- A selection in which every company is blocked returns `200` with an empty `updatedCompanies` and no company changed.
- Blocked companies, their lifecycle context, and their trucks are byte-for-byte unchanged after the request.
- An empty `ids`, a non-UUID id, and a duplicated id are each refused with `422`, and **no** company in the request is reactivated — including the eligible ones.
- A 1,001-character comment is refused with `422` and nothing is reactivated.
- Reactivating a selection that overlaps a concurrently reactivated company reports it as `ALREADY_AVAILABLE` while its eligible neighbours are still reactivated, and only one reactivation context exists for it.
- The bulk write issues **no** query against `trucks`.
- `blockers.spec.ts` covers `findBulkBlockers` for both expectations: with `'AVAILABLE'` it still produces the three archival reasons in the delivered order, and with `'ARCHIVED'` it produces only `NOT_FOUND` and `ALREADY_AVAILABLE`, ignoring any truck set it is handed.

Then confirm the coupling to the delivered endpoints, in the same integration suite:

```bash
pnpm --filter @portflow/api test integration --files=tests/integration/transport_companies
```

- Reactivated companies appear in `GET /transport-companies` with both lifecycle contexts.
- They appear again in `GET /transport-companies/available`.
- `PATCH /transport-companies/:id` on one of them now succeeds where it previously returned `409 E_TRANSPORT_COMPANY_ARCHIVED`.
- `POST /trucks` naming one of them as provider now succeeds where it previously returned `422 E_TRUCK_TRANSPORT_COMPANY_INVALID`.
- `POST /transport-companies/:id/archive` on a reactivated company works again, subject to its own available-truck rule.
- The delivered archive suites still pass unchanged after the blockers module is generalised.

## 4. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run src/features/transport-companies src/features/transport-resources
```

Expected outcomes — single reactivation:

- **Reactivate company** appears only for an administrator viewing an archived company.
- An observer sees no reactivate affordance anywhere.
- An administrator viewing an available company sees **Edit company** and **Archive company**, and no reactivate affordance.
- An administrator viewing an archived company sees **Reactivate company** and **no Edit affordance**, and a hand-typed `companyDetailsMode=edit` on it still opens no form.
- Confirming opens a dialog that states the company becomes selectable again for new operational use, and offers an optional comment capped at 1,000 characters.
- Cancelling the dialog leaves the company unchanged and sends no request.
- A successful reactivation shows a confirmation, the directory switches to the **Available** tab with the company present and the available count incremented, and the open details panel shows the available status with the reactivation time, actor, and comment.
- A `409` already-available response and a retryable failure each surface distinctly, and the administrator can retry without reopening the company.

Expected outcomes — bulk reactivation:

- Selection checkboxes and the toolbar now appear for an administrator on **both** lifecycle tabs, and the toolbar's action reflects the active tab: **Archive selected** on Available, **Reactivate selected** on Archived.
- An observer's directory is unchanged on both tabs — no checkboxes, no toolbar.
- Selecting a row's checkbox does not change which company scopes the trucks panel, and selecting a company to scope its trucks does not change the lifecycle selection.
- Confirming opens a dialog with the same optional comment, and cancelling leaves every company unchanged.
- A fully successful bulk reactivation reports how many companies were reactivated, and they leave the Archived tab.
- A partially blocked bulk reactivation reports both counts, lists each blocked company with a readable reason — including **already available** — and leaves the selection reduced to exactly the blocked companies.
- An all-blocked bulk reactivation says plainly that nothing changed and still lists every reason.
- Changing the lifecycle tab clears the selection, in both directions.
- The delivered archive tests still pass unchanged, and the existing consultation, creation, and update tests still pass: lifecycle tabs, counts, search, ordering, details, edit mode, empty, and retry behavior are unaffected.

## 5. Run repository verification

```bash
pnpm check
pnpm typecheck
pnpm test
```

All commands must pass before the PR is marked ready. Because no Playwright suite is configured, also complete the affected browser flow below.

## 6. Exercise the affected browser flow

```bash
pnpm dev
```

Validate in a desktop viewport and a narrow mobile viewport.

**Single reactivation**

1. Sign in as an operations administrator and open **Site references → Transport resources**.
2. Switch to the **Archived** tab and open *Loire Vrac Transport*. Confirm the details show the archive context, that **Reactivate company** is offered, and that **Edit company** is not.
3. Open the reactivate dialog. Confirm it explains that the company becomes selectable again, and that the comment is optional.
4. Cancel. Confirm the company is unchanged and still in the Archived tab.
5. Reactivate it with a comment. Confirm the confirmation appears, the directory moves to the **Available** tab with the company listed, the Archived count drops by one, and the details panel now shows **Available**, the reactivation time, your name, and your comment.
6. Confirm the company's name and creation date are unchanged.
7. Confirm **Edit company** and **Archive company** are now offered on it, and that renaming it works.
8. Start creating a truck and confirm the company is offered again as a provider.
9. Confirm its previously existing trucks are unchanged — an archived truck of that company is still archived.
10. Open *Estuaire Bennes* (available, previously reactivated) and confirm no reactivate affordance is offered.
11. Open *Noroît Logistique* on the Archived tab and reactivate it. Confirm it succeeds even though its archival records no actor, and that the panel renders the missing actor gracefully.
12. Paste a comment longer than 1,000 characters and confirm it is refused before anything changes.

**Bulk reactivation** — reseed with `pnpm --filter @portflow/api db:fresh` first, so both companies are archived again.

13. On the **Archived** tab, confirm each row now carries a selection checkbox and that the toolbar offers **Reactivate selected**.
14. Select *Loire Vrac Transport* and *Noroît Logistique*. Confirm the toolbar reports 2 selected.
15. Click a row's body (not its checkbox) to scope the trucks panel. Confirm the selection count is unchanged.
16. Open the bulk dialog and cancel. Confirm nothing changed and the selection is preserved.
17. Reactivate the selection with a comment. Confirm the outcome reports 2 reactivated, both leave the Archived tab, and both appear on the Available tab sharing one identical reactivation time, actor, and comment.
18. Reseed, then reproduce a partially blocked outcome: on the **Archived** tab select both companies, and — before confirming — reactivate one of them from its details panel in a second browser tab. Confirm the outcome reports 1 reactivated and 1 unchanged, names the blocked company with **already available**, and reduces the selection to exactly it.
19. Press the action again on that reduced selection. Confirm the same reason is reported and nothing changes. This is expected: no reactivation blocker is recoverable ([research.md](./research.md) Decision 10). Note also that the blocked company is no longer listed on the Archived tab it left, so the reduced selection refers to a row that is not visible — the toolbar count and the reasons in the outcome are what the administrator reads, and clearing the selection is the sensible next action.
    `NOT_FOUND` is not reachable through the interface, since site references are never deleted; it is covered by the automated suites only.
20. Switch to the **Available** tab. Confirm the selection is cleared and that the toolbar there offers **Archive selected**, not reactivate.
21. Sign in as an observer and confirm every company is readable on both tabs with no lifecycle affordance, no checkboxes, and no selection toolbar anywhere.

Finally, repeat both API access checks with an unauthenticated session and a non-active user; both must be refused before any company is modified.
