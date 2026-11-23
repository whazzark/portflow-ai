# Contract: `dockOccupations` on the discharge detail

Applies to every response carrying the discharge detail DTO (`DischargeDetailTransformer`):

- `GET /discharges/:id` (`discharges.show`)
- `POST /discharges` (`discharges.store`)
- `PATCH /discharges/:id` (`discharges.update`)
- `POST /discharges/:id/start` (`discharges.start`)
- every product lot, truck pool, warehouse door, and shift mutation that answers with the detail

Authorization is unchanged: whoever may receive the detail receives this field. It discloses only
what `GET /discharges` already discloses to every active user (vessel name, status, dock, expected
start), plus the planned span of the other discharge's shifts.

## Shape (added field)

```jsonc
{
  "data": {
    // ...existing detail fields...
    "dockOccupations": [
      {
        "dischargeId": "0b9f…",
        "vesselName": "MV Ocean Cedar",
        "status": "ACTIVE",               // "PLANNED" | "ACTIVE"
        "expectedStartAt": "2026-10-21T06:00:00.000Z",
        "startedAt": "2026-10-21T06:12:00.000Z", // null when PLANNED
        "plannedStartAt": "2026-10-21T06:00:00.000Z", // null when the discharge has no shift
        "plannedEndAt": "2026-10-23T18:00:00.000Z"    // null when the discharge has no shift
      }
    ]
  }
}
```

## Rules

1. Contains the PLANNED and ACTIVE discharges whose `dock_id` equals this discharge's, excluding this
   discharge; never CLOSED ones.
2. Empty (`[]`) when the discharge read is ACTIVE or CLOSED.
3. Ordered ACTIVE first, then by `coalesce(plannedStartAt, expectedStartAt)` ascending, then
   `dischargeId` ascending — stable between two reads.
4. `plannedStartAt` / `plannedEndAt` are the min / max over all of that discharge's shifts, whatever
   their status.
5. Instants are ISO-8601 UTC strings, as every other instant of the detail.

## Integration test scenarios (`tests/integration/discharges/consultation/show.spec.ts`)

- planned discharge on a dock held by an active discharge and shared with another planned one →
  both listed, active first, with their periods;
- other discharge without shifts → `plannedStartAt`/`plannedEndAt` null;
- closed discharge on the same dock → absent;
- discharge on another dock → absent;
- active or closed discharge read → `dockOccupations: []`;
- unauthenticated / inactive access → unchanged refusals (no field disclosed).
