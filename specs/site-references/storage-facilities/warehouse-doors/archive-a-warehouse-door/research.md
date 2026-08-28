# Phase 0 Research: Archive a Warehouse Door

> **Amended by [#216 Reactivate a Warehouse Door](../reactivate-a-warehouse-door/spec.md).** A door
> is archived *on its own* exactly while its containing warehouse is available, and nothing on the
> door records that: `warehouse_doors.archived_with_warehouse` is dropped, a later archival of the
> warehouse takes this door over, and the warehouse's reactivation brings it back. Where this
> document reasons about writing or reading that provenance, read `spec.md`'s amendment note
> instead. The text is kept as the delivery record of what was built at the time.

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No `NEEDS CLARIFICATION` marker survived `/speckit-specify` — the one material question (single
versus single-and-multiple) was answered before the spec was written and is recorded in its
Clarifications. This phase resolves design questions rather than product ones. Each decision below
is consumed by `data-model.md`, the contracts, or `quickstart.md`.

---

## R1 — Verb, routes, and payload shapes

**Decision**: two endpoints, mirroring the six delivered sibling archive slices exactly:

| Route | Body | Success |
|---|---|---|
| `POST /api/v1/warehouse-doors/archive` | `{ ids: uuid[], comment?: string \| null }` | `200 { data: { updatedDoors, blockedDoors } }` |
| `POST /api/v1/warehouse-doors/:id/archive` | `{ comment?: string \| null }` | `200 { data: WarehouseDoor }` |

The collection route is declared **before** `/:id/archive` in `start/routes.ts`, the ordering
`warehouses` and `docks` already carry.

**Rationale**: `POST /:id/archive` and `POST /archive` are the shape every site-reference lifecycle
transition uses (customers, transport companies, trucks, docks, weighing areas, warehouses). A
lifecycle transition is not a partial update of the resource, which is why none of them is a `PATCH`
on `/:id`, and this slice has no reason to be the first exception. Reusing the shape is also what
lets the shared bulk confirmation be wired with nothing but nouns (research R9).

The single response is the **bare door**, like docks and weighing areas, and unlike
`warehouses.archive`, which wraps the resource to report `archivedDoorCount`. A door archival
cascades onto nothing, so there is no second number to report and no envelope to justify.

**Alternatives considered**:

- **`PATCH /api/v1/warehouse-doors/:id` with `{ status: 'ARCHIVED' }`.** Rejected: it would make the
  lifecycle addressable from the update payload, which #214 FR-003 explicitly forbids, and would
  leave nowhere natural for the archive comment.
- **One endpoint taking an array of one.** Rejected: every sibling keeps the single path distinct
  because its refusals are exceptions (409/404) an administrator sees as one message, while the bulk
  path reports blockers *per record* in a 200. Collapsing them would force the single path to
  swallow its own refusal into a blocker list.
- **Scoping the bulk route under the warehouse (`POST /api/v1/warehouses/:id/doors/archive`).**
  Rejected: it would encode the UI's single-warehouse selection rule into the API, where it is not a
  domain rule. Each door carries its own containing warehouse, so the flat collection route applies
  one rule set to any submission (spec FR-031) and stays the shape every sibling already speaks.

---

## R2 — Where eligibility and usage are decided

**Decision**: both the lifecycle guards and the usage query run **inside the repository's write
transaction**, on the single path as well as the bulk one — the shape
`LucidWarehouseRepository.archiveAvailable` / `archiveAvailableMany` uses. The use cases hold no
pre-check: they translate repository outcome kinds into exceptions, exactly as
`UpdateWarehouseDoorUseCase` already does.

**Rationale**: a door archival has to serialize against **warehouse archival's cascade** (#210),
which archives every available door of a warehouse in one transaction. A pre-flight check in the use
case would leave a window in which the cascade commits between the check and the write — and the
outcome would be a door archived twice, the second write silently overwriting the archive time,
actor, comment, and the `archived_with_warehouse` provenance the reactivation of the warehouse
depends on. Spec FR-024 and FR-009 require exactly-once and submission-time assessment; the only
place both hold is inside the transaction that takes the warehouse lock.

The same transaction already has to read the containing warehouse (FR-005), so the usage query costs
one more statement in a transaction that was opening regardless.

**Alternatives considered**:

- **`ArchiveDockUseCase`'s split** — `findById`, status check, usage check, then `archiveAvailable`.
  Rejected here: a dock has no cascading parent, so its lost race merely fails to archive, while a
  door's lost race corrupts recorded lifecycle context. `LucidWarehouseRepository` already records
  this exact reasoning for the cascade side and is the newer precedent on this map.
- **Keeping the usage *rule* in the use case by passing a `usedIds` set into the repository.**
  Rejected: the set would have to be computed before the lock to be passed in, which is the race
  above. The rule itself is not restated in the repository — it calls the shared
  `SiteReferenceUsageChecker.findUsedByPlannedOrActiveDischarge({ referenceType: 'WAREHOUSE_DOOR' })`
  (`#240` FR-006), so there is still exactly one definition of door usage in the codebase
  (spec FR-007). Recorded as a boundary note in the plan's Complexity Tracking.

---

## R3 — Lock order, and the pre-read that finds the warehouses

**Decision**: **warehouses first, ordered by id; then doors, ordered by id.** Both paths open with an
unlocked pre-read of the submitted door ids to learn which warehouses to lock:

- single: `WarehouseDoor.find(id)` → `NOT_FOUND` when it resolves to nothing, otherwise its
  `warehouse_id`;
- bulk: `WarehouseDoor.query().whereIn('id', ids)` → the distinct `warehouse_id` set.

Inside the transaction the warehouses are locked `forUpdate()` ordered by id, then the doors are
locked `forUpdate()` ordered by id, then the guarded `status = 'AVAILABLE'` update runs.

**Rationale**: every existing writer that touches both tables takes the warehouse first —
`LucidWarehouseDoorRepository.create` (#213), `updateAvailable` (#214), and #210's cascade, which
locks warehouses and then scans their doors `forUpdate`. Any other order deadlocks against the
cascade. Ordering within each table by id is the rule the delivered bulk paths already state, so two
overlapping submissions queue instead of deadlocking.

The unlocked pre-read is safe for the same reason #214's is: a door belongs **permanently** to one
warehouse (`CONTEXT.md`), so the `warehouse_id` it yields cannot go stale, and every decision that
depends on it is taken again under lock.

**Alternatives considered**:

- **Joining doors to warehouses in one locked read.** Rejected: `FOR UPDATE` over a join locks rows
  in the order the planner chooses, which is precisely the guarantee the fixed table order buys.
- **Skipping the warehouse lock and guarding only on the door's status.** Rejected: it reverses no
  order but removes the serialization against the cascade — the door guard alone cannot tell a
  concurrent cascade from an already-archived door, and FR-005's containing-warehouse rule would
  have no snapshot to read.

---

## R4 — Provenance: `archived_with_warehouse` is written, not defaulted

**Decision**: the archive write sets `archived_with_warehouse = false` **explicitly**, alongside
`status`, `archived_at`, `archived_by_user_id`, and `archive_comment`.

**Rationale**: the column describes *the archival that is current*, not the row's history. A door can
have been archived by a cascade (flag `true`), then reactivated with its warehouse — #211's
`applyReactivation` clears the flag — and be archived on its own afterwards. The value would already
be `false` in that sequence, but relying on that makes this slice's correctness depend on a clause
inside another slice's reactivation write. Writing it makes the invariant local: *whoever archives a
door states how it was archived* (spec FR-011). It is also what stops #211 from restoring a door
retired on its own (spec SC-008).

**Alternatives considered**:

- **Relying on the column default and on #211 clearing it.** Rejected as above: a silent dependency
  across two slices, provable only by a three-step sequence test.
- **Deriving the provenance instead of storing it** (e.g. "archived at the same instant as its
  warehouse"). Rejected: two independent archivals can share a timestamp, and #210 already chose the
  stored marker.

---

## R5 — What the archive response exposes

**Decision**: `WarehouseDoorTransformer` gains `archivedAt`, `archivedByUserId`, `archiveComment`,
and `archivedWithWarehouse`. Reactivation members stay out; they are #216's to add.

**Rationale**: the 200 from an archival is where the administrator's client observes what was
recorded. Without these members the response would state `status: 'ARCHIVED'` and nothing about the
archival — the one thing the request just wrote. `DockTransformer` and `WeighingAreaTransformer`
already expose their whole lifecycle context for this reason, and `WarehouseTransformer` already
embeds these four members on the doors it nests, so the shapes converge rather than diverge.

The addition is **additive** for the two existing consumers: `warehouse-doors.available` (#212) and
the 201 from `warehouse-doors.store` (#213) gain four members no current caller reads. The doors
embedded under `GET /api/v1/warehouses` are produced by `WarehouseTransformer` and are untouched, so
every #212 consultation test passes unchanged in substance.

**Alternatives considered**:

- **Leaving the transformer alone and returning `204 No Content`.** Rejected: it diverges from every
  sibling single-archive endpoint, and the integration tests would have to re-read the row through a
  second request to assert what was written.
- **Adding the reactivation members too, for symmetry.** Rejected: #216 has no delivered writer for
  them yet, and a member that is always `null` invites a client to render an empty "Reactivated by".

---

## R6 — Exceptions: what is reused, what is new

**Decision**: two new door exceptions, and two reuses.

| Condition | Exception | Status / code |
|---|---|---|
| Door id resolves to nothing (or is malformed) | `WarehouseDoorNotFoundException` *(exists, #214)* | 404 `E_WAREHOUSE_DOOR_NOT_FOUND` |
| Door is already archived | `WarehouseDoorAlreadyArchivedException` **(new)** | 409 `E_WAREHOUSE_DOOR_ALREADY_ARCHIVED` |
| Door holds a current product lot assignment in a planned or active discharge | `WarehouseDoorInUseException` **(new)** | 409 `E_WAREHOUSE_DOOR_IN_USE` |
| Containing warehouse is archived | `ArchivedWarehouseReadOnlyException` *(exists, #209)* | 409 `E_WAREHOUSE_ARCHIVED` |
| Containing warehouse resolves to nothing | `WarehouseNotFoundException` *(exists)* | 404 `E_WAREHOUSE_NOT_FOUND` |

The names and codes mirror `DockAlreadyArchivedException` / `DockInUseException` one-for-one.

`ArchivedWarehouseDoorReadOnlyException` (`E_WAREHOUSE_DOOR_ARCHIVED`, "Reactivate the door first")
is **not** reused for an archive attempt: its guidance is right for an *update* of an archived door
and wrong here, where the administrator asked for the state the door is already in. "Already
archived" is the accurate refusal, and it is the one every sibling reports.

**Order of checks**: the containing warehouse is evaluated **before** the door's own status, because
that is the order the transaction takes its locks (R3) and the order `create` and `updateAvailable`
already use. In practice `WAREHOUSE_ARCHIVED` is unreachable from the interface — the cascade means
an available door never sits under an archived warehouse — so the case exists as a defensive
guarantee for crafted requests (spec FR-005) rather than as a state a user can produce.

**Alternatives considered**:

- **A single `E_WAREHOUSE_DOOR_NOT_ARCHIVABLE` covering both new refusals.** Rejected: spec FR-023
  and SC-009 require distinct feedback per condition, and the bulk path needs the two reasons
  separated anyway.
- **Minting door-flavoured warehouse errors** (`E_WAREHOUSE_DOOR_WAREHOUSE_ARCHIVED`). Rejected for
  the reason `warehouse_door_exceptions.ts` already records: the failing fact belongs to the
  warehouse, and #213/#214 established the reuse.

---

## R7 — How a door selection starts, and what a marker click means

**Decision**: checking doors is **offered, never entered**. There is no mode and no new search-param
value: opening an available warehouse's Available doors as an administrator already puts a checkbox
on every available row, a `Select all` above the list — the `truck-list.tsx` layout — and the
checkable contract on every corresponding marker (a ring, `aria-pressed`, the `CheckpointMarker`
`checked` contract). A marker click **checks the door and highlights it in the same gesture**.

Because it is offered rather than entered, being offered must cost nothing: the warehouse polygons
stay selectable while no door is checked, and only a **non-empty** checked set suppresses them, so a
stray click cannot move the warehouse out from under a selection in progress. A creation or update
session withdraws the offer, and leaving that session starts from an empty set rather than restoring
the previous one (spec FR-041).

**Rationale**: doors are a map resource — an administrator condemns a physical door they can see —
so the map has to be a selection surface, which is what docks and weighing areas established and
what spec FR-042 requires. But the *mode* the three map slices carry exists to answer a question
doors do not raise: which of the things on screen is this gesture about. A door selection is already
scoped by the open warehouse and the open lifecycle view, so the mode would gate a decision that is
never ambiguous — a control to press before the gesture the administrator came to make.

A control in the map's control cluster is doubly wrong: that cluster is page-scoped, door selection
is meaningless without a selected warehouse, and `startSelecting()` for warehouses deliberately
**clears `warehouseId`**, closing the Doors panel. The Doors panel is where the door-scoped
affordances belong, and once they live there the header control adds nothing the checkbox does not.

The marker toggle is safe here in a way #214 rejected for a *click-to-place* gesture: that decision
turned on a map click having to mean "select this door" among sibling markers, and checking *and*
highlighting in one gesture keeps that meaning rather than replacing it — the row does the same.

**Alternatives considered**:

- **An explicit `selecting='doors'` mode** widening the existing param, entered from a `Select doors`
  header control. Rejected as above: a mode gate on an unambiguous gesture, plus a deep-linkable URL
  that would restore not a mode but a queue of ids the collection may no longer hold.
- **List checkboxes only, no map involvement** (the trucks/customers variant of the same model).
  Rejected: it is cheaper — no marker prop — but it makes the map a read-only witness of a decision
  taken in a list, on the one site reference whose identity is a physical location. Spec FR-042 names
  the three map slices as the model to follow.
- **Suppressing the polygons whenever checking is offered.** Rejected: the offer stands on every open
  available warehouse, so this leaves an administrator with an empty selection unable to click
  another warehouse at all — they would have to close the panel first.

---

## R8 — Selection shortcuts, and the conflict with the warehouse ones

**Decision**: `useSelectAllShortcut` and `useClearSelectionShortcut` stay bound to the **warehouse**
selection, untouched. Doors get no keyboard binding of their own; the panel's `Select all` checkbox
is the door equivalent.

**Rationale**: rebinding follows from a mode, and R7 removes the mode. With checking merely offered,
there is no state in which the page could say the keystroke is "about doors now" — it would have to
guess from what is checked, and one keystroke that means two things depending on invisible state is
worse than one that means one thing. The precedent is already in the codebase: the trucks and
customers directories select in a list with a `Select all` header and no binding of their own, and
FR-042's "same selection count and clearing" is met by the selection row's `N selected` and
`Clear selection`, which are the affordances the requirement names.

Leaving the warehouse bindings live is safe for the same reason the polygons stay clickable: they
act on the map's own selection, which the administrator can see, and entering it clears `warehouseId`
— an explicit, visible move, not a silent one.

**Alternatives considered**:

- **Rebinding the two hooks to doors while something is checked.** Rejected: the binding would flip
  under the administrator on the first checkbox, and flip back on the last uncheck.
- **A second pair of bindings on different keys.** Rejected: two clear-selection keystrokes on one
  page is a worse contract than one, and neither would be discoverable.

---

## R9 — Reusing the bulk confirmation, and what a partial outcome leaves checked

**Decision**: `BulkResourceLifecycleDialog` — the confirmation half of the shared component, split
from its floating toolbar — is used as it stands, with `singular: 'door'`, `plural: 'doors'`,
`idPrefix: 'warehouse-door'`, `action: 'archive'`, **no** `describeEffect` override and no
`blockerReasonLabels` *override*: the only entry passed is the added `WAREHOUSE_ARCHIVED` label,
which the shared four have no entry for at all. On success, the checked set is narrowed to the ids
blocked with `IN_USE`; every other blocker is dropped.

**Rationale**: the canonical bulk sentence — "N doors remain readable but are no longer available for
new operations" — is exactly true of doors, so unlike warehouses there is no cascade clause to
append. And the default blocker label, `used by an active or planned discharge`, is already right:
warehouses had to override it precisely because a warehouse is blocked by *a door*, whereas a door is
blocked by itself. Keeping the overrides absent is the evidence that the shared copy fits.

The *toolbar* half is what the panel does not reuse: `BulkResourceLifecycleActions` is the floating
map bar, and this selection lives in the Doors panel, where a bar hovering between the panel and the
map legend is the one place an administrator does not look (R7). What the panel therefore owns is the
toolbar's own trio, word for word — `N selected`, `Archive selected`, `Clear selection` — which is
what FR-042's "same selection count and clearing" asks for; only its home differs.

Narrowing to `IN_USE` on success is the warehouses precedent and the same reasoning: it is the one
blocker an administrator can resolve and retry (close the discharge, end the assignment), while
`NOT_FOUND` and `ALREADY_ARCHIVED` are final — and a door left checked after being archived elsewhere
would sit in an Available view that no longer lists it.

**Alternatives considered**:

- **`singular: 'warehouse door'`.** Rejected: the row would read "3 warehouse doors selected" inside
  a panel titled *Doors* under the warehouse's own name. The noun is unambiguous in context, and the
  row-level confirmation names the door itself.
- **Clearing the whole selection on success.** Rejected: it discards the retry path spec FR-039
  requires.

---

## R10 — The single-door confirmation, and the row menu that was left waiting

**Decision**: `WarehouseDoorRowActions` passes `actions: ['archive']` for an available door of an
available warehouse (and `[]` otherwise), with `renderDialog` mounting `ResourceLifecycleDialog`
against a new `features/warehouse-doors/warehouse-door-lifecycle.tsx` config. No shared component
changes.

**Rationale**: #214 adopted `ResourceRowActions` precisely so this slice would add a menu entry
rather than restructure the Doors panel, and shipped `actions: []` with no dialog. The component's
prop union already models both states — an empty tuple with no `renderDialog`, or a non-empty
`LifecycleAction[]` that requires one — so filling it is a type-level no-op. The dialog is built by a
callback, so a warehouse with fifty doors mounts no mutation observer per idle row.

The config mirrors `warehouse-lifecycle.tsx` with two members fewer: no `describeEffect` (nothing
cascades) and no `describeSuccess` (nothing extra to report). Row-level gating stays
`door.status === 'AVAILABLE' && warehouseStatus === 'AVAILABLE'`, which the row already computes for
`editable` — so an archived door's menu still renders **nothing at all** rather than a dead entry.

**Alternatives considered**:

- **An `Archive` button in the row, beside the name.** Rejected: it would put a destructive action
  one mis-click from the row's select gesture, and #214 already chose the menu as the container.
- **Archiving from a door detail pane.** Rejected: #212 FR-004a forbids a door detail view, and this
  slice does not lift it.

---

## R11 — What happens to the selection after a successful single archive

**Decision**: nothing is forced. The archived door leaves the Available view, the page's existing
"selected door is no longer admitted" effect clears `doorId`, and the administrator stays on the
warehouse with its Doors panel and an incremented Archived count. No tab switch, no re-selection.

**Rationale**: this is what a single warehouse archival already does one level up — the warehouse
leaves the Available filter and the sheet closes — and the effect that produces it is already
written and tested (`admittedDoor` undefined → `doorId` cleared with `replace: true`). Forcing
`doorStatus: 'archived'` to reveal the door would move the administrator to a view they did not ask
for, in the middle of a task that is often "archive these three doors", and the toast already
confirms the outcome.

**Alternatives considered**:

- **Switching to the Archived tab and keeping the door selected**, mirroring `handleDoorCreated`.
  Rejected: creation reveals a door that exists *nowhere else* and would otherwise be invisible;
  archival moves a door the administrator was already looking at into a view one click away.

---

## R12 — Bulk submissions that span warehouses

**Decision**: the API accepts any set of door ids and evaluates each door against **its own**
containing warehouse; it imposes no same-warehouse rule. The interface only ever builds a
single-warehouse selection, because the Doors panel shows one warehouse at a time.

**Rationale**: spec FR-031 requires the bulk path to apply the same rules as the single one and no
new rule of its own. A same-warehouse constraint would be a new rule, invented in the API to describe
a limitation of one screen. Locking stays safe because warehouses are locked as a set, ordered by id
(R3).

**Alternatives considered**:

- **Rejecting a cross-warehouse submission as invalid.** Rejected: it adds a refusal the spec does
  not describe, and a future screen — a door directory, a warehouse comparison — would have to
  either fight it or add a second endpoint.

---

## R13 — Test seams

**Decision**: the web tests reach the two new endpoints through the existing MSW handler module
(`features/warehouses/__tests__/support/handlers.ts`) and the existing warehouse-map mock, extended
with the door checkbox and marker-toggle seams. API coverage splits into
`tests/unit/warehouse_doors/lifecycle/{archive,bulk_archive}.spec.ts` and
`tests/integration/warehouse_doors/lifecycle/{archive,bulk_archive}.spec.ts`, the layout
`tests/unit/warehouses/lifecycle/` already uses.

**Rationale**: every seam this slice needs exists. The warehouse collection is what the panel reads,
so the door mutations invalidate `warehouseQueries.list()` exactly as #213 and #214 do, and the web
tests assert against the refreshed collection rather than against a mutation response — which is also
what makes the "no manual reload" requirement (FR-026) observable in a test.

**Alternatives considered**:

- **A dedicated door-list query to invalidate.** Rejected: #212 FR-003a's available-only collection
  is reserved for future discharge selectors and is not consumed by this UI.
