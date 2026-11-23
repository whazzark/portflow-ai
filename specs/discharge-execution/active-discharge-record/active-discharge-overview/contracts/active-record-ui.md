# UI Contract: Active Discharge Record

The observable contract feature tests assert. Copy is the retained design's. Route unchanged:
`/discharges/$dischargeId?tab=overview|product-lots|truck-pool|shifts`.

## API contracts consumed

- `GET /api/v1/discharges/:id` (`discharges.show`) — unchanged.
- `GET /api/v1/discharges/dock-occupancy?dockId=` — defined by #323 in
  `specs/discharge-preparation/discharge-resource-planning-and-activation-conflicts/widen-the-creation-wizard-with-a-shift-preview/contracts/dock-occupancy.openapi.yaml`.
  Reused as is; implemented here to that contract only if it has not merged (research D2).

## Header (every tab, status `ACTIVE`)

| Element | Content |
|---------|---------|
| Heading (h1) | vessel name |
| Status badge | `Active` |
| Facts (`dl`) | `Dock` · `Period` (`dd/mm/yyyy, hh:mm → dd/mm/yyyy, hh:mm`) · `IMO` (or « Not specified ») · `Expected tonnage` |
| Actions | none (no Edit, no Start) |
| Tabs | `Overview`, `Product lots (n)`, `Truck pool (n)`, `Shifts (n)` |

## Overview (status `ACTIVE`), in order

1. **Vessel comment** — labelled block, only when the vessel has a comment.
2. **Current shift** card (`region` named « Current shift »):
   - Title « Current shift », badge `Active`, line `Shift i of n · <shift period> · <duration>`,
     link « Open in Shifts » (opens Shifts tab with that shift's panel).
   - Fields: `Responsible`; `Trucks (n)` registrations; `Warehouse doors (n)` names;
     `Weighing areas (n)` names; archived / ineligible markings as elsewhere.
   - Footer: `Next: <day> <hh:mm>–<hh:mm> · <responsible> · n trucks, n door(s), n weighing area(s)`
     or « No further shift planned ».
   - Between shifts: « No shift is active », `Last: <shift period>` when any, then the Next line;
     with neither, Add shift is offered to preparers.
3. **Dock timeline · <dock name>** (`region`): legend Completed / In progress / Planned; facts
   `Started <date>` · `planned until <date>`, `Dock`, `Shifts c of n completed`; day columns; one
   lane per discharge on the dock, this one first; Now line labelled `Now dd/mm hh:mm`. The Active
   Shift block is labelled « In progress » in its accessible name (not colour alone).
4. **Progress** card (`region`): subtitle « Read-only while active, except adding shifts »; rows
   Shifts / Product lots / Truck pool as in research D5, each with a link to its tab.

No « Overview » facts card and no Preparation card on an active discharge.

## Other tabs (status `ACTIVE`)

- Product lots, Truck pool: no correction action for any role.
- Shifts: `Add shift` for preparers only; the `ACTIVE` shift block carries the `Active` badge and
  its own border; Now line drawn.

## Not affected

Planned and closed records show neither the Current shift card nor the Progress card (FR-016).
