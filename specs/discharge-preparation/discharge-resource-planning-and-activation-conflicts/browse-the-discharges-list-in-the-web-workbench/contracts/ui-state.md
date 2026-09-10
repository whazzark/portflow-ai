# Contract: Discharges Workbench UI State

The user-facing contract of the `/discharges` route: what the address carries, what each state
renders, and what the screen deliberately does not offer.

## Route

`/discharges`, under `_authenticated`, breadcrumb `Discharges`. Reached from the existing
`Operations → Discharges` sidebar entry, visible to every active role.

## URL state

Anything a user can be halfway through lives in the address, per `apps/web/AGENTS.md`.

| Parameter | Values | Default | Invalid input |
|---|---|---|---|
| `status` | `planned` \| `active` \| `closed` | `active` | Falls back to `active` (FR-014) — `.catch('active')` |
| `search` | any string | `''` | Falls back to `''` — `.catch('')` |

The route carries one resource, so no parameter is prefixed. There is deliberately **no**
`dischargeId` and **no** `mode`: rows are inert in this slice, so there is no open record to
restore and nothing for a `transform` to reconcile. GH-58 introduces `dischargeId`.

Typing in the search navigates with `replace: true`, so a search does not fill the history stack.
Switching status is a normal navigation and preserves the current `search` (FR-011).

## Rendered states

| State | Condition | What the user sees |
|---|---|---|
| Loading | Route loader in flight | Route-level pending component; never an empty table (FR-016) |
| Populated | Selected status has matches | Table of rows, ordered per FR-012 |
| Empty status | Selected status has no discharge at all | `Empty` with copy naming that status; no create action, since this slice creates nothing (FR-015) |
| No match | Status has discharges, search matches none | No-match copy that does not claim the status is empty (FR-015) |
| Error | Retrieval failed | Route-level error component with a retry action (FR-017) |

Empty and no-match are distinct copy, not one shared message — telling the two apart is the whole
point of FR-015 and User Story 4.

## Tabs and counts

Three tabs, `Planned`, `Active`, `Closed`, each with its count in the trigger, all three always
visible. Counts are the status totals and **do not change as the user types** (FR-005) — they are
derived from the loaded collection before the search filter, matching `trucks-page.tsx:248`. A
status with zero discharges keeps its tab selectable.

## Row

Each row shows: vessel name, vessel IMO (or a muted italic `Not specified`), dock name, expected
start via the shared `formatDateTime`, the distinct customers of the discharge's product lots, the
product-lot count, and the shift count. The status is deliberately absent: the selected tab already
says which status is listed.

The table scrolls inside its own container so the header stays visible, using the same
`[data-slot=table-container]` overrides as the users directory.

A row is inert (FR-024): no pointer cursor, no hover highlight, no checkbox, no row actions, no
click handler, and it is not a link or a button. This is a deliberate departure from every other
directory in the app, where a row opens a details `Sheet`. It is reversed by GH-58.

## Search

One `InputSearch` — never a hand-rolled input with an icon — placeholder naming what it matches.
Matching is case-insensitive, ignores surrounding whitespace, treats a whitespace-only query as no
search, and matches vessel name, vessel IMO, dock name, and any product lot's customer or product
name. A discharge matching through several lots appears once (FR-010).

## Out of this contract

No creation, edit, archive, or bulk action; no detail sheet; no column sorting chosen by the user;
no pagination; no export; no saved filters; no map.
