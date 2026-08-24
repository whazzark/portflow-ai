# Quickstart: Validate Archiving a Transport Company

**Last Updated**: 2026-08-24 — bulk archival added.

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

This slice adds **no migration** — `status`, `archived_at`, `archived_by_user_id`, and `archive_comment` already exist on `transport_companies`. Reseeding is only to get a known dataset for the browser flow. If `apps/api/database/schema.ts` changes after this command, something else is out of date; do not hand-edit it.

The seeded companies give you every browser case except one, and they compose into a single mixed bulk selection:

| Company | Trucks | Expected |
|---|---|---|
| *Grand Ouest Camions* (available) | none | archives successfully |
| *Atlantique Transport Routier* (available) | 1 available | blocked: still provides available trucks |
| *Armor Fret Services* (available) | 1 available | blocked, same reason |
| *Estuaire Bennes* (available, reactivated) | 1 available | blocked, same reason |
| *Loire Vrac Transport* | 1 archived | already archived |

The remaining rule — an available company whose trucks are **all archived** archives successfully — has no fixture and is proven by the automated suites, which build that state with `TruckFactory.apply('archived')`. It becomes manually reachable once truck archival (#225) ships; see [research.md](./research.md) Decision 10.

Authoritative field rules and the blocking rule are defined in [data-model.md](./data-model.md); request and response shapes are defined in [contracts/http-api.md](./contracts/http-api.md).

## 2. Run focused API verification — single archival

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/transport_companies/lifecycle/archive.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/transport_companies/lifecycle/archive.spec.ts
```

Expected outcomes:

- An unauthenticated request is refused with `401` and changes nothing.
- An active observer is refused with `403` and changes nothing; a non-active user is refused by the auth middleware.
- Both administration roles archive an eligible company and receive the complete archived record, with `archivedBy` populated.
- The response preserves `id`, `name`, and `createdAt`, and sets `status`, `archivedAt`, `archivedByUserId`, and `updatedAt`.
- A company with no trucks archives successfully.
- A company whose trucks are all archived archives successfully.
- A company with one available truck is refused with `409 E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS`; the company stays `AVAILABLE` and the truck is untouched.
- A company whose available truck is reserved by a planned or active discharge is refused for the same reason.
- An already-archived company is refused with `409 E_TRANSPORT_COMPANY_ALREADY_ARCHIVED` and its original `archivedAt`, `archivedByUserId`, and `archiveComment` are unchanged.
- An already-archived company that also has available trucks reports `ALREADY_ARCHIVED`, not the truck conflict.
- An unknown id is refused with `404 E_TRANSPORT_COMPANY_NOT_FOUND`.
- An empty body archives with `archiveComment: null`; a whitespace-only comment also stores `null`; a comment with surrounding whitespace is stored trimmed.
- A 1,000-character comment is accepted; 1,001 characters is refused with `422` and the company stays `AVAILABLE`.
- A company previously archived and reactivated keeps its reactivation context after being archived again, and its archive triple is replaced rather than duplicated.

## 3. Run focused API verification — bulk archival

```bash
pnpm --filter @portflow/api test unit \
  --files=tests/unit/transport_companies/lifecycle/bulk/archive.spec.ts
pnpm --filter @portflow/api test integration \
  --files=tests/integration/transport_companies/lifecycle/bulk/archive.spec.ts
```

Expected outcomes:

- An unauthenticated request is refused with `401`; an active observer with `403`. Neither changes anything.
- A selection of eligible companies archives all of them, and `updatedCompanies` carries one identical `archivedAt`, `archivedByUserId`, and `archiveComment` across every entry.
- A mixed selection archives exactly the eligible companies and reports the others in `blockedCompanies` with `HAS_AVAILABLE_TRUCKS`, `ALREADY_ARCHIVED`, or `NOT_FOUND` as appropriate.
- `updatedCompanies` and `blockedCompanies` partition the requested ids exactly — every requested id appears once, in one collection, and no other id appears.
- Both collections preserve the requested order.
- A `NOT_FOUND` blocker omits `name`; the response never discloses data for an unknown id.
- A selection in which every company is blocked returns `200` with an empty `updatedCompanies` and no company changed.
- Blocked companies, their lifecycle context, and their trucks are byte-for-byte unchanged after the request.
- An empty `ids`, a non-UUID id, and a duplicated id are each refused with `422`, and **no** company in the request is archived — including the eligible ones.
- A 1,001-character comment is refused with `422` and nothing is archived.
- Archiving a selection that overlaps a concurrently archived company reports it as `ALREADY_ARCHIVED` while its eligible neighbours are still archived, and only one archival context exists for it.
- The bulk write issues one truck-availability read for the whole selection, not one per company.

Then confirm the coupling to the delivered endpoints, in the same integration suite:

```bash
pnpm --filter @portflow/api test integration --files=tests/integration/transport_companies
```

- Archived companies still appear in `GET /transport-companies` with their archive context.
- They no longer appear in `GET /transport-companies/available`.
- `PATCH /transport-companies/:id` on one of them is refused with `409 E_TRANSPORT_COMPANY_ARCHIVED`.
- `POST /trucks` naming one of them as provider is refused with `422 E_TRUCK_TRANSPORT_COMPANY_INVALID`.
- Their existing trucks are still associated and still readable.

## 4. Run focused web verification

```bash
pnpm --dir apps/web exec vitest run src/features/transport-companies src/features/transport-resources
```

Expected outcomes — single archival:

- **Archive company** appears only for an administrator viewing an available company.
- An observer sees no archive affordance anywhere.
- An administrator viewing an archived company sees no archive affordance.
- Confirming opens a dialog that states the company stays readable but stops being selectable, and offers an optional comment capped at 1,000 characters.
- Cancelling the dialog leaves the company unchanged and sends no request.
- A successful archival shows a confirmation, the directory switches to the **Archived** tab with the company present and the available count decremented, and the open details panel shows the archived status with when, by whom, and the comment.
- A `409` truck conflict surfaces as distinct error feedback naming the blocker; the dialog stays usable and the company remains in the Available tab.
- A `409` already-archived response and a retryable failure each surface distinctly, and the administrator can retry without reopening the company.

Expected outcomes — bulk archival:

- Selection checkboxes appear only for an administrator, and only on the **Available** tab. An observer's directory is unchanged, and the Archived tab offers no selection.
- Selecting a row's checkbox does not change which company scopes the trucks panel, and selecting a company to scope its trucks does not change the archive selection.
- The selection toolbar appears once at least one company is selected, states how many are selected, and offers clearing the selection.
- Confirming opens a dialog with the same optional comment, and cancelling leaves every company unchanged.
- A fully successful bulk archival reports how many companies were archived, and the archived companies leave the Available tab.
- A partially blocked bulk archival reports both counts, lists each blocked company with a readable reason, and leaves the selection reduced to exactly the blocked companies so they can be retried in place.
- An all-blocked bulk archival says plainly that nothing changed and still lists every reason.
- Changing the lifecycle tab clears the selection.
- The existing consultation, creation, and update tests still pass: lifecycle tabs, counts, search, ordering, details, edit mode, empty, and retry behavior are unaffected.

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

**Single archival**

1. Sign in as an operations administrator and open **Site references → Transport resources**.
2. Select *Grand Ouest Camions* and open its details. Confirm both **Edit company** and **Archive company** are offered, and that the archive action reads as destructive.
3. Open the archive dialog. Confirm it explains that the company remains readable but stops being selectable, and that the comment is optional.
4. Cancel. Confirm the company is unchanged and still in the Available tab.
5. Archive it with a comment. Confirm the confirmation appears, the directory moves to the **Archived** tab with the company listed, the Available count drops by one, and the details panel now shows **Archived**, the archival time, your name, and your comment.
6. Confirm the company's name and creation date are unchanged.
7. Confirm no update affordance is offered on it any more, and that requesting `?companyDetailsId=<id>&companyDetailsMode=edit` for it opens no form.
8. Start creating a truck and confirm the archived company is not offered as a provider.
9. Select *Atlantique Transport Routier* and attempt to archive it. Confirm the refusal names the available trucks, the company stays available, and its truck is untouched.
10. Paste a comment longer than 1,000 characters and confirm it is refused before anything changes.
11. Open an already-archived company and confirm no archive affordance is offered.

**Bulk archival** — reseed with `pnpm --filter @portflow/api db:fresh` first, so *Grand Ouest Camions* is available again.

12. On the **Available** tab, confirm each row now carries a selection checkbox.
13. Select *Grand Ouest Camions*, *Atlantique Transport Routier*, and *Armor Fret Services*. Confirm the toolbar reports 3 selected.
14. Click a row's body (not its checkbox) to scope the trucks panel to that company. Confirm the selection count is unchanged.
15. Open the bulk dialog and cancel. Confirm nothing changed and the selection is preserved.
16. Archive the selection with a comment. Confirm the outcome reports 1 archived and 2 unchanged, names both blocked companies with the available-truck reason, and that the selection is now reduced to exactly those two.
17. Retry the blocked companies from the outcome without reselecting. Confirm they are blocked again for the same reason and that nothing changed.
18. Confirm *Grand Ouest Camions* is now in the **Archived** tab with your comment, and that the two blocked companies are untouched in the Available tab with their trucks intact.
19. Switch to the **Archived** tab. Confirm the selection is cleared and no checkboxes or bulk action are offered there.
20. Select a company, then archive it individually from its details panel while it is still part of the selection. Confirm the selection does not silently claim to have archived it twice.
21. Sign in as an observer and confirm every company is readable with no archive affordance, no checkboxes, and no selection toolbar anywhere.

Finally, repeat both API access checks with an unauthenticated session and a non-active user; both must be refused before any company is modified.
